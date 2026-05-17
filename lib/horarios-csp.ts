import { query, queryOne } from './db';
import {
  construirGruposBloques,
  asignarGrupoContinuo,
  asignarUnidad,
  contarFranjasLabsParalelos,
  slotsUtiles,
  type BlockUnit,
  type BlockGroup,
  type AmbAvailMap,
  type Occupancy,
} from './csp-asignacion';
import { DIAS_SEMANA } from './horario-utils';
import {
  construirAmbAvail,
  diagnosticarFalloContinuo,
  diagnosticarFalloUnidad,
} from './csp-diagnostico';

export interface CspStats {
  total_bloques: number;
  asignados: number;
  conflictos: number;
  asesorias_asignadas: number;
  prioridad_alta: number;
  prioridad_baja: number;
  bloques_continuos: number;
  lab_coexistencias?: number;
  franjas_labs_paralelos?: number;
  por_docente: Array<{
    docente_id: string;
    docente_nombre: string;
    categoria: string;
    total: number;
    en_preferida: number;
    en_aceptable: number;
    pct_preferida: number;
  }>;
  log: string[];
}

type WorkItem =
  | { kind: 'group'; group: ReturnType<typeof construirGruposBloques>[0] }
  | { kind: 'asesoria'; unit: BlockUnit };

function puntuacionDificultad(
  item: WorkItem,
  docAvail: Map<string, Map<string, number>>
): number {
  if (item.kind === 'asesoria') return -1000;

  const g = item.group;
  const meta = g.units[0].meta;
  let score = 0;

  if (g.indivisible && g.units.length > 1) score += g.units.length * 150;
  else score += 15;

  if (g.tipo_sesion === 'laboratorio') score += 120;
  if (g.tipo_sesion === 'practica') score += 35;

  const slotsDoc = meta.docente_id ? docAvail.get(meta.docente_id)?.size ?? 0 : 400;
  score += Math.max(0, 150 - slotsDoc);

  score += (meta.condicion_orden ?? 1) * 12;
  score += (4 - (meta.categoria_orden ?? 4)) * 10;

  return score;
}

function rellenarAmbAvailLabs(ambientes: any[], slots: any[], ambAvail: AmbAvailMap) {
  const util = slotsUtiles(slots);
  for (const a of ambientes) {
    if (a.tipo !== 'laboratorio') continue;
    if (!ambAvail.has(a.id)) ambAvail.set(a.id, new Set());
    for (const d of DIAS_SEMANA) {
      for (const s of util) {
        ambAvail.get(a.id)!.add(`${d}-${s.id}`);
      }
    }
  }
}

export type CspOpciones = {
  practicaEnAula?: boolean;
  soloReintentar?: boolean;
  unidadesPendientes?: BlockUnit[];
  gruposPendientes?: BlockGroup[];
  occInicial?: Occupancy;
  asignacionesIniciales?: any[];
  totalUnidades?: number;
  logPrevio?: string[];
};

export async function generarHorarioCSP(programacion_id: string, opciones: CspOpciones = {}) {
  const inicio = Date.now();
  const debugLog: string[] = opciones.logPrevio ? [...opciones.logPrevio] : [];

  const cursos = await query(`
    SELECT pc.*, g.num_alumnos, g.numero_grupo, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
           COALESCE(cu.bloque_indivisible, true) as bloque_indivisible,
           COALESCE(cu.cantidad_labs, 1) as cantidad_labs,
           COALESCE(cu.horas_laboratorio, cu.horas_practica, 0) as horas_laboratorio_catalogo,
           d.condicion, d.categoria, d.fecha_ingreso, d.nombre as docente_n, d.apellidos as docente_a,
           CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
           CASE d.categoria 
             WHEN 'principal' THEN 0 
             WHEN 'asociado' THEN 1 
             WHEN 'auxiliar' THEN 2 
             WHEN 'jefe_practica' THEN 3 
             ELSE 4
           END as categoria_orden
    FROM programacion_cursos pc
    LEFT JOIN grupos g ON g.id = pc.grupo_id
    JOIN cursos cu ON cu.id = pc.curso_id
    LEFT JOIN docentes d ON d.id = pc.docente_id
    WHERE pc.programacion_id = $1
  `, [programacion_id]);

  const disponibilidad = await query(`
    SELECT * FROM disponibilidad_docente 
    WHERE programacion_id = $1 AND disponible = true AND prioridad IN (1, 2)
  `, [programacion_id]);

  let dispAmbiente: { ambiente_id: string; slot_id: string; dia: string; estado: string }[] = [];
  try {
    dispAmbiente = await query(`
      SELECT ambiente_id, slot_id, dia, estado FROM disponibilidad_ambiente
    `);
  } catch {
    dispAmbiente = [];
  }

  const docentesProg = await query(`
    SELECT DISTINCT d.id, d.nombre, d.apellidos, d.categoria, d.fecha_ingreso,
           CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
           CASE d.categoria 
             WHEN 'principal' THEN 0 
             WHEN 'asociado' THEN 1 
             WHEN 'auxiliar' THEN 2 
             WHEN 'jefe_practica' THEN 3 
             ELSE 4
           END as categoria_orden
    FROM docentes d
    WHERE d.activo = true
      AND (
        EXISTS (SELECT 1 FROM programacion_cursos pc WHERE pc.docente_id = d.id AND pc.programacion_id = $1)
        OR EXISTS (SELECT 1 FROM disponibilidad_docente dd WHERE dd.docente_id = d.id AND dd.programacion_id = $1)
      )
  `, [programacion_id]);

  const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true`);
  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

  const docAvail = new Map<string, Map<string, number>>();
  for (const d of disponibilidad) {
    if (!docAvail.has(d.docente_id)) docAvail.set(d.docente_id, new Map());
    docAvail.get(d.docente_id)!.set(`${d.dia}-${d.slot_id}`, d.prioridad);
  }

  const ambAvail: AmbAvailMap = dispAmbiente.length > 0
    ? construirAmbAvail(dispAmbiente)
    : new Map();
  rellenarAmbAvailLabs(ambientes, slots, ambAvail);

  const docenteCursosMap = new Map<string, string[]>();
  for (const c of cursos) {
    if (!c.docente_id || !c.curso_id) continue;
    const list = docenteCursosMap.get(c.docente_id) || [];
    if (!list.includes(c.curso_id)) list.push(c.curso_id);
    docenteCursosMap.set(c.docente_id, list);
  }

  const grupos = construirGruposBloques(cursos);
  const asesoriaUnits: BlockUnit[] = [];

  for (const doc of docentesProg) {
    const docName = `${doc.apellidos}, ${doc.nombre}`;
    asesoriaUnits.push({
      meta: {
        docente_id: doc.id,
        docente_nombre_real: docName,
        docente_cursos: docenteCursosMap.get(doc.id) || [],
        condicion_orden: doc.condicion_orden,
        categoria_orden: doc.categoria_orden,
        fecha_ingreso: doc.fecha_ingreso,
        categoria: doc.categoria,
        tipo_sesion: 'asesoria',
        curso_codigo: 'ASESORÍA',
        curso_nombre: 'Horas de Asesoría',
        codigo: 'ASESORÍA',
        numero_grupo: '-',
        ciclo_plan: null,
        grupo_id: null,
      },
      tipo_sesion: 'asesoria',
    });
  }

  const docStatsInit = new Map<string, { nombre: string; categoria: string; total: number; alta: number; baja: number }>();
  for (const doc of docentesProg) {
    docStatsInit.set(doc.id, {
      nombre: `${doc.apellidos}, ${doc.nombre}`,
      categoria: doc.categoria,
      total: 0,
      alta: 0,
      baja: 0,
    });
  }

  const asignaciones: any[] = opciones.asignacionesIniciales ? [...opciones.asignacionesIniciales] : [];
  const conflictos: string[] = [];
  const conflictosDetalle: Array<{ descripcion: string; datos: object; sugerencia: string }> = [];
  const occ: Occupancy = opciones.occInicial ?? {
    docenteOcupado: new Set<string>(),
    ambienteOcupado: new Set<string>(),
    grupoOcupado: new Set<string>(),
    cicloOcupado: new Set<string>(),
    labSlots: new Map(),
    labCoexistenciasUsadas: 0,
    aulaPreferidaTeoria: new Map<string, string>(),
    docenteCursoClase: new Set<string>(),
  };

  if (!opciones.occInicial && asignaciones.length > 0) {
    for (const a of asignaciones) {
      const timeKey = `${a.dia}-${a.slot_id}`;
      if (a.docente_id) occ.docenteOcupado.add(`${a.docente_id}-${timeKey}`);
      if (a.grupo_id) occ.grupoOcupado.add(`${a.grupo_id}-${timeKey}`);
      if (a.ciclo_plan) occ.cicloOcupado.add(`${a.ciclo_plan}-${timeKey}`);
      if (a.ambiente_id) occ.ambienteOcupado.add(`${a.ambiente_id}-${timeKey}`);
      if (a.docente_id && a.curso_id) {
        occ.docenteCursoClase.add(`${a.docente_id}-${a.curso_id}-${timeKey}`);
      }
    }
  }

  let prioridadAlta = 0;
  let prioridadBaja = 0;
  let asesoriasAsignadas = 0;
  let bloquesContinuos = 0;
  const totalUnidades = grupos.reduce((s, g) => s + g.units.length, 0) + asesoriaUnits.length;

  const cspOpts = { practicaEnAula: opciones.practicaEnAula ?? false };

  let workCursos: WorkItem[] = grupos.map(g => ({ kind: 'group' as const, group: g }));
  if (opciones.gruposPendientes?.length) {
    workCursos = opciones.gruposPendientes.map(g => ({ kind: 'group' as const, group: g }));
  }
  if (opciones.unidadesPendientes?.length) {
    for (const unit of opciones.unidadesPendientes) {
      workCursos.push({
        kind: 'group',
        group: {
          id: `retry-${unit.meta.programacion_curso_id || unit.meta.codigo}-${unit.tipo_sesion}`,
          units: [unit],
          indivisible: false,
          tipo_sesion: unit.tipo_sesion,
        },
      });
    }
  }
  workCursos.sort((a, b) => {
    const labA = a.kind === 'group' && a.group.tipo_sesion === 'laboratorio' ? 1 : 0;
    const labB = b.kind === 'group' && b.group.tipo_sesion === 'laboratorio' ? 1 : 0;
    if (labB !== labA) return labB - labA;
    return puntuacionDificultad(b, docAvail) - puntuacionDificultad(a, docAvail);
  });

  const workAsesorias: WorkItem[] = opciones.soloReintentar
    ? []
    : asesoriaUnits.map(u => ({ kind: 'asesoria' as const, unit: u }));

  const work: WorkItem[] = [...workCursos, ...workAsesorias];

  const registrarStats = (meta: any, prio: number) => {
    if (meta.docente_id) {
      const ds = docStatsInit.get(meta.docente_id);
      if (ds) {
        ds.total++;
        if (prio === 1) ds.alta++;
        if (prio === 2) ds.baja++;
      }
    }
    if (prio === 1) prioridadAlta++;
    if (prio === 2) prioridadBaja++;
  };

  const registrarConflicto = (descripcion: string, datos: object, sugerencia: string) => {
    conflictos.push(descripcion);
    conflictosDetalle.push({ descripcion, datos, sugerencia });
    debugLog.push(`[CSP:FALLO] ${descripcion}`);
    if (sugerencia) debugLog.push(`  → ${sugerencia}`);
  };

  const pendientesGrupos: BlockGroup[] = [];
  const pendientesUnits: BlockUnit[] = [];

  for (const item of work) {
    const passes = [1, 2];

    if (item.kind === 'group' && item.group.indivisible && item.group.units.length > 1) {
      const meta = item.group.units[0].meta;
      const passesDoc = meta.docente_id ? passes : [2];
      let assigned = false;

      for (const p of passesDoc) {
        const res = asignarGrupoContinuo(item.group, slots, ambientes, docAvail, occ, p, ambAvail, cspOpts);
        if (res.ok) {
          asignaciones.push(...res.asignaciones);
          registrarStats(meta, res.prioridadUsada!);
          bloquesContinuos++;
          debugLog.push(
            `[CSP] ${meta.docente_nombre_real} → ${meta.codigo} ${item.group.tipo_sesion} ` +
            `bloque continuo ${item.group.units.length}h (P${res.prioridadUsada})`
          );
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        if (!opciones.soloReintentar) pendientesGrupos.push(item.group);
        else {
          const diag = diagnosticarFalloContinuo(item.group, slots, ambientes, docAvail, ambAvail, occ, asignaciones);
          const detalle = diag.conflictos_detectados?.length
            ? `${diag.resumen}\n${diag.conflictos_detectados.map(c => `  · ${c}`).join('\n')}`
            : diag.resumen;
          registrarConflicto(detalle, diag, diag.sugerencias.join(' | '));
        }
      }
      continue;
    }

    const units = item.kind === 'asesoria' ? [item.unit] : item.group.units;
    for (const unit of units) {
      const meta = unit.meta;
      const passesDoc = meta.docente_id ? passes : [2];
      let unitOk = false;

      for (const p of passesDoc) {
        const res = asignarUnidad(
          unit,
          slots,
          ambientes,
          docAvail,
          occ,
          p,
          item.kind === 'group' ? item.group.id : undefined,
          ambAvail,
          cspOpts
        );
        if (res.ok && res.asignacion) {
          asignaciones.push(res.asignacion);
          registrarStats(meta, res.prioridadUsada!);
          if (meta.tipo_sesion === 'asesoria') asesoriasAsignadas++;
          unitOk = true;
          break;
        }
      }

      if (!unitOk) {
        if (!opciones.soloReintentar) pendientesUnits.push(unit);
        else {
          const diag = diagnosticarFalloUnidad(unit, slots, ambientes, docAvail, occ, asignaciones);
          const detalle = diag.conflictos_detectados?.length
            ? `${diag.resumen}\n${diag.conflictos_detectados.map(c => `  · ${c}`).join('\n')}`
            : diag.resumen;
          registrarConflicto(detalle, diag, diag.sugerencias.join(' | '));
        }
      }
    }
  }

  if (!opciones.soloReintentar && (pendientesGrupos.length > 0 || pendientesUnits.length > 0)) {
    debugLog.push(`[CSP] Reintento flexible: ${pendientesGrupos.length} grupos + ${pendientesUnits.length} unidades`);
    const r2 = await generarHorarioCSP(programacion_id, {
      practicaEnAula: true,
      soloReintentar: true,
      gruposPendientes: pendientesGrupos,
      unidadesPendientes: pendientesUnits,
      occInicial: occ,
      asignacionesIniciales: asignaciones,
      totalUnidades,
      logPrevio: debugLog,
    });
    return r2;
  }

  const franjasLabsParalelos = contarFranjasLabsParalelos(asignaciones);

  const porDocente = Array.from(docStatsInit.entries()).map(([docente_id, s]) => ({
    docente_id,
    docente_nombre: s.nombre,
    categoria: s.categoria,
    total: s.total,
    en_preferida: s.alta,
    en_aceptable: s.baja,
    pct_preferida: s.total > 0 ? Math.round((s.alta / s.total) * 100) : 0,
  }));

  const totalBloques = opciones.totalUnidades ?? totalUnidades;

  const stats: CspStats = {
    total_bloques: totalBloques,
    asignados: asignaciones.length,
    conflictos: conflictos.length,
    asesorias_asignadas: asesoriasAsignadas,
    prioridad_alta: prioridadAlta,
    prioridad_baja: prioridadBaja,
    bloques_continuos: bloquesContinuos,
    lab_coexistencias: occ.labCoexistenciasUsadas,
    franjas_labs_paralelos: franjasLabsParalelos,
    por_docente: porDocente,
    log: debugLog,
  };

  debugLog.push(
    `[CSP] Tiempo: ${Date.now() - inicio}ms | Continuos: ${bloquesContinuos} | ` +
    `Labs paralelos (franjas): ${franjasLabsParalelos} | Fallos: ${conflictos.length}`
  );

  const prog = await queryOne(`SELECT config FROM programaciones WHERE id = $1`, [programacion_id]);
  const newConfig = { ...(prog?.config || {}), asignaciones, csp_stats: stats };
  await queryOne(`UPDATE programaciones SET config = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newConfig), programacion_id]);

  await query(`DELETE FROM conflictos_horario WHERE programacion_id = $1`, [programacion_id]);
  for (const c of conflictosDetalle) {
    await query(`
      INSERT INTO conflictos_horario (programacion_id, tipo, severidad, descripcion, datos, sugerencia)
      VALUES ($1, 'UNASSIGNED', 'error', $2, $3::jsonb, $4)
    `, [programacion_id, c.descripcion, JSON.stringify(c.datos), c.sugerencia]);
  }

  return { asignaciones, conflictos, stats };
}

export async function obtenerPreValidacionCSP(programacion_id: string) {
  const rows = await query(`
    SELECT * FROM v_pre_validacion_csp WHERE programacion_id = $1
    ORDER BY
      CASE estado WHEN 'ok' THEN 1 ELSE 0 END,
      docente_nombre
  `, [programacion_id]);

  const resumen = await queryOne(`
    SELECT
      COUNT(*) AS total_docentes,
      COUNT(*) FILTER (WHERE estado = 'ok') AS ok,
      COUNT(*) FILTER (WHERE estado <> 'ok') AS alertas
    FROM v_pre_validacion_csp
    WHERE programacion_id = $1
  `, [programacion_id]);

  return { resumen, docentes: rows };
}
