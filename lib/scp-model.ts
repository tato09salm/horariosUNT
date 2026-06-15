import { construirGruposBloques, asignarBloqueEstudiante, asignarGrupoContinuo, asignarUnidad, slotsUtiles, type BlockGroup, type BlockUnit, type AmbAvailMap, type Occupancy } from './csp-asignacion';
import { construirAmbAvail, diagnosticarFalloContinuo, diagnosticarFalloUnidad } from './csp-diagnostico';
import { DIAS_SEMANA } from './horario-utils';

export interface ScpResult {
  asignaciones: any[];
  conflictos: string[];
  conflictosDetalle: Array<{ descripcion: string; datos: object; sugerencia: string }>;
  stats: {
    asignados: number;
    total: number;
    prioridad_alta: number;
    prioridad_baja: number;
    bloques_continuos: number;
  };
  log: string[];
}

export type ScpOpciones = {
  practicaEnAula?: boolean;
  incluirSabado?: boolean;
  soloReintentar?: boolean;
  occInicial?: Occupancy;
  asignacionesIniciales?: any[];
  gruposPendientes?: BlockGroup[];
  unidadesPendientes?: BlockUnit[];
  totalUnidades?: number;
  logPrevio?: string[];
  restrictedIds?: string[];
};

function puntuarCandidato(meta: any, dia: string, slot: any, priorityPass: number, docAvail: Map<string, Map<string, number>>): number {
  let score = 0;

  // Prefer P1 over P2
  if (priorityPass === 1) score += 50;
  else score += 20;

  // Prefer slots before 13:00 (morning)
  const hora = parseInt(slot.hora_inicio || '0', 10);
  if (hora < 13) score += 10;

  // Nombrados + higher category = higher score (they should get prime slots)
  if (meta.condicion_orden === 0) score += 8;
  score += (4 - (meta.categoria_orden ?? 4)) * 3;

  // Docente availability preference
  if (meta.docente_id) {
    const disp = docAvail.get(meta.docente_id);
    if (disp) {
      const key = `${dia}-${slot.id}`;
      if (disp.has(key)) {
        if (disp.get(key) === 1) score += 25;
        else score += 10;
      }
    }
  }

  return score;
}

export async function resolverScp(
  programacion_id: string,
  cursos: any[],
  disponibilidad: any[],
  ambientes: any[],
  slots: any[],
  docentesProg: any[],
  opciones: ScpOpciones = {},
): Promise<ScpResult> {
  const debugLog: string[] = opciones.logPrevio ? [...opciones.logPrevio] : [];
  const conflictos: string[] = [];
  const conflictosDetalle: Array<{ descripcion: string; datos: object; sugerencia: string }> = [];

  const restrictedIds = opciones.restrictedIds ?? [];
  const util = slotsUtiles(slots, restrictedIds);

  // Build availability maps
  const docAvail = new Map<string, Map<string, number>>();
  for (const d of disponibilidad) {
    if (!docAvail.has(d.docente_id)) docAvail.set(d.docente_id, new Map());
    docAvail.get(d.docente_id)!.set(`${d.dia}-${d.slot_id}`, d.prioridad);
  }

  const ambAvail: AmbAvailMap = new Map();

  // Populate lab availability for all days
  const dias = opciones.incluirSabado ? [...DIAS_SEMANA, 'sabado'] : [...DIAS_SEMANA];
  for (const a of ambientes) {
    if (a.tipo !== 'laboratorio') continue;
    if (!ambAvail.has(a.id)) ambAvail.set(a.id, new Set());
    for (const d of dias) {
      for (const s of util) {
        ambAvail.get(a.id)!.add(`${d}-${s.id}`);
      }
    }
  }

  const grupos = opciones.gruposPendientes?.length
    ? opciones.gruposPendientes
    : construirGruposBloques(cursos);

  const pendientesGrupos: BlockGroup[] = [];
  const pendientesUnits: BlockUnit[] = [];
  const asignaciones: any[] = opciones.asignacionesIniciales ? [...opciones.asignacionesIniciales] : [];

  const occ: Occupancy = opciones.occInicial ?? {
    docenteOcupado: new Set<string>(),
    ambienteOcupado: new Set<string>(),
    grupoOcupado: new Set<string>(),
    labEnFranja: new Map(),
    franjaModo: new Map(),
    labParalelosFranjas: 0,
    aulaPreferidaTeoria: new Map<string, string>(),
    docenteCursoClase: new Set<string>(),
    cicloOcupado: new Set<string>(),
  };

  if (!opciones.occInicial && asignaciones.length > 0) {
    for (const a of asignaciones) {
      const timeKey = `${a.dia}-${a.slot_id}`;
      if (a.docente_id) occ.docenteOcupado.add(`${a.docente_id}-${timeKey}`);
      if (a.grupo_id) occ.grupoOcupado.add(`${a.grupo_id}-${timeKey}`);
      if (a.ambiente_id) {
        occ.ambienteOcupado.add(`${a.ambiente_id}-${timeKey}`);
        const fk = `${a.ciclo_plan || 'global'}-${a.dia}-${a.slot_id}`;
        if (a.tipo === 'laboratorio' && a.curso_id) {
          const usos = occ.labEnFranja.get(fk) || [];
          usos.push({ curso_id: a.curso_id, ambiente_id: a.ambiente_id, docente_id: a.docente_id, grupo_id: a.grupo_id || null, codigo: a.curso_codigo || '' });
          occ.labEnFranja.set(fk, usos);
          occ.franjaModo.set(fk, usos.length >= 2 ? 'lleno' : 'solo_lab');
          if (usos.length === 2) occ.labParalelosFranjas++;
        } else {
          occ.franjaModo.set(fk, 'exclusivo');
        }
      }
    }
  }

  let prioridadAlta = 0;
  let prioridadBaja = 0;
  let bloquesContinuos = 0;

  const registrarStats = (meta: any, prio: number) => {
    if (prio === 1) prioridadAlta++;
    if (prio === 2) prioridadBaja++;
  };

  const registrarConflicto = (descripcion: string, datos: object, sugerencia: string) => {
    conflictos.push(descripcion);
    conflictosDetalle.push({ descripcion, datos, sugerencia });
    debugLog.push(`[SCP:FALLO] ${descripcion}`);
    if (sugerencia) debugLog.push(`  → ${sugerencia}`);
  };

  // ── Score each session (block group) by difficulty — most constrained first ──
  interface ScpWorkItem { grupo: BlockGroup; score: number; }
  const work: ScpWorkItem[] = grupos.map(g => {
    const meta = g.units[0].meta;
    let score = 0;
    if (g.indivisible && g.units.length > 1) score += g.units.length * 100;
    if (g.tipo_sesion === 'grupo_estudiante') score += 200;
    if (g.tipo_sesion === 'laboratorio') score += 120;
    if (g.tipo_sesion === 'practica') score += 35;
    const slotsDoc = meta.docente_id ? docAvail.get(meta.docente_id)?.size ?? 0 : 400;
    score += Math.max(0, 120 - slotsDoc);
    if (meta.condicion_orden === 0) score += 12;
    score += (4 - (meta.categoria_orden ?? 4)) * 10;
    if (meta.fecha_ingreso) {
      const years = (Date.now() - new Date(meta.fecha_ingreso).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      score += Math.min(8, Math.floor(years));
    }
    return { grupo: g, score };
  });
  work.sort((a, b) => b.score - a.score);

  const cspOpts = { practicaEnAula: opciones.practicaEnAula ?? false, restrictedIds, incluirSabado: opciones.incluirSabado ?? false };

  for (const { grupo } of work) {
    const passes = [1, 2];
    if (grupo.indivisible && grupo.units.length >= 1) {
      const meta = grupo.units[0].meta;
      const passesDoc = meta.docente_id ? passes : [2];
      let assigned = false;

      for (const p of passesDoc) {
        const res = grupo.tipo_sesion === 'grupo_estudiante'
          ? asignarBloqueEstudiante(grupo, slots, ambientes, docAvail, occ, p, ambAvail, cspOpts)
          : asignarGrupoContinuo(grupo, slots, ambientes, docAvail, occ, p, ambAvail, cspOpts);

        if (res.ok) {
          asignaciones.push(...res.asignaciones);
          registrarStats(meta, res.prioridadUsada!);
          bloquesContinuos++;
          const nom = meta.docente_nombre_real || `${meta.docente_a || ''}, ${meta.docente_n || ''}`;
          debugLog.push(`[SCP] ${nom} → ${meta.codigo} ${grupo.tipo_sesion} bloque ${grupo.units.length}h (P${res.prioridadUsada})`);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        if (!opciones.soloReintentar) {
          pendientesGrupos.push(grupo);
        } else {
          const diag = diagnosticarFalloContinuo(grupo, slots, ambientes, docAvail, ambAvail, occ, asignaciones);
          registrarConflicto(diag.resumen, diag, diag.sugerencias.join(' | '));
        }
      }
    } else {
      // Individual units (non-contiguous)
      for (const unit of grupo.units) {
        const passesDoc = unit.meta.docente_id ? passes : [2];
        let assigned = false;
        for (const p of passesDoc) {
          const res = asignarUnidad(unit, slots, ambientes, docAvail, occ, p, undefined, ambAvail, cspOpts);
          if (res.ok) {
            asignaciones.push(res.asignacion!);
            registrarStats(unit.meta, res.prioridadUsada!);
            const nom = unit.meta.docente_nombre_real || `${unit.meta.docente_a || ''}, ${unit.meta.docente_n || ''}`;
            debugLog.push(`[SCP] ${nom} → ${unit.meta.codigo} ${unit.tipo_sesion} 1h (P${res.prioridadUsada})`);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          if (opciones.soloReintentar) {
            const diag = diagnosticarFalloUnidad(unit, slots, ambientes, docAvail, occ, asignaciones);
            registrarConflicto(diag.resumen, diag, diag.sugerencias.join(' | '));
          } else {
            pendientesUnits.push(unit);
          }
        }
      }
    }
  }

  debugLog.push(`[SCP] Asignados: ${asignaciones.length}/${grupos.reduce((s, g) => s + g.units.length, 0)} | Pendientes: ${pendientesGrupos.length + pendientesUnits.length} | P1: ${prioridadAlta} P2: ${prioridadBaja}`);

  return {
    asignaciones,
    conflictos,
    conflictosDetalle,
    stats: {
      asignados: asignaciones.length,
      total: grupos.reduce((s, g) => s + g.units.length, 0),
      prioridad_alta: prioridadAlta,
      prioridad_baja: prioridadBaja,
      bloques_continuos: bloquesContinuos,
    },
    log: debugLog,
  };
}
