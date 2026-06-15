import type { AmbAvailMap, BlockGroup, BlockUnit, Occupancy, SlotRow } from './csp-asignacion';
import { slotsUtiles } from './csp-asignacion';
import { DIAS_SEMANA } from './horario-utils';

const DIAS = [...DIAS_SEMANA];

export function construirAmbAvail(
  rows: { ambiente_id: string; dia: string; slot_id: string; estado: string }[]
): AmbAvailMap {
  const m: AmbAvailMap = new Map();
  for (const r of rows) {
    if (r.estado !== 'disponible') continue;
    if (!m.has(r.ambiente_id)) m.set(r.ambiente_id, new Set());
    m.get(r.ambiente_id)!.add(`${r.dia}-${r.slot_id}`);
  }
  return m;
}

export type { AmbAvailMap };

export function maxBloqueContinuoDocente(
  docenteId: string,
  docAvail: Map<string, Map<string, number>>,
  slots: SlotRow[]
): number {
  const util = slotsUtiles(slots);
  const docMap = docAvail.get(docenteId);
  if (!docMap) return 0;

  let max = 0;
  for (const dia of DIAS) {
    let run = 0;
    for (let i = 0; i < util.length; i++) {
      const s = util[i];
      const key = `${dia}-${s.id}`;
      if (docMap.has(key)) {
        if (i === 0 || s.orden === util[i - 1].orden + 1) run++;
        else run = 1;
        max = Math.max(max, run);
      } else {
        run = 0;
      }
    }
  }
  return max;
}

export interface DiagnosticoFallo {
  resumen: string;
  codigo: string;
  curso_codigo?: string;
  curso_nombre?: string;
  tipo_sesion?: string;
  numero_grupo?: number | string;
  lab_turno?: number;
  docente_nombre?: string;
  horas_requeridas?: number;
  disponibilidad: {
    horas_totales: number;
    max_bloque_continuo: number;
    bloques_2h: number;
    dias_con_carga: number;
  };
  ambientes: {
    compatibles: number;
    tipo_requerido: string;
  };
  conflictos_detectados?: string[];
  sugerencias: string[];
}

function analizarBloqueosFranja(
  meta: Record<string, any>,
  dia: string,
  slot: SlotRow,
  occ: Occupancy,
  asignaciones: any[]
): string[] {
  const timeKey = `${dia}-${slot.id}`;
  const bloqueos: string[] = [];

  const labsFranja = occ?.labEnFranja?.get(timeKey) || [];
  const modo = occ?.franjaModo?.get(timeKey);
  if (meta.tipo_sesion === 'laboratorio' && modo === 'exclusivo') {
    bloqueos.push('VIOLACIÓN: franja con teoría/práctica; no se puede agregar laboratorio');
  }
  if (meta.tipo_sesion !== 'laboratorio' && (labsFranja.length > 0 || modo === 'solo_lab' || modo === 'lleno')) {
    bloqueos.push('VIOLACIÓN: solo Lab+Lab en paralelo; esta franja ya tiene laboratorio(s)');
  }
  if (meta.tipo_sesion === 'laboratorio' && labsFranja.length >= 2) {
    bloqueos.push('Máximo 2 laboratorios en paralelo por franja');
  }

  if (meta.grupo_id && occ.grupoOcupado.has(`${meta.grupo_id}-${timeKey}`)) {
    const otra = asignaciones.find(
      a => a.grupo_id === meta.grupo_id && a.dia === dia && a.slot_id === slot.id
    );
    bloqueos.push(
      otra
        ? `Grupo G${meta.numero_grupo ?? '?'} ocupado: ${otra.curso_codigo} (${otra.tipo})`
        : `Grupo G${meta.numero_grupo ?? '?'} ya tiene clase en esta franja`
    );
  }

  if (meta.docente_id && occ.docenteOcupado.has(`${meta.docente_id}-${timeKey}`)) {
    const otra = asignaciones.find(
      a => a.docente_id === meta.docente_id && a.dia === dia && a.slot_id === slot.id
    );
    bloqueos.push(
      otra
        ? `Docente ocupado: ${otra.curso_codigo} (${otra.tipo})`
        : 'Docente ya asignado en esta franja'
    );
  }

  return bloqueos;
}

export function diagnosticarFalloContinuo(
  group: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  ambAvail: AmbAvailMap,
  occ?: Occupancy,
  asignaciones: any[] = []
): DiagnosticoFallo {
  const meta = group.units[0].meta;
  const duracion = group.units.length;
  const docId = meta.docente_id as string | undefined;
  const docMap = docId ? docAvail.get(docId) : undefined;
  const horasTot = docMap?.size ?? 0;
  const maxCont = docId ? maxBloqueContinuoDocente(docId, docAvail, slots) : 0;

  const validAmb = ambientes.filter((a: any) => {
    if ((meta.num_alumnos || 0) > a.capacidad) return false;
    if (group.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
    if (group.tipo_sesion === 'teoria' && a.tipo === 'laboratorio') return false;
    if (group.tipo_sesion === 'practica') return a.tipo === 'aula' || a.tipo === 'laboratorio';
    return true;
  });

  const sugerencias: string[] = [];
  const conflictos_detectados: string[] = [];
  let codigo = 'sin_ventana';

  if (!docId) {
    codigo = 'sin_docente';
    sugerencias.push('Asignar un docente al curso en Fase 1 (programación).');
  } else if (horasTot < duracion) {
    codigo = 'horas_insuficientes';
    sugerencias.push(`Ampliar disponibilidad: requiere ${duracion}h y el docente tiene ${horasTot}h marcadas.`);
    sugerencias.push('Ejecutar npm run db:seed para refuerzo de docentes conflictivos.');
  } else if (group.tipo_sesion !== 'laboratorio' && maxCont < duracion) {
    codigo = 'sin_bloque_continuo';
    sugerencias.push(
      `Marcar al menos ${duracion}h consecutivas el mismo día (máximo actual: ${maxCont}h). Solo aplica a teoría.`
    );
  } else if (validAmb.length === 0) {
    codigo = 'sin_aula_compatible';
    sugerencias.push('No hay ambiente con capacidad/tipo adecuado; revisar catálogo de aulas/labs.');
  } else {
    codigo = 'franjas_ocupadas';
    if (occ) {
      const util = slotsUtiles(slots);
      let muestras = 0;
      for (const dia of DIAS) {
        for (let i = 0; i <= util.length - duracion && muestras < 4; i++) {
          const ventana = util.slice(i, i + duracion);
          const consecutivos =
            group.tipo_sesion === 'laboratorio' ||
            ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
          if (!consecutivos) continue;
          const bloqueos = ventana.flatMap(s => analizarBloqueosFranja(meta, dia, s, occ, asignaciones));
          if (bloqueos.length > 0 && muestras < 4) {
            const h0 = ventana[0].hora_inicio;
            conflictos_detectados.push(`${dia} ${h0}: ${bloqueos[0]}`);
            muestras++;
          }
        }
      }
    }
    sugerencias.push('Reejecutar CSP con flexibilidad (P2 + práctica en aula).');
    sugerencias.push('Labs distintos pueden usarse en paralelo; el mismo lab admite hasta 2 cursos distintos.');
    if (group.tipo_sesion === 'laboratorio') {
      sugerencias.push(`Hay ${validAmb.length} laboratorio(s) compatible(s); revise choque de ciclo o docente.`);
    }
  }

  const titulo = meta.curso_nombre ? `${meta.codigo} — ${meta.curso_nombre}` : meta.codigo;
  const resumen =
    group.tipo_sesion === 'laboratorio'
      ? `❌ ${titulo} (G${meta.numero_grupo}${meta.lab_turno ? `, lab turno ${meta.lab_turno}` : ''}): no se ubicaron ${duracion}h de laboratorio`
      : `❌ ${titulo} (G${meta.numero_grupo}): no hay bloque de ${duracion}h de ${group.tipo_sesion}`;

  return {
    resumen,
    codigo,
    curso_codigo: meta.codigo,
    curso_nombre: meta.curso_nombre,
    tipo_sesion: group.tipo_sesion,
    numero_grupo: meta.numero_grupo,
    lab_turno: meta.lab_turno,
    docente_nombre: meta.docente_nombre_real,
    horas_requeridas: duracion,
    disponibilidad: {
      horas_totales: horasTot,
      max_bloque_continuo: maxCont,
      bloques_2h: maxCont >= 2 ? 1 : 0,
      dias_con_carga: docMap
        ? DIAS.filter(d => [...docMap.keys()].some(k => k.startsWith(`${d}-`))).length
        : 0,
    },
    ambientes: {
      compatibles: validAmb.length,
      tipo_requerido: group.tipo_sesion === 'laboratorio' ? 'laboratorio' : 'aula',
    },
    conflictos_detectados,
    sugerencias,
  };
}

export function diagnosticarFalloUnidad(
  unit: BlockUnit,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ?: Occupancy,
  asignaciones: any[] = []
): DiagnosticoFallo {
  const meta = unit.meta;
  const g: BlockGroup = {
    id: 'u',
    units: [unit],
    indivisible: false,
    tipo_sesion: unit.tipo_sesion,
  };
  const d = diagnosticarFalloContinuo(g, slots, ambientes, docAvail, new Map(), occ, asignaciones);
  const titulo = meta.curso_nombre ? `${meta.codigo} — ${meta.curso_nombre}` : meta.codigo || 'ASESORÍA';
  return {
    ...d,
    resumen: `❌ ${titulo} (G${meta.numero_grupo || '-'}${
      meta.lab_turno ? `, lab turno ${meta.lab_turno}` : ''
    }): no se asignó 1h de ${meta.tipo_sesion || 'asesoría'}`,
    horas_requeridas: 1,
  };
}

export function interpretarEstadoPreValidacion(estado: string): string {
  switch (estado) {
    case 'horas_insuficientes':
      return 'Horas disponibles menores que la carga';
    case 'sin_bloque_continuo':
      return 'No tiene bloque continuo suficiente para teoría';
    case 'pocos_dias':
      return 'Menos de 3 días con disponibilidad';
    default:
      return 'OK para CSP';
  }
}
