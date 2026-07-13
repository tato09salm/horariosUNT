import { randomUUID } from 'crypto';
import {
  slotsUtiles,
  asignarGrupoContinuo,
  cloneOccupancy,
  type BlockGroup, type BlockUnit, type AmbAvailMap, type Occupancy, type SlotRow,
} from './csp-asignacion';
import { DIAS_SEMANA } from './horario-utils';

const DIAS: string[] = [...DIAS_SEMANA];
const DIAS_EXT: string[] = [...DIAS_SEMANA, 'sabado'];

// ── Cálculo compartido de requerimientos de curso ────────────────────────
export interface ReqCurso {
  teoria: number;
  practica: number;
  laboratorioPorTurno: number;
  turnosLaboratorio: number;
  laboratorioTotal: number;
  total: number;
}

export function calcularRequerimientosCurso(curso: Record<string, any>): ReqCurso {
  const teoria = Number(curso.horas_teoria) || 0;
  const practica = Number(curso.horas_practica) || 0;
  const laboratorioPorTurno = Number(curso.horas_laboratorio) || 0;
  const turnosLaboratorio = laboratorioPorTurno > 0 ? Math.max(1, Number(curso.cantidad_labs) || 1) : 0;
  const laboratorioTotal = laboratorioPorTurno * turnosLaboratorio;
  const total = teoria + practica + laboratorioTotal;
  return { teoria, practica, laboratorioPorTurno, turnosLaboratorio, laboratorioTotal, total };
}

// ── Auditoría de bloques por fase ─────────────────────────────────────────
export interface DuplicadoBloque {
  clave_bloque: string;
  cantidadHoras: number;
  horasEsperadas: number;
  dias: string[];
  ambientes: string[];
  fuentes: string[];
  bloqueContinuoIds: string[];
  pc_id?: string;
  curso_id?: string;
  grupo_id?: string;
  docente_id?: string;
  tipo?: string;
  lab_turno?: number;
}

export function auditarBloques(fase: string, asignaciones: any[]): DuplicadoBloque[] {
  const porClave = new Map<string, DuplicadoBloque>();
  for (const a of asignaciones) {
    const ck = a.clave_bloque as string || 'SIN_CLAVE';
    if (!porClave.has(ck)) {
      porClave.set(ck, {
        clave_bloque: ck,
        cantidadHoras: 0,
        horasEsperadas: (a.bloque_total as number) || 0,
        dias: [],
        ambientes: [],
        fuentes: [],
        bloqueContinuoIds: [],
        pc_id: a.pc_id,
        curso_id: a.curso_id,
        grupo_id: a.grupo_id,
        docente_id: a.docente_id,
        tipo: a.tipo,
        lab_turno: a.lab_turno,
      });
    }
    const d = porClave.get(ck)!;
    d.cantidadHoras++;
    if (!d.dias.includes(a.dia)) d.dias.push(a.dia);
    if (!d.ambientes.includes(a.ambiente_id)) d.ambientes.push(a.ambiente_id);
    if (!d.fuentes.includes(a.fuente)) d.fuentes.push(a.fuente);
    if (!d.bloqueContinuoIds.includes(a.bloque_continuo_id)) d.bloqueContinuoIds.push(a.bloque_continuo_id);
  }

  const duplicados: DuplicadoBloque[] = [];
  for (const [ck, info] of porClave) {
    if (ck === 'SIN_CLAVE') continue;
    if (info.horasEsperadas > 0 && info.cantidadHoras > info.horasEsperadas) {
      duplicados.push(info);
    }
    if (info.horasEsperadas > 0 && info.dias.length > 1) {
      if (!duplicados.find(d => d.clave_bloque === ck)) duplicados.push(info);
    }
  }

  if (duplicados.length > 0) {
    const msg = `[AUDITORIA ${fase}] ${duplicados.length} bloque(s) duplicado(s): ` +
      duplicados.map(d =>
        `${d.clave_bloque} (${d.cantidadHoras}h, esperadas ${d.horasEsperadas}h, días: ${d.dias.join(',')}, fuentes: ${d.fuentes.join(',')})`
      ).join(' | ');
    console.error(msg);
    throw new Error(msg);
  }

  return duplicados;
}

// ── Clave de bloque académico (identidad estable) ─────────────────────────
export function claveBloqueAcademico(meta: {
  pc_id?: string | null;
  id?: string | null;
  docente_id?: string | null;
  curso_id?: string | null;
  grupo_id?: string | null;
  tipo_sesion?: string | null;
  lab_turno?: number | null;
}): string {
  // Normalize: pc_id could be in meta.id (from programacion_cursos), fallback to '' if absent
  const pc_id = meta.pc_id || meta.id || '';
  return [
    pc_id,
    meta.docente_id ?? '',
    meta.curso_id ?? '',
    meta.grupo_id ?? '',
    meta.tipo_sesion ?? '',
    meta.lab_turno ?? 0,
  ].join('|');
}

export function contarHorasAsignadasPorBloque(asignaciones: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of asignaciones) {
    const k = a.clave_bloque || '';
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

// ── Crear Occupancy desde asignaciones ────────────────────────────────────
function crearOccupancyDesdeAsignaciones(asignaciones: any[], ambientes: any[]): Occupancy {
  const occ = initOccupancy();
  for (const a of asignaciones) {
    const amb = ambientes.find((ax: any) => ax.id === a.ambiente_id);
    if (amb) marcarOcupado(a, a.dia, a.slot_id, a.ambiente_id, occ);
    else marcarOcupado(a, a.dia, a.slot_id, null, occ);
  }
  return occ;
}

// ── Backtracking limitado: snap/rollback por curso ────────────────────────
interface BacktrackSnapshot {
  occ: Occupancy;
  asignaciones: any[];
  asignadosDoc: any[];
  pendientesDoc: BlockGroup[];
}

function cloneSnapshot(occ: Occupancy, asignaciones: any[], asignadosDoc: any[], pendientesDoc: BlockGroup[]): BacktrackSnapshot {
  return {
    occ: cloneOccupancy(occ),
    asignaciones: [...asignaciones],
    asignadosDoc: [...asignadosDoc],
    pendientesDoc: pendientesDoc.map(b => ({ ...b, units: [...b.units] })),
  };
}

// ── Nuevo bloque_continuo_id único ────────────────────────────────────────
export function nuevoBloqueContinuo(): string {
  return require('crypto').randomUUID();
}

// ── Helpers de reemplazo atómico y clonación ───────────────────────────────
function reemplazarEnAsignaciones(asignaciones: any[], nuevas: any[]): any[] {
  if (nuevas.length === 0) return asignaciones;
  const nuevasClaves = new Set<string>();
  for (const a of nuevas) {
    if (a.clave_bloque) nuevasClaves.add(a.clave_bloque);
  }
  if (nuevasClaves.size === 0) return [...asignaciones, ...nuevas];
  return [...asignaciones.filter(a => !a.clave_bloque || !nuevasClaves.has(a.clave_bloque)), ...nuevas];
}

function clonarBloque(b: BlockGroup): BlockGroup {
  return {
    id: b.id,
    units: b.units.map(u => ({
      meta: { ...u.meta },
      tipo_sesion: u.tipo_sesion,
    })),
    indivisible: b.indivisible,
    tipo_sesion: b.tipo_sesion,
  };
}

// ── Constantes de configuración ────────────────────────────────────────────
const MAX_REINTENTOS_POR_DOCENTE = 8;
const MAX_ITERACIONES_REFINAMIENTO = 20;
const MEJORA_MINIMA = 0.001; // 0.1% mejora mínima para considerar avance
const ITERACIONES_SIN_MEJORA_MAX = 5; // detener refinamiento si N iteraciones no mejoran
const PENALIZACION_HORA_PENDIENTE = 1000;
const PENALIZACION_BLOQUE_MIXTO = 100;
const PENALIZACION_DIA_ADICIONAL = 20;
const PENALIZACION_HUECO_POR_HORA = 10;
const PENALIZACION_TEORIA_TRAS_PRACTICA = 50;
const PENALIZACION_SABADO = 30;
const PENALIZACION_AMBIENTE_ALTERNATIVO = 15;
const PENALIZACION_FRAGMENTACION = 30;
const BONIFICACION_DOCENTE_COMPLETO = 500;
const BONIFICACION_T_P_CONTIGUO_MISMO_DIA = 50;

export interface DocPriority {
  docente_id: string;
  nombre: string;
  condicion: string;
  categoria: string;
  condicion_orden: number;
  categoria_orden: number;
  fecha_ingreso: Date;
  index: number;
}

export interface CursoDetalle {
  curso_id: string;
  curso_codigo: string;
  horas_requeridas: number;
  horas_asignadas: number;
  bloques_requeridos: number;
  bloques_completos: number;
  estado: 'COMPLETO' | 'PARCIAL' | 'SIN_ASIGNAR';
  razon_pendiente?: string;
  labs?: {
    lab_turno: number;
    horas_requeridas: number;
    horas_asignadas: number;
    continuo: boolean;
    dia?: string;
    ambiente_id?: string;
  }[];
}

export interface DocenteResult {
  docente_id: string;
  nombre: string;
  condicion: string;
  categoria: string;
  total_horas: number;
  asignadas: number;
  pendientes: number;
  pct_completado: number;
  bloques_mixtos: number;
  prioridad_orden: number;
  cursos_totales: number;
  cursos_completos: number;
  cursos_parciales: number;
  cursos_sin_asignar: number;
  detalle_cursos: CursoDetalle[];
}

export interface ResolverV2Result {
  asignaciones: any[];
  conflictos: string[];
  conflictosDetalle: Array<{ descripcion: string; datos: object; sugerencia: string }>;
  por_docente: DocenteResult[];
  stats: {
    total_horas: number;
    asignadas: number;
    pendientes: number;
    pct_completado: number;
    bloques_mixtos: number;
    phase: string;
    iteraciones: number;
    tiempo_ms: number;
    iteraciones_detalle?: {
      csp: number;
      ga: number;
      refinamiento: number;
      reintentosPorDocente: Record<string, number>;
    };
    puntaje_global?: PuntajeSolucion;
  };
  mejoras?: MejoraIteracion[];
  razones_mixtos?: string[];
  log: string[];
}

function sortDocentes(docentes: any[]): DocPriority[] {
  return docentes
    .map((d, i) => ({
      docente_id: d.id,
      nombre: `${d.apellidos || ''}, ${d.nombre || ''}`,
      condicion: d.condicion || 'contratado',
      categoria: d.categoria || 'auxiliar',
      condicion_orden: d.condicion === 'nombrado' ? 0 : 1,
      categoria_orden:
        d.categoria === 'principal' ? 0
        : d.categoria === 'asociado' ? 1
        : d.categoria === 'auxiliar' ? 2
        : d.categoria === 'jefe_practica' ? 3 : 4,
      fecha_ingreso: d.fecha_ingreso || new Date('2026-01-01'),
      index: i,
    }))
    .sort((a, b) => {
      if (a.condicion_orden !== b.condicion_orden) return a.condicion_orden - b.condicion_orden;
      if (a.categoria_orden !== b.categoria_orden) return a.categoria_orden - b.categoria_orden;
      return new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime();
    });
}

function construirBloquesIndependientes(cursos: any[]): BlockGroup[] {
  const grupos: BlockGroup[] = [];
  for (const c of cursos) {
    const base = { ...c, pc_id: c.pc_id ?? c.id };
    const mkUnits = (tipo: string, horas: number, extra: Record<string, unknown> = {}): BlockUnit[] =>
      Array.from({ length: horas }, () => ({
        meta: { ...base, ...extra, tipo_sesion: tipo },
        tipo_sesion: tipo,
      }));
    if (c.horas_teoria > 0) {
      grupos.push({
        id: randomUUID(),
        units: mkUnits('teoria', c.horas_teoria, { curso_group_key: `${c.curso_id}-${c.grupo_id}` }),
        indivisible: true,
        tipo_sesion: 'teoria',
      });
    }
    if (c.horas_practica > 0) {
      grupos.push({
        id: randomUUID(),
        units: mkUnits('practica', c.horas_practica, { curso_group_key: `${c.curso_id}-${c.grupo_id}` }),
        indivisible: true,
        tipo_sesion: 'practica',
      });
    }
    const horasPorTurno = Number(c.horas_laboratorio) || 0;
    const turnosLab = horasPorTurno > 0 ? Math.max(1, Number(c.cantidad_labs) || 1) : 0;
    for (let turno = 1; turno <= turnosLab; turno++) {
      grupos.push({
        id: randomUUID(),
        units: mkUnits('laboratorio', horasPorTurno, {
          lab_turno: turno,
          lab_turnos_total: turnosLab,
          curso_group_key: `${c.curso_id}-${c.grupo_id}`,
        }),
        indivisible: true,
        tipo_sesion: 'laboratorio',
      });
    }
  }
  return grupos;
}

function construirBloqueMixtoTP(teoria: BlockGroup, practica: BlockGroup): BlockGroup {
  return {
    id: randomUUID(),
    units: [...teoria.units, ...practica.units],
    indivisible: true,
    tipo_sesion: 'mixto',
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
}

function initOccupancy(): Occupancy {
  return {
    docenteOcupado: new Set(),
    ambienteOcupado: new Set(),
    grupoOcupado: new Set(),
    labEnFranja: new Map(),
    franjaModo: new Map(),
    labParalelosFranjas: 0,
    aulaPreferidaTeoria: new Map(),
    docenteCursoClase: new Set(),
    cicloOcupado: new Set(),
  };
}

function rebuildOccupancy(asignaciones: any[], occ: Occupancy) {
  for (const a of asignaciones) {
    const timeKey = `${a.dia}-${a.slot_id}`;
    if (a.docente_id) occ.docenteOcupado.add(`${a.docente_id}-${timeKey}`);
    if (a.grupo_id) occ.grupoOcupado.add(`${a.grupo_id}-${timeKey}`);
    if (a.docente_id && a.curso_id) {
      occ.docenteCursoClase.add(`${a.docente_id}-${a.curso_id}-${timeKey}`);
    }
    if (a.ciclo_plan && a.tipo !== 'laboratorio') {
      const seccion = a.seccion || 'A';
      occ.cicloOcupado.add(`${a.ciclo_plan}-${seccion}-${timeKey}`);
    }
    if (!a.ambiente_id) continue;
    occ.ambienteOcupado.add(`${a.ambiente_id}-${timeKey}`);
    const fk = `${a.ciclo_plan || 'global'}-${a.dia}-${a.slot_id}`;
    if (a.tipo === 'laboratorio' && a.curso_id) {
      const usos = occ.labEnFranja.get(fk) || [];
      usos.push({ curso_id: a.curso_id, ambiente_id: a.ambiente_id, docente_id: a.docente_id || '', grupo_id: a.grupo_id || null, codigo: a.curso_codigo || '' });
      occ.labEnFranja.set(fk, usos);
      occ.franjaModo.set(fk, usos.length >= 2 ? 'lleno' : 'solo_lab');
      if (usos.length === 2) occ.labParalelosFranjas++;
    } else {
      occ.franjaModo.set(fk, 'exclusivo');
    }
  }
}

function intentarAsignarTPContiguo(
  teoria: BlockGroup,
  practica: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  priorityPass: number,
  ambAvail: AmbAvailMap,
  opts: any,
): { ok: boolean; asignaciones: any[]; prioridadUsada: number | null } {
  const blockT = teoria.units[0].meta;
  const blockP = practica.units[0].meta;
  const totalHoras = teoria.units.length + practica.units.length;
  const util = slotsUtiles(slots, opts.restrictedIds);
  const aulas = ambientes.filter((a: any) => {
    if (a.tipo === 'laboratorio') return false;
    return (blockT.num_alumnos || 0) <= a.capacidad;
  });
  const labs = ambientes.filter((a: any) => a.tipo === 'laboratorio' && (blockT.num_alumnos || 0) <= a.capacidad);
  const dias = [...DIAS];
  if (opts.incluirSabado) dias.push('sabado');

  for (const dia of dias) {
    for (let i = 0; i <= util.length - totalHoras; i++) {
      const ventana = util.slice(i, i + totalHoras);
      const consecutivos = ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
      if (!consecutivos) continue;
      const slotsLibresT = ventana.slice(0, teoria.units.length).every(s => puedeSlot(blockT, dia, s, priorityPass, docAvail, occ));
      const slotsLibresP = ventana.slice(teoria.units.length).every(s => puedeSlot(blockP, dia, s, priorityPass, docAvail, occ));
      if (!slotsLibresT || !slotsLibresP) continue;
      for (const aula of aulas) {
        const aLibreT = ventana.slice(0, teoria.units.length).every(s => ambienteDisponible(blockT, aula.id, dia, s.id, occ) && ambienteSlotOk(aula.id, dia, s.id, ambAvail, false));
        const aLibreP = ventana.slice(teoria.units.length).every(s => ambienteDisponible(blockP, aula.id, dia, s.id, occ) && ambienteSlotOk(aula.id, dia, s.id, ambAvail, false));
        if (!aLibreT || !aLibreP) continue;
        const labsValidos = labs.filter(lab => ventana.every(s => ambienteDisponible(blockT, lab.id, dia, s.id, occ) && ambienteSlotOk(lab.id, dia, s.id, ambAvail, true)));
        for (const lab of labsValidos) {
          const asignaciones: any[] = [];
          let ok = true;
          for (let idx = 0; idx < ventana.length; idx++) {
            const unit = idx < teoria.units.length ? teoria.units[idx] : practica.units[idx - teoria.units.length];
            const s = ventana[idx];
            const amb = unit.tipo_sesion === 'laboratorio' ? lab : aula;
            const res = puedeSlot(unit.meta, dia, s, priorityPass, docAvail, occ);
            if (!res) { ok = false; break; }
            if (!ambienteDisponible(unit.meta, amb.id, dia, s.id, occ)) { ok = false; break; }
            marcarOcupado(unit.meta, dia, s.id, amb.id, occ);
            asignaciones.push(crearAsignacion(unit.meta, dia, s, amb, priorityPass, teoria.id, idx + 1, ventana.length));
          }
          if (ok) return { ok: true, asignaciones, prioridadUsada: priorityPass };
        }
      }
    }
  }
  return { ok: false, asignaciones: [], prioridadUsada: null };
}

function puedeSlot(
  block: Record<string, any>,
  dia: string,
  slot: SlotRow,
  priorityPass: number,
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy
): boolean {
  const timeKey = `${dia}-${slot.id}`;
  if (block.docente_id) {
    const docMap = docAvail.get(block.docente_id);
    if (!docMap?.has(timeKey)) return false;
    const p = docMap.get(timeKey)!;
    if (priorityPass === 1 && p !== 1) return false;
    if (priorityPass === 2 && p === undefined) return false;
    if (occ.docenteOcupado.has(`${block.docente_id}-${timeKey}`)) return false;
  }
  if (block.grupo_id && occ.grupoOcupado.has(`${block.grupo_id}-${timeKey}`)) return false;
  if (occ.docenteCursoClase.has(`${block.docente_id}-${block.curso_id}-${timeKey}`)) return false;
  if (block.ciclo_plan) {
    const seccion = block.seccion || 'A';
    if (block.tipo_sesion !== 'laboratorio' && occ.cicloOcupado.has(`${block.ciclo_plan}-${seccion}-${timeKey}`)) return false;
  }
  const fk = `${block.ciclo_plan || 'global'}-${dia}-${slot.id}`;
  const modo = occ.franjaModo.get(fk) || 'libre';
  const labs = occ.labEnFranja.get(fk) || [];
  const esLab = block.tipo_sesion === 'laboratorio';
  if (esLab) {
    if (modo === 'exclusivo') return false;
    if (labs.length >= 2) return false;
  } else {
    if (modo !== 'libre' || labs.length > 0) return false;
  }
  return true;
}

function ambienteDisponible(
  block: Record<string, any>,
  ambienteId: string,
  dia: string,
  slotId: string,
  occ: Occupancy
): boolean {
  const key = `${ambienteId}-${dia}-${slotId}`;
  if (occ.ambienteOcupado.has(key)) return false;
  return true;
}

function ambienteSlotOk(ambId: string, dia: string, slotId: string, ambAvail: AmbAvailMap, esLab: boolean): boolean {
  if (!ambAvail.has(ambId)) return true;
  return ambAvail.get(ambId)!.has(`${dia}-${slotId}`);
}

function marcarOcupado(
  block: Record<string, any>,
  dia: string,
  slotId: string,
  ambienteId: string | null,
  occ: Occupancy
) {
  const timeKey = `${dia}-${slotId}`;
  if (block.docente_id) occ.docenteOcupado.add(`${block.docente_id}-${timeKey}`);
  if (block.grupo_id) occ.grupoOcupado.add(`${block.grupo_id}-${timeKey}`);
  if (block.docente_id && block.curso_id) {
    occ.docenteCursoClase.add(`${block.docente_id}-${block.curso_id}-${timeKey}`);
  }
  if (block.ciclo_plan && block.tipo_sesion !== 'laboratorio') {
    const seccion = block.seccion || 'A';
    occ.cicloOcupado.add(`${block.ciclo_plan}-${seccion}-${timeKey}`);
  }
  if (!ambienteId) return;
  occ.ambienteOcupado.add(`${ambienteId}-${timeKey}`);
  const fk = `${block.ciclo_plan || 'global'}-${dia}-${slotId}`;
  if (block.tipo_sesion === 'laboratorio') {
    const usos = occ.labEnFranja.get(fk) || [];
    usos.push({
      curso_id: block.curso_id,
      ambiente_id: ambienteId,
      docente_id: block.docente_id || '',
      grupo_id: block.grupo_id || null,
      codigo: block.codigo || block.curso_codigo || '',
    });
    occ.labEnFranja.set(fk, usos);
    occ.franjaModo.set(fk, usos.length >= 2 ? 'lleno' : 'solo_lab');
    if (usos.length === 2) occ.labParalelosFranjas++;
  } else {
    occ.franjaModo.set(fk, 'exclusivo');
  }
}

function crearAsignacion(
  block: any, dia: string, slot: SlotRow, amb: any,
  prioridadUsada: number, bloqueContinuoId?: string,
  parte?: number, totalPartes?: number
) {
  return {
    id: randomUUID(),
    clave_bloque: claveBloqueAcademico(block),
    pc_id: block.id || block.pc_id || null,
    curso_id: block.curso_id || null,
    grupo_id: block.grupo_id || null,
    docente_id: block.docente_id,
    ambiente_id: amb.id,
    slot_id: slot.id,
    dia,
    tipo: block.tipo_sesion,
    curso_codigo: block.codigo || block.curso_codigo,
    curso_nombre: block.curso_nombre,
    numero_grupo: block.numero_grupo,
    ambiente_codigo: amb.codigo,
    ambiente_nombre: amb.nombre,
    ambiente_tipo: amb.tipo,
    docente_nombre: block.docente_nombre_real || `${block.docente_a || ''}, ${block.docente_n || ''}`,
    ciclo_plan: block.ciclo_plan,
    condicion_orden: block.condicion_orden,
    categoria_orden: block.categoria_orden,
    fecha_ingreso: block.fecha_ingreso,
    prioridad_usada: prioridadUsada,
    bloque_continuo_id: bloqueContinuoId || null,
    bloque_parte: parte || null,
    bloque_total: totalPartes || null,
    lab_turno: block.lab_turno || null,
    lab_turnos_total: block.lab_turnos_total || null,
    cantidad_labs: block.cantidad_labs || 1,
    es_mixto: block.tipo_sesion === 'mixto' || false,
    fuente: 'RESOLVER_V2',
  };
}

// ── Interfaces de puntaje y mejoras ────────────────────────────────────────
export interface PuntajeSolucion {
  puntajeTotal: number;
  horasTotales: number;
  horasAsignadas: number;
  horasPendientes: number;
  porcentajeCompletitud: number;
  conflictosDuros: number;
  bloquesMixtos: number;
  bloquesFragmentados: number;
  huecosTotales: number;
  diasDocenteTotales: number;
  usoSabado: number;
  teoriaPracticaInvertidas: number;
  desglose: Record<string, number>;
}

export interface MejoraIteracion {
  fase: 'CSP' | 'GA' | 'REFINAMIENTO';
  iteracion: number;
  docenteId?: string;
  accion: string;
  puntajeAnterior: number;
  puntajeNuevo: number;
  horasAsignadasAntes: number;
  horasAsignadasDespues: number;
  detalles?: string;
}

interface EstrategiaResult {
  asignaciones: any[];
  pendientes: BlockGroup[];
  bloquesMixtos: number;
  razonesMixtos: string[];
}

// ── Clonar docAvail ────────────────────────────────────────────────────────
function clonarDocAvail(orig: Map<string, Map<string, number>>): Map<string, Map<string, number>> {
  const copy = new Map<string, Map<string, number>>();
  for (const [k, v] of orig) copy.set(k, new Map(v));
  return copy;
}

// ── Validación final de solución ───────────────────────────────────────────
export interface ErrorValidacion {
  codigo: 'BLOQUE_DUPLICADO' | 'LABORATORIO_DIVIDIDO' | 'BLOQUE_INDIVISIBLE_PARCIAL' | 'HORAS_EXCEDIDAS' | 'HORAS_FALTANTES' | 'CURSO_INCOMPLETO' | 'CONFLICTO_DOCENTE' | 'CONFLICTO_GRUPO' | 'CONFLICTO_AMBIENTE' | 'CLAVE_BLOQUE_AUSENTE';
  mensaje: string;
  clave_bloque?: string;
  pc_id?: string;
  curso_id?: string;
  grupo_id?: string;
  docente_id?: string;
  lab_turno?: number;
  esperadas?: number;
  encontradas?: number;
}

export interface ValidacionSolucion {
  valida: boolean;
  errores: string[];
  advertencias: string[];
}

export interface ValidacionSolucionFinal {
  valida: boolean;
  errores: string[];
  errores_estructurados: ErrorValidacion[];
  advertencias: string[];
  resumen: {
    duplicados: number;
    conflictosDocente: number;
    conflictosGrupo: number;
    conflictosAmbiente: number;
    bloquesIncompletos: number;
    bloquesNoContiguos: number;
    mixtosInvalidos: number;
    horasFaltantes: number;
    horasExcedentes: number;
    bloquesDuplicados: number;
  };
}

export function validarSolucionFinal(
  asignaciones: Record<string, unknown>[],
  cursos: Record<string, unknown>[],
  slots: SlotRow[],
): ValidacionSolucionFinal {
  const errores: string[] = [];
  const erroresEstructurados: ErrorValidacion[] = [];
  const advertencias: string[] = [];

  const slotOrden = new Map<string, number>();
  for (const s of slots) slotOrden.set(s.id, s.orden);

  // Counters for resumen
  let duplicados = 0;
  let conflictosDocente = 0;
  let conflictosGrupo = 0;
  let conflictosAmbiente = 0;
  let bloquesIncompletos = 0;
  let bloquesNoContiguos = 0;
  let mixtosInvalidos = 0;
  let bloquesDuplicados = 0;
  const horasFaltantesSet = new Set<string>();
  const horasExcedentesSet = new Set<string>();

  if (asignaciones.length === 0) {
    return {
      valida: false, errores: ['No hay asignaciones'], errores_estructurados: [], advertencias: [],
      resumen: { duplicados: 0, conflictosDocente: 0, conflictosGrupo: 0, conflictosAmbiente: 0, bloquesIncompletos: 0, bloquesNoContiguos: 0, mixtosInvalidos: 0, horasFaltantes: 0, horasExcedentes: 0, bloquesDuplicados: 0 },
    };
  }

  // ── 0a. Asignaciones sin clave_bloque ───────────────────────────────────
  for (const a of asignaciones) {
    if (!a.clave_bloque) {
      errores.push(`CLAVE_BLOQUE_AUSENTE: asignación ${a.id} sin clave_bloque`);
      erroresEstructurados.push({ codigo: 'CLAVE_BLOQUE_AUSENTE', mensaje: `Asignación ${a.id} sin clave_bloque` });
    }
  }

  // ── 0b. Bloques duplicados por clave_bloque (mismo bloque en > de un día o > horas que requeridas) ───
  const bloquesPorClave = new Map<string, { dias: Set<string>; horas: number; bloque_total?: number; partes: Set<number> }>();
  for (const a of asignaciones) {
    const ck = a.clave_bloque as string | undefined;
    if (!ck) continue;
    if (!bloquesPorClave.has(ck)) bloquesPorClave.set(ck, { dias: new Set(), horas: 0, bloque_total: (a.bloque_total as number) || undefined, partes: new Set() });
    const b = bloquesPorClave.get(ck)!;
    b.dias.add(a.dia as string);
    b.horas++;
    if (a.bloque_parte) b.partes.add(a.bloque_parte as number);
  }
  for (const [ck, info] of bloquesPorClave) {
    const req = info.bloque_total;
    if (req && info.horas > req) {
      bloquesDuplicados++;
      errores.push(`BLOQUE_DUPLICADO: clave ${ck} tiene ${info.horas}h asignadas (requiere ${req}h) — mismo bloque en más de un día: ${[...info.dias].join(', ')}`);
      erroresEstructurados.push({ codigo: 'BLOQUE_DUPLICADO', mensaje: `Clave ${ck}: ${info.horas}h encontradas, ${req}h esperadas`, clave_bloque: ck, esperadas: req, encontradas: info.horas });
    }
    if (info.dias.size > 1 && req) {
      const totalPartes = [...info.partes].sort((a, b) => a - b).join(',');
      errores.push(`BLOQUE_DUPLICADO: clave ${ck} aparece en ${[...info.dias].join(', ')} con partes (${totalPartes})`);
    }
    if (bloquesDuplicados > 0 && info.dias.size > 1 && req && info.horas >= req) {
      bloquesDuplicados++;
    }
  }

  // ── 1. Duplicados (mismo slot+ambiente+docente+grupo) ────────────────────
  const visto = new Set<string>();
  for (const a of asignaciones) {
    const k = `${a.dia}|${a.slot_id}|${a.docente_id || ''}|${a.grupo_id || ''}|${a.ambiente_id || ''}`;
    if (visto.has(k)) duplicados++;
    visto.add(k);
  }
  if (duplicados > 0) errores.push(`Asignaciones duplicadas: ${duplicados}`);

  // ── 2. Cruces de docente ─────────────────────────────────────────────────
  const docSlots = new Set<string>();
  for (const a of asignaciones) {
    if (!a.docente_id) continue;
    const k = `${a.docente_id}|${a.dia}|${a.slot_id}`;
    if (docSlots.has(k)) {
      conflictosDocente++;
      erroresEstructurados.push({ codigo: 'CONFLICTO_DOCENTE', mensaje: `Docente ${a.docente_id} en ${a.dia} slot ${a.slot_id}` });
    }
    docSlots.add(k);
  }
  if (conflictosDocente > 0) errores.push(`Cruces de docente: ${conflictosDocente}`);

  // ── 3. Cruces de grupo ───────────────────────────────────────────────────
  const grpSlots = new Set<string>();
  for (const a of asignaciones) {
    if (!a.grupo_id) continue;
    const k = `${a.grupo_id}|${a.dia}|${a.slot_id}`;
    if (grpSlots.has(k)) {
      conflictosGrupo++;
      erroresEstructurados.push({ codigo: 'CONFLICTO_GRUPO', mensaje: `Grupo ${a.grupo_id} en ${a.dia} slot ${a.slot_id}` });
    }
    grpSlots.add(k);
  }
  if (conflictosGrupo > 0) errores.push(`Cruces de grupo: ${conflictosGrupo}`);

  // ── 4. Cruces de ambiente ────────────────────────────────────────────────
  const ambSlots = new Set<string>();
  for (const a of asignaciones) {
    if (!a.ambiente_id) continue;
    const k = `${a.ambiente_id}|${a.dia}|${a.slot_id}`;
    if (ambSlots.has(k)) {
      conflictosAmbiente++;
      erroresEstructurados.push({ codigo: 'CONFLICTO_AMBIENTE', mensaje: `Ambiente ${a.ambiente_id} en ${a.dia} slot ${a.slot_id}` });
    }
    ambSlots.add(k);
  }
  if (conflictosAmbiente > 0) errores.push(`Cruces de ambiente: ${conflictosAmbiente}`);

  // ── 5. Horas exactas por (curso, grupo, tipo, lab_turno) ────────────
  const reqCounts = new Map<string, number>();
  for (const c of cursos) {
    const factorLab = (c.horas_laboratorio as number || 0) > 0 ? Math.max(1, Number(c.cantidad_labs) || 1) : 0;
    const baseKey = `${c.curso_id || c.id}|${c.grupo_id || ''}`;
    const ht = c.horas_teoria as number || 0;
    const hp = c.horas_practica as number || 0;
    const hl = c.horas_laboratorio as number || 0;
    if (ht > 0) reqCounts.set(`${baseKey}|teoria|0`, (reqCounts.get(`${baseKey}|teoria|0`) || 0) + ht);
    if (hp > 0) reqCounts.set(`${baseKey}|practica|0`, (reqCounts.get(`${baseKey}|practica|0`) || 0) + hp);
    for (let t = 1; t <= factorLab; t++) {
      reqCounts.set(`${baseKey}|laboratorio|${t}`, (reqCounts.get(`${baseKey}|laboratorio|${t}`) || 0) + hl);
    }
  }

  // Count actually assigned
  const asigCounts = new Map<string, number>();
  for (const a of asignaciones) {
    const k = `${a.curso_id || ''}|${a.grupo_id || ''}|${a.tipo || ''}|${a.lab_turno || 0}`;
    asigCounts.set(k, (asigCounts.get(k) || 0) + 1);
  }

  for (const [k, needed] of reqCounts) {
    const have = asigCounts.get(k) || 0;
    if (have < needed) {
      errores.push(`Horas faltantes para ${k}: esperadas ${needed}, asignadas ${have}`);
      erroresEstructurados.push({ codigo: 'HORAS_FALTANTES', mensaje: `${k}: ${have}/${needed}`, esperadas: needed, encontradas: have });
      horasFaltantesSet.add(k);
    } else if (have > needed) {
      errores.push(`Horas excedentes para ${k}: esperadas ${needed}, asignadas ${have}`);
      erroresEstructurados.push({ codigo: 'HORAS_EXCEDIDAS', mensaje: `${k}: ${have}/${needed}`, esperadas: needed, encontradas: have });
      horasExcedentesSet.add(k);
    }
  }

  for (const [k, have] of asigCounts) {
    if (!reqCounts.has(k)) {
      errores.push(`Horas excedentes sin requerimiento para ${k}: ${have}`);
      erroresEstructurados.push({ codigo: 'HORAS_EXCEDIDAS', mensaje: `Sin requerimiento: ${k} (${have})` });
      horasExcedentesSet.add(k);
    }
  }

  // ── 6. Continuidad de bloques indivisibles ───────────────────────────────
  const bloquesContinuos = new Map<string, { slots: number[]; total: number; dia?: string; ambiente?: string; clave_bloque?: string }>();
  for (const a of asignaciones) {
    const bcId = a.bloque_continuo_id as string | undefined;
    if (!bcId) continue;
    if (!bloquesContinuos.has(bcId)) {
      bloquesContinuos.set(bcId, { slots: [], total: (a.bloque_total as number) || 1, dia: a.dia as string, ambiente: a.ambiente_id as string, clave_bloque: a.clave_bloque as string });
    }
    const b = bloquesContinuos.get(bcId)!;
    b.slots.push(slotOrden.get(a.slot_id as string) ?? 0);
  }
  for (const [id, b] of bloquesContinuos) {
    if (b.slots.length !== b.total) {
      errores.push(`Bloque continuo ${id}: esperadas ${b.total} partes, encontradas ${b.slots.length}`);
      erroresEstructurados.push({ codigo: 'BLOQUE_INDIVISIBLE_PARCIAL', mensaje: `bloque_continuo_id ${id}: ${b.slots.length}/${b.total}`, clave_bloque: b.clave_bloque, esperadas: b.total, encontradas: b.slots.length });
      bloquesIncompletos++;
    }
    b.slots.sort((a, b) => a - b);
    for (let i = 1; i < b.slots.length; i++) {
      if (b.slots[i] - b.slots[i - 1] !== 1) {
        errores.push(`Bloque continuo ${id}: slots no consecutivos (${b.slots.join(',')})`);
        bloquesNoContiguos++;
        break;
      }
    }
  }

  // ── 7. Validez de bloques mixtos ─────────────────────────────────────────
  for (const a of asignaciones) {
    if (a.es_mixto) {
      if (!a.tipo_mixto) {
        errores.push(`Asignación mixta sin tipo_mixto`);
        mixtosInvalidos++;
      }
      const tm = a.tipo_mixto as string;
      if (tm === 'completo' && (!a.horas_teoria_mixtas || !a.horas_practica_mixtas)) {
        errores.push(`Mixto completo sin horas_teoria_mixtas/horas_practica_mixtas`);
        mixtosInvalidos++;
      }
    }
  }

  // ── 8/9. Caso A y Caso B ────────────────────────────────────────────────
  const mixtosPorCurso = new Map<string, Record<string, unknown>[]>();
  for (const a of asignaciones) {
    if (!a.es_mixto) continue;
    const k = `${a.curso_id || ''}|${a.grupo_id || ''}|${a.docente_id || ''}`;
    if (!mixtosPorCurso.has(k)) mixtosPorCurso.set(k, []);
    mixtosPorCurso.get(k)!.push(a);
  }
  for (const [k, mixes] of mixtosPorCurso) {
    const completo = mixes.find(m => m.tipo_mixto === 'completo');
    if (completo) continue;
    const remanentes = asignaciones.filter(a2 =>
      !a2.es_mixto &&
      a2.curso_id === mixes[0].curso_id &&
      a2.grupo_id === mixes[0].grupo_id &&
      a2.docente_id === mixes[0].docente_id
    );
    const remT = remanentes.filter(r => r.tipo === 'teoria').length;
    const remP = remanentes.filter(r => r.tipo === 'practica').length;
    if (remT > 0 && remP > 0) {
      errores.push(`Caso A/B inválido para ${k}: quedan ${remT}h teoría y ${remP}h práctica como remanentes`);
      mixtosInvalidos++;
    }
  }

  // ── 10. No exista hora asignada y pendiente simultáneamente ──────────────
  const horasAsignadas = new Set<string>();
  for (const a of asignaciones) {
    horasAsignadas.add(`${a.curso_id}|${a.grupo_id}|${a.tipo}|${a.lab_turno || 0}`);
  }
  for (const [k, needed] of reqCounts) {
    if (needed > 0 && !horasAsignadas.has(k)) {
      advertencias.push(`Horas requeridas sin asignación para ${k}: ${needed}`);
    }
  }

  const resumen = {
    duplicados,
    conflictosDocente,
    conflictosGrupo,
    conflictosAmbiente,
    bloquesIncompletos,
    bloquesNoContiguos,
    mixtosInvalidos,
    horasFaltantes: horasFaltantesSet.size,
    horasExcedentes: horasExcedentesSet.size,
    bloquesDuplicados,
  };

  return {
    valida: errores.length === 0,
    errores,
    errores_estructurados: erroresEstructurados,
    advertencias,
    resumen,
  };
}

// ── Calcular puntaje global de una solución (todos los criterios) ──────────
export function calcularPuntajeSolucion(
  asignaciones: any[],
  totalHoras: number,
  conflictos: string[],
  bloquesMixtosCount: number,
  slots: SlotRow[],
): PuntajeSolucion {
  const horasAsignadas = asignaciones.length;
  const horasPendientes = totalHoras - horasAsignadas;
  const conflictosDuros = conflictos.length;

  // Build slot orden map
  const slotOrden = new Map<string, number>();
  for (const s of slots) slotOrden.set(s.id, s.orden);

  const getOrden = (a: any) => slotOrden.get(a.slot_id) ?? 0;

  // Group by docente+curso+grupo+tipo+lab_turno+dia for correct fragmentation
  const porSegmento = new Map<string, number[]>();
  for (const a of asignaciones) {
    if (!a.docente_id) continue;
    const k = `${a.docente_id}|${a.curso_id}|${a.grupo_id}|${a.tipo}|${a.lab_turno || 0}|${a.dia}`;
    if (!porSegmento.has(k)) porSegmento.set(k, []);
    porSegmento.get(k)!.push(getOrden(a));
  }

  // Fragmentación (por todas las dimensiones)
  let bloquesFragmentados = 0;
  for (const slotsArr of porSegmento.values()) {
    if (slotsArr.length < 3) continue;
    slotsArr.sort((a, b) => a - b);
    let segmentos = 1;
    for (let i = 1; i < slotsArr.length; i++) {
      if (slotsArr[i] - slotsArr[i - 1] > 1) segmentos++;
    }
    if (segmentos > 2) bloquesFragmentados += segmentos - 2;
  }

  // Group by docente+dia for gaps, extra days
  const porDocDia = new Map<string, Map<string, number[]>>();
  for (const a of asignaciones) {
    if (!a.docente_id) continue;
    if (!porDocDia.has(a.docente_id)) porDocDia.set(a.docente_id, new Map());
    const dd = porDocDia.get(a.docente_id)!;
    if (!dd.has(a.dia)) dd.set(a.dia, []);
    dd.get(a.dia)!.push(getOrden(a));
  }

  // Huecos
  let huecosTotales = 0;
  for (const dd of porDocDia.values()) {
    for (const slotsArr of dd.values()) {
      if (slotsArr.length < 2) continue;
      slotsArr.sort((a, b) => a - b);
      for (let i = 1; i < slotsArr.length; i++) {
        const diff = slotsArr[i] - slotsArr[i - 1];
        if (diff > 1) huecosTotales += diff - 1;
      }
    }
  }

  // Días adicionales (>3 por docente)
  let diasAdicionales = 0;
  for (const dd of porDocDia.values()) {
    if (dd.size > 3) diasAdicionales += dd.size - 3;
  }

  // Uso de sábado
  const usoSabado = asignaciones.filter(a => a.dia === 'sabado').length;

  // Teoría después de práctica (slots ordenados con tipo)
  let teoriaPracticaInvertidas = 0;
  const tpPairs = new Map<string, Map<string, { orden: number; tipo: string }[]>>();
  for (const a of asignaciones) {
    if (!a.docente_id) continue;
    if (!tpPairs.has(a.docente_id)) tpPairs.set(a.docente_id, new Map());
    const dd = tpPairs.get(a.docente_id)!;
    if (!dd.has(a.dia)) dd.set(a.dia, []);
    dd.get(a.dia)!.push({ orden: getOrden(a), tipo: a.tipo });
  }
  for (const dd of tpPairs.values()) {
    for (const pairs of dd.values()) {
      if (pairs.length < 2) continue;
      pairs.sort((a, b) => a.orden - b.orden);
      for (let i = 0; i < pairs.length; i++) {
        if (pairs[i].tipo === 'practica') {
          const idxT = pairs.findIndex(p => p.tipo === 'teoria' && p.orden > pairs[i].orden);
          if (idxT >= 0) { teoriaPracticaInvertidas++; break; }
        }
      }
    }
  }

  // T→P contiguo (bonificación)
  let tpContiguoCount = 0;
  for (const dd of tpPairs.values()) {
    for (const pairs of dd.values()) {
      pairs.sort((a, b) => a.orden - b.orden);
      for (let i = 0; i < pairs.length - 1; i++) {
        if (pairs[i].tipo === 'teoria' && pairs[i + 1].tipo === 'practica'
            && pairs[i + 1].orden - pairs[i].orden === 1) {
          tpContiguoCount++;
        }
      }
    }
  }

  // Docente completo: verificar que todas las horas requeridas están asignadas
  // Agrupar por docente+curso+grupo+tipo+lab_turno
  const reqMap = new Map<string, number>();
  for (const a of asignaciones) {
    const k = `${a.docente_id || '?'}|${a.curso_id || '?'}|${a.grupo_id || '?'}|${a.tipo || '?'}|${a.lab_turno || 0}`;
    reqMap.set(k, (reqMap.get(k) || 0) + 1);
  }
  // We approximate completitud: if the spread of keys is "dense" enough

  // Ambientes alternativos (no preferido para teoría)
  let ambAlternativos = 0;
  for (const a of asignaciones) {
    if (a.tipo === 'teoria' && a.ambiente_tipo !== 'aula') ambAlternativos++;
    if (a.tipo === 'practica' && a.ambiente_tipo === 'aula') ambAlternativos++;
    if (a.tipo === 'laboratorio' && a.ambiente_tipo !== 'laboratorio') ambAlternativos += 2;
  }

  // Calcular puntaje (menor = mejor)
  const pConflictos = conflictosDuros * 10000;
  const pHorasPend = horasPendientes * PENALIZACION_HORA_PENDIENTE;
  const pMixtos = bloquesMixtosCount * PENALIZACION_BLOQUE_MIXTO;
  const pHuecos = huecosTotales * PENALIZACION_HUECO_POR_HORA;
  const pSabado = usoSabado * PENALIZACION_SABADO;
  const pTPInvert = teoriaPracticaInvertidas * PENALIZACION_TEORIA_TRAS_PRACTICA;
  const pFragment = bloquesFragmentados * PENALIZACION_FRAGMENTACION;
  const pDiasAdic = diasAdicionales * PENALIZACION_DIA_ADICIONAL;
  const pAmbAlt = ambAlternativos * PENALIZACION_AMBIENTE_ALTERNATIVO;

  // Bonificaciones
  const bDocCompleto = horasPendientes === 0 ? BONIFICACION_DOCENTE_COMPLETO : 0;
  const bTPContiguo = tpContiguoCount * BONIFICACION_T_P_CONTIGUO_MISMO_DIA;

  const puntaje = Math.max(0, pConflictos + pHorasPend + pMixtos + pHuecos + pSabado
    + pTPInvert + pFragment + pDiasAdic + pAmbAlt - bDocCompleto - bTPContiguo);

  const desglose: Record<string, number> = {
    conflictosDuros: pConflictos,
    horasPendientes: pHorasPend,
    bloquesMixtos: pMixtos,
    huecos: pHuecos,
    uso_sabado: pSabado,
    teoria_practica_invertidas: pTPInvert,
    fragmentacion: pFragment,
    dias_adicionales: pDiasAdic,
    ambientes_alternativos: pAmbAlt,
    bonificacion_docente_completo: -bDocCompleto,
    bonificacion_tp_contiguo: -bTPContiguo,
  };

  return {
    puntajeTotal: puntaje,
    horasTotales: totalHoras,
    horasAsignadas,
    horasPendientes,
    porcentajeCompletitud: totalHoras > 0 ? Math.round(horasAsignadas / totalHoras * 100) : 0,
    conflictosDuros,
    bloquesMixtos: bloquesMixtosCount,
    bloquesFragmentados,
    huecosTotales,
    diasDocenteTotales: diasAdicionales,
    usoSabado,
    teoriaPracticaInvertidas,
    desglose,
  };
}

// ── Evaluación lexicográfica por docente ──────────────────────────────────
export interface EvaluacionDocente {
  cursosTotales: number;
  cursosCompletos: number;
  cursosParciales: number;
  bloquesTotales: number;
  bloquesCompletos: number;
  bloquesPendientes: number;
  horasRequeridas: number;
  horasAsignadas: number;
}

export function esMejorResultadoDocente(
  candidato: EvaluacionDocente,
  actual: EvaluacionDocente,
): boolean {
  if (candidato.cursosCompletos !== actual.cursosCompletos) return candidato.cursosCompletos > actual.cursosCompletos;
  if (candidato.bloquesCompletos !== actual.bloquesCompletos) return candidato.bloquesCompletos > actual.bloquesCompletos;
  if (candidato.horasAsignadas !== actual.horasAsignadas) return candidato.horasAsignadas > actual.horasAsignadas;
  if (candidato.cursosParciales !== actual.cursosParciales) return candidato.cursosParciales < actual.cursosParciales;
  const candPend = candidato.horasRequeridas - candidato.horasAsignadas;
  const actPend = actual.horasRequeridas - actual.horasAsignadas;
  if (candPend !== actPend) return candPend < actPend;
  if (candidato.bloquesPendientes !== actual.bloquesPendientes) return candidato.bloquesPendientes < actual.bloquesPendientes;
  return false;
}

function evaluarResultadoDocente(
  resultado: EstrategiaResult,
  horasRequeridas: number,
  cursosDocente: any[],
): EvaluacionDocente {
  const horasAsignadas = resultado.asignaciones.length;
  const bloquesPendientes = resultado.pendientes.length;

  const cursosCompletosSet = new Set<string>();
  const cursosParcialesSet = new Set<string>();
  for (const c of cursosDocente) {
    const k = `${c.curso_id}|${c.grupo_id || ''}`;
    const totalReq = (c.horas_teoria || 0) + (c.horas_practica || 0) + (c.horas_laboratorio || 0) * Math.max(1, Number(c.cantidad_labs) || 1);
    const asig = resultado.asignaciones.filter(a => a.docente_id === c.docente_id && a.curso_id === c.curso_id).length;
    if (asig >= totalReq) cursosCompletosSet.add(k);
    else if (asig > 0) cursosParcialesSet.add(k);
  }

  const totalBloques = cursosDocente.reduce((s, c) => s + (c.horas_teoria || 0) + (c.horas_practica || 0) + Math.max(1, Number(c.cantidad_labs) || 1) * ((c.horas_laboratorio || 0) > 0 ? 1 : 0), 0);

  return {
    cursosTotales: cursosDocente.length,
    cursosCompletos: cursosCompletosSet.size,
    cursosParciales: cursosParcialesSet.size,
    bloquesTotales: totalBloques,
    bloquesCompletos: horasAsignadas,
    bloquesPendientes,
    horasRequeridas,
    horasAsignadas,
  };
}

// ── Construir bloque mixto parcial (Casos A y B) ──────────────────────────
// Caso A: se consume TOTA la teoría (ht = teoria.units.length), queda solo práctica
// Caso B: se consume TOTA la práctica (hp = practica.units.length), queda solo teoría
// Retorna null si ambas quedan (no se permite)
function construirBloqueMixtoParcial(
  teoria: BlockGroup,
  practica: BlockGroup,
  horasTeoriaMixtas: number,
  horasPracticaMixtas: number,
): { mixto: BlockGroup; remanente: BlockGroup | null } | null {
  const unitsMixto: BlockUnit[] = [
    ...teoria.units.slice(0, horasTeoriaMixtas).map(u => ({
      ...u,
      meta: { ...u.meta, tipo_sesion: 'mixto' as const },
      tipo_sesion: 'mixto' as const,
    })),
    ...practica.units.slice(0, horasPracticaMixtas).map(u => ({
      ...u,
      meta: { ...u.meta, tipo_sesion: 'mixto' as const },
      tipo_sesion: 'mixto' as const,
    })),
  ];

  const mixto: BlockGroup = {
    id: randomUUID(),
    units: unitsMixto,
    indivisible: true,
    tipo_sesion: 'mixto',
  };

  const restoT = teoria.units.slice(horasTeoriaMixtas);
  const restoP = practica.units.slice(horasPracticaMixtas);

  // Reject if BOTH remain (invalid partial mix)
  if (restoT.length > 0 && restoP.length > 0) return null;

  let remanente: BlockGroup | null = null;
  if (restoT.length > 0) {
    remanente = { id: randomUUID(), units: restoT, indivisible: true, tipo_sesion: 'teoria' };
  } else if (restoP.length > 0) {
    remanente = { id: randomUUID(), units: restoP, indivisible: true, tipo_sesion: 'practica' };
  }

  return { mixto, remanente };
}

export async function generarHorarioV2(
  programacion_id: string,
  cursos: any[],
  disponibilidad: any[],
  ambientes: any[],
  slots: SlotRow[],
  docentesProg: any[],
  opts: {
    restrictedIds?: string[];
  } = {},
): Promise<ResolverV2Result> {
  const inicio = Date.now();
  const log: string[] = [];
  const conflictos: string[] = [];
  const conflictosDetalle: Array<{ descripcion: string; datos: object; sugerencia: string }> = [];

  const restrictedIds = opts.restrictedIds || [];
  const util = slotsUtiles(slots, restrictedIds);

  const docAvail = new Map<string, Map<string, number>>();
  for (const d of disponibilidad) {
    if (!docAvail.has(d.docente_id)) docAvail.set(d.docente_id, new Map());
    docAvail.get(d.docente_id)!.set(`${d.dia}-${d.slot_id}`, d.prioridad);
  }

  const ambAvail: AmbAvailMap = new Map();
  for (const a of ambientes) {
    if (a.tipo !== 'laboratorio') continue;
    if (!ambAvail.has(a.id)) ambAvail.set(a.id, new Set());
    for (const d of DIAS_EXT) {
      for (const s of util) {
        ambAvail.get(a.id)!.add(`${d}-${s.id}`);
      }
    }
  }

  // Build independent blocks per type
  const todosLosBloques = construirBloquesIndependientes(cursos);
  log.push(`[V2] Bloques construidos: ${todosLosBloques.length} (${todosLosBloques.filter(b => b.tipo_sesion === 'teoria').length} teoría, ${todosLosBloques.filter(b => b.tipo_sesion === 'practica').length} práctica, ${todosLosBloques.filter(b => b.tipo_sesion === 'laboratorio').length} laboratorio)`);

  // ── Verificación pre-CSP: cada clave_bloque debe aparecer exactamente una vez ──
  const clavesPreCSP = new Map<string, { grupo: BlockGroup; count: number }[]>();
  for (const b of todosLosBloques) {
    const meta = b.units[0]?.meta || {};
    const ck = claveBloqueAcademico(meta);
    if (!clavesPreCSP.has(ck)) clavesPreCSP.set(ck, []);
    clavesPreCSP.get(ck)!.push({ grupo: b, count: (clavesPreCSP.get(ck)?.length || 0) + 1 });
  }
  for (const [ck, entries] of clavesPreCSP) {
    if (entries.length > 1) {
      const first = entries[0].grupo.units[0]?.meta || {};
      throw new Error(
        `Bloque duplicado antes del CSP: ${ck} (${entries.length} instancias) | ` +
        `pc_id=${first.pc_id || first.id} curso=${first.curso_id} grupo=${first.grupo_id} tipo=${first.tipo_sesion} turno=${first.lab_turno}`
      );
    }
  }

  // Group blocks by docente
  const bloquesPorDocente = groupBy(todosLosBloques, b => b.units[0]?.meta?.docente_id || 'sin_docente');
  const totalHoras = todosLosBloques.reduce((s, b) => s + b.units.length, 0);

  // Sort docentes by priority
  const docentesOrdenados = sortDocentes(docentesProg);
  log.push(`[V2] Docentes ordenados por prioridad: ${docentesOrdenados.map(d => `${d.nombre} (${d.condicion}, ${d.categoria})`).join(' → ')}`);

  const occ = initOccupancy();
  let asignacionesFinales: any[] = [];
  const bloquesPendientes: BlockGroup[] = [];
  let bloquesMixtosCount = 0;

  const cspOpts = { practicaEnAula: false, restrictedIds, incluirSabado: false };

  interface DocHolding {
    docente_id: string;
    total: number;
    asignadas: number;
  }
  const docResults = new Map<string, DocHolding>();
  for (const d of docentesOrdenados) {
    docResults.set(d.docente_id, { docente_id: d.docente_id, total: 0, asignadas: 0 });
  }

  // ── FASE 1: Docente-priority CSP con reintentos ─────────────────────────────
  log.push(`[V2] ═══ FASE 1: Docente-priority CSP con reintentos ═══`);
  let iteracionesCsp = 0;
  const reintentosPorDocente: Record<string, number> = {};
  const mejoras: MejoraIteracion[] = [];
  const razonesMixtosGlobal: string[] = [];

  for (const doc of docentesOrdenados) {
    const bloques = bloquesPorDocente.get(doc.docente_id) || [];
    if (bloques.length === 0) continue;

    const docHoras = bloques.reduce((s, b) => s + b.units.length, 0);
    const res = docResults.get(doc.docente_id)!;
    res.total = docHoras;

    log.push(`[V2] Procesando: ${doc.nombre} (${doc.condicion}, ${doc.categoria}) — ${docHoras}h en ${bloques.length} bloques`);

    // ── Reintentos por docente ──────────────────────────────────────────────
    let mejorResultado: EstrategiaResult | null = null;
    let mejorEval: EvaluacionDocente | null = null;
    const cursosDelDocente = cursos.filter((c: any) => c.docente_id === doc.docente_id);

    for (let intento = 0; intento < MAX_REINTENTOS_POR_DOCENTE; intento++) {
      iteracionesCsp++;
      // ── Estado aislado por intento ──────────────────────────────────────
      const occTemp = cloneOccupancy(occ);
      const docAvailTemp = clonarDocAvail(docAvail);
      let asignadosTemp: any[] = [];
      // Comienza con los bloques originales clonados; se remueven al asignar
      let pendientesTemp: BlockGroup[] = bloques.map(clonarBloque);
      let mixtosTemp = 0;
      const razonesMixtosTemp: string[] = [];
      const cspOptsTemp = {
        practicaEnAula: (intento >= 4) ? true : cspOpts.practicaEnAula,
        restrictedIds,
        incluirSabado: (intento >= 6) ? true : false,
        rotacion: (intento % 4),
      };
      // Track assigned claves to prevent any duplication within this intento
      const assignedClaves = new Set<string>();

      const bloquesPorCursoGrupo = groupBy(bloques, b => b.units[0]?.meta?.curso_group_key || b.id);

      for (const [_key, grupos] of bloquesPorCursoGrupo) {
        const teoria = grupos.find(b => b.tipo_sesion === 'teoria');
        const practica = grupos.find(b => b.tipo_sesion === 'practica');
        const labs = grupos.filter(b => b.tipo_sesion === 'laboratorio');

        // E1: T→P contiguo
        if (teoria && practica) {
          let tpOk = false;
          for (const p of [1, 2]) {
            const tpRes = intentarAsignarTPContiguo(teoria, practica, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
            if (tpRes.ok) {
              asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, tpRes.asignaciones);
              for (const ta of tpRes.asignaciones) { if (ta.clave_bloque) assignedClaves.add(ta.clave_bloque); }
              tpOk = true;
              log.push(`[V2] ${doc.nombre} → ${teoria.units[0].meta.codigo} T+P contiguos (${teoria.units.length}+${practica.units.length}h, P${p}) [intento ${intento}]`);
              break;
            }
          }
          if (tpOk) {
            // Also assign labs (only if not already assigned)
            for (const lab of labs) {
              const labCk = lab.units[0]?.meta ? claveBloqueAcademico({ ...lab.units[0].meta, pc_id: lab.units[0].meta.pc_id ?? lab.units[0].meta.id }) : '';
              if (labCk && assignedClaves.has(labCk)) continue;
              for (const p of [1, 2]) {
                const lRes = asignarGrupoContinuo(lab, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
                if (lRes.ok) {
                  asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, lRes.asignaciones);
                  for (const la of lRes.asignaciones) { if (la.clave_bloque) assignedClaves.add(la.clave_bloque); }
                  break;
                }
              }
            }
            continue;
          }

          // E2: Bloques separados
          for (const b of [teoria, practica]) {
            const bCk = b.units[0]?.meta ? claveBloqueAcademico({ ...b.units[0].meta, pc_id: b.units[0].meta.pc_id ?? b.units[0].meta.id }) : '';
            if (bCk && assignedClaves.has(bCk)) continue;
            for (const p of [1, 2]) {
              const bRes = asignarGrupoContinuo(b, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
              if (bRes.ok) {
                asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, bRes.asignaciones);
                for (const ba of bRes.asignaciones) { if (ba.clave_bloque) assignedClaves.add(ba.clave_bloque); }
                log.push(`[V2] ${doc.nombre} → ${b.units[0].meta.codigo} ${b.tipo_sesion} ${b.units.length}h (P${p}) [intento ${intento}]`);
                break;
              }
            }
          }
        } else {
          // Individual blocks
          for (const grupo of grupos) {
            const gCk = grupo.units[0]?.meta ? claveBloqueAcademico({ ...grupo.units[0].meta, pc_id: grupo.units[0].meta.pc_id ?? grupo.units[0].meta.id }) : '';
            if (gCk && assignedClaves.has(gCk)) continue;
            for (const p of [1, 2]) {
              const gRes = asignarGrupoContinuo(grupo, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
              if (gRes.ok) {
                asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, gRes.asignaciones);
                for (const ga of gRes.asignaciones) { if (ga.clave_bloque) assignedClaves.add(ga.clave_bloque); }
                log.push(`[V2] ${doc.nombre} → ${grupo.units[0].meta.codigo} ${grupo.tipo_sesion} ${grupo.units.length}h (P${p}) [intento ${intento}]`);
                break;
              }
            }
          }
        }

        // Assign labs (atomic replacement prevents duplicate clave_bloque)
        for (const lab of labs) {
          const lCk = lab.units[0]?.meta ? claveBloqueAcademico({ ...lab.units[0].meta, pc_id: lab.units[0].meta.pc_id ?? lab.units[0].meta.id }) : '';
          if (lCk && assignedClaves.has(lCk)) continue;
          let lOk = false;
          for (const p of [1, 2]) {
            const lRes = asignarGrupoContinuo(lab, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
            if (lRes.ok) {
              asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, lRes.asignaciones);
              for (const la of lRes.asignaciones) { if (la.clave_bloque) assignedClaves.add(la.clave_bloque); }
              lOk = true;
              break;
            }
          }
          if (!lOk) {
            // Only add to pendientes if not already assigned via clave
            if (!lCk || !assignedClaves.has(lCk)) pendientesTemp.push(lab);
          }
        }
      }

      // Remove assigned blocks from pendientesTemp
      pendientesTemp = pendientesTemp.filter(b => {
        const ck = b.units[0]?.meta ? claveBloqueAcademico({ ...b.units[0].meta, pc_id: b.units[0].meta.pc_id ?? b.units[0].meta.id }) : '';
        return !ck || !assignedClaves.has(ck);
      });

      // Collect blocks still unassigned
      const teoriasPend = pendientesTemp.filter(b => b.tipo_sesion === 'teoria');
      const practicasPend = pendientesTemp.filter(b => b.tipo_sesion === 'practica');
      const labsPend = pendientesTemp.filter(b => b.tipo_sesion === 'laboratorio');

      const consumidos = new Set<string>();

      // E7: Mixed blocks for remaining T+P
      for (const t of teoriasPend) {
        if (consumidos.has(t.id)) continue;
        const pair = practicasPend.find(p =>
          !consumidos.has(p.id) &&
          p.units[0]?.meta?.curso_group_key === t.units[0]?.meta?.curso_group_key
        );
        if (pair) {
          const fullMixto = construirBloqueMixtoTP(t, pair);
          let mOk = false;
          for (const p of [1, 2]) {
            const mRes = asignarGrupoContinuo(fullMixto, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
            if (mRes.ok) {
              for (const a of mRes.asignaciones) {
                a.es_mixto = true;
                a.razon_mixto = `No se encontró un bloque continuo separado de ${t.units.length}h teoría y ${pair.units.length}h práctica. Se asignó bloque mixto completo.`;
                a.tipo_mixto = 'completo';
                a.horas_teoria_mixtas = t.units.length;
                a.horas_practica_mixtas = pair.units.length;
              }
              // Skip if any of these claves are already assigned
              const nuevasClavesMix = new Set(mRes.asignaciones.map((aa: any) => aa.clave_bloque).filter(Boolean));
              const yaAsignadas = [...nuevasClavesMix].some(ck => assignedClaves.has(ck));
              if (!yaAsignadas) {
                asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, mRes.asignaciones);
                for (const aa of mRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
                mixtosTemp++;
                razonesMixtosTemp.push(`Bloque mixto completo de ${t.units.length}h teoría + ${pair.units.length}h práctica`);
                mOk = true;
                consumidos.add(t.id);
                consumidos.add(pair.id);
                log.push(`[V2] ${doc.nombre} → ${t.units[0].meta.codigo} BLOQUE MIXTO COMPLETO ${fullMixto.units.length}h [intento ${intento}]`);
              }
              break;
            }
          }
          if (mOk) continue;

          // E8: Casos A/B
          let parcialOkGlobal = false;
          for (let ht = 1; ht <= t.units.length && !parcialOkGlobal; ht++) {
            const hp = (ht === t.units.length)
              ? Math.min(pair.units.length - 1, Math.max(1, pair.units.length - 1))
              : pair.units.length;
            if (ht === t.units.length && hp === pair.units.length) continue;
            if (hp < 1) continue;
            const parcial = construirBloqueMixtoParcial(t, pair, ht, hp);
            if (!parcial) continue;
            for (const p of [1, 2]) {
              const mRes = asignarGrupoContinuo(parcial.mixto, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
              if (!mRes.ok) continue;
              if (parcial.remanente) {
                const rRes = asignarGrupoContinuo(parcial.remanente, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
                if (!rRes.ok) continue;
                for (const a of rRes.asignaciones) a.es_mixto = false;
                const rClaves = rRes.asignaciones.map((aa: any) => aa.clave_bloque).filter(Boolean);
                if (rClaves.some(ck => assignedClaves.has(ck))) continue;
                asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, rRes.asignaciones);
                for (const aa of rRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
              }
              for (const a of mRes.asignaciones) {
                a.es_mixto = true;
                const tipoStr = parcial.remanente?.tipo_sesion === 'teoria' ? 'mixto_mas_teoria' : 'mixto_mas_practica';
                a.razon_mixto = `Se asignaron ${ht}h teoría + ${hp}h práctica en bloque mixto y ${parcial.remanente?.units.length || 0}h de ${parcial.remanente?.tipo_sesion || ''} separadas.`;
                a.tipo_mixto = tipoStr;
                a.horas_teoria_mixtas = ht;
                a.horas_practica_mixtas = hp;
              }
              const mClaves = mRes.asignaciones.map((aa: any) => aa.clave_bloque).filter(Boolean);
              if (mClaves.some(ck => assignedClaves.has(ck))) continue;
              asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, mRes.asignaciones);
              for (const aa of mRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
              mixtosTemp++;
              razonesMixtosTemp.push(`Bloque mixto parcial (${ht}T+${hp}P) + ${parcial.remanente?.units.length || 0}h ${parcial.remanente?.tipo_sesion || ''}`);
              parcialOkGlobal = true;
              consumidos.add(t.id);
              consumidos.add(pair.id);
              log.push(`[V2] ${doc.nombre} → ${t.units[0].meta.codigo} BLOQUE MIXTO PARCIAL (${ht}T+${hp}P) + ${parcial.remanente?.units.length || 0}h ${parcial.remanente?.tipo_sesion || ''} [intento ${intento}]`);
              break;
            }
          }
          if (parcialOkGlobal) continue;
        }
        // Unpaired theory
        if (!consumidos.has(t.id)) {
          const ck = t.units[0]?.meta ? claveBloqueAcademico({ ...t.units[0].meta, pc_id: t.units[0].meta.pc_id ?? t.units[0].meta.id }) : '';
          if (ck && assignedClaves.has(ck)) continue;
          for (const p of [1, 2]) {
            const tRes = asignarGrupoContinuo(t, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
            if (tRes.ok) {
              asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, tRes.asignaciones);
              for (const aa of tRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
              consumidos.add(t.id);
              break;
            }
          }
        }
      }

      // Remaining prácticas
      for (const pr of practicasPend) {
        if (consumidos.has(pr.id)) continue;
        const ck = pr.units[0]?.meta ? claveBloqueAcademico({ ...pr.units[0].meta, pc_id: pr.units[0].meta.pc_id ?? pr.units[0].meta.id }) : '';
        if (ck && assignedClaves.has(ck)) continue;
        for (const pp of [1, 2]) {
          const pRes = asignarGrupoContinuo(pr, slots, ambientes, docAvailTemp, occTemp, pp, ambAvail, cspOptsTemp);
          if (pRes.ok) {
            asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, pRes.asignaciones);
            for (const aa of pRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
            consumidos.add(pr.id);
            break;
          }
        }
      }

      // Remaining labs
      for (const lab of labsPend) {
        if (consumidos.has(lab.id)) continue;
        const ck = lab.units[0]?.meta ? claveBloqueAcademico({ ...lab.units[0].meta, pc_id: lab.units[0].meta.pc_id ?? lab.units[0].meta.id }) : '';
        if (ck && assignedClaves.has(ck)) continue;
        for (const ll of [1, 2]) {
          const lRes = asignarGrupoContinuo(lab, slots, ambientes, docAvailTemp, occTemp, ll, ambAvail, cspOptsTemp);
          if (lRes.ok) {
            asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, lRes.asignaciones);
            for (const aa of lRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
            break;
          }
        }
      }

      pendientesTemp = pendientesTemp.filter(b => !consumidos.has(b.id));

      // ── Auditoría interna antes de evaluar ──
      try {
        auditarBloques(`DOC_${doc.docente_id}_INTENTO_${intento}_FINAL`, asignadosTemp);
      } catch {
        log.push(`[V2] Intento ${intento} de ${doc.nombre} descartado: contiene bloques duplicados`);
        continue;
      }

      const estrategiaResult: EstrategiaResult = {
        asignaciones: asignadosTemp,
        pendientes: pendientesTemp,
        bloquesMixtos: mixtosTemp,
        razonesMixtos: razonesMixtosTemp,
      };

      const evalDoc = evaluarResultadoDocente(estrategiaResult, docHoras, cursosDelDocente);
      if (!mejorEval || esMejorResultadoDocente(evalDoc, mejorEval)) {
        mejorEval = evalDoc;
        mejorResultado = estrategiaResult;
      }
    }

    // ── Backtracking limitado: reemplazo atómico por clave_bloque ──
    if (mejorResultado && mejorResultado.pendientes.length > 0) {
      log.push(`[V2] Backtracking para ${doc.nombre}: ${mejorResultado.pendientes.length} bloques pendientes`);
      const { pendientes: pendientesBack } = mejorResultado;
      const coursesSeen = new Set<string>();
      for (const bPend of pendientesBack) {
        const metaP = bPend.units[0]?.meta || {};
        const cursoKey = `${metaP.curso_id}|${metaP.grupo_id || ''}|${metaP.tipo_sesion}`;
        if (coursesSeen.has(cursoKey)) continue;
        coursesSeen.add(cursoKey);
        const mismatched = mejorResultado.asignaciones.filter(a =>
          a.curso_id === metaP.curso_id && a.grupo_id === metaP.grupo_id
        );
        if (mismatched.length === 0) continue;
        const occBk = cloneOccupancy(occ);
        const docAvailBk = clonarDocAvail(docAvail);
        const otrasAsign = mejorResultado.asignaciones.filter(a =>
          !(a.curso_id === metaP.curso_id && a.grupo_id === metaP.grupo_id)
        );
        for (const a of otrasAsign) {
          const ambBk = ambientes.find((ax: any) => ax.id === a.ambiente_id);
          if (ambBk) marcarOcupado(a, a.dia, a.slot_id, a.ambiente_id, occBk);
        }
        for (const p of [1, 2]) {
          const bRes = asignarGrupoContinuo(bPend, slots, ambientes, docAvailBk, occBk, p, ambAvail, cspOpts);
          if (bRes.ok) {
            // Atomic replacement: remove old key → add new
            const sinAnteriores = reemplazarEnAsignaciones(otrasAsign, bRes.asignaciones);
            const nuevoEval: EstrategiaResult = {
              asignaciones: sinAnteriores,
              pendientes: pendientesBack.filter(b => b.id !== bPend.id),
              bloquesMixtos: mejorResultado.bloquesMixtos,
              razonesMixtos: mejorResultado.razonesMixtos,
            };
            // Audit before accepting backtrack candidate
            try {
              auditarBloques(`DOC_${doc.docente_id}_BACKTRACK_${metaP.curso_id}`, sinAnteriores);
            } catch {
              log.push(`[V2] Backtracking para ${metaP.codigo || '?'}: candidato con duplicados, descartado`);
              break;
            }
            const nuevoEvalDoc = evaluarResultadoDocente(nuevoEval, docHoras, cursosDelDocente);
            if (mejorEval && esMejorResultadoDocente(nuevoEvalDoc, mejorEval)) {
              mejorEval = nuevoEvalDoc;
              mejorResultado = nuevoEval;
              log.push(`[V2] Backtracking exitoso: re-asignado ${metaP.codigo || '?'} ${bPend.tipo_sesion}`);
            }
            break;
          }
        }
      }
    }

    // Apply the best strategy result for this docente
    if (mejorResultado) {
      const { asignaciones: mejoresAsign, pendientes: pendientesMejor } = mejorResultado;

      // Re-apply best assignments to real occupancy
      for (const a of mejoresAsign) {
        const s = slots.find((sx: SlotRow) => sx.id === a.slot_id);
        if (!s) continue;
        const amb = ambientes.find((ax: any) => ax.id === a.ambiente_id);
        if (!amb) continue;
        const blockMeta = cursos.find((c: any) => c.id === a.pc_id || c.id === a.curso_id);
        const block = blockMeta || a;
        marcarOcupado(block, a.dia, a.slot_id, a.ambiente_id, occ);
      }

      const docAsignadas = mejoresAsign.length;
      const docPendientes = pendientesMejor.reduce((s, b) => s + b.units.length, 0);
      res.asignadas = docAsignadas;

      // Audit candidate before atomic consolidation
      auditarBloques('CANDIDATO_DOCENTE_' + doc.docente_id, mejoresAsign);
      // Atomic replacement: remove existing with same clave_bloque, then add new
      const nuevasClaves = new Set(mejoresAsign.map((a: any) => a.clave_bloque).filter(Boolean));
      asignacionesFinales = asignacionesFinales.filter((a: any) => !a.clave_bloque || !nuevasClaves.has(a.clave_bloque));
      asignacionesFinales.push(...mejoresAsign);
      bloquesMixtosCount += mejorResultado.bloquesMixtos;
      razonesMixtosGlobal.push(...mejorResultado.razonesMixtos);

      log.push(`[V2] ${doc.nombre}: ${docAsignadas}/${docHoras} asignadas (${Math.round(docAsignadas / docHoras * 100)}%) — cursos completos ${mejorEval?.cursosCompletos ?? 0}/${mejorEval?.cursosTotales ?? 0}`);
      if (docPendientes > 0) {
        const pcts = pendientesMejor.map(p => `${p.units[0].meta.codigo || '?'} ${p.tipo_sesion} ${p.units.length}h`);
        log.push(`[V2]   Pendientes: ${pcts.join(', ')}`);
      }

      // Auditar después de aplicar resultado por docente
      auditarBloques('CSP_DOCENTE_' + doc.docente_id, asignacionesFinales);

      // Record remaining blocks for GA
      for (const b of pendientesMejor) {
        if (!bloquesPendientes.some(x => x.id === b.id)) bloquesPendientes.push(b);
      }

      reintentosPorDocente[doc.docente_id] = MAX_REINTENTOS_POR_DOCENTE;

      // Record improvement
      mejoras.push({
        fase: 'CSP',
        iteracion: iteracionesCsp,
        docenteId: doc.docente_id,
        accion: `CSP con reintentos (${MAX_REINTENTOS_POR_DOCENTE} intentos)`,
        puntajeAnterior: 0,
        puntajeNuevo: mejorEval?.horasAsignadas ?? 0,
        horasAsignadasAntes: 0,
        horasAsignadasDespues: docAsignadas,
        detalles: `Completos: ${mejorEval?.cursosCompletos ?? 0}/${mejorEval?.cursosTotales ?? 0} | Asignadas: ${mejorEval?.horasAsignadas ?? 0}/${mejorEval?.horasRequeridas ?? 0} | Mixtos: ${mejorResultado.bloquesMixtos}`,
      });
    }
  }

  // ── Auditoría post-CSP ──────────────────────────────────────────────────────
  auditarBloques('CSP', asignacionesFinales);
  log.push(`[V2] Auditoría CSP: ${asignacionesFinales.length}h, sin duplicados`);

  let gaIteraciones = 0;

  // ── FASE 2: GA Fallback ─────────────────────────────────────────────────────
  // Normalize pendientes: remove any block whose clave_bloque is already fully assigned
  const horasPorClave = contarHorasAsignadasPorBloque(asignacionesFinales);
  const pendientesNormalizados: BlockGroup[] = [];
  for (const b of bloquesPendientes) {
    const meta = b.units[0]?.meta || {};
    const ck = claveBloqueAcademico(meta);
    const asignadas = horasPorClave.get(ck) ?? 0;
    const requeridas = b.units.length;
    if (asignadas === requeridas) continue;
    if (asignadas > requeridas) {
      log.push(`[V2] ERROR: bloque duplicado detectado en pendientes: ${ck} (${asignadas}h > ${requeridas}h)`);
      continue;
    }
    if (asignadas > 0 && asignadas < requeridas && b.indivisible) {
      log.push(`[V2] Bloque indivisible parcialmente asignado, será re-asignado completo: ${ck}`);
    }
    pendientesNormalizados.push(b);
  }
  log.push(`[V2] Pendientes normalizados: ${pendientesNormalizados.length} (de ${bloquesPendientes.length} originales)`);

  if (pendientesNormalizados.length > 0) {
    log.push(`[V2] ═══ FASE 2: GA Fallback (${pendientesNormalizados.reduce((s, b) => s + b.units.length, 0)}h pendientes) ═══`);
    // Build BloqueGenetico[] for GA — one entry per ATOMIC block, not per hour
    const bloquesGa: import('./horarios-ga').BloqueGenetico[] = pendientesNormalizados.map(b => {
      const meta = b.units[0]?.meta || {};
      return {
        bloque_id: b.id,
        clave_bloque: claveBloqueAcademico(meta),
        pc_id: meta.id || meta.pc_id,
        curso_id: meta.curso_id,
        curso_codigo: meta.codigo || meta.curso_codigo,
        curso_nombre: meta.curso_nombre,
        grupo_id: meta.grupo_id,
        numero_grupo: meta.numero_grupo,
        docente_id: meta.docente_id,
        tipo_sesion: b.tipo_sesion as 'teoria' | 'practica' | 'laboratorio' | 'mixto',
        lab_turno: meta.lab_turno ?? null,
        duracion: b.units.length,
        indivisible: b.indivisible,
        num_alumnos: meta.num_alumnos || 25,
        ciclo_plan: meta.ciclo_plan,
        condicion_orden: meta.condicion_orden,
        categoria_orden: meta.categoria_orden,
        fecha_ingreso: meta.fecha_ingreso,
        cantidad_labs: meta.cantidad_labs || 1,
      };
    });
    try {
      const { ejecutarAlgoritmoGenetico } = await import('./horarios-ga');
      const gaResult = await ejecutarAlgoritmoGenetico(bloquesGa, programacion_id, asignacionesFinales, false);
      gaIteraciones += gaResult.stats.generaciones;
      log.push(...gaResult.log);
      if (gaResult.asignaciones.length > 0 && gaResult.stats.hardPenalty <= 0) {
        const clavesFinales = new Set(asignacionesFinales.map((a: any) => a.clave_bloque).filter((clave: any): clave is string => Boolean(clave)));
        const candidatosSinDuplicar = gaResult.asignaciones.filter((a: any) => a.clave_bloque && !clavesFinales.has(a.clave_bloque));
        if (candidatosSinDuplicar.length > 0) {
          for (const a of candidatosSinDuplicar) a.fuente = 'V2_GA';
          const porClaveGA = groupBy(candidatosSinDuplicar, (a: any) => a.clave_bloque!);
          const validos: any[] = [];
          for (const [clave, horas] of porClaveGA) {
            const totalEsperado = horas[0]?.bloque_total ?? 0;
            if (horas.length !== totalEsperado) {
              log.push(`[V2] GA bloque ${clave} incompleto: ${horas.length}/${totalEsperado}, descartado`);
              continue;
            }
            const dias = new Set(horas.map((h: any) => h.dia));
            if (dias.size !== 1) {
              log.push(`[V2] GA bloque ${clave} distribuido en varios días, descartado`);
              continue;
            }
            const ambientes = new Set(horas.map((h: any) => h.ambiente_id));
            if (ambientes.size !== 1) {
              log.push(`[V2] GA bloque ${clave} distribuido en varios ambientes, descartado`);
              continue;
            }
            const partes = horas.map((h: any) => h.bloque_parte).sort((a: number, b: number) => (a ?? 0) - (b ?? 0));
            const partesValidas = partes.every((parte: number, index: number) => parte === index + 1);
            if (!partesValidas) {
              log.push(`[V2] GA bloque ${clave} contiene partes inválidas o duplicadas`);
              continue;
            }
            const bloqueContinuoId = nuevoBloqueContinuo();
            for (const hora of horas) hora.bloque_continuo_id = bloqueContinuoId;
            validos.push(...horas);
          }
          if (validos.length > 0) {
            asignacionesFinales.push(...validos);
            auditarBloques('GA', asignacionesFinales);
            log.push(`[V2] GA aceptó ${validos.length}h; ${candidatosSinDuplicar.length - validos.length}h fueron descartadas`);
          } else {
            log.push(`[V2] GA: 0h válidas de ${candidatosSinDuplicar.length}h`);
          }
        } else {
          log.push(`[V2] GA: todas las ${gaResult.asignaciones.length}h fueron descartadas por duplicado`);
        }
      } else if (gaResult.asignaciones.length > 0) {
        log.push(`[V2] GA descartado: hardPenalty=${gaResult.stats.hardPenalty} > 0`);
      }
    } catch (e: any) {
      log.push(`[V2] GA error: ${e.message}`);
    }
  }

  // ── FASE 3: GA + Sábado ─────────────────────────────────────────────────────
  const pendientesTrasGA = todosLosBloques.reduce((s, b) => s + b.units.length, 0) - asignacionesFinales.length;
  if (pendientesTrasGA > 0) {
    log.push(`[V2] ═══ FASE 3: GA + Sábado (${pendientesTrasGA}h aún pendientes) ═══`);
    const faltantesBloques = await getCursosFaltantes(programacion_id, asignacionesFinales);
    if (faltantesBloques.length > 0) {
      try {
        const { ejecutarAlgoritmoGenetico } = await import('./horarios-ga');
        const gaSabResult = await ejecutarAlgoritmoGenetico(faltantesBloques, programacion_id, asignacionesFinales, true);
        gaIteraciones += gaSabResult.stats.generaciones;
        log.push(...gaSabResult.log);
        if (gaSabResult.asignaciones.length > 0 && gaSabResult.stats.hardPenalty <= 0) {
          const clavesFinales = new Set(asignacionesFinales.map((a: any) => a.clave_bloque).filter((clave: any): clave is string => Boolean(clave)));
          const sinDuplicados = gaSabResult.asignaciones.filter((a: any) => a.clave_bloque && !clavesFinales.has(a.clave_bloque));
          if (sinDuplicados.length > 0) {
            for (const a of sinDuplicados) a.fuente = 'V2_GA_SAB';
            const porClaveGA = groupBy(sinDuplicados, (a: any) => a.clave_bloque!);
            const validos: any[] = [];
            for (const [clave, horas] of porClaveGA) {
              const totalEsperado = horas[0]?.bloque_total ?? 0;
              if (horas.length !== totalEsperado) {
                log.push(`[V2] GA+Sáb bloque ${clave} incompleto: ${horas.length}/${totalEsperado}, descartado`);
                continue;
              }
              const dias = new Set(horas.map((h: any) => h.dia));
              if (dias.size !== 1) {
                log.push(`[V2] GA+Sáb bloque ${clave} distribuido en varios días, descartado`);
                continue;
              }
              const ambientes = new Set(horas.map((h: any) => h.ambiente_id));
              if (ambientes.size !== 1) {
                log.push(`[V2] GA+Sáb bloque ${clave} distribuido en varios ambientes, descartado`);
                continue;
              }
              const partes = horas.map((h: any) => h.bloque_parte).sort((a: number, b: number) => (a ?? 0) - (b ?? 0));
              const partesValidas = partes.every((parte: number, index: number) => parte === index + 1);
              if (!partesValidas) {
                log.push(`[V2] GA+Sáb bloque ${clave} contiene partes inválidas o duplicadas`);
                continue;
              }
              const bloqueContinuoId = nuevoBloqueContinuo();
              for (const hora of horas) hora.bloque_continuo_id = bloqueContinuoId;
              validos.push(...horas);
            }
            if (validos.length > 0) {
              asignacionesFinales.push(...validos);
              auditarBloques('GA_SABADO', asignacionesFinales);
              log.push(`[V2] GA+Sáb aceptó ${validos.length}h; ${sinDuplicados.length - validos.length}h fueron descartadas`);
            } else {
              log.push(`[V2] GA+Sáb: 0h válidas de ${sinDuplicados.length}h`);
            }
          } else {
            log.push(`[V2] GA+Sáb: todas las ${gaSabResult.asignaciones.length}h fueron descartadas por duplicado`);
          }
        } else if (gaSabResult.asignaciones.length > 0) {
          log.push(`[V2] GA+Sáb descartado: hardPenalty=${gaSabResult.stats.hardPenalty} > 0`);
        }
      } catch (e: any) {
        log.push(`[V2] GA+Sáb error: ${e.message}`);
      }
    }
  }

  // ── FASE 4: Refinamiento ────────────────────────────────────────────────────
  log.push(`[V2] ═══ FASE 4: Refinamiento posterior ═══`);
  let iteracionesRefinamiento = 0;
  let refinamientoSinMejora = 0;

  // Rebuild Occupancy from scratch to ensure consistency (Fix 14)
  const occRef = initOccupancy();
  rebuildOccupancy(asignacionesFinales, occRef);

  const puntajeAntes = calcularPuntajeSolucion(asignacionesFinales, totalHoras, conflictos, bloquesMixtosCount, slots);
  let puntajeActual = puntajeAntes;

  for (let ri = 0; ri < MAX_ITERACIONES_REFINAMIENTO; ri++) {
    if (refinamientoSinMejora >= ITERACIONES_SIN_MEJORA_MAX) {
      log.push(`[V2] Refinamiento detenido tras ${ITERACIONES_SIN_MEJORA_MAX} iteraciones sin mejora`);
      break;
    }
    iteracionesRefinamiento++;
    let mejoraEncontrada = false;

    // Try to replace mixed blocks with separate blocks
    const asignacionesMixtas = asignacionesFinales.filter((a: any) => a.es_mixto);
    for (const aMix of asignacionesMixtas) {
      const allMixForCourse = asignacionesMixtas.filter(
        (x: any) => x.curso_id === aMix.curso_id && x.grupo_id === aMix.grupo_id && x.docente_id === aMix.docente_id
      );
      if (allMixForCourse.length === 0) continue;

      const mixIds = new Set(allMixForCourse.map((x: any) => x.id));
      // Build temp list without these mixed assignments
      const tempList = asignacionesFinales.filter((a: any) => !mixIds.has(a.id));

      // Rebuild Occupancy from temp list
      const occTmp = initOccupancy();
      rebuildOccupancy(tempList, occTmp);
      const docAvailTmp = clonarDocAvail(docAvail);

      const htRef = aMix.horas_teoria_mixtas || Math.ceil(allMixForCourse.length / 2);
      const hpRef = aMix.horas_practica_mixtas || Math.floor(allMixForCourse.length / 2);

      // Build separate blocks
      const refBloqueT: BlockGroup = {
        id: randomUUID(),
        units: Array.from({ length: htRef }, () => ({
          meta: { ...aMix, tipo_sesion: 'teoria' as const },
          tipo_sesion: 'teoria' as const,
        })),
        indivisible: true,
        tipo_sesion: 'teoria',
      };
      const refBloqueP: BlockGroup = {
        id: randomUUID(),
        units: Array.from({ length: hpRef }, () => ({
          meta: { ...aMix, tipo_sesion: 'practica' as const },
          tipo_sesion: 'practica' as const,
        })),
        indivisible: true,
        tipo_sesion: 'practica',
      };

      for (const p of [1, 2]) {
        const tpRes = intentarAsignarTPContiguo(
          refBloqueT, refBloqueP, slots, ambientes, docAvailTmp, occTmp, p, ambAvail, cspOpts
        );
        if (!tpRes.ok) continue;

        // Assign new bloque_continuo_id for the replacement assignments
        const bcIdRef = nuevoBloqueContinuo();
        for (const a of tpRes.asignaciones) {
          a.bloque_continuo_id = bcIdRef;
          a.clave_bloque = claveBloqueAcademico(a);
        }

        // Build final candidate: tempList + new separate assignments
        const nuevoList = [...tempList, ...tpRes.asignaciones];
        const nuevoOcc = initOccupancy();
        rebuildOccupancy(nuevoList, nuevoOcc);

        // Validate no conflicts and hours unchanged
        const difHoras = nuevoList.length - tempList.length;
        const sinConflictos = nuevoList.length === tempList.length + tpRes.asignaciones.length;
        if (!sinConflictos || difHoras !== tpRes.asignaciones.length) continue;

        const nvoPunt = calcularPuntajeSolucion(nuevoList, totalHoras, conflictos, bloquesMixtosCount - 1, slots);
        if (nvoPunt.puntajeTotal < puntajeActual.puntajeTotal) {
          // Accept: update global state
          asignacionesFinales = nuevoList;
          auditarBloques('REFINAMIENTO', asignacionesFinales);
          // Rebuild global occupancy
          const occNuevo = initOccupancy();
          rebuildOccupancy(asignacionesFinales, occNuevo);
          // Copy back to occRef
          Object.assign(occRef, occNuevo);
          bloquesMixtosCount--;
          mejoraEncontrada = true;
          log.push(`[V2] Refinamiento: reemplazado mixto ${aMix.curso_codigo} por T+P separados (P${p})`);
          mejoras.push({
            fase: 'REFINAMIENTO',
            iteracion: ri,
            accion: 'Reemplazar bloque mixto por T+P separados',
            puntajeAnterior: puntajeActual.puntajeTotal,
            puntajeNuevo: nvoPunt.puntajeTotal,
            horasAsignadasAntes: tempList.length,
            horasAsignadasDespues: nuevoList.length,
            detalles: `Curso: ${aMix.curso_codigo} | Docente: ${aMix.docente_nombre}`,
          });
          break;
        }
      }
      if (mejoraEncontrada) break;
    }

    // Try to move complete Saturday blocks to weekdays
    if (!mejoraEncontrada) {
      const sabAssignments = asignacionesFinales.filter((a: any) => a.dia === 'sabado');
      const processedClaves = new Set<string>();
      for (const a of sabAssignments) {
        const clave = a.clave_bloque;
        if (!clave || processedClaves.has(clave)) continue;
        processedClaves.add(clave);
        const blockHours = sabAssignments.filter((x: any) => x.clave_bloque === clave);
        const blockSize = blockHours.length;
        if (blockSize === 0) continue;
        // Remove complete block from temp
        const tempList = asignacionesFinales.filter((x: any) => !(x.clave_bloque === clave && x.dia === 'sabado'));
        const occTmp = initOccupancy();
        rebuildOccupancy(tempList, occTmp);
        const docAvailTmp = clonarDocAvail(docAvail);
        const cursoData = cursos.find((c: any) => c.id === a.curso_id || c.id === a.pc_id);
        const blockMeta = cursoData || a;
        let moved = false;
        for (const dia of DIAS) {
          if (dia === 'sabado') continue;
          for (let si = 0; si <= slots.length - blockSize; si++) {
            const slotGroup = slots.slice(si, si + blockSize);
            let allOk = true;
            for (const s of slotGroup) {
              if (!puedeSlot(blockMeta, dia, s, a.prioridad_usada || 1, docAvailTmp, occTmp)) {
                allOk = false;
                break;
              }
              const ambOk = ambientes.find((amb: any) =>
                amb.id === a.ambiente_id &&
                ambienteDisponible(blockMeta, amb.id, dia, s.id, occTmp)
              );
              if (!ambOk) { allOk = false; break; }
            }
            if (!allOk) continue;
            // Place complete block in consecutive slots
            const bcIdMov = nuevoBloqueContinuo();
            const newBlock: any[] = [];
            for (let pi = 0; pi < blockSize; pi++) {
              const s = slotGroup[pi];
              const orig = blockHours[pi];
              const newAsig = { ...orig, dia, slot_id: s.id, bloque_continuo_id: bcIdMov };
              newAsig.clave_bloque = claveBloqueAcademico(newAsig);
              newBlock.push(newAsig);
            }
            const nuevoList = [...tempList, ...newBlock];
            const nuevoOcc = initOccupancy();
            rebuildOccupancy(nuevoList, nuevoOcc);
            const nvoPunt = calcularPuntajeSolucion(nuevoList, totalHoras, conflictos, bloquesMixtosCount, slots);
            if (nvoPunt.puntajeTotal < puntajeActual.puntajeTotal) {
              asignacionesFinales = nuevoList;
              auditarBloques('REFINAMIENTO_SAB', asignacionesFinales);
              const occNuevo = initOccupancy();
              rebuildOccupancy(asignacionesFinales, occNuevo);
              Object.assign(occRef, occNuevo);
              mejoraEncontrada = true;
              moved = true;
              log.push(`[V2] Refinamiento: movido bloque ${clave} (${blockSize}h) de sábado a ${dia}, slot ${slotGroup[0]?.hora_inicio}`);
              break;
            }
          }
          if (moved) break;
        }
        if (mejoraEncontrada) break;
      }
    }

    // Update score after improvements
    if (mejoraEncontrada) {
      const nuevoPuntaje = calcularPuntajeSolucion(asignacionesFinales, totalHoras, conflictos, bloquesMixtosCount, slots);
      if (nuevoPuntaje.puntajeTotal < puntajeActual.puntajeTotal) {
        const mejora = (puntajeActual.puntajeTotal - nuevoPuntaje.puntajeTotal) / Math.max(1, puntajeActual.puntajeTotal);
        if (mejora > MEJORA_MINIMA) {
          puntajeActual = nuevoPuntaje;
          refinamientoSinMejora = 0;
        } else {
          refinamientoSinMejora++;
        }
      } else {
        refinamientoSinMejora++;
      }
    } else {
      refinamientoSinMejora++;
    }
  }

  log.push(`[V2] Refinamiento: ${iteracionesRefinamiento} iteraciones | Puntaje: ${puntajeAntes.puntajeTotal} → ${puntajeActual.puntajeTotal}`);

  // Build per-docente results (with course-level detail)
  const porDocente: DocenteResult[] = [];
  for (const d of docentesOrdenados) {
    const res = docResults.get(d.docente_id);
    if (!res) continue;
    const asignadas = asignacionesFinales.filter(a => a.docente_id === d.docente_id).length;
    const asigDoc = asignacionesFinales.filter(a => a.docente_id === d.docente_id);

    // Group by curso+grupo for course detail
    const cursosMap = new Map<string, { curso_id: string; codigo: string; reqHoras: number; asigHoras: number; reqBloques: number; compBloques: number; labs: Map<number, { turno: number; req: number; asig: number; dia?: string; amb?: string }> }>();
    for (const c of cursos) {
      if (c.docente_id !== d.docente_id) continue;
      const k = `${c.curso_id}|${c.grupo_id || ''}`;
      if (!cursosMap.has(k)) {
        const turnosLab = (c.horas_laboratorio || 0) > 0 ? Math.max(1, Number(c.cantidad_labs) || 1) : 0;
        const reqLabs = turnosLab * (c.horas_laboratorio || 0);
        cursosMap.set(k, {
          curso_id: c.curso_id, codigo: c.codigo || '',
          reqHoras: (c.horas_teoria || 0) + (c.horas_practica || 0) + reqLabs,
          asigHoras: 0,
          reqBloques: (c.horas_teoria || 0 > 0 ? 1 : 0) + (c.horas_practica || 0 > 0 ? 1 : 0) + turnosLab,
          compBloques: 0,
          labs: new Map(),
        });
      }
    }

    for (const a of asigDoc) {
      const k = `${a.curso_id}|${a.grupo_id || ''}`;
      const entry = cursosMap.get(k);
      if (!entry) continue;
      entry.asigHoras++;
      if (a.tipo === 'laboratorio' && a.lab_turno) {
        const lt = Number(a.lab_turno);
        if (!entry.labs.has(lt)) entry.labs.set(lt, { turno: lt, req: 0, asig: 0 });
        entry.labs.get(lt)!.asig++;
      }
    }

    // Mark lab turno requirements
    for (const c of cursos) {
      if (c.docente_id !== d.docente_id) continue;
      const k = `${c.curso_id}|${c.grupo_id || ''}`;
      const entry = cursosMap.get(k);
      if (!entry) continue;
      const hl = c.horas_laboratorio || 0;
      const turnosLab = hl > 0 ? Math.max(1, Number(c.cantidad_labs) || 1) : 0;
      for (let t = 1; t <= turnosLab; t++) {
        if (!entry.labs.has(t)) entry.labs.set(t, { turno: t, req: hl, asig: 0 });
        entry.labs.get(t)!.req = hl;
      }
    }

    let cursosCompletos = 0, cursosParciales = 0, cursosSinAsignar = 0;
    const detalleCursos: CursoDetalle[] = [];

    for (const [k, entry] of cursosMap) {
      const completoT = entry.asigHoras >= entry.reqHoras;
      const bloquesCompletos = entry.compBloques;

      // Check lab atomicity
      const labsDetalle = Array.from(entry.labs.values()).map(l => {
        const labAsig = asigDoc.filter(a => a.tipo === 'laboratorio' && a.lab_turno === l.turno);
        const continuo = labAsig.length > 0 && labAsig.length === l.req &&
          new Set(labAsig.map(a => a.dia)).size === 1 &&
          new Set(labAsig.map(a => a.ambiente_id)).size === 1;
        return {
          lab_turno: l.turno,
          horas_requeridas: l.req,
          horas_asignadas: labAsig.length,
          continuo,
          dia: labAsig.length > 0 ? labAsig[0].dia : undefined,
          ambiente_id: labAsig.length > 0 ? labAsig[0].ambiente_id : undefined,
        };
      });

      if (completoT) cursosCompletos++;
      else if (entry.asigHoras > 0) cursosParciales++;
      else cursosSinAsignar++;

      let razon = undefined;
      if (!completoT && entry.asigHoras > 0) {
        razon = `Faltan ${entry.reqHoras - entry.asigHoras}h de ${entry.reqHoras}h requeridas`;
        const labsPend = labsDetalle.filter(l => l.horas_asignadas > 0 && l.horas_asignadas < l.horas_requeridas);
        if (labsPend.length > 0) razon += ` | Lab turnos ${labsPend.map(l => l.lab_turno).join(',')} parciales`;
      } else if (!completoT) {
        razon = 'Sin asignar';
      }

      detalleCursos.push({
        curso_id: entry.curso_id,
        curso_codigo: entry.codigo,
        horas_requeridas: entry.reqHoras,
        horas_asignadas: entry.asigHoras,
        bloques_requeridos: entry.reqBloques,
        bloques_completos: entry.compBloques,
        estado: completoT ? 'COMPLETO' : (entry.asigHoras > 0 ? 'PARCIAL' : 'SIN_ASIGNAR'),
        razon_pendiente: razon,
        labs: labsDetalle,
      });
    }

    porDocente.push({
      docente_id: d.docente_id,
      nombre: d.nombre,
      condicion: d.condicion,
      categoria: d.categoria,
      total_horas: res.total,
      asignadas,
      pendientes: res.total - asignadas,
      pct_completado: res.total > 0 ? Math.round(asignadas / res.total * 100) : 0,
      bloques_mixtos: asignacionesFinales.filter(a => a.docente_id === d.docente_id && a.es_mixto).length,
      prioridad_orden: d.index,
      cursos_totales: cursosMap.size,
      cursos_completos: cursosCompletos,
      cursos_parciales: cursosParciales,
      cursos_sin_asignar: cursosSinAsignar,
      detalle_cursos: detalleCursos,
    });
  }

  const totalAsignadas = asignacionesFinales.length;
  const pendientesFinal = totalHoras - totalAsignadas;

  const puntajeFinal = calcularPuntajeSolucion(asignacionesFinales, totalHoras, conflictos, bloquesMixtosCount, slots);
  log.push(`[V2] ═══ FINAL ═══`);
  log.push(`[V2] Total: ${totalAsignadas}/${totalHoras} (${Math.round(totalAsignadas / totalHoras * 100)}%) | Mixtos: ${bloquesMixtosCount} | Pendientes: ${pendientesFinal}`);
  log.push(`[V2] Puntaje global: ${puntajeFinal.puntajeTotal} | Iteraciones CSP: ${iteracionesCsp} | GA: ${gaIteraciones} | Refinamiento: ${iteracionesRefinamiento}`);

  return {
    asignaciones: asignacionesFinales,
    conflictos,
    conflictosDetalle,
    por_docente: porDocente,
    stats: {
      total_horas: totalHoras,
      asignadas: totalAsignadas,
      pendientes: pendientesFinal,
      pct_completado: totalHoras > 0 ? Math.round(totalAsignadas / totalHoras * 100) : 0,
      bloques_mixtos: bloquesMixtosCount,
      phase: pendientesFinal === 0 ? 'COMPLETA' : 'PARCIAL',
      iteraciones: iteracionesCsp + gaIteraciones + iteracionesRefinamiento,
      tiempo_ms: Date.now() - inicio,
      iteraciones_detalle: {
        csp: iteracionesCsp,
        ga: gaIteraciones,
        refinamiento: iteracionesRefinamiento,
        reintentosPorDocente,
      },
      puntaje_global: puntajeFinal,
    },
    mejoras,
    razones_mixtos: razonesMixtosGlobal,
    log,
  };
}

async function getCursosFaltantes(programacion_id: string, asignaciones: any[]): Promise<import('./horarios-ga').BloqueGenetico[]> {
  const { query } = await import('./db');
  const cursosFaltantes = await query(`
    SELECT pc.*, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
           GREATEST(COALESCE(cu.cantidad_labs, 1), 1) AS cantidad_labs,
           g.numero_grupo, g.num_alumnos,
           CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
           CASE d.categoria 
             WHEN 'principal' THEN 0 
             WHEN 'asociado' THEN 1 
             WHEN 'auxiliar' THEN 2 
             WHEN 'jefe_practica' THEN 3 
             ELSE 4
           END as categoria_orden,
           d.fecha_ingreso
    FROM programacion_cursos pc
    JOIN cursos cu ON cu.id = pc.curso_id
    LEFT JOIN grupos g ON g.id = pc.grupo_id
    LEFT JOIN docentes d ON d.id = pc.docente_id
    WHERE pc.programacion_id = $1
  `, [programacion_id]);

  // Build clave_bloque map from existing asignaciones
  const horasPorClave = contarHorasAsignadasPorBloque(asignaciones);

  const faltantes: import('./horarios-ga').BloqueGenetico[] = [];
  for (const c of cursosFaltantes) {
    const hl = (c.horas_laboratorio || 0);
    const ht = (c.horas_teoria || 0);
    const hp = (c.horas_practica || 0);
    const turnosLab = Math.max(1, Number(c.cantidad_labs) || 1);

    // Check theory/practica/mixto by clave_bloque
    const ckTP = claveBloqueAcademico({
      pc_id: c.id, docente_id: c.docente_id, curso_id: c.curso_id,
      grupo_id: c.grupo_id, tipo_sesion: 'mixto', lab_turno: 0,
    });
    const asigTP = horasPorClave.get(ckTP) ?? 0;
    const totalTP = (ht || 0) + (hp || 0);
    if (totalTP > 0) {
      const restoT = totalTP - asigTP;
      if (restoT > 0) {
        faltantes.push({
          bloque_id: `ga-mix-${c.id}`,
          clave_bloque: ckTP,
          pc_id: c.id, curso_id: c.curso_id, curso_codigo: c.codigo, curso_nombre: c.curso_nombre,
          grupo_id: c.grupo_id, numero_grupo: c.numero_grupo, docente_id: c.docente_id,
          tipo_sesion: 'mixto',
          lab_turno: null,
          duracion: restoT,
          indivisible: false,
          num_alumnos: c.num_alumnos || 25, ciclo_plan: c.ciclo_plan,
          condicion_orden: c.condicion_orden, categoria_orden: c.categoria_orden,
          fecha_ingreso: c.fecha_ingreso, cantidad_labs: turnosLab,
        });
      }
    }

    // Check lab blocks by clave_bloque (per turno)
    for (let t = 1; t <= turnosLab; t++) {
      if (hl <= 0) break;
      const ckLab = claveBloqueAcademico({
        pc_id: c.id, docente_id: c.docente_id, curso_id: c.curso_id,
        grupo_id: c.grupo_id, tipo_sesion: 'laboratorio', lab_turno: t,
      });
      const asigLab = horasPorClave.get(ckLab) ?? 0;
      if (asigLab >= hl) continue;
      faltantes.push({
        bloque_id: `ga-lab-${c.id}-t${t}`,
        clave_bloque: ckLab,
        pc_id: c.id, curso_id: c.curso_id, curso_codigo: c.codigo, curso_nombre: c.curso_nombre,
        grupo_id: c.grupo_id, numero_grupo: c.numero_grupo, docente_id: c.docente_id,
        tipo_sesion: 'laboratorio',
        lab_turno: t,
        duracion: hl,
        indivisible: true,
        num_alumnos: c.num_alumnos || 25, ciclo_plan: c.ciclo_plan,
        condicion_orden: c.condicion_orden, categoria_orden: c.categoria_orden,
        fecha_ingreso: c.fecha_ingreso, cantidad_labs: turnosLab,
      });
    }
  }
  return faltantes;
}
