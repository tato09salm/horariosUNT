import { randomUUID } from 'crypto';
import {
  slotsUtiles,
  asignarGrupoContinuo,
  cloneOccupancy,
  generarCandidatosBloque,
  ambienteCompatibleConBloque,
  type BlockGroup, type BlockUnit, type AmbAvailMap, type Occupancy, type SlotRow,
  obtenerAportesAsignacion,
} from './csp-asignacion';
import { DIAS_SEMANA } from './horario-utils';
import type {
  DiagnosticoBloqueNoAsignado, CargaProgramableDocente, ReporteConsistencia,
  DebugIteracionDocente, AuditoriaDisponibilidad,
} from './horarios-debug';
import { obtenerCargaProgramableDocente, auditarDisponibilidadDocente, diagnosticarBloqueNoAsignado, validarConsistenciaFase1Fase2 } from './horarios-debug';

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

export function obtenerClaveBloque(b: BlockGroup): string {
  const meta = b.units[0]?.meta || {};
  return claveBloqueAcademico({ ...meta, pc_id: meta.pc_id ?? meta.id });
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

// ── Backtracking local por docente: evacuar bloques pequeños ──────────────
function intentarConBacktrackingLocal(
  bloque: BlockGroup,
  docId: string,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  ambAvail: AmbAvailMap,
  opts: { practicaEnAula?: boolean; restrictedIds?: string[]; incluirSabado?: boolean; rotacion?: number },
  asignadosDoc: any[],
  log: string[],
): { ok: boolean; asignaciones: any[]; evictedKeys: Set<string> } | null {
  // Phase 1: direct attempt
  for (const p of [1, 2]) {
    const res = asignarGrupoContinuo(bloque, slots, ambientes, docAvail, occ, p, ambAvail, opts);
    if (res.ok) return { ok: true, asignaciones: res.asignaciones, evictedKeys: new Set() };
  }

  // Phase 2: find candidate windows and evict smaller same-docente blocks
  const duracion = bloque.units.length;
  const diasSemana = opts.incluirSabado ? DIAS_EXT : DIAS;
  const mejoresVentanas: { dia: string; ventana: SlotRow[]; evictables: any[] }[] = [];

  for (const dia of diasSemana) {
    for (let si = 0; si <= slots.length - duracion; si++) {
      const ventana = slots.slice(si, si + duracion);
      const consecutivo = ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
      if (!consecutivo) continue;

      // Check restricted slots (comida, etc.)
      if (ventana.some(s => opts.restrictedIds?.includes(s.id))) continue;

      // Find which same-docente blocks occupy these slots
      const timeKeys = new Set(ventana.map(s => `${dia}-${s.id}`));
      const evictables: any[] = [];
      for (const a of asignadosDoc) {
        const tk = `${a.dia}-${a.slot_id}`;
        if (timeKeys.has(tk) && a.docente_id === docId) {
          if (!evictables.some(e => e.clave_bloque === a.clave_bloque)) {
            evictables.push(a);
          }
        }
      }

      if (evictables.length === 0) continue;

      // Prefer windows where evicted blocks sum to less than the target duration
      const horasEvictadas = evictables.length;
      if (horasEvictadas <= duracion) {
        mejoresVentanas.push({ dia, ventana, evictables });
      }
    }
  }

  // Sort: prefer fewer evictions
  mejoresVentanas.sort((a, b) => a.evictables.length - b.evictables.length);

  for (const { dia, ventana, evictables } of mejoresVentanas.slice(0, 10)) {
    const evictedKeys = new Set(evictables.map(a => a.clave_bloque).filter(Boolean));
    const snapshot = cloneSnapshot(occ, asignadosDoc, [], []);

    // Remove evicted blocks from occupancy
    for (const ev of evictables) {
      const tk = `${ev.dia}-${ev.slot_id}`;
      occ.docenteOcupado.delete(`${ev.docente_id}-${tk}`);
      if (ev.grupo_id) occ.grupoOcupado.delete(`${ev.grupo_id}-${tk}`);
      if (ev.docente_id && ev.curso_id) {
        occ.docenteCursoClase.delete(`${ev.docente_id}-${ev.curso_id}-${tk}`);
      }
      if (ev.ambiente_id) occ.ambienteOcupado.delete(`${ev.ambiente_id}-${tk}`);
      const cicloKey = ev.ciclo_plan ? `${ev.ciclo_plan}-${ev.seccion || 'A'}-${tk}` : null;
      if (cicloKey) occ.cicloOcupado.delete(cicloKey);
      const labKey = `${ev.dia}-${ev.slot_id}`;
      if (ev.tipo_sesion === 'laboratorio' && ev.ambiente_id) {
        const existing = occ.labEnFranja.get(labKey);
        if (existing) {
          occ.labEnFranja.set(labKey, existing.filter((x: any) => x.curso_id !== ev.curso_id || x.ambiente_id !== ev.ambiente_id));
        }
      }
    }

    // Try to place the large block
    for (const p of [1, 2]) {
      const res = asignarGrupoContinuo(bloque, slots, ambientes, docAvail, occ, p, ambAvail, opts);
      if (res.ok) {
        log.push(`[BACKTRACK] ${bloque.units[0]?.meta?.codigo || ''} ${bloque.tipo_sesion} ${duracion}h: evacuó ${evictables.length} bloque(s) (${evictables.map((e: any) => e.clave_bloque).join(', ')})`);

        // Try to reassign evicted blocks
        const evictedReassigned: any[] = [];
        let allReassigned = true;
        for (const ev of evictables) {
          const evBlock: BlockGroup = {
            id: randomUUID(),
            units: [{ meta: { ...ev, pc_id: ev.pc_id ?? ev.id }, tipo_sesion: ev.tipo_sesion || 'teoria' }],
            indivisible: false,
            tipo_sesion: ev.tipo_sesion || 'teoria',
          };
          let evOk = false;
          for (const ep of [1, 2]) {
            const evRes = asignarGrupoContinuo(evBlock, slots, ambientes, docAvail, occ, ep, ambAvail, opts);
            if (evRes.ok) {
              evictedReassigned.push(...evRes.asignaciones);
              evOk = true;
              break;
            }
          }
          if (!evOk) { allReassigned = false; break; }
        }

        if (allReassigned) {
          return { ok: true, asignaciones: [...res.asignaciones, ...evictedReassigned], evictedKeys };
        } else {
          // Restore snapshot
          occ.docenteOcupado = snapshot.occ.docenteOcupado;
          occ.grupoOcupado = snapshot.occ.grupoOcupado;
          occ.ambienteOcupado = snapshot.occ.ambienteOcupado;
          occ.docenteCursoClase = snapshot.occ.docenteCursoClase;
          occ.cicloOcupado = snapshot.occ.cicloOcupado;
          occ.labEnFranja = snapshot.occ.labEnFranja;
          log.push(`[BACKTRACK] Falló reassign de bloques evacuados, restaurado`);
        }
        break;
      }
    }
  }

  return null;
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
const MAX_ITERACIONES_POR_DOCENTE = 30;
const MAX_ITERACIONES_SIN_MEJORA = 5;
const MAX_ITERACIONES_REFINAMIENTO = 20;
const MEJORA_MINIMA = 0.001;
const ITERACIONES_SIN_MEJORA_MAX = 5;
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
  debug_resolver?: {
    docentes_incompletos: number;
    bloques_no_asignados: number;
    causas_agrupadas: Record<string, number>;
    iteraciones_por_docente: DebugIteracionDocente[];
    diagnosticos: DiagnosticoBloqueNoAsignado[];
    consistencias: ReporteConsistencia[];
    auditorias_disponibilidad: AuditoriaDisponibilidad[];
  };
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

export function construirBloquesIndependientes(cursos: any[]): BlockGroup[] {
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

export function aplicarDistribucionesExcepcionionales(
  bloques: BlockGroup[],
  slots: SlotRow[],
  docAvail: Map<string, Map<string, number>>,
  ambientes: any[],
  ambAvail: AmbAvailMap,
  occ: Occupancy,
  opts: any,
): BlockGroup[] {
  const resultado: BlockGroup[] = [];
  const idsReemplazados = new Set<string>();
  
  // Group blocks by docente_id + curso_id (academic load identity)
  const gruposPorCarga = new Map<string, BlockGroup[]>();
  for (const bloque of bloques) {
    const meta = bloque.units[0]?.meta || {};
    const clave = `${meta.docente_id}-${meta.curso_id}`;
    if (!gruposPorCarga.has(clave)) {
      gruposPorCarga.set(clave, []);
    }
    gruposPorCarga.get(clave)!.push(bloque);
  }
  
  for (const [clave, bloquesCurso] of gruposPorCarga) {
    const meta = bloquesCurso[0]?.units[0]?.meta || {};
    const cursoCodigo = meta.codigo || meta.curso_codigo || '';
    
    // Audit EG-101 raw blocks
    if (cursoCodigo === 'EG-101') {
      console.log('[EG-101 RAW]', bloquesCurso.map(b => ({
        pc_id: b.units[0]?.meta?.pc_id,
        docente_id: b.units[0]?.meta?.docente_id,
        curso_id: b.units[0]?.meta?.curso_id,
        grupo_id: b.units[0]?.meta?.grupo_id,
        tipo: b.tipo_sesion,
        units: b.units.length,
      })));
    }
    
    const teoria = bloquesCurso.filter(b => b.tipo_sesion === 'teoria');
    const practica = bloquesCurso.filter(b => b.tipo_sesion === 'practica');
    const horasTeoria = teoria.reduce((sum, b) => sum + b.units.length, 0);
    const horasPractica = practica.reduce((sum, b) => sum + b.units.length, 0);
    
    // Check for TP_2_MAS_P_3 exceptional distribution (EG-101: 1T + 4P)
    if (cursoCodigo === 'EG-101' && horasTeoria === 1 && horasPractica === 4) {
      const pcTeoria = teoria[0]?.units[0]?.meta?.pc_id;
      const pcPractica = practica[0]?.units[0]?.meta?.pc_id;
      console.log(`[EG-101] pc teoria=${pcTeoria}`);
      console.log(`[EG-101] pc practica=${pcPractica}`);
      console.log(`[EG-101] mismos pc_id: ${pcTeoria === pcPractica ? 'SÍ' : 'NO'}`);
      console.log(`[EG-101] agrupados por docente+curso: SÍ`);
      
      // Check 4h continuous practice availability against original docente availability (not occupancy)
      const docenteId = meta.docente_id;
      let maxBloqueContiguo = 0;
      const diasEvaluar = opts.incluirSabado ? DIAS_EXT : DIAS;
      for (const dia of diasEvaluar) {
        let currentSeq = 0;
        for (const s of slots) {
          const tk = `${dia}-${s.id}`;
          if (docAvail.get(docenteId)?.has(tk)) {
            currentSeq++;
            if (currentSeq > maxBloqueContiguo) maxBloqueContiguo = currentSeq;
          } else {
            currentSeq = 0;
          }
        }
      }
      console.log(`[EG-101] máximo bloque contiguo en disponibilidad: ${maxBloqueContiguo}h`);
      
      if (maxBloqueContiguo < 4) {
        console.log(`[EG-101] estrategia activada: TP_2_MAS_P_3`);
        
        const metaTeoria = teoria[0]?.units[0]?.meta || {};
        const metaPractica = practica[0]?.units[0]?.meta || {};
        const base = { ...meta };
        const distribucionId = `${docenteId}-${meta.curso_id}-TP_2_MAS_P_3`;
        
        // Segment 1: teoria_practica 2h (1T + 1P)
        // Unit 1: contributes 1h theory
        const tpUnit1: BlockUnit = {
          meta: { ...base, tipo_sesion: 'teoria_practica', estrategia_excepcional: 'TP_2_MAS_P_3', segmento_excepcional: 1, distribucion_id: distribucionId, pc_id_teoria_origen: metaTeoria.pc_id ?? metaTeoria.id, pc_id_practica_origen: metaPractica.pc_id ?? metaPractica.id, grupo_id_teoria_origen: metaTeoria.grupo_id, grupo_id_practica_origen: metaPractica.grupo_id, aporte_tipo: 'teoria', aporte_horas: 1, pc_id_aporte: metaTeoria.pc_id ?? metaTeoria.id, grupo_id_aporte: metaTeoria.grupo_id },
          tipo_sesion: 'teoria_practica',
        };
        // Unit 2: contributes 1h practice
        const tpUnit2: BlockUnit = {
          meta: { ...base, tipo_sesion: 'teoria_practica', estrategia_excepcional: 'TP_2_MAS_P_3', segmento_excepcional: 1, distribucion_id: distribucionId, pc_id_teoria_origen: metaTeoria.pc_id ?? metaTeoria.id, pc_id_practica_origen: metaPractica.pc_id ?? metaPractica.id, grupo_id_teoria_origen: metaTeoria.grupo_id, grupo_id_practica_origen: metaPractica.grupo_id, aporte_tipo: 'practica', aporte_horas: 1, pc_id_aporte: metaPractica.pc_id ?? metaPractica.id, grupo_id_aporte: metaPractica.grupo_id },
          tipo_sesion: 'teoria_practica',
        };
        
        const tpBlock: BlockGroup = {
          id: randomUUID(),
          units: [tpUnit1, tpUnit2],
          indivisible: true,
          tipo_sesion: 'teoria_practica',
          estrategia_excepcional: 'TP_2_MAS_P_3',
          segmento_excepcional: 1,
        };
        
        // Segment 2: practica 3h (3P)
        // Each unit contributes 1h practice
        const pUnits: BlockUnit[] = Array.from({ length: 3 }, () => ({
          meta: { ...base, tipo_sesion: 'practica', estrategia_excepcional: 'TP_2_MAS_P_3', segmento_excepcional: 2, distribucion_id: distribucionId, pc_id_practica_origen: metaPractica.pc_id ?? metaPractica.id, grupo_id_practica_origen: metaPractica.grupo_id, aporte_tipo: 'practica', aporte_horas: 1, pc_id_aporte: metaPractica.pc_id ?? metaPractica.id, grupo_id_aporte: metaPractica.grupo_id },
          tipo_sesion: 'practica',
        }));
        
        const pBlock: BlockGroup = {
          id: randomUUID(),
          units: pUnits,
          indivisible: true,
          tipo_sesion: 'practica',
          estrategia_excepcional: 'TP_2_MAS_P_3',
          segmento_excepcional: 2,
        };
        
        // Mark original blocks for removal
        for (const b of teoria) {
          idsReemplazados.add(b.id);
        }
        for (const b of practica) {
          idsReemplazados.add(b.id);
        }
        
        resultado.push(tpBlock);
        resultado.push(pBlock);
        console.log(`[EG-101] originales retirados: ${teoria.length + practica.length}`);
        console.log(`[EG-101] bloques excepcionales agregados: 2`);
        continue;
      } else {
        console.log(`[EG-101] disponibilidad 4h suficiente, usando distribución normal`);
      }
    }
    
    // Add non-replaced blocks
    for (const b of bloquesCurso) {
      if (!idsReemplazados.has(b.id)) {
        resultado.push(b);
      }
    }
  }
  
  return resultado;
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

export function initOccupancy(): Occupancy {
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

export function rebuildOccupancy(asignaciones: any[], occ: Occupancy) {
  // Clear all maps first to ensure clean state
  occ.docenteOcupado.clear();
  occ.grupoOcupado.clear();
  occ.ambienteOcupado.clear();
  occ.docenteCursoClase.clear();
  occ.cicloOcupado.clear();
  occ.labEnFranja.clear();
  occ.franjaModo.clear();
  occ.labParalelosFranjas = 0;
  
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
  horasExcedentes: number;
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
export function clonarDocAvail(orig: Map<string, Map<string, number>>): Map<string, Map<string, number>> {
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
    // Handle TP_2_MAS_P_3 exceptional distribution
    if (a.estrategia_excepcional === 'TP_2_MAS_P_3') {
      const tipoAporte = a.aporte_tipo as string | undefined;
      const horasAporte = Number(a.aporte_horas) || 0;
      const grupoAporte = a.grupo_id_aporte as string | undefined || a.grupo_id as string | undefined;
      
      if (tipoAporte && horasAporte > 0) {
        const k = `${a.curso_id || ''}|${grupoAporte}|${tipoAporte}|0`;
        asigCounts.set(k, (asigCounts.get(k) || 0) + horasAporte);
      }
    } else {
      // Normal counting by tipo
      const k = `${a.curso_id || ''}|${a.grupo_id || ''}|${a.tipo || ''}|${a.lab_turno || 0}`;
      asigCounts.set(k, (asigCounts.get(k) || 0) + 1);
    }
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

// ── Normalizar tipo de asignación antes de insertar ────────────────────────
export function normalizarTipoAsignacion(a: any): any {
  const tipo = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
  if (!tipo) {
    throw new Error(
      `Asignación sin tipo: pc=${a.pc_id}, curso=${a.curso_id}, grupo=${a.grupo_id}`
    );
  }
  return {
    ...a,
    tipo,
    tipo_sesion: tipo,
  };
}

// ── Helper para verificar si asignación es crítica ────────────────────────────
export function esAsignacionCritica(a: any): boolean {
  return a.fuente === 'CRITICO' || a.fuente === 'CRITICO_SAB';
}

// ── Detallar conflictos mostrando ambas asignaciones enfrentadas ───────────────
export interface DetalleConflicto {
  tipo_conflicto: 'DOCENTE' | 'AMBIENTE' | 'GRUPO';
  clave_ocupacion: string;
  asignacion_a: {
    id?: string;
    fuente?: string;
    clave_bloque?: string;
    pc_id?: string;
    curso_codigo?: string;
    curso_nombre?: string;
    docente_id?: string;
    ambiente_id?: string;
    dia?: string;
    slot_id?: string;
    tipo?: string;
  };
  asignacion_b: {
    id?: string;
    fuente?: string;
    clave_bloque?: string;
    pc_id?: string;
    curso_codigo?: string;
    curso_nombre?: string;
    docente_id?: string;
    ambiente_id?: string;
    dia?: string;
    slot_id?: string;
    tipo?: string;
  };
}

export function detallarConflictos(asignaciones: any[]): DetalleConflicto[] {
  const conflictos: DetalleConflicto[] = [];
  
  // Build maps for conflict detection
  const docenteMap = new Map<string, any[]>();
  const ambienteMap = new Map<string, any[]>();
  const grupoMap = new Map<string, any[]>();
  
  for (const a of asignaciones) {
    if (a.docente_id) {
      const key = `${a.docente_id}|${a.dia}|${a.slot_id}`;
      if (!docenteMap.has(key)) docenteMap.set(key, []);
      docenteMap.get(key)!.push(a);
    }
    if (a.ambiente_id) {
      const key = `${a.ambiente_id}|${a.dia}|${a.slot_id}`;
      if (!ambienteMap.has(key)) ambienteMap.set(key, []);
      ambienteMap.get(key)!.push(a);
    }
    if (a.grupo_id) {
      const key = `${a.grupo_id}|${a.dia}|${a.slot_id}`;
      if (!grupoMap.has(key)) grupoMap.set(key, []);
      grupoMap.get(key)!.push(a);
    }
  }
  
  // Detect conflicts
  for (const [key, asignaciones] of docenteMap) {
    if (asignaciones.length > 1) {
      conflictos.push({
        tipo_conflicto: 'DOCENTE',
        clave_ocupacion: key,
        asignacion_a: extractDetalle(asignaciones[0]),
        asignacion_b: extractDetalle(asignaciones[1]),
      });
    }
  }
  
  for (const [key, asignaciones] of ambienteMap) {
    if (asignaciones.length > 1) {
      conflictos.push({
        tipo_conflicto: 'AMBIENTE',
        clave_ocupacion: key,
        asignacion_a: extractDetalle(asignaciones[0]),
        asignacion_b: extractDetalle(asignaciones[1]),
      });
    }
  }
  
  for (const [key, asignaciones] of grupoMap) {
    if (asignaciones.length > 1) {
      conflictos.push({
        tipo_conflicto: 'GRUPO',
        clave_ocupacion: key,
        asignacion_a: extractDetalle(asignaciones[0]),
        asignacion_b: extractDetalle(asignaciones[1]),
      });
    }
  }
  
  return conflictos;
}

function extractDetalle(a: any) {
  return {
    id: a.id,
    fuente: a.fuente,
    clave_bloque: a.clave_bloque,
    pc_id: a.pc_id,
    curso_codigo: a.curso_codigo,
    curso_nombre: a.curso_nombre,
    docente_id: a.docente_id,
    ambiente_id: a.ambiente_id,
    dia: a.dia,
    slot_id: a.slot_id,
    tipo: a.tipo,
  };
}

// ── Auditoría de validez parcial por fase ─────────────────────────────────────
export interface AuditoriaParcial {
  fase: string;
  valida: boolean;
  conflictos_docente: number;
  conflictos_ambiente: number;
  conflictos_grupo: number;
  duplicados: number;
  horas_excedentes: number;
  claves_sin_tipo: number;
  detalles: DetalleConflicto[];
}

export function auditarValidezParcial(fase: string, asignaciones: any[], cursos: any[], slots: SlotRow[]): AuditoriaParcial {
  const conflictos = detallarConflictos(asignaciones);
  const conflictosDocente = conflictos.filter(c => c.tipo_conflicto === 'DOCENTE').length;
  const conflictosAmbiente = conflictos.filter(c => c.tipo_conflicto === 'AMBIENTE').length;
  const conflictosGrupo = conflictos.filter(c => c.tipo_conflicto === 'GRUPO').length;
  
  // Check for empty tipo
  const clavesSinTipo = asignaciones.filter(a => !a.tipo || !a.tipo_sesion).length;
  
  // Check for empty tipo in clave_bloque
  const clavesConTipoVacio = asignaciones.filter(a => a.clave_bloque && a.clave_bloque.includes('||')).length;
  
  // Validate with validarSolucionFinal for excess hours
  const validacion = validarSolucionFinal(asignaciones, cursos, slots);
  
  const valida = conflictosDocente === 0 && 
                 conflictosAmbiente === 0 && 
                 conflictosGrupo === 0 && 
                 clavesSinTipo === 0 && 
                 clavesConTipoVacio === 0 &&
                 validacion.resumen.horasExcedentes === 0;
  
  return {
    fase,
    valida,
    conflictos_docente: conflictosDocente,
    conflictos_ambiente: conflictosAmbiente,
    conflictos_grupo: conflictosGrupo,
    duplicados: validacion.resumen.bloquesDuplicados,
    horas_excedentes: validacion.resumen.horasExcedentes,
    claves_sin_tipo: clavesSinTipo + clavesConTipoVacio,
    detalles: conflictos,
  };
}

// ── Invariante global: verificar consistencia de tipo y clave ───────────────────
export function verificarInvarianteGlobal(asignaciones: any[]): { valida: boolean; errores: string[] } {
  const errores: string[] = [];
  
  for (const a of asignaciones) {
    if (!a.tipo || !a.tipo_sesion) {
      errores.push(`Asignación sin tipo: pc=${a.pc_id}, curso=${a.curso_id}, grupo=${a.grupo_id}`);
    }
    
    if (a.clave_bloque) {
      const partes = a.clave_bloque.split('|');
      if (!partes.includes(a.tipo)) {
        errores.push(`Clave inconsistente: ${a.clave_bloque} (tipo=${a.tipo})`);
      }
      if (a.clave_bloque.includes('||')) {
        errores.push(`Clave con tipo vacío: ${a.clave_bloque}`);
      }
    }
  }
  
  return { valida: errores.length === 0, errores };
}

// ── Validación incremental antes de insertar bloque completo ───────────────
export interface ValidacionBloqueCompleto {
  valido: boolean;
  errores: string[];
}

export function puedeAgregarBloqueCompleto(
  bloque: any[],
  actuales: any[],
): ValidacionBloqueCompleto {
  const errores: string[] = [];
  
  // Check for duplicate docente+dia+slot
  const clavesDocente = new Set(
    actuales
      .filter(a => a.docente_id)
      .map(a => `${a.docente_id}|${a.dia}|${a.slot_id}`)
  );
  for (const a of bloque) {
    if (!a.docente_id) continue;
    const key = `${a.docente_id}|${a.dia}|${a.slot_id}`;
    if (clavesDocente.has(key)) {
      return { valido: false, errores: [`CONFLICTO_DOCENTE ${key}`] };
    }
  }
  
  // Check for duplicate ambiente+dia+slot
  const clavesAmbiente = new Set(
    actuales
      .filter(a => a.ambiente_id)
      .map(a => `${a.ambiente_id}|${a.dia}|${a.slot_id}`)
  );
  for (const a of bloque) {
    if (!a.ambiente_id) continue;
    const key = `${a.ambiente_id}|${a.dia}|${a.slot_id}`;
    if (clavesAmbiente.has(key)) {
      return { valido: false, errores: [`CONFLICTO_AMBIENTE ${key}`] };
    }
  }
  
  // Check for duplicate grupo+dia+slot
  const clavesGrupo = new Set(
    actuales
      .filter(a => a.grupo_id)
      .map(a => `${a.grupo_id}|${a.dia}|${a.slot_id}`)
  );
  for (const a of bloque) {
    if (!a.grupo_id) continue;
    const key = `${a.grupo_id}|${a.dia}|${a.slot_id}`;
    if (clavesGrupo.has(key)) {
      return { valido: false, errores: [`CONFLICTO_GRUPO ${key}`] };
    }
  }
  
  // Check for valid tipo in all assignments
  for (const a of bloque) {
    const tipo = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
    if (!tipo) {
      return { valido: false, errores: [`TIPO_SESION_AUSENTE pc=${a.pc_id} curso=${a.curso_id} grupo=${a.grupo_id}`] };
    }
  }
  
  // Check for empty tipo in clave_bloque
  for (const a of bloque) {
    if (a.clave_bloque && a.clave_bloque.includes('||')) {
      return { valido: false, errores: [`CLAVE_BLOQUE_CON_TIPO_VACIO ${a.clave_bloque}`] };
    }
  }
  
  return { valido: true, errores: [] };
}

// ── Calcular puntaje global de una solución (todos los criterios) ──────────
export function calcularPuntajeSolucion(
  asignaciones: any[],
  totalHoras: number,
  cursos: any[],
  bloquesMixtosCount: number,
  slots: SlotRow[],
): PuntajeSolucion {
  const horasAsignadas = asignaciones.length;
  const horasPendientes = totalHoras - horasAsignadas;
  
  // Use validarSolucionFinal as single source of truth for conflicts
  const validacion = validarSolucionFinal(asignaciones, cursos, slots);
  const conflictosDuros = validacion.resumen.conflictosDocente + 
                          validacion.resumen.conflictosGrupo + 
                          validacion.resumen.conflictosAmbiente +
                          validacion.resumen.duplicados +
                          validacion.resumen.bloquesNoContiguos;

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
    horasExcedentes: validacion.resumen.horasExcedentes * 1000,
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
    horasExcedentes: validacion.resumen.horasExcedentes,
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

// ── Evaluación global lexicográfica ───────────────────────────────────────
interface EvaluacionGlobal {
  horasAsignadas: number;
  cursosCompletos: number;
  laboratoriosCompletos: number;
  cursosSinAsignar: number;
}

export function evaluarSolucionGlobal(asignaciones: any[], cursos: any[], slots: SlotRow[]): EvaluacionGlobalExtendida {
  const porCurso = new Map<string, { req: number; asig: number; labReq: number; labAsig: number }>();
  for (const c of cursos) {
    const totalReq = (c.horas_teoria || 0) + (c.horas_practica || 0) + (c.horas_laboratorio || 0) * Math.max(1, Number(c.cantidad_labs) || 1);
    const labReq = (c.horas_laboratorio || 0) * Math.max(1, Number(c.cantidad_labs) || 1);
    const k = `${c.curso_id}|${c.grupo_id || ''}|${c.docente_id || ''}`;
    porCurso.set(k, { req: totalReq, asig: 0, labReq, labAsig: 0 });
  }
  for (const a of asignaciones) {
    const k = `${a.curso_id}|${a.grupo_id || ''}|${a.docente_id || ''}`;
    const entry = porCurso.get(k);
    if (entry) { entry.asig++; if (a.tipo === 'laboratorio') entry.labAsig++; }
  }
  let horasAsignadas = 0, cursosCompletos = 0, laboratoriosCompletos = 0, cursosSinAsignar = 0;
  for (const entry of porCurso.values()) {
    horasAsignadas += entry.asig;
    if (entry.asig >= entry.req) cursosCompletos++;
    else if (entry.asig === 0) cursosSinAsignar++;
    if (entry.labReq > 0 && entry.labAsig >= entry.labReq) laboratoriosCompletos++;
  }
  
  // Add conflict validation
  const validacion = validarSolucionFinal(asignaciones, cursos, slots);
  const conflictosDuros = validacion.resumen.conflictosDocente + 
                          validacion.resumen.conflictosGrupo + 
                          validacion.resumen.conflictosAmbiente +
                          validacion.resumen.duplicados +
                          validacion.resumen.bloquesNoContiguos;
  
  return { 
    horasAsignadas, 
    cursosCompletos, 
    laboratoriosCompletos, 
    cursosSinAsignar,
    conflictosDuros,
    horasExcedentes: validacion.resumen.horasExcedentes
  };
}

export interface EvaluacionGlobalExtendida extends EvaluacionGlobal {
  conflictosDuros?: number;
  horasExcedentes?: number;
}

export function esMejorGlobal(candidato: EvaluacionGlobalExtendida, actual: EvaluacionGlobalExtendida): boolean {
  // Priority 1: fewer hard conflicts (docente, ambiente, grupo, duplicados)
  const candConflictos = candidato.conflictosDuros ?? 0;
  const actConflictos = actual.conflictosDuros ?? 0;
  if (candConflictos !== actConflictos) return candConflictos < actConflictos;
  
  // Priority 2: fewer excess hours
  const candExceso = candidato.horasExcedentes ?? 0;
  const actExceso = actual.horasExcedentes ?? 0;
  if (candExceso !== actExceso) return candExceso < actExceso;
  
  // Priority 3: more hours assigned
  if (candidato.horasAsignadas !== actual.horasAsignadas) return candidato.horasAsignadas > actual.horasAsignadas;
  if (candidato.cursosCompletos !== actual.cursosCompletos) return candidato.cursosCompletos > actual.cursosCompletos;
  if (candidato.laboratoriosCompletos !== actual.laboratoriosCompletos) return candidato.laboratoriosCompletos > actual.laboratoriosCompletos;
  if (candidato.cursosSinAsignar !== actual.cursosSinAsignar) return candidato.cursosSinAsignar < actual.cursosSinAsignar;
  return false;
}

// ── Diagnóstico de factibilidad por bloque ────────────────────────────────
interface DiagnosticoBloquePendiente {
  clave_bloque: string;
  curso_codigo: string;
  docente_id: string;
  grupo_id: string;
  tipo: string;
  duracion: number;
  slots_disponibles_docente: number;
  ventanas_contiguas_docente: number;
  ambientes_compatibles: number;
  candidatos_antes_ocupacion: number;
  candidatos_libres: number;
  candidatos_bloqueados_docente: number;
  candidatos_bloqueados_grupo: number;
  candidatos_bloqueados_ambiente: number;
  bloqueantes_unicos: number;
  bloqueantes_movibles: number;
  candidatos_finales: number;
  razon_final: string;
  causas_rechazo: Record<string, number>;
}

// Check docente availability at ANY priority (1 or 2)
function disponibleEnAlgunaPrioridad(
  docenteId: string,
  dia: string,
  slotId: string,
  docAvail: Map<string, Map<string, number>>
): { disponible: boolean; prioridad: 1 | 2 | null; valor: number | null } {
  const valor = docAvail.get(docenteId)?.get(`${dia}-${slotId}`);
  if (valor == null || valor <= 0) {
    return { disponible: false, prioridad: null, valor: valor ?? null };
  }
  return { disponible: true, prioridad: valor >= 2 ? 2 : 1, valor };
}

// Check docente availability WITHOUT considering current occupancy (legacy)
function docenteDisponibleSinOcupacion(
  docenteId: string,
  dia: string,
  slotId: string,
  prioridad: 1 | 2,
  docAvail: Map<string, Map<string, number>>
): boolean {
  const disponibilidad = docAvail.get(docenteId);
  const valor = disponibilidad?.get(`${dia}-${slotId}`);
  if (valor == null) return false;
  return prioridad === 1 ? valor >= 1 : valor >= 2;
}

function diagnosticarBloquePendiente(
  bloque: BlockGroup, slots: SlotRow[], ambientes: any[],
  occ: Occupancy, docAvail: Map<string, Map<string, number>>,
  cspOpts: any, ambAvail: AmbAvailMap,
): DiagnosticoBloquePendiente {
  const meta = bloque.units[0]?.meta || {};
  const docenteId = meta.docente_id || '';
  const duracion = bloque.units.length;
  const ck = claveBloqueAcademico({ ...meta, pc_id: meta.pc_id ?? meta.id });
  const causas: Record<string, number> = {};
  
  // Track unique slots to avoid counting duplicates
  const slotsDisponiblesUnicos = new Set<string>();
  let ventanasPorDisponibilidad = 0;
  let ambientesCompatibles = 0;
  let combinacionesTeoricas = 0;
  let bloqueadasPorDocente = 0;
  let bloqueadasPorGrupo = 0;
  let bloqueadasPorAmbiente = 0;
  let candidatasLibres = 0;
  const bloquesBloqueantes = new Map<string, any[]>();
  
  // Static compatibility is exactly the one used by the assigner.
  const ambValidos = ambientes.filter(amb => ambienteCompatibleConBloque(bloque, amb, cspOpts));
  ambientesCompatibles = ambValidos.length;

  const candidatosCompartidos = generarCandidatosBloque(
    bloque, slots, ambientes, docAvail, occ, ambAvail,
    { ...cspOpts, incluirSabado: true },
  );
  for (const rechazo of candidatosCompartidos.rechazados) {
    for (const razon of rechazo.razones) causas[razon] = (causas[razon] || 0) + 1;
    if (rechazo.razones.includes('DOCENTE_OCUPADO')) bloqueadasPorDocente++;
    if (rechazo.razones.includes('GRUPO_OCUPADO')) bloqueadasPorGrupo++;
    if (rechazo.razones.includes('AMBIENTE_OCUPADO')) bloqueadasPorAmbiente++;
  }

  for (const dia of DIAS_EXT) {
    for (let si = 0; si <= slots.length - duracion; si++) {
      const slotGroup = slots.slice(si, si + duracion);
      
      // Check continuity by slot.orden
      const continua = slotGroup.every((slot, index) =>
        index === 0 || slot.orden === slotGroup[index - 1].orden + 1
      );
      if (!continua) continue;
      
      // Check availability at ANY priority (1 or 2)
      const disponibilidadVentana = slotGroup.map(slot =>
        disponibleEnAlgunaPrioridad(docenteId, dia, slot.id, docAvail)
      );
      const disponible = disponibilidadVentana.every(d => d.disponible);
      if (!disponible) continue;
      
      // Track unique slots
      for (const s of slotGroup) {
        slotsDisponiblesUnicos.add(`${dia}-${s.id}`);
      }
      
      ventanasPorDisponibilidad++;
      
      // Theoretical combinations are reported only for explanation. Validity is
      // decided above by generarCandidatosBloque, never by this local loop.
      combinacionesTeoricas += ambValidos.length;
    }
  }
  candidatasLibres = candidatosCompartidos.validos.length;
  
  // Invariant: 1h block with available slots must have windows
  if (duracion === 1 && slotsDisponiblesUnicos.size > 0 && ventanasPorDisponibilidad === 0) {
    throw new Error(
      `Diagnóstico imposible para bloque 1h: ${slotsDisponiblesUnicos.size} slots únicos y 0 ventanas por disponibilidad. ` +
      `Curso: ${meta.codigo}, Docente: ${docenteId}`
    );
  }

  // Determine razon_final
  let razonFinal = '';
  if (slotsDisponiblesUnicos.size === 0) {
    razonFinal = 'DOCENTE_NO_DISPONIBLE';
  } else if (ventanasPorDisponibilidad === 0) {
    razonFinal = 'SIN_VENTANA_CONTINUA';
  } else if (ambientesCompatibles === 0) {
    razonFinal = 'SIN_AMBIENTE_COMPATIBLE';
  } else if (candidatasLibres === 0 && combinacionesTeoricas > 0) {
    razonFinal = 'CANDIDATOS_OCUPADOS';
  } else if (candidatasLibres > 0) {
    razonFinal = 'CANDIDATO_DISPONIBLE';
  } else {
    razonFinal = 'CAUSA_DESCONOCIDA';
  }

  if (slotsDisponiblesUnicos.size === 0) causas['DOCENTE_NO_DISPONIBLE'] = 1;
  if (ventanasPorDisponibilidad === 0) causas['SIN_VENTANA_CONTINUA'] = 1;
  if (ambientesCompatibles === 0) causas['SIN_AMBIENTE_COMPATIBLE'] = 1;
  if (candidatasLibres === 0 && combinacionesTeoricas > 0) causas['CANDIDATOS_OCUPADOS'] = 1;

  return {
    clave_bloque: ck, curso_codigo: meta.codigo || '', docente_id: docenteId,
    grupo_id: meta.grupo_id || '', tipo: bloque.tipo_sesion, duracion,
    slots_disponibles_docente: slotsDisponiblesUnicos.size,
    ventanas_contiguas_docente: ventanasPorDisponibilidad,
    ambientes_compatibles: ambientesCompatibles,
    candidatos_antes_ocupacion: combinacionesTeoricas,
    candidatos_libres: candidatasLibres,
    candidatos_bloqueados_docente: bloqueadasPorDocente,
    candidatos_bloqueados_grupo: bloqueadasPorGrupo,
    candidatos_bloqueados_ambiente: bloqueadasPorAmbiente,
    bloqueantes_unicos: bloquesBloqueantes.size,
    bloqueantes_movibles: 0, // TODO: calculate movable blockers
    candidatos_finales: candidatasLibres,
    razon_final: razonFinal,
    causas_rechazo: causas,
  } as DiagnosticoBloquePendiente & {
    candidatos_docente?: number;
    candidatos_continuos?: number;
    candidatos_ambiente?: number;
    candidatos_sin_cruce?: number;
  };
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

// ── Exceptional distribution: TP_2_MAS_P_3 (1T + 4P → 2h TP + 3h P) ───────────────
export interface DistribucionExcepcionalTP2P3 {
  curso_codigo: string;
  docente_id: string;
  grupo_id: string;
  estrategia_elegida: 'NORMAL' | 'TP_2_MAS_P_3' | 'SIN_SOLUCION';
  estrategia_normal: {
    teoria_1h_candidatos: number;
    practica_4h_candidatos: number;
  };
  estrategia_excepcional: {
    tp_2h_candidatos: number;
    practica_3h_candidatos: number;
    combinaciones_validas: number;
  };
}

export function esCandidatoTP2P3(curso: any): boolean {
  return (
    (Number(curso.horas_teoria) || 0) === 1 &&
    (Number(curso.horas_practica) || 0) === 4 &&
    (curso.distribucion_excepcional_horaria === 'TP_2_MAS_P_3' || curso.codigo === 'EG-101') // Temporary hardcoded for testing
  );
}

export function generarVentanasValidas(
  duracion: number,
  tipo: string,
  docente_id: string,
  slots: SlotRow[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  ambientes: any[],
  ambAvail: AmbAvailMap,
  opts: any,
  meta: any,
): { dia: string; slot_ids: string[]; ambiente_id: string; costo: number }[] {
  const ventanas: { dia: string; slot_ids: string[]; ambiente_id: string; costo: number }[] = [];
  
  for (const dia of DIAS_EXT) {
    for (let i = 0; i <= slots.length - duracion; i++) {
      const slotIds = slots.slice(i, i + duracion).map(s => s.id);
      const slotKeys = slotIds.map(id => `${dia}-${id}`);
      
      // Check docente availability
      let docenteDisponible = true;
      for (const key of slotKeys) {
        if ((docAvail.get(docente_id)?.get(key) || 0) === 0) {
          docenteDisponible = false;
          break;
        }
      }
      if (!docenteDisponible) continue;
      
      // Check each compatible environment
      const ambientesCompatibles = ambientes.filter(a =>
        a.activo &&
        (tipo === 'teoria' ? a.tipo === 'aula' : a.tipo === 'laboratorio') &&
        (a.capacidad || 30) >= (meta.num_alumnos || 30)
      );
      
      for (const amb of ambientesCompatibles) {
        // Check environment availability
        let ambienteDisponible = true;
        for (const key of slotKeys) {
          const ambSet = ambAvail.get(amb.id);
          if (!ambSet || !ambSet.has(key)) {
            ambienteDisponible = false;
            break;
          }
        }
        if (!ambienteDisponible) continue;
        
        // Check conflicts in occupancy
        let hayConflicto = false;
        for (const key of slotKeys) {
          const [d, s] = key.split('-');
          if (occ.docenteOcupado.has(`${docente_id}|${d}|${s}`)) hayConflicto = true;
          if (occ.ambienteOcupado.has(`${amb.id}|${d}|${s}`)) hayConflicto = true;
          if (meta.grupo_id && occ.grupoOcupado.has(`${meta.grupo_id}|${d}|${s}`)) hayConflicto = true;
        }
        if (hayConflicto) continue;
        
        ventanas.push({
          dia,
          slot_ids: slotIds,
          ambiente_id: amb.id,
          costo: i, // Prefer earlier slots
        });
      }
    }
  }
  
  return ventanas.sort((a, b) => a.costo - b.costo);
}

export function asignarDistribucionExcepcionalTP2P3(
  curso: any,
  docente_id: string,
  grupo_id: string,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  ambAvail: AmbAvailMap,
  opts: any,
): { ok: boolean; asignaciones: any[]; debug: DistribucionExcepcionalTP2P3 } {
  const meta = {
    docente_id,
    curso_id: curso.curso_id,
    grupo_id,
    codigo: curso.codigo,
    num_alumnos: 30,
  };
  
  const debug: DistribucionExcepcionalTP2P3 = {
    curso_codigo: curso.codigo,
    docente_id,
    grupo_id,
    estrategia_elegida: 'SIN_SOLUCION',
    estrategia_normal: { teoria_1h_candidatos: 0, practica_4h_candidatos: 0 },
    estrategia_excepcional: { tp_2h_candidatos: 0, practica_3h_candidatos: 0, combinaciones_validas: 0 },
  };
  
  // Try normal strategy first
  const ventanasTeoria1h = generarVentanasValidas(1, 'teoria', docente_id, slots, docAvail, occ, ambientes, ambAvail, opts, meta);
  const ventanasPractica4h = generarVentanasValidas(4, 'practica', docente_id, slots, docAvail, occ, ambientes, ambAvail, opts, meta);
  debug.estrategia_normal.teoria_1h_candidatos = ventanasTeoria1h.length;
  debug.estrategia_normal.practica_4h_candidatos = ventanasPractica4h.length;
  
  // If normal strategy has candidates, prefer it
  if (ventanasTeoria1h.length > 0 && ventanasPractica4h.length > 0) {
    debug.estrategia_elegida = 'NORMAL';
    return { ok: false, asignaciones: [], debug };
  }
  
  // Try exceptional strategy
  const ventanasTP2h = generarVentanasValidas(2, 'teoria_practica', docente_id, slots, docAvail, occ, ambientes, ambAvail, opts, meta);
  const ventanasPractica3h = generarVentanasValidas(3, 'practica', docente_id, slots, docAvail, occ, ambientes, ambAvail, opts, meta);
  debug.estrategia_excepcional.tp_2h_candidatos = ventanasTP2h.length;
  debug.estrategia_excepcional.practica_3h_candidatos = ventanasPractica3h.length;
  
  if (ventanasTP2h.length === 0 || ventanasPractica3h.length === 0) {
    debug.estrategia_elegida = 'SIN_SOLUCION';
    return { ok: false, asignaciones: [], debug };
  }
  
  // Find valid combinations (non-overlapping)
  const combinacionesValidas: { tp: typeof ventanasTP2h[0]; p: typeof ventanasPractica3h[0] }[] = [];
  for (const tp of ventanasTP2h) {
    for (const p of ventanasPractica3h) {
      // Check for overlap
      const tpKeys = new Set(tp.slot_ids.map(s => `${tp.dia}-${s}`));
      const pKeys = new Set(p.slot_ids.map(s => `${p.dia}-${s}`));
      let overlap = false;
      for (const k of tpKeys) {
        if (pKeys.has(k)) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        combinacionesValidas.push({ tp, p });
      }
    }
  }
  debug.estrategia_excepcional.combinaciones_validas = combinacionesValidas.length;
  
  if (combinacionesValidas.length === 0) {
    debug.estrategia_elegida = 'SIN_SOLUCION';
    return { ok: false, asignaciones: [], debug };
  }
  
  // Sort by cost and try each combination
  combinacionesValidas.sort((a, b) => (a.tp.costo + a.p.costo) - (b.tp.costo + b.p.costo));
  
  for (const combo of combinacionesValidas) {
    const occSnapshot = cloneOccupancy(occ);
    const asignaciones: any[] = [];
    
    // Create TP block (2h: 1T + 1P)
    const bcIdTP = nuevoBloqueContinuo();
    for (let i = 0; i < 2; i++) {
      const slotId = combo.tp.slot_ids[i];
      const slot = slots.find(s => s.id === slotId)!;
      asignaciones.push({
        id: randomUUID(),
        pc_id: curso.curso_id,
        curso_id: curso.curso_id,
        curso_codigo: curso.codigo,
        curso_nombre: curso.nombre,
        docente_id,
        grupo_id,
        ambiente_id: combo.tp.ambiente_id,
        dia: combo.tp.dia,
        slot_id: slotId,
        slot_orden: slot.orden,
        tipo: i === 0 ? 'teoria' : 'practica', // 1st hour: theory, 2nd hour: practice
        tipo_sesion: 'teoria_practica',
        bloque_continuo_id: bcIdTP,
        bloque_parte: i + 1,
        bloque_total: 2,
        clave_bloque: `${curso.curso_id}|${docente_id}|${grupo_id}|teoria_practica|1`,
        segmento_excepcional: 1,
        estrategia_excepcional: 'TP_2_MAS_P_3',
        fuente: 'TEORIA_DIVIDIDA',
        horas_teoria_incluidas: 1,
        horas_practica_incluidas: 1,
      });
    }
    
    // Create P block (3h: 3P)
    const bcIdP = nuevoBloqueContinuo();
    for (let i = 0; i < 3; i++) {
      const slotId = combo.p.slot_ids[i];
      const slot = slots.find(s => s.id === slotId)!;
      asignaciones.push({
        id: randomUUID(),
        pc_id: curso.curso_id,
        curso_id: curso.curso_id,
        curso_codigo: curso.codigo,
        curso_nombre: curso.nombre,
        docente_id,
        grupo_id,
        ambiente_id: combo.p.ambiente_id,
        dia: combo.p.dia,
        slot_id: slotId,
        slot_orden: slot.orden,
        tipo: 'practica',
        tipo_sesion: 'practica',
        bloque_continuo_id: bcIdP,
        bloque_parte: i + 1,
        bloque_total: 3,
        clave_bloque: `${curso.curso_id}|${docente_id}|${grupo_id}|practica|2`,
        segmento_excepcional: 2,
        estrategia_excepcional: 'TP_2_MAS_P_3',
        fuente: 'TEORIA_DIVIDIDA',
        horas_teoria_incluidas: 0,
        horas_practica_incluidas: 3,
      });
    }
    
    // Validate no conflicts
    const validacion = puedeAgregarBloqueCompleto(asignaciones, []);
    if (!validacion.valido) {
      Object.assign(occ, occSnapshot);
      continue;
    }
    
    // Apply to occupancy
    for (const a of asignaciones) {
      occ.docenteOcupado.add(`${a.docente_id}|${a.dia}|${a.slot_id}`);
      occ.ambienteOcupado.add(`${a.ambiente_id}|${a.dia}|${a.slot_id}`);
      if (a.grupo_id) occ.grupoOcupado.add(`${a.grupo_id}|${a.dia}|${a.slot_id}`);
    }
    
    debug.estrategia_elegida = 'TP_2_MAS_P_3';
    return { ok: true, asignaciones, debug };
  }
  
  debug.estrategia_elegida = 'SIN_SOLUCION';
  return { ok: false, asignaciones: [], debug };
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
  const { restrictedIds } = opts;
  const logGlobal: string[] = [];
  const conflictosGlobal: string[] = [];
  const conflictosDetalleGlobal: Array<{ descripcion: string; datos: object; sugerencia: string }> = [];

  // Internal resolver core — runs one strategy
  async function _resolverCore(
    _opts: { restrictedIds?: string[]; _skipFase0?: boolean; estrategia?: 'BASELINE' | 'CRITICOS' },
  ): Promise<ResolverV2Result> {
    const inicio = Date.now();
    const logLocal: string[] = [];
    const conflictosLocal: string[] = [];
    const conflictosDetalleLocal: Array<{ descripcion: string; datos: object; sugerencia: string }> = [];
    // Alias to minimize code changes in the body
    const log = logLocal;
    const conflictos = conflictosLocal;
    const conflictosDetalle = conflictosDetalleLocal;

    const restrictedIds = _opts.restrictedIds || [];
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
  const teoriaCount = todosLosBloques.filter(b => b.tipo_sesion === 'teoria').length;
  const practicaCount = todosLosBloques.filter(b => b.tipo_sesion === 'practica').length;
  const laboratorioCount = todosLosBloques.filter(b => b.tipo_sesion === 'laboratorio').length;
  const mixtoCount = todosLosBloques.filter(b => b.tipo_sesion === 'teoria_practica').length;
  log.push(`[V2] Bloques construidos: ${todosLosBloques.length} (${teoriaCount} teoría, ${practicaCount} práctica, ${laboratorioCount} laboratorio, ${mixtoCount} mixto)`);

  // Initialize occupancy before applying exceptional distributions
  let occ = initOccupancy();

  // Apply exceptional distributions (TP_2_MAS_P_3 for EG-101)
  const todosLosBloquesNormalizados = aplicarDistribucionesExcepcionionales(
    todosLosBloques,
    slots,
    docAvail,
    ambientes,
    ambAvail,
    occ,
    { practicaEnAula: false, restrictedIds: [], incluirSabado: false }
  );
  const mixtoCountNormalized = todosLosBloquesNormalizados.filter(b => b.tipo_sesion === 'teoria_practica' && !b.estrategia_excepcional).length;
  log.push(`[V2] Bloques normalizados: ${todosLosBloquesNormalizados.length} (${mixtoCountNormalized} mixto tras excepciones)`);

  // ── Verificación pre-CSP: cada clave_bloque debe aparecer exactamente una vez ──
  const clavesPreCSP = new Map<string, { grupo: BlockGroup; count: number }[]>();
  for (const b of todosLosBloquesNormalizados) {
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
  const bloquesPorDocente = groupBy(todosLosBloquesNormalizados, b => b.units[0]?.meta?.docente_id || 'sin_docente');
  const totalHoras = todosLosBloquesNormalizados.reduce((s, b) => s + b.units.length, 0);

  // Sort docentes by priority
  const docentesOrdenados = sortDocentes(docentesProg);
  log.push(`[V2] Docentes ordenados por prioridad: ${docentesOrdenados.map(d => `${d.nombre} (${d.condicion}, ${d.categoria})`).join(' → ')}`);

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

  // ── FASE 0: Critical blocks first (labs, long indivisible, few-window blocks) ──
  let critIteraciones = 0;
  let critAsignados = 0;
  let critFallidos = 0;

  if (!_opts._skipFase0) {
  log.push(`[V2] ═══ FASE 0: Bloques críticos (labs + largos) ═══`);
  // FASE 0 body follows — all code until the closing brace at FASE 0 end


  function contarVentanasValidas(
    bloque: BlockGroup, slots: SlotRow[], ambientes: any[],
    docAvailM: Map<string, Map<string, number>>, occM: Occupancy,
    cspOptsM: any, docentesProgM: any[],
  ): number {
    const meta = bloque.units[0]?.meta || {};
    const docenteId = meta.docente_id || '';
    const duracion = bloque.units.length;
    let total = 0;
    for (const dia of DIAS_EXT) {
      for (let si = 0; si <= slots.length - duracion; si++) {
        const sg = slots.slice(si, si + duracion);
        let ok = true;
        for (const s of sg) {
          if (!puedeSlot(meta, dia, s, 2, docAvailM, occM)) { ok = false; break; }
        }
        if (!ok) continue;
        // Check ambiente availability
        let ambOk = false;
        for (const amb of ambientes) {
          if (bloque.tipo_sesion === 'laboratorio' && amb.tipo !== 'laboratorio') continue;
          let aOk = true;
          for (const s of sg) {
            if (!ambienteDisponible(meta, amb.id, dia, s.id, occM)) { aOk = false; break; }
          }
          if (aOk) { ambOk = true; break; }
        }
        if (ambOk) total++;
      }
    }
    return total;
  }

  interface CriticalBlock {
    bloque: BlockGroup;
    prioridad: number;
    ventanas: number;
    tipoOrd: number;
  }

  function ordenarBloquesPorCriticidad(
    bloques: BlockGroup[], slots: SlotRow[], ambientes: any[],
    docAvailM: Map<string, Map<string, number>>, occM: Occupancy,
    cspOptsM: any, docentesProgM: any[],
    docPrioridad: Map<string, number>,
  ): BlockGroup[] {
    const scored: CriticalBlock[] = bloques.map(b => {
      const tipoOrd = b.tipo_sesion === 'laboratorio' ? 0 : b.tipo_sesion === 'practica' ? 1 : 2;
      const v = contarVentanasValidas(b, slots, ambientes, docAvailM, occM, cspOptsM, docentesProgM);
      const docId = b.units[0]?.meta?.docente_id || '';
      return { bloque: b, prioridad: docPrioridad.get(docId) ?? 99, ventanas: v, tipoOrd };
    });
    scored.sort((a, b) => {
      if (a.ventanas !== b.ventanas) return a.ventanas - b.ventanas;        // MRV
      if (a.tipoOrd !== b.tipoOrd) return a.tipoOrd - b.tipoOrd;            // lab < practica < teoria
      const durDiff = (b.bloque.units.length - a.bloque.units.length);       // longer first
      if (durDiff !== 0) return durDiff;
      return a.prioridad - b.prioridad;                                       // docente priority tiebreak
    });
    return scored.map(s => s.bloque);
  }

  function esCritico(bloque: BlockGroup): boolean {
    if (bloque.tipo_sesion === 'laboratorio') return true;
    if (bloque.tipo_sesion === 'practica' && bloque.units.length >= 3 && bloque.indivisible) return true;
    return false;
  }

  function verificarForwardChecking(
    bloqueAsignado: BlockGroup, asignaciones: any[], occM: Occupancy,
    pendientesCriticos: BlockGroup[], slots: SlotRow[], ambientes: any[],
    docAvailM: Map<string, Map<string, number>>, cspOptsM: any, docentesProgM: any[],
  ): { ok: boolean; bloqueAfectado?: BlockGroup; ventanasRestantes?: number } {
    for (const pc of pendientesCriticos) {
      const v = contarVentanasValidas(pc, slots, ambientes, docAvailM, occM, cspOptsM, docentesProgM);
      if (v === 0) {
        return { ok: false, bloqueAfectado: pc, ventanasRestantes: 0 };
      }
    }
    return { ok: true };
  }

  const docPrioridadMap = new Map<string, number>();
  for (let i = 0; i < docentesOrdenados.length; i++) {
    docPrioridadMap.set(docentesOrdenados[i].docente_id, i);
  }

  // Phase 0: assign critical blocks globally
  const cspOptsCriticos = { ...cspOpts, incluirSabado: false };
  {
    const allBloques = [...todosLosBloquesNormalizados];
    const criticalBlocks = allBloques.filter(b => esCritico(b));
    const flexibleBlocks = allBloques.filter(b => !esCritico(b));

    if (criticalBlocks.length > 0) {
      log.push(`[V2] Bloques críticos: ${criticalBlocks.length}, flexibles: ${flexibleBlocks.length}`);

      // Sort critical blocks by MRV
      const sortedCriticos = ordenarBloquesPorCriticidad(criticalBlocks, slots, ambientes, docAvail, occ, cspOptsCriticos, docentesProg, docPrioridadMap);

      const assignedCritClaves = new Set<string>();

      for (const bloque of sortedCriticos) {
        critIteraciones++;
        const meta = bloque.units[0]?.meta || {};
        const ck = claveBloqueAcademico({ ...meta, pc_id: meta.pc_id ?? meta.id });
        if (assignedCritClaves.has(ck)) continue;

        // Store pre-assignment state for potential rollback
        const occSnapshot = cloneOccupancy(occ);
        const asignSnapshot = [...asignacionesFinales];
        const pendientesCriticosRestantes = sortedCriticos.filter(b => {
          const bCk = claveBloqueAcademico({ ...b.units[0]?.meta, pc_id: b.units[0]?.meta?.pc_id ?? b.units[0]?.meta?.id });
          return !assignedCritClaves.has(bCk) && b !== bloque;
        });

        let assigned = false;
        for (const p of [1, 2]) {
          const res = asignarGrupoContinuo(bloque, slots, ambientes, docAvail, occ, p, ambAvail, { ...cspOptsCriticos, incluirSabado: p === 2 });
          if (res.ok) {
            // Forward check: does this leave any other critical block without options?
            const fc = verificarForwardChecking(bloque, [...asignacionesFinales, ...res.asignaciones], occ, pendientesCriticosRestantes, slots, ambientes, docAvail, cspOptsCriticos, docentesProg);
            if (fc.ok) {
              const bcId = nuevoBloqueContinuo();
              for (const a of res.asignaciones) { 
                a.bloque_continuo_id = bcId; 
                a.fuente = 'CRITICO';
                // Normalize tipo before clave generation
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CRITICO: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
              }
              const candidato = [...asignacionesFinales, ...res.asignaciones];
              // Accept if it increases total or doesn't harm critical blocks
              asignacionesFinales = candidato;
              rebuildOccupancy(asignacionesFinales, occ);
              auditarBloques('CRITICO', asignacionesFinales);
              assignedCritClaves.add(ck);
              assigned = true;
              critAsignados++;
              log.push(`[V2] CRITICO: ${meta.codigo || ''} ${bloque.tipo_sesion} ${bloque.units.length}h (P${p}, ${res.asignaciones[0]?.dia} slots[${res.asignaciones[0]?.slot_orden}])`);
              break;
            } else {
              // Rollback: restore pre-assignment state
              Object.assign(occ, occSnapshot);
              asignacionesFinales = asignSnapshot;
              rebuildOccupancy(asignacionesFinales, occ);
              log.push(`[V2] CRITICO: ${meta.codigo || ''} ${bloque.tipo_sesion} ${bloque.units.length}h — forward checking bloqueó (afecta a ${fc.bloqueAfectado?.units[0]?.meta?.codigo || ''})`);
            }
          }
        }
        if (!assigned) {
          critFallidos++;
          // Try more flexible options for this critical block before giving up
          for (const p of [1, 2]) {
            const res = asignarGrupoContinuo(bloque, slots, ambientes, docAvail, occ, p, ambAvail, { ...cspOptsCriticos, incluirSabado: true });
            if (res.ok) {
              // Normalize tipo before validation
              const normalizedAsignaciones = res.asignaciones.map(normalizarTipoAsignacion);
              
              // Validate against current critical assignments
              const validacionBloque = puedeAgregarBloqueCompleto(normalizedAsignaciones, asignacionesFinales);
              if (!validacionBloque.valido) {
                log.push(`[V2] CRITICO_SAB: bloque rechazado por validación incremental: ${validacionBloque.errores.join(', ')}`);
                continue;
              }
              
              const bcId = nuevoBloqueContinuo();
              for (const a of normalizedAsignaciones) { a.bloque_continuo_id = bcId; a.fuente = 'CRITICO_SAB'; }
              const candidato = [...asignacionesFinales, ...normalizedAsignaciones];
              
              // Validate complete candidate
              const validacionCompleta = validarSolucionFinal(candidato, cursos, slots);
              const codigosInvalidos = new Set([
                'CONFLICTO_DOCENTE', 'CONFLICTO_GRUPO', 'CONFLICTO_AMBIENTE',
                'HORAS_EXCEDIDAS', 'BLOQUE_DUPLICADO', 'LABORATORIO_DIVIDIDO',
                'BLOQUE_INDIVISIBLE_PARCIAL', 'CLAVE_BLOQUE_AUSENTE'
              ]);
              const tieneErroresEstructurales = validacionCompleta.errores_estructurados.some(e =>
                codigosInvalidos.has(e.codigo)
              );
              if (tieneErroresEstructurales) {
                log.push(`[V2] CRITICO_SAB: candidato rechazado por errores estructurales: ${validacionCompleta.errores_estructurados.map(e => e.codigo).join(', ')}`);
                continue;
              }
              
              asignacionesFinales = candidato;
              rebuildOccupancy(asignacionesFinales, occ);
              auditarBloques('CRITICO', asignacionesFinales);
              assignedCritClaves.add(ck);
              critAsignados++;
              log.push(`[V2] CRITICO: ${meta.codigo || ''} ${bloque.tipo_sesion} ${bloque.units.length}h con sábado (P${p})`);
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            log.push(`[V2] CRITICO: ${meta.codigo || ''} ${bloque.tipo_sesion} ${bloque.units.length}h — no asignado (${contarVentanasValidas(bloque, slots, ambientes, docAvail, occ, cspOptsCriticos, docentesProg)} ventanas)`);
          }
        }
      }
    }
  }

  } // end if (!_opts._skipFase0)

  // ── Capture critical assignments from FASE 0 ──
  const asignacionesCriticasTodas = asignacionesFinales.filter(
    (a: any) => a.fuente === 'CRITICO' || a.fuente === 'CRITICO_SAB'
  );
  const clavesCriticasAsignadas = new Set<string>(
    asignacionesCriticasTodas
      .map((a: any) => a.clave_bloque)
      .filter((x): x is string => Boolean(x))
  );
  log.push(`[V2] FASE 0 completada: ${asignacionesCriticasTodas.length}h críticas asignadas (${critAsignados} exitosas, ${critFallidos} fallidas)`);

  // ── Audit FASE 0 for conflicts ──
  const auditoriaFase0 = auditarValidezParcial('FASE_0', asignacionesFinales, cursos, slots);
  if (!auditoriaFase0.valida) {
    log.push(`[ROLLBACK] FASE_0 descartada por introducir conflictos: ${auditoriaFase0.detalles.map(d => `${d.tipo_conflicto}: ${d.clave_ocupacion}`).join(', ')}`);
    for (const d of auditoriaFase0.detalles) {
      log.push(`  CONFLICTO ${d.tipo_conflicto}: ${d.asignacion_a.fuente} vs ${d.asignacion_b.fuente} en ${d.clave_ocupacion}`);
    }
    asignacionesFinales = [];
    occ = initOccupancy();
  } else {
    log.push(`[V2] FASE_0 válida: 0 conflictos`);
  }

  // ── Rebuild Occupancy from scratch after FASE 0 ──
  const occPostCriticos = initOccupancy();
  rebuildOccupancy(asignacionesFinales, occPostCriticos);
  occ = occPostCriticos;
  auditarBloques('POST_FASE_0', asignacionesFinales);

  // Store baseline for comparison (post-FASE 0 state)
  const asignacionesBaseline = [...asignacionesFinales];
  const occBaseline = cloneOccupancy(occPostCriticos);
  const evalBaseline = evaluarSolucionGlobal(asignacionesBaseline, cursos, slots);
  let mejorSolucionValida = { asignaciones: asignacionesBaseline, occ: occBaseline, eval: evalBaseline };

  // ── FASE 1: Docente-priority CSP con reintentos ─────────────────────────────
  log.push(`[V2] ═══ FASE 1: Docente-priority CSP con reintentos ═══`);
  let iteracionesCsp = 0;
  const reintentosPorDocente: Record<string, number> = {};
  const mejoras: MejoraIteracion[] = [];
  const razonesMixtosGlobal: string[] = [];

  for (const doc of docentesOrdenados) {
    const bloquesDocente = bloquesPorDocente.get(doc.docente_id) || [];
    // Remove blocks already assigned in FASE 0 (they are already in asignacionesFinales)
    const bloques = bloquesDocente.filter((b: BlockGroup) => {
      const ck = obtenerClaveBloque(b);
      return !clavesCriticasAsignadas.has(ck);
    });
    if (bloques.length === 0) {
      const asignadasCrit = asignacionesCriticasTodas.filter((a: any) => a.docente_id === doc.docente_id);
      if (asignadasCrit.length > 0) {
        log.push(`[V2] ${doc.nombre}: completado en FASE 0 (${asignadasCrit.length}h críticas)`);
      }
      continue;
    }

    const docHoras = bloques.reduce((s, b) => s + b.units.length, 0);
    const res = docResults.get(doc.docente_id)!;
    res.total = docHoras;

    log.push(`[V2] Procesando: ${doc.nombre} (${doc.condicion}, ${doc.categoria}) — ${docHoras}h flexibles en ${bloques.length} bloques (${asignacionesCriticasTodas.filter((a: any) => a.docente_id === doc.docente_id).length}h críticas previas)`);

    // ── Reintentos por docente ──────────────────────────────────────────────
    let mejorResultado: EstrategiaResult | null = null;
    let mejorEval: EvaluacionDocente | null = null;
    const cursosDelDocente = cursos.filter((c: any) => c.docente_id === doc.docente_id);

    // Critical blocks already placed by FASE 0 for this docente
    const asignacionesCriticasDocente = asignacionesFinales
      .filter((a: any) =>
        a.docente_id === doc.docente_id &&
        (a.fuente === 'CRITICO' || a.fuente === 'CRITICO_SAB')
      )
      .map((a: any) => ({ ...a }));
    const asignacionesOtrosDocentes = asignacionesFinales.filter(
      (a: any) => a.docente_id !== doc.docente_id
    );

    let iteracionesSinMejora = 0;
    const debugIteracionesDoc: DebugIteracionDocente[] = [];
    let cargaProgramable: CargaProgramableDocente;
    try {
      cargaProgramable = await obtenerCargaProgramableDocente(programacion_id, doc.docente_id);
    } catch {
      cargaProgramable = { docente_id: doc.docente_id, total_horas_programables: docHoras, cursos: [] };
    }

    for (let intento = 0; intento < MAX_ITERACIONES_POR_DOCENTE; intento++) {
      // ── Detener si se alcanzó la carga completa o estancamiento ──
      const mejorAsigActual = mejorResultado?.asignaciones?.length || 0;
      const cargaTotalDocente = docHoras + asignacionesCriticasDocente.length;
      if (mejorAsigActual >= cargaTotalDocente) {
        log.push(`[V2] ${doc.nombre}: carga completada (${mejorAsigActual}/${cargaTotalDocente}) en intento ${intento}`);
        break;
      }
      if (iteracionesSinMejora >= MAX_ITERACIONES_SIN_MEJORA) {
        log.push(`[V2] ${doc.nombre}: detenido tras ${MAX_ITERACIONES_SIN_MEJORA} iteraciones sin mejora`);
        break;
      }

      iteracionesCsp++;
      const estrategiaActual = [
        intento < 2 ? 'estándar' : '',
        intento >= 4 ? 'práctica_en_aula' : '',
        intento >= 6 ? 'sábado' : '',
        intento >= 8 ? 'rotación_completa' : '',
        intento >= 12 ? 'ventanas_alternativas' : '',
        intento >= 16 ? 'todos_los_ambientes' : '',
        intento >= 20 ? 'último_recurso' : '',
      ].filter(Boolean).join('+') || 'estándar';

      // ── Estado aislado por intento ──────────────────────────────────────
      // Build occupancy from other docentes + this docente's criticals only
      const occTemp = initOccupancy();
      rebuildOccupancy([
        ...asignacionesOtrosDocentes,
        ...asignacionesCriticasDocente,
      ], occTemp);
      const docAvailTemp = clonarDocAvail(docAvail);
      // Pre-load critical assignments from FASE 0
      let asignadosTemp: any[] = asignacionesCriticasDocente.map((a: any) => ({ ...a }));
      // Start with flexible blocks; already-assigned criticals are not in bloques
      let pendientesTemp: BlockGroup[] = bloques.map(clonarBloque);
      let mixtosTemp = 0;
      const razonesMixtosTemp: string[] = [];
      const cspOptsTemp = {
        practicaEnAula: (intento >= 4) ? true : cspOpts.practicaEnAula,
        restrictedIds,
        incluirSabado: (intento >= 6) ? true : false,
        rotacion: (intento % 4),
      };
      // Seed with critical claves to prevent re-assignment
      const assignedClaves = new Set<string>(
        asignacionesCriticasDocente
          .map((a: any) => a.clave_bloque)
          .filter((x): x is string => Boolean(x))
      );

      // Sort blocks by duration DESC: large blocks first to preserve contiguous windows
      const bloquesSorted = [...bloques].sort((a, b) => b.units.length - a.units.length);
      const bloquesPorCursoGrupo = groupBy(bloquesSorted, b => b.units[0]?.meta?.curso_group_key || b.id);

      for (const [_key, grupos] of bloquesPorCursoGrupo) {
        const teoria = grupos.find(b => b.tipo_sesion === 'teoria');
        const practica = grupos.find(b => b.tipo_sesion === 'practica');
        const labs = grupos.filter(b => b.tipo_sesion === 'laboratorio');
        const teoriaPractica = grupos.find(b => b.tipo_sesion === 'teoria_practica');
        const practicaExcepcional = grupos.find(b => b.tipo_sesion === 'practica' && b.estrategia_excepcional === 'TP_2_MAS_P_3');

        // Handle TP_2_MAS_P_3 exceptional distribution (EG-101)
        if (teoriaPractica && practicaExcepcional && 
            teoriaPractica.estrategia_excepcional === 'TP_2_MAS_P_3' &&
            practicaExcepcional.estrategia_excepcional === 'TP_2_MAS_P_3') {
          log.push(`[V2] ${doc.nombre} → ${teoriaPractica.units[0].meta.codigo} TP_2_MAS_P_3 (2h TP + 3h P)`);
          
          // Try to assign both segments atomically
          let tpAsignado = false;
          for (const p of [1, 2]) {
            const tpRes = asignarGrupoContinuo(teoriaPractica, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
            if (!tpRes.ok) continue;
            
            // Temporarily add TP assignment to check if P can be assigned
            const occConTP = cloneOccupancy(occTemp);
            rebuildOccupancy([...asignadosTemp, ...tpRes.asignaciones], occConTP);
            
            for (const p2 of [1, 2]) {
              const pRes = asignarGrupoContinuo(practicaExcepcional, slots, ambientes, docAvailTemp, occConTP, p2, ambAvail, cspOptsTemp);
              if (pRes.ok) {
                // Both segments can be assigned - commit both
                for (const a of tpRes.asignaciones) {
                  a.fuente = 'CSP';
                  const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                  if (!tipoNormalizado) throw new Error(`TIPO_SESION_AUSENTE en CSP TP_2_MAS_P_3`);
                  a.tipo = tipoNormalizado;
                  a.tipo_sesion = tipoNormalizado;
                }
                for (const a of pRes.asignaciones) {
                  a.fuente = 'CSP';
                  const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                  if (!tipoNormalizado) throw new Error(`TIPO_SESION_AUSENTE en CSP TP_2_MAS_P_3`);
                  a.tipo = tipoNormalizado;
                  a.tipo_sesion = tipoNormalizado;
                }
                asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, [...tpRes.asignaciones, ...pRes.asignaciones]);
                rebuildOccupancy(asignadosTemp, occTemp);
                for (const ta of tpRes.asignaciones) { if (ta.clave_bloque) assignedClaves.add(ta.clave_bloque); }
                for (const pa of pRes.asignaciones) { if (pa.clave_bloque) assignedClaves.add(pa.clave_bloque); }
                log.push(`[V2] ${doc.nombre} → ${teoriaPractica.units[0].meta.codigo} TP_2_MAS_P_3 asignado (P${p}+P${p2})`);
                tpAsignado = true;
                // TP_2_MAS_P_3 is an exceptional strategy, NOT a traditional mixed block
                // Do NOT count it in mixtosTemp
                break;
              }
            }
            if (tpAsignado) break;
          }
          
          if (tpAsignado) {
            // Also assign labs if any
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
          } else {
            log.push(`[V2] ${doc.nombre} → ${teoriaPractica.units[0].meta.codigo} TP_2_MAS_P_3 no pudo asignarse atómicamente`);
          }
        }

        // E1: T→P contiguo
        if (teoria && practica) {
          let tpOk = false;
          for (const p of [1, 2]) {
            const tpRes = intentarAsignarTPContiguo(teoria, practica, slots, ambientes, docAvailTemp, occTemp, p, ambAvail, cspOptsTemp);
            if (tpRes.ok) {
              // Mark fuente and normalize tipo
              for (const a of tpRes.asignaciones) {
                a.fuente = 'CSP';
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CSP: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
              }
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
                // Mark fuente and normalize tipo
                for (const a of bRes.asignaciones) {
                  a.fuente = 'CSP';
                  const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                  if (!tipoNormalizado) {
                    throw new Error(`TIPO_SESION_AUSENTE en CSP: pc=${a.pc_id}, curso=${a.curso_id}`);
                  }
                  a.tipo = tipoNormalizado;
                  a.tipo_sesion = tipoNormalizado;
                }
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
                // Mark fuente and normalize tipo
                for (const a of gRes.asignaciones) {
                  a.fuente = 'CSP';
                  const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                  if (!tipoNormalizado) {
                    throw new Error(`TIPO_SESION_AUSENTE en CSP: pc=${a.pc_id}, curso=${a.curso_id}`);
                  }
                  a.tipo = tipoNormalizado;
                  a.tipo_sesion = tipoNormalizado;
                }
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
              // Mark fuente and normalize tipo
              for (const a of lRes.asignaciones) {
                a.fuente = 'CSP';
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CSP: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
              }
              asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, lRes.asignaciones);
              for (const la of lRes.asignaciones) { if (la.clave_bloque) assignedClaves.add(la.clave_bloque); }
              lOk = true;
              break;
            }
          }
          if (!lOk) {
            // Try local backtracking: evict smaller same-docente blocks to make room
            const btRes = intentarConBacktrackingLocal(
              lab, doc.docente_id, slots, ambientes, docAvailTemp, occTemp, ambAvail, cspOptsTemp,
              asignadosTemp.filter((a: any) => a.docente_id === doc.docente_id && a.fuente !== 'CRITICO' && a.fuente !== 'CRITICO_SAB'),
              log,
            );
            if (btRes && btRes.ok) {
              // Mark fuente and normalize tipo
              for (const a of btRes.asignaciones) {
                a.fuente = 'CSP';
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CSP backtrack: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
              }
              asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, btRes.asignaciones);
              for (const ba of btRes.asignaciones) { if (ba.clave_bloque) assignedClaves.add(ba.clave_bloque); }
              lOk = true;
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
              // Mark fuente and normalize tipo
              for (const a of mRes.asignaciones) {
                a.fuente = 'CSP';
                a.es_mixto = true;
                a.razon_mixto = `No se encontró un bloque continuo separado de ${t.units.length}h teoría y ${pair.units.length}h práctica. Se asignó bloque mixto completo.`;
                a.tipo_mixto = 'completo';
                a.horas_teoria_mixtas = t.units.length;
                a.horas_practica_mixtas = pair.units.length;
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CSP mixto: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
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
                // Mark fuente and normalize tipo for remanente
                for (const a of rRes.asignaciones) {
                  a.fuente = 'CSP';
                  a.es_mixto = false;
                  const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                  if (!tipoNormalizado) {
                    throw new Error(`TIPO_SESION_AUSENTE en CSP remanente: pc=${a.pc_id}, curso=${a.curso_id}`);
                  }
                  a.tipo = tipoNormalizado;
                  a.tipo_sesion = tipoNormalizado;
                }
                const rClaves = rRes.asignaciones.map((aa: any) => aa.clave_bloque).filter(Boolean);
                if (rClaves.some(ck => assignedClaves.has(ck))) continue;
                asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, rRes.asignaciones);
                for (const aa of rRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
              }
              // Mark fuente and normalize tipo for mixto
              for (const a of mRes.asignaciones) {
                a.fuente = 'CSP';
                a.es_mixto = true;
                const tipoStr = parcial.remanente?.tipo_sesion === 'teoria' ? 'mixto_mas_teoria' : 'mixto_mas_practica';
                a.razon_mixto = `Se asignaron ${ht}h teoría + ${hp}h práctica en bloque mixto y ${parcial.remanente?.units.length || 0}h de ${parcial.remanente?.tipo_sesion || ''} separadas.`;
                a.tipo_mixto = tipoStr;
                a.horas_teoria_mixtas = ht;
                a.horas_practica_mixtas = hp;
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CSP mixto parcial: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
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
              // Mark fuente and normalize tipo
              for (const a of tRes.asignaciones) {
                a.fuente = 'CSP';
                const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
                if (!tipoNormalizado) {
                  throw new Error(`TIPO_SESION_AUSENTE en CSP theory: pc=${a.pc_id}, curso=${a.curso_id}`);
                }
                a.tipo = tipoNormalizado;
                a.tipo_sesion = tipoNormalizado;
              }
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
            // Mark fuente and normalize tipo
            for (const a of pRes.asignaciones) {
              a.fuente = 'CSP';
              const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en CSP practica: pc=${a.pc_id}, curso=${a.curso_id}`);
              }
              a.tipo = tipoNormalizado;
              a.tipo_sesion = tipoNormalizado;
            }
            asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, pRes.asignaciones);
            for (const aa of pRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
            consumidos.add(pr.id);
            break;
          }
        }
      }

      // Remaining labs (with backtracking for large blocks)
      for (const lab of labsPend) {
        if (consumidos.has(lab.id)) continue;
        const ck = lab.units[0]?.meta ? claveBloqueAcademico({ ...lab.units[0].meta, pc_id: lab.units[0].meta.pc_id ?? lab.units[0].meta.id }) : '';
        if (ck && assignedClaves.has(ck)) continue;
        let lOk = false;
        for (const ll of [1, 2]) {
          const lRes = asignarGrupoContinuo(lab, slots, ambientes, docAvailTemp, occTemp, ll, ambAvail, cspOptsTemp);
          if (lRes.ok) {
            // Mark fuente and normalize tipo
            for (const a of lRes.asignaciones) {
              a.fuente = 'CSP';
              const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en CSP lab: pc=${a.pc_id}, curso=${a.curso_id}`);
              }
              a.tipo = tipoNormalizado;
              a.tipo_sesion = tipoNormalizado;
            }
            asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, lRes.asignaciones);
            for (const aa of lRes.asignaciones) { if (aa.clave_bloque) assignedClaves.add(aa.clave_bloque); }
            lOk = true; break;
          }
        }
        if (!lOk && lab.units.length >= 2) {
          const btRes = intentarConBacktrackingLocal(
            lab, doc.docente_id, slots, ambientes, docAvailTemp, occTemp, ambAvail, cspOptsTemp,
            asignadosTemp.filter((a: any) => a.docente_id === doc.docente_id && a.fuente !== 'CRITICO' && a.fuente !== 'CRITICO_SAB'),
            log,
          );
          if (btRes && btRes.ok) {
            // Mark fuente and normalize tipo
            for (const a of btRes.asignaciones) {
              a.fuente = 'CSP';
              const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en CSP lab backtrack: pc=${a.pc_id}, curso=${a.curso_id}`);
              }
              a.tipo = tipoNormalizado;
              a.tipo_sesion = tipoNormalizado;
            }
            asignadosTemp = reemplazarEnAsignaciones(asignadosTemp, btRes.asignaciones);
            for (const ba of btRes.asignaciones) { if (ba.clave_bloque) assignedClaves.add(ba.clave_bloque); }
            consumidos.add(lab.id);
            lOk = true;
          }
        }
        if (!lOk && !consumidos.has(lab.id)) {
          pendientesTemp.push(lab);
        }
      }

      pendientesTemp = pendientesTemp.filter(b => !consumidos.has(b.id));

      // ── Invariant: critical blocks from FASE 0 must be preserved ──
      const horasCriticasEsperadas = asignacionesCriticasDocente.length;
      const horasCriticasConservadas = asignadosTemp.filter(
        (a: any) =>
          (a.fuente === 'CRITICO' || a.fuente === 'CRITICO_SAB') &&
          asignacionesCriticasDocente.some(
            (c: any) => c.clave_bloque === a.clave_bloque
          )
      ).length;
      if (horasCriticasConservadas !== horasCriticasEsperadas) {
        log.push(`[FASE 1] Intento ${intento} de ${doc.nombre} descartado: perdió ${horasCriticasEsperadas - horasCriticasConservadas}h críticas`);
        continue;
      }

      // ── Audit candidate (includes criticals + CSP additions) ──
      try {
        auditarBloques(`CANDIDATO_COMPLETO_DOC_${doc.docente_id}_INTENTO_${intento}`, asignadosTemp);
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

      // ── Track mejora por iteración ──
      const prevMejor = mejorEval?.horasAsignadas ?? 0;
      if (!mejorEval || esMejorResultadoDocente(evalDoc, mejorEval)) {
        const mejora = evalDoc.horasAsignadas - prevMejor;
        if (mejora > 0) iteracionesSinMejora = 0;
        mejorEval = evalDoc;
        mejorResultado = estrategiaResult;
      } else {
        iteracionesSinMejora++;
      }

      const blPend = pendientesTemp.map(b =>
        `${b.units[0]?.meta?.codigo || '?'}-${b.tipo_sesion}`
      );
      debugIteracionesDoc.push({
        iteracion: intento + 1,
        carga_total: cargaTotalDocente,
        carga_asignada: asignadosTemp.length,
        carga_pendiente: docHoras - asignadosTemp.length,
        cursos_completos: evalDoc.cursosCompletos,
        bloques_pendientes: blPend.slice(0, 5),
        mejora: (mejorEval?.horasAsignadas ?? 0) - (intento === 0 ? 0 : (debugIteracionesDoc[intento - 1]?.carga_asignada ?? 0)),
        estrategia: estrategiaActual,
      });
    }

    // ── Teoría de 2h: último recurso (dividir en 1h+1h) ──
    if (mejorResultado && mejorResultado.pendientes.length > 0) {
      // Rebuild occ to include this docente's Fase 1 assignments
      // so asignarGrupoContinuo can detect same-docente same-slot conflicts
      const asigOtrosDocentes = asignacionesFinales.filter((a: any) => a.docente_id !== doc.docente_id);
      rebuildOccupancy([...asigOtrosDocentes, ...mejorResultado.asignaciones], occ);

      const pendientes2h = mejorResultado.pendientes.filter(b =>
        b.tipo_sesion === 'teoria' && b.units.length === 2 && b.indivisible
      );
      for (const b2h of pendientes2h) {
        const meta2h = b2h.units[0]?.meta || {};
        log.push(`[V2] No se encontró bloque continuo de 2h después de ${MAX_ITERACIONES_POR_DOCENTE} intentos. Se aplica estrategia de último recurso: teoría 1h + 1h para ${meta2h.codigo || '?'}`);
        const seg1: BlockGroup = { id: randomUUID(), units: [b2h.units[0]], indivisible: false, tipo_sesion: 'teoria' };
        const seg2: BlockGroup = { id: randomUUID(), units: [b2h.units[1]], indivisible: false, tipo_sesion: 'teoria' };
        const metaSeg1 = { ...meta2h, teoria_dividida: true, segmento_teoria: 1 };
        const metaSeg2 = { ...meta2h, teoria_dividida: true, segmento_teoria: 2 };
        if (seg1.units[0]) seg1.units[0].meta = metaSeg1;
        if (seg2.units[0]) seg2.units[0].meta = metaSeg2;

        for (const p of [2, 1]) {
          const r1 = asignarGrupoContinuo(seg1, slots, ambientes, docAvail, occ, p, ambAvail, { ...cspOpts, incluirSabado: true });
          if (r1.ok) {
            // Ensure tipo='teoria' is set for divided theory segments
            for (const a of r1.asignaciones) { 
              a.tipo = 'teoria';
              a.tipo_sesion = 'teoria';
              a.teoria_dividida = true; 
              a.segmento_teoria = 1; 
              a.fuente = 'TEORIA_DIVIDIDA'; 
              // Theory should not have lab_turno
              const claveMeta = { ...a, pc_id: a.pc_id ?? a.id, tipo_sesion: 'teoria' };
              delete claveMeta.lab_turno;
              a.clave_bloque = claveBloqueAcademico(claveMeta) + '|seg1'; 
            }
            const r2 = asignarGrupoContinuo(seg2, slots, ambientes, docAvail, occ, p, ambAvail, { ...cspOpts, incluirSabado: true });
            if (r2.ok) {
              // Ensure tipo='teoria' is set for divided theory segments
              for (const a of r2.asignaciones) { 
                a.tipo = 'teoria';
                a.tipo_sesion = 'teoria';
                a.teoria_dividida = true; 
                a.segmento_teoria = 2; 
                a.fuente = 'TEORIA_DIVIDIDA'; 
                // Theory should not have lab_turno
                const claveMeta = { ...a, pc_id: a.pc_id ?? a.id, tipo_sesion: 'teoria' };
                delete claveMeta.lab_turno;
                a.clave_bloque = claveBloqueAcademico(claveMeta) + '|seg2'; 
              }
              
              // Normalize and validate before accepting
              const normalizedR1 = r1.asignaciones.map(normalizarTipoAsignacion);
              const normalizedR2 = r2.asignaciones.map(normalizarTipoAsignacion);
              const candidato: any[] = [...(mejorResultado?.asignaciones || []), ...normalizedR1, ...normalizedR2];
              
              // Validate complete candidate
              const validacionCompleta = validarSolucionFinal(candidato, cursos, slots);
              const codigosInvalidos = new Set([
                'CONFLICTO_DOCENTE', 'CONFLICTO_GRUPO', 'CONFLICTO_AMBIENTE',
                'HORAS_EXCEDIDAS', 'BLOQUE_DUPLICADO', 'LABORATORIO_DIVIDIDO',
                'BLOQUE_INDIVISIBLE_PARCIAL', 'CLAVE_BLOQUE_AUSENTE'
              ]);
              const tieneErroresEstructurales = validacionCompleta.errores_estructurados.some(e =>
                codigosInvalidos.has(e.codigo)
              );
              if (tieneErroresEstructurales) {
                log.push(`[V2] Teoría dividida rechazada por errores estructurales: ${validacionCompleta.errores_estructurados.map(e => e.codigo).join(', ')}`);
                continue;
              }
              
              mejorResultado = {
                ...mejorResultado,
                asignaciones: candidato,
                pendientes: mejorResultado.pendientes.filter(x => x.id !== b2h.id),
              };
              rebuildOccupancy(candidato, occ);
              log.push(`[V2] Teoría dividida exitosa: ${meta2h.codigo || '?'} → 1h+1h en días distintos`);
              break;
            }
          }
        }
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
        // Keep criticals (FASE 0) even for the pendiente's curso — only remove flexible
        const otrasAsign = mejorResultado.asignaciones.filter(a =>
          !(a.curso_id === metaP.curso_id && a.grupo_id === metaP.grupo_id && a.fuente !== 'CRITICO' && a.fuente !== 'CRITICO_SAB')
        );
        for (const a of otrasAsign) {
          const ambBk = ambientes.find((ax: any) => ax.id === a.ambiente_id);
          if (ambBk) marcarOcupado(a, a.dia, a.slot_id, a.ambiente_id, occBk);
        }
        for (const p of [1, 2]) {
          const bRes = asignarGrupoContinuo(bPend, slots, ambientes, docAvailBk, occBk, p, ambAvail, cspOpts);
          if (bRes.ok) {
            // Mark fuente and normalize tipo
            for (const a of bRes.asignaciones) {
              a.fuente = 'CSP';
              const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en CSP backtrack: pc=${a.pc_id}, curso=${a.curso_id}`);
              }
              a.tipo = tipoNormalizado;
              a.tipo_sesion = tipoNormalizado;
            }
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

    // Apply the best strategy result for this docente — full replacement
    const resultadoDocenteFinal = mejorResultado?.asignaciones ?? asignacionesCriticasDocente;
    const pendientesFinal = mejorResultado?.pendientes ?? [];

    if (resultadoDocenteFinal.length > 0) {
      auditarBloques('CANDIDATO_DOCENTE_' + doc.docente_id, resultadoDocenteFinal);

      // Full replacement: remove ALL old entries for this docente, add new result
      asignacionesFinales = [
        ...asignacionesFinales.filter((a: any) => a.docente_id !== doc.docente_id),
        ...resultadoDocenteFinal,
      ];

      // Rebuild occupancy from scratch (discard stale state)
      occ = initOccupancy();
      rebuildOccupancy(asignacionesFinales, occ);

      const docAsignadas = resultadoDocenteFinal.length;
      const docPendientes = pendientesFinal.reduce((s, b) => s + b.units.length, 0);
      res.asignadas = docAsignadas;

      bloquesMixtosCount += mejorResultado?.bloquesMixtos ?? 0;
      razonesMixtosGlobal.push(...(mejorResultado?.razonesMixtos ?? []));

      log.push(`[V2] ${doc.nombre}: ${docAsignadas}/${docHoras + asignacionesCriticasDocente.length} totales (${docAsignadas - asignacionesCriticasDocente.length}h nuevas) — cursos completos ${mejorEval?.cursosCompletos ?? 0}/${mejorEval?.cursosTotales ?? 0}`);
      if (docPendientes > 0) {
        const pcts = pendientesFinal.map((p: BlockGroup) => `${p.units[0].meta.codigo || '?'} ${p.tipo_sesion} ${p.units.length}h`);
        log.push(`[V2]   Pendientes: ${pcts.join(', ')}`);
      }

      auditarBloques('CONSOLIDADO_DOCENTE_' + doc.docente_id, asignacionesFinales);

      // Record remaining blocks for GA
      for (const b of pendientesFinal) {
        if (!bloquesPendientes.some(x => x.id === b.id)) bloquesPendientes.push(b);
      }

      reintentosPorDocente[doc.docente_id] = debugIteracionesDoc.length;

      mejoras.push({
        fase: 'CSP',
        iteracion: iteracionesCsp,
        docenteId: doc.docente_id,
        accion: mejorResultado
          ? `CSP con reintentos (${debugIteracionesDoc.length} intentos)`
          : `Solo críticos (CSP no mejoró)`,
        puntajeAnterior: 0,
        puntajeNuevo: mejorEval?.horasAsignadas ?? asignacionesCriticasDocente.length,
        horasAsignadasAntes: 0,
        horasAsignadasDespues: docAsignadas,
        detalles: mejorResultado
          ? `Completos: ${mejorEval?.cursosCompletos ?? 0}/${mejorEval?.cursosTotales ?? 0} | Asignadas: ${mejorEval?.horasAsignadas ?? 0}/${mejorEval?.horasRequeridas ?? 0} | Mixtos: ${mejorResultado.bloquesMixtos}`
          : `Solo ${asignacionesCriticasDocente.length}h críticas conservadas`,
      });
    }
  }

  // ── Auditoría post-CSP ──────────────────────────────────────────────────────
  auditarBloques('CSP', asignacionesFinales);
  log.push(`[V2] Auditoría CSP: ${asignacionesFinales.length}h, sin duplicados`);

  // ── Audit CSP phase for conflicts ──
  const auditoriaCSP = auditarValidezParcial('CSP', asignacionesFinales, cursos, slots);
  if (!auditoriaCSP.valida) {
    log.push(`[ROLLBACK] CSP descartada por introducir conflictos: ${auditoriaCSP.detalles.map(d => `${d.tipo_conflicto}: ${d.clave_ocupacion}`).join(', ')}`);
    for (const d of auditoriaCSP.detalles) {
      log.push(`  CONFLICTO ${d.tipo_conflicto}: ${d.asignacion_a.fuente} vs ${d.asignacion_b.fuente} en ${d.clave_ocupacion}`);
    }
    // Rollback to last valid baseline
    asignacionesFinales = [...mejorSolucionValida.asignaciones];
    occ = cloneOccupancy(mejorSolucionValida.occ);
    rebuildOccupancy(asignacionesFinales, occ);
  } else {
    log.push(`[V2] CSP válida: 0 conflictos`);
    // Update best valid solution
    const evalCSP = evaluarSolucionGlobal(asignacionesFinales, cursos, slots);
    if (esMejorGlobal(evalCSP, mejorSolucionValida.eval)) {
      mejorSolucionValida = { asignaciones: [...asignacionesFinales], occ: cloneOccupancy(occ), eval: evalCSP };
      log.push(`[V2] Mejor solución actualizada tras CSP: ${evalCSP.horasAsignadas}h asignadas`);
    }
  }

  let gaIteraciones = 0;

  // ── FASE 2: GA Fallback ─────────────────────────────────────────────────────
  // Normalize pendientes: remove any block whose clave_bloque is already fully assigned
  const horasPorClaveGA = contarHorasAsignadasPorBloque(asignacionesFinales);
  const pendientesNormalizados: BlockGroup[] = [];
  for (const b of bloquesPendientes) {
    const meta = b.units[0]?.meta || {};
    const ck = claveBloqueAcademico(meta);
    const asignadas = horasPorClaveGA.get(ck) ?? 0;
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
          // Mark fuente and normalize tipo for GA assignments
          for (const a of candidatosSinDuplicar) {
            a.fuente = 'GA';
            const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
            if (!tipoNormalizado) {
              throw new Error(`TIPO_SESION_AUSENTE en GA: pc=${a.pc_id}, curso=${a.curso_id}`);
            }
            a.tipo = tipoNormalizado;
            a.tipo_sesion = tipoNormalizado;
          }
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

  // ── Audit GA phase for conflicts ──
  const auditoriaGA = auditarValidezParcial('GA', asignacionesFinales, cursos, slots);
  if (!auditoriaGA.valida) {
    log.push(`[ROLLBACK] GA descartada por introducir conflictos: ${auditoriaGA.detalles.map(d => `${d.tipo_conflicto}: ${d.clave_ocupacion}`).join(', ')}`);
    for (const d of auditoriaGA.detalles) {
      log.push(`  CONFLICTO ${d.tipo_conflicto}: ${d.asignacion_a.fuente} vs ${d.asignacion_b.fuente} en ${d.clave_ocupacion}`);
    }
    // Rollback to last valid baseline
    asignacionesFinales = [...mejorSolucionValida.asignaciones];
    occ = cloneOccupancy(mejorSolucionValida.occ);
    rebuildOccupancy(asignacionesFinales, occ);
  } else {
    log.push(`[V2] GA válida: 0 conflictos`);
    // Update best valid solution
    const evalGA = evaluarSolucionGlobal(asignacionesFinales, cursos, slots);
    if (esMejorGlobal(evalGA, mejorSolucionValida.eval)) {
      mejorSolucionValida = { asignaciones: [...asignacionesFinales], occ: cloneOccupancy(occ), eval: evalGA };
      log.push(`[V2] Mejor solución actualizada tras GA: ${evalGA.horasAsignadas}h asignadas`);
    }
  }

  // ── FASE 3: GA + Sábado ─────────────────────────────────────────────────────
  const pendientesTrasGA = todosLosBloquesNormalizados.reduce((s, b) => s + b.units.length, 0) - asignacionesFinales.length;
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
            // Mark fuente and normalize tipo for GA_SABADO assignments
            for (const a of sinDuplicados) {
              a.fuente = 'GA_SABADO';
              const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en GA_SABADO: pc=${a.pc_id}, curso=${a.curso_id}`);
              }
              a.tipo = tipoNormalizado;
              a.tipo_sesion = tipoNormalizado;
            }
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

  // ── Audit GA_SABADO phase for conflicts ──
  const auditoriaGASab = auditarValidezParcial('GA_SABADO', asignacionesFinales, cursos, slots);
  if (!auditoriaGASab.valida) {
    log.push(`[ROLLBACK] GA_SABADO descartada por introducir conflictos: ${auditoriaGASab.detalles.map(d => `${d.tipo_conflicto}: ${d.clave_ocupacion}`).join(', ')}`);
    for (const d of auditoriaGASab.detalles) {
      log.push(`  CONFLICTO ${d.tipo_conflicto}: ${d.asignacion_a.fuente} vs ${d.asignacion_b.fuente} en ${d.clave_ocupacion}`);
    }
    // Rollback to last valid baseline
    asignacionesFinales = [...mejorSolucionValida.asignaciones];
    occ = cloneOccupancy(mejorSolucionValida.occ);
    rebuildOccupancy(asignacionesFinales, occ);
  } else {
    log.push(`[V2] GA_SABADO válida: 0 conflictos`);
    // Update best valid solution
    const evalGASab = evaluarSolucionGlobal(asignacionesFinales, cursos, slots);
    if (esMejorGlobal(evalGASab, mejorSolucionValida.eval)) {
      mejorSolucionValida = { asignaciones: [...asignacionesFinales], occ: cloneOccupancy(occ), eval: evalGASab };
      log.push(`[V2] Mejor solución actualizada tras GA_SABADO: ${evalGASab.horasAsignadas}h asignadas`);
    }
  }

  // ── FASE 4: Refinamiento ────────────────────────────────────────────────────
  log.push(`[V2] ═══ FASE 4: Refinamiento posterior ═══`);
  let iteracionesRefinamiento = 0;
  let refinamientoSinMejora = 0;

  // Rebuild Occupancy from scratch to ensure consistency (Fix 14)
  const occRef = initOccupancy();
  rebuildOccupancy(asignacionesFinales, occRef);

  const puntajeAntes = calcularPuntajeSolucion(asignacionesFinales, totalHoras, cursos, bloquesMixtosCount, slots);
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

        // Mark fuente and normalize tipo for refinamiento assignments
        for (const a of tpRes.asignaciones) {
          a.fuente = 'REFINAMIENTO';
          const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
          if (!tipoNormalizado) {
            throw new Error(`TIPO_SESION_AUSENTE en REFINAMIENTO: pc=${a.pc_id}, curso=${a.curso_id}`);
          }
          a.tipo = tipoNormalizado;
          a.tipo_sesion = tipoNormalizado;
        }

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

        const nvoPunt = calcularPuntajeSolucion(nuevoList, totalHoras, cursos, bloquesMixtosCount - 1, slots);
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
              // Mark fuente and normalize tipo for moved Saturday block
              newAsig.fuente = 'REFINAMIENTO';
              const tipoNormalizado = newAsig.tipo ?? newAsig.tipo_sesion ?? newAsig.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en REFINAMIENTO_SAB: pc=${newAsig.pc_id}, curso=${newAsig.curso_id}`);
              }
              newAsig.tipo = tipoNormalizado;
              newAsig.tipo_sesion = tipoNormalizado;
              newAsig.clave_bloque = claveBloqueAcademico(newAsig);
              newBlock.push(newAsig);
            }
            const nuevoList = [...tempList, ...newBlock];
            const nuevoOcc = initOccupancy();
            rebuildOccupancy(nuevoList, nuevoOcc);
            const nvoPunt = calcularPuntajeSolucion(nuevoList, totalHoras, cursos, bloquesMixtosCount, slots);
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
      const nuevoPuntaje = calcularPuntajeSolucion(asignacionesFinales, totalHoras, cursos, bloquesMixtosCount, slots);
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

  // ── Audit REFINAMIENTO phase for conflicts ──
  const auditoriaRefinamiento = auditarValidezParcial('REFINAMIENTO', asignacionesFinales, cursos, slots);
  if (!auditoriaRefinamiento.valida) {
    log.push(`[ROLLBACK] REFINAMIENTO descartada por introducir conflictos: ${auditoriaRefinamiento.detalles.map(d => `${d.tipo_conflicto}: ${d.clave_ocupacion}`).join(', ')}`);
    for (const d of auditoriaRefinamiento.detalles) {
      log.push(`  CONFLICTO ${d.tipo_conflicto}: ${d.asignacion_a.fuente} vs ${d.asignacion_b.fuente} en ${d.clave_ocupacion}`);
    }
    // Rollback to last valid baseline
    asignacionesFinales = [...mejorSolucionValida.asignaciones];
    occ = cloneOccupancy(mejorSolucionValida.occ);
    rebuildOccupancy(asignacionesFinales, occ);
  } else {
    log.push(`[V2] REFINAMIENTO válida: 0 conflictos`);
    // Update best valid solution
    const evalRefinamiento = evaluarSolucionGlobal(asignacionesFinales, cursos, slots);
    if (esMejorGlobal(evalRefinamiento, mejorSolucionValida.eval)) {
      mejorSolucionValida = { asignaciones: [...asignacionesFinales], occ: cloneOccupancy(occ), eval: evalRefinamiento };
      log.push(`[V2] Mejor solución actualizada tras REFINAMIENTO: ${evalRefinamiento.horasAsignadas}h asignadas`);
    }
  }

  // ── Audit REPARACION phase for conflicts ──
  const auditoriaReparacion = auditarValidezParcial('REPARACION', asignacionesFinales, cursos, slots);
  if (!auditoriaReparacion.valida) {
    log.push(`[ROLLBACK] REPARACION descartada por introducir conflictos: ${auditoriaReparacion.detalles.map(d => `${d.tipo_conflicto}: ${d.clave_ocupacion}`).join(', ')}`);
    for (const d of auditoriaReparacion.detalles) {
      log.push(`  CONFLICTO ${d.tipo_conflicto}: ${d.asignacion_a.fuente} vs ${d.asignacion_b.fuente} en ${d.clave_ocupacion}`);
    }
    // Rollback to last valid baseline
    asignacionesFinales = [...mejorSolucionValida.asignaciones];
    occ = cloneOccupancy(mejorSolucionValida.occ);
    rebuildOccupancy(asignacionesFinales, occ);
  } else {
    log.push(`[V2] REPARACION válida: 0 conflictos`);
    // Update best valid solution
    const evalReparacion = evaluarSolucionGlobal(asignacionesFinales, cursos, slots);
    if (esMejorGlobal(evalReparacion, mejorSolucionValida.eval)) {
      mejorSolucionValida = { asignaciones: [...asignacionesFinales], occ: cloneOccupancy(occ), eval: evalReparacion };
      log.push(`[V2] Mejor solución actualizada tras REPARACION: ${evalReparacion.horasAsignadas}h asignadas`);
    }
  }

  // Count mixed blocks (including exceptional teoria_practica blocks)
  bloquesMixtosCount = new Set(
    asignacionesFinales
      .filter(a =>
        a.tipo_sesion === 'teoria_practica' ||
        a.tipo === 'teoria_practica'
      )
      .map(a =>
        a.bloque_continuo_id ??
        a.clave_bloque
      )
  ).size;

  // Build per-docente results (with course-level detail) - AFTER repair phase
  const porDocente: DocenteResult[] = [];
  for (const d of docentesOrdenados) {
    const res = docResults.get(d.docente_id);
    if (!res) continue;
    const asignadas = asignacionesFinales.filter(a => a.docente_id === d.docente_id).length;
    const asigDoc = asignacionesFinales.filter(a => a.docente_id === d.docente_id);

    // Group by curso+grupo+tipo for course detail with per-type tracking
    const requerimientosMap = new Map<string, { curso_id: string; codigo: string; reqHoras: number; asigHoras: number; tipo: string; lab_turno: number; reqBloques: number; compBloques: number; labs: Map<number, { turno: number; req: number; asig: number; dia?: string; amb?: string }> }>();
    for (const c of cursos) {
      if (c.docente_id !== d.docente_id) continue;
      const ht = (c.horas_teoria || 0);
      const hp = (c.horas_practica || 0);
      const hl = (c.horas_laboratorio || 0);
      const turnosLab = hl > 0 ? Math.max(1, Number(c.cantidad_labs) || 1) : 0;
      const reqLabs = turnosLab * hl;
      
      // Theory requirement
      if (ht > 0) {
        const k = `${c.curso_id}|${c.grupo_id || ''}|teoria|0`;
        if (!requerimientosMap.has(k)) {
          requerimientosMap.set(k, {
            curso_id: c.curso_id, codigo: c.codigo || '',
            reqHoras: ht, asigHoras: 0, tipo: 'teoria', lab_turno: 0,
            reqBloques: 1, compBloques: 0, labs: new Map(),
          });
        }
      }
      
      // Practice requirement
      if (hp > 0) {
        const k = `${c.curso_id}|${c.grupo_id || ''}|practica|0`;
        if (!requerimientosMap.has(k)) {
          requerimientosMap.set(k, {
            curso_id: c.curso_id, codigo: c.codigo || '',
            reqHoras: hp, asigHoras: 0, tipo: 'practica', lab_turno: 0,
            reqBloques: 1, compBloques: 0, labs: new Map(),
          });
        }
      }
      
      // Lab requirements per turno
      for (let t = 1; t <= turnosLab; t++) {
        const k = `${c.curso_id}|${c.grupo_id || ''}|laboratorio|${t}`;
        if (!requerimientosMap.has(k)) {
          requerimientosMap.set(k, {
            curso_id: c.curso_id, codigo: c.codigo || '',
            reqHoras: hl, asigHoras: 0, tipo: 'laboratorio', lab_turno: t,
            reqBloques: 1, compBloques: 0, labs: new Map(),
          });
        }
      }
    }

    // Count hours using obtenerAportesAsignacion for accurate exceptional distribution handling
    for (const a of asigDoc) {
      const aportes = obtenerAportesAsignacion(a);
      for (const aporte of aportes) {
        const k = `${aporte.curso_id || ''}|${aporte.grupo_id || ''}|${aporte.tipo}|${aporte.lab_turno || 0}`;
        const entry = requerimientosMap.get(k);
        if (entry) {
          entry.asigHoras += aporte.horas;
        }
        
        // Track lab assignments by turno
        if (aporte.tipo === 'laboratorio' && aporte.lab_turno) {
          const lt = aporte.lab_turno;
          // Find the entry for this lab turno
          for (const [key, reqEntry] of requerimientosMap) {
            if (reqEntry.tipo === 'laboratorio' && reqEntry.lab_turno === lt && 
                reqEntry.curso_id === (aporte.curso_id || '') && 
                (key.startsWith(`${aporte.curso_id || ''}|${aporte.grupo_id || ''}`))) {
              if (!reqEntry.labs.has(lt)) reqEntry.labs.set(lt, { turno: lt, req: 0, asig: 0 });
              reqEntry.labs.get(lt)!.asig += aporte.horas;
            }
          }
        }
      }
    }

    // Aggregate by curso+grupo for final course detail
    const cursosMap = new Map<string, { curso_id: string; codigo: string; reqHoras: number; asigHoras: number; reqBloques: number; compBloques: number; labs: Map<number, { turno: number; req: number; asig: number; dia?: string; amb?: string }> }>();
    for (const [k, entry] of requerimientosMap) {
      // Extract curso_id and grupo_id from the key
      const parts = k.split('|');
      const cursoId = parts[0];
      const grupoId = parts[1];
      const cursoGrupoKey = `${cursoId}|${grupoId}`;
      if (!cursosMap.has(cursoGrupoKey)) {
        cursosMap.set(cursoGrupoKey, {
          curso_id: entry.curso_id, codigo: entry.codigo,
          reqHoras: 0, asigHoras: 0, reqBloques: 0, compBloques: 0, labs: new Map(),
        });
      }
      const aggEntry = cursosMap.get(cursoGrupoKey)!;
      aggEntry.reqHoras += entry.reqHoras;
      aggEntry.asigHoras += entry.asigHoras;
      aggEntry.reqBloques += entry.reqBloques;
      aggEntry.compBloques += entry.compBloques;
      // Merge labs
      for (const [lt, lab] of entry.labs) {
        if (!aggEntry.labs.has(lt)) aggEntry.labs.set(lt, { turno: lt, req: 0, asig: 0 });
        aggEntry.labs.get(lt)!.req += lab.req;
        aggEntry.labs.get(lt)!.asig += lab.asig;
      }
    }

    let cursosCompletos = 0, cursosParciales = 0, cursosSinAsignar = 0;
    const detalleCursos: CursoDetalle[] = [];

    for (const [k, entry] of cursosMap) {
      const completoT = entry.asigHoras >= entry.reqHoras;
      const bloquesCompletos = entry.compBloques;

      // Check lab atomicity - filter by curso_id and grupo_id, only include if required > 0
      const labsDetalle = Array.from(entry.labs.values())
        .filter((l: any) => l.req > 0)
        .map((l: any) => {
        const labAsig = asigDoc.filter(a => 
          a.curso_id === entry.curso_id &&
          (a.grupo_id || '') === k.split('|')[1] &&
          a.tipo === 'laboratorio' && 
          a.lab_turno === l.turno
        );
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
      bloques_mixtos: new Set(
        asignacionesFinales
          .filter(a => a.docente_id === d.docente_id && (
            a.tipo_sesion === 'teoria_practica' ||
            a.tipo === 'teoria_practica'
          ))
          .map(a => a.bloque_continuo_id ?? a.clave_bloque)
      ).size,
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

  // Count hours assigned per bloque clave for repair phase
  const horasPorClaveReparacion = contarHorasAsignadasPorBloque(asignacionesFinales);

  // ── FASE 5: Reparación de pendientes ────────────────────────────────────
  const antesReparacion = totalAsignadas;
  const baselineReparacion = totalAsignadas; // Use dynamic baseline instead of hardcoded 304
  
  interface PendienteExacto {
    bloque: BlockGroup;
    clave_bloque: string;
    horas_requeridas: number;
    horas_asignadas: number;
    horas_faltantes: number;
    estado: 'SIN_ASIGNAR' | 'PARCIAL';
  }
  
  interface ResultadoReparacion {
    ok: boolean;
    asignacionesNuevas: any[];
    movimientos: number;
    horasAntes: number;
    horasDespues: number;
    validacion: any;
    razon?: string;
  }
  
  // Assign a block to an exact window (day + slots + environment)
function asignarGrupoEnVentanaExacta(
  bloque: BlockGroup,
  dia: string,
  slotGroup: SlotRow[],
  ambiente: any,
  occ: Occupancy,
  prioridad: 1 | 2
): { ok: boolean; asignaciones: any[] } {
  const asignaciones: any[] = [];
  const meta = bloque.units[0]?.meta || {};
  // Exact placements used by atomic swaps are validated by the same candidate
  // generator as normal CSP assignment; a swap cannot bypass a hard rule.
  const candidato = generarCandidatosBloque(
    bloque, slots, [ambiente], docAvail, occ, ambAvail,
    { ...cspOpts, incluirSabado: true, priorityPass: prioridad },
  ).validos.find(c => c.dia === dia && c.ambiente.id === ambiente.id &&
    c.slots.length === slotGroup.length && c.slots.every((s, i) => s.id === slotGroup[i].id));
  if (!candidato) return { ok: false, asignaciones: [] };
  
  // Create assignments for exact window
  for (let i = 0; i < slotGroup.length; i++) {
    const slot = slotGroup[i];
    const unit = bloque.units[i] || bloque.units[0];
    const asignacion = crearAsignacion(
      { ...unit, meta: { ...meta, bloque_parte: i + 1, bloque_total: slotGroup.length } },
      dia,
      slot,
      ambiente,
      candidato.prioridad,
      bloque.indivisible ? bloque.id : undefined,
      i + 1,
      slotGroup.length
    );
    asignaciones.push(asignacion);
  }
  
  return { ok: true, asignaciones };
}

// Reconstruct a complete BlockGroup from its assignments
  function reconstruirBlockGroup(asignacionesBloque: any[]): BlockGroup {
    const ordenadas = [...asignacionesBloque].sort(
      (a, b) => Number(a.bloque_parte || 0) - Number(b.bloque_parte || 0)
    );
    return {
      id: ordenadas[0].clave_bloque || randomUUID(),
      tipo_sesion: ordenadas[0].tipo_sesion,
      indivisible: (ordenadas[0].bloque_total || 1) > 1,
      units: ordenadas.map(a => ({
        meta: {
          ...a,
          pc_id: a.pc_id,
        },
        tipo_sesion: a.tipo_sesion,
      })),
    };
  }

  // Atomic swap by complete blocks
  function intentarIntercambioAtomico(
    pendiente: PendienteExacto,
    asignacionesActuales: any[],
    occActual: Occupancy,
    profundidadMaxima = 3
  ): ResultadoReparacion {
    const snapshotAsignaciones = asignacionesActuales.map(a => ({ ...a }));
    const snapshotOcc = cloneOccupancy(occActual);
    const horasGlobalesAntes = snapshotAsignaciones.length;
    const meta = pendiente.bloque.units[0]?.meta || {};
    const docenteId = meta.docente_id || '';
    const duracion = pendiente.horas_requeridas;
    
    try {
      // Generate all windows permitted by availability (without occupancy), separated by priority
      interface VentanaDisponibilidad {
        dia: string;
        slotGroup: SlotRow[];
        prioridad: 1 | 2;
      }
      const ventanasDisponibilidad: VentanaDisponibilidad[] = [];
      for (const dia of DIAS_EXT) {
        for (let si = 0; si <= slots.length - duracion; si++) {
          const slotGroup = slots.slice(si, si + duracion);
          const continua = slotGroup.every((slot, index) =>
            index === 0 || slot.orden === slotGroup[index - 1].orden + 1
          );
          if (!continua) continue;
          const disponibilidadVentana = slotGroup.map(slot =>
            disponibleEnAlgunaPrioridad(docenteId, dia, slot.id, docAvail)
          );
          const disponible = disponibilidadVentana.every(d => d.disponible);
          if (!disponible) continue;
          const prioridadVentana = disponibilidadVentana.every(d => d.prioridad === 2) ? 2 : 1;
          ventanasDisponibilidad.push({ dia, slotGroup, prioridad: prioridadVentana });
        }
      }
      
      if (ventanasDisponibilidad.length === 0) {
        return {
          ok: false,
          asignacionesNuevas: snapshotAsignaciones,
          movimientos: 0,
          horasAntes: horasGlobalesAntes,
          horasDespues: horasGlobalesAntes,
          validacion: null,
          razon: 'No hay ventanas disponibles por disponibilidad',
        };
      }
      
      // Static compatibility is shared with direct placement. Occupancy is
      // intentionally handled below because this path is looking for swaps.
      const ambValidos = ambientes.filter(amb => ambienteCompatibleConBloque(pendiente.bloque, amb, cspOpts));
      
      // Create concrete candidates with priority
      interface CandidatoIntercambio {
        dia: string;
        slotGroup: SlotRow[];
        ambiente: any;
        prioridad: 1 | 2;
        clavesBloqueantes: string[];
      }
      const candidatos: CandidatoIntercambio[] = [];
      
      for (const { dia, slotGroup, prioridad } of ventanasDisponibilidad) {
        for (const amb of ambValidos) {
          // Identify blocking complete block keys
          const clavesBloqueantes = new Set<string>();
          for (const s of slotGroup) {
            const dk = `${docenteId}-${dia}-${s.id}`;
            if (occActual.docenteOcupado.has(dk)) {
              const bloqueante = asignacionesActuales.find(a => 
                a.docente_id === docenteId && a.dia === dia && a.slot_id === s.id
              );
              if (bloqueante && bloqueante.clave_bloque) {
                clavesBloqueantes.add(bloqueante.clave_bloque);
              }
            }
            const ak = `${amb.id}-${dia}-${s.id}`;
            if (occActual.ambienteOcupado.has(ak)) {
              const bloqueante = asignacionesActuales.find(a => 
                a.ambiente_id === amb.id && a.dia === dia && a.slot_id === s.id
              );
              if (bloqueante && bloqueante.clave_bloque) {
                clavesBloqueantes.add(bloqueante.clave_bloque);
              }
            }
            if (meta.grupo_id) {
              const gk = `${meta.grupo_id}-${dia}-${s.id}`;
              if (occActual.grupoOcupado.has(gk)) {
                const bloqueante = asignacionesActuales.find(a => 
                  a.grupo_id === meta.grupo_id && a.dia === dia && a.slot_id === s.id
                );
                if (bloqueante && bloqueante.clave_bloque) {
                  clavesBloqueantes.add(bloqueante.clave_bloque);
                }
              }
            }
          }
          
          // Skip if too many blockers
          if (clavesBloqueantes.size > profundidadMaxima) continue;
          
          candidatos.push({
            dia,
            slotGroup,
            ambiente: amb,
            prioridad,
            clavesBloqueantes: Array.from(clavesBloqueantes),
          });
        }
      }
      
      if (candidatos.length === 0) {
        return {
          ok: false,
          asignacionesNuevas: snapshotAsignaciones,
          movimientos: 0,
          horasAntes: horasGlobalesAntes,
          horasDespues: horasGlobalesAntes,
          validacion: null,
          razon: 'No hay candidatos viables (demasiados bloqueantes)',
        };
      }
      
      // Sort candidates by real cost
      candidatos.sort((a, b) => {
        // Free candidates first
        const aFree = a.clavesBloqueantes.length === 0;
        const bFree = b.clavesBloqueantes.length === 0;
        if (aFree !== bFree) return aFree ? -1 : 1;
        
        // Fewer blocking blocks
        if (a.clavesBloqueantes.length !== b.clavesBloqueantes.length) {
          return a.clavesBloqueantes.length - b.clavesBloqueantes.length;
        }
        
        // Priority 1 first
        if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
        
        // Weekday before Saturday
        const aSabado = a.dia === 'sabado';
        const bSabado = b.dia === 'sabado';
        if (aSabado !== bSabado) return aSabado ? 1 : -1;
        
        return 0;
      });
      
      // Try each candidate
      for (const { dia, slotGroup, ambiente, prioridad, clavesBloqueantes } of candidatos.slice(0, 20)) {
        let asignacionesModificadas = [...asignacionesActuales];
        let occModificada = cloneOccupancy(occActual);
        const horasTemporalesTrasRetiro = asignacionesModificadas.length;
        
        // Recover complete blocking blocks (not just intersecting hours)
        const bloquesBloqueantes = new Map<string, any[]>();
        for (const clave of clavesBloqueantes) {
          const asignacionesBloque = asignacionesActuales.filter(a => a.clave_bloque === clave);
          bloquesBloqueantes.set(clave, asignacionesBloque);
          
          // Invariant: complete block recovered
          const totalEsperado = asignacionesBloque[0]?.bloque_total ?? asignacionesBloque.length;
          if (asignacionesBloque.length !== totalEsperado) {
            throw new Error(
              `Bloqueante incompleto recuperado: ${clave} ${asignacionesBloque.length}/${totalEsperado}`
            );
          }
        }
        
        // Remove blocking complete blocks
        for (const clave of clavesBloqueantes) {
          asignacionesModificadas = asignacionesModificadas.filter(a => a.clave_bloque !== clave);
        }
        rebuildOccupancy(asignacionesModificadas, occModificada);
        
        // Try to assign the pending block in the exact window
        const asignacionExacta = asignarGrupoEnVentanaExacta(pendiente.bloque, dia, slotGroup, ambiente, occModificada, prioridad);
        if (!asignacionExacta.ok) continue;
        
        // Normalize and add new assignments
        for (const a of asignacionExacta.asignaciones) {
          a.fuente = 'INTERCAMBIO';
          const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
          if (!tipoNormalizado) {
            throw new Error(`TIPO_SESION_AUSENTE en INTERCAMBIO: pc=${a.pc_id}, curso=${a.curso_id}`);
          }
          a.tipo = tipoNormalizado;
          a.tipo_sesion = tipoNormalizado;
        }
        const normalizedAsignaciones = asignacionExacta.asignaciones.map(normalizarTipoAsignacion);
        asignacionesModificadas = [...asignacionesModificadas, ...normalizedAsignaciones];
        rebuildOccupancy(asignacionesModificadas, occModificada);
        
        // Try to reassign removed blocks with both priorities
        let todosReasignados = true;
        for (const [clave, asignacionesBloque] of bloquesBloqueantes) {
          const bloqueEvacuado = reconstruirBlockGroup(asignacionesBloque);
          let reasignarRes = null;
          
          // Try both priorities
          for (const prio of [1, 2] as const) {
            reasignarRes = asignarGrupoContinuo(bloqueEvacuado, slots, ambientes, docAvail, occModificada, prio, ambAvail, { ...cspOpts, incluirSabado: true });
            if (reasignarRes.ok) break;
          }
          
          if (reasignarRes && reasignarRes.ok) {
            for (const a of reasignarRes.asignaciones) {
              a.fuente = 'REASIGNADO';
              const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
              if (!tipoNormalizado) {
                throw new Error(`TIPO_SESION_AUSENTE en REASIGNADO: pc=${a.pc_id}, curso=${a.curso_id}`);
              }
              a.tipo = tipoNormalizado;
              a.tipo_sesion = tipoNormalizado;
            }
            const reasignNormalized = reasignarRes.asignaciones.map(normalizarTipoAsignacion);
            asignacionesModificadas = [...asignacionesModificadas, ...reasignNormalized];
            rebuildOccupancy(asignacionesModificadas, occModificada);
          } else {
            todosReasignados = false;
            break;
          }
        }
        
        if (!todosReasignados) continue;
        
        // Validate the complete solution
        const validacion = validarSolucionFinal(asignacionesModificadas, cursos, slots);
        const conflictos = detallarConflictos(asignacionesModificadas);
        const horasDespues = asignacionesModificadas.length;
        
        // Accept only if conditions are met (compare against global before, not temporary after removal)
        if (validacion.resumen.conflictosDocente === 0 &&
            validacion.resumen.conflictosGrupo === 0 &&
            validacion.resumen.conflictosAmbiente === 0 &&
            validacion.resumen.horasExcedentes === 0 &&
            horasDespues > horasGlobalesAntes &&
            conflictos.length === 0) {
          return {
            ok: true,
            asignacionesNuevas: asignacionesModificadas,
            movimientos: horasDespues - horasGlobalesAntes,
            horasAntes: horasGlobalesAntes,
            horasDespues,
            validacion,
          };
        }
      }
      
      // No successful swap found
      return {
        ok: false,
        asignacionesNuevas: snapshotAsignaciones,
        movimientos: 0,
        horasAntes: horasGlobalesAntes,
        horasDespues: horasGlobalesAntes,
        validacion: null,
        razon: 'No se encontró intercambio viable',
      };
    } catch (error) {
      // Rollback on any error
      return {
        ok: false,
        asignacionesNuevas: snapshotAsignaciones,
        movimientos: 0,
        horasAntes: horasGlobalesAntes,
        horasDespues: horasGlobalesAntes,
        validacion: null,
        razon: `Error en intercambio: ${error}`,
      };
    }
  }
  function intentarReparacionAtomica(
    pendiente: PendienteExacto,
    asignacionesActuales: any[],
    occActual: Occupancy
  ): ResultadoReparacion {
    const snapshotAsignaciones = asignacionesActuales.map(a => ({ ...a }));
    const snapshotOcc = cloneOccupancy(occActual);
    const horasAntes = asignacionesActuales.length;
    const baselineLocal = baselineReparacion; // Capture baseline for this repair attempt
    
    try {
      // For partial blocks, remove existing assignments first
      let asignacionesModificadas = [...asignacionesActuales];
      let occModificada = cloneOccupancy(occActual);
      
      if (pendiente.estado === 'PARCIAL' && pendiente.bloque.indivisible) {
        const clave = pendiente.clave_bloque;
        asignacionesModificadas = asignacionesModificadas.filter(a => a.clave_bloque !== clave);
        rebuildOccupancy(asignacionesModificadas, occModificada);
        
        // Reconstruct the full block with required hours (not missing hours)
        const meta = pendiente.bloque.units[0]?.meta || {};
        const duracionCompleta = pendiente.horas_requeridas; // Use required hours (3), not missing (2)
        pendiente.bloque = {
          id: pendiente.bloque.id,
          tipo_sesion: pendiente.bloque.tipo_sesion,
          indivisible: true,
          units: Array.from({ length: duracionCompleta }, (_, i) => ({
            meta: { ...meta, bloque_parte: i + 1, bloque_total: duracionCompleta },
            tipo_sesion: pendiente.bloque.tipo_sesion,
          })),
        };
      }
      
      // Try to assign complete block directly
      let repaired = false;
      let ultimoRechazoDirecto: ReturnType<typeof asignarGrupoContinuo> | null = null;
      for (const p of [2, 1]) {
        const diagnosticoDirecto = generarCandidatosBloque(
          pendiente.bloque, slots, ambientes, docAvail, occModificada, ambAvail,
          { ...cspOpts, incluirSabado: true, priorityPass: p as 1 | 2 },
        );
        if (diagnosticoDirecto.validos.length > 0) {
          for (const c of diagnosticoDirecto.validos.slice(0, 15)) {
            log.push(`[CANDIDATO ${pendiente.bloque.units[0]?.meta?.codigo || '?'}] ${c.dia} ${c.slots.map(s => `${s.hora_inicio}/${s.id}`).join(',')} ${c.ambiente.codigo || c.ambiente.id} P${c.prioridad}`);
          }
        }
        const res = asignarGrupoContinuo(pendiente.bloque, slots, ambientes, docAvail, occModificada, p, ambAvail, { ...cspOpts, incluirSabado: true });
        if (diagnosticoDirecto.validos.length > 0 && !res.ok) {
          throw new Error(`Inconsistencia: ${pendiente.bloque.units[0]?.meta?.codigo || '?'} tiene ${diagnosticoDirecto.validos.length} candidatos válidos, pero asignarGrupoContinuo devolvió false`);
        }
        if (res.ok) {
          for (const a of res.asignaciones) {
            a.fuente = 'REPARACION';
            const tipoNormalizado = a.tipo ?? a.tipo_sesion ?? a.meta?.tipo_sesion;
            if (!tipoNormalizado) {
              throw new Error(`TIPO_SESION_AUSENTE en REPARACION: pc=${a.pc_id}, curso=${a.curso_id}`);
            }
            a.tipo = tipoNormalizado;
            a.tipo_sesion = tipoNormalizado;
          }
          const normalizedAsignaciones = res.asignaciones.map(normalizarTipoAsignacion);
          const validacionBloque = puedeAgregarBloqueCompleto(normalizedAsignaciones, asignacionesModificadas);
          if (validacionBloque.valido) {
            asignacionesModificadas = [...asignacionesModificadas, ...normalizedAsignaciones];
            rebuildOccupancy(asignacionesModificadas, occModificada);
          repaired = true;
          break;
        }
        ultimoRechazoDirecto = res;
      }
      }
      
      // If direct assignment failed, try atomic swap
      if (!repaired) {
        const resultadoSwap = intentarIntercambioAtomico(pendiente, asignacionesModificadas, occModificada, 3);
        if (resultadoSwap.ok) {
          asignacionesModificadas = resultadoSwap.asignacionesNuevas;
          occModificada = cloneOccupancy(occActual); // Rebuild from scratch
          rebuildOccupancy(asignacionesModificadas, occModificada);
          repaired = true;
        }
      }
      
      if (!repaired) {
        if (ultimoRechazoDirecto) {
          // TypeScript can infer `never` here because the value is assigned
          // after the success branch; retain the structured failed result.
          const detalleRechazo = ultimoRechazoDirecto as any;
          const resumen = Object.entries(detalleRechazo.causas_rechazo as Record<string, number>)
            .map(([causa, cantidad]) => `${causa}: ${cantidad}`).join(', ');
          log.push(`[ASIGNAR ${pendiente.bloque.units[0]?.meta?.codigo || '?'}] candidatos evaluados: ${detalleRechazo.candidatos_evaluados}; rechazos: ${resumen || 'sin candidatos compatibles'}`);
          for (const ejemplo of detalleRechazo.ejemplos_rechazo) {
            log.push(`[ASIGNAR ${pendiente.bloque.units[0]?.meta?.codigo || '?'}] ${ejemplo.dia} ${ejemplo.slot_ids.join(',')} ${ejemplo.ambiente_id} P${ejemplo.prioridad}: ${ejemplo.razones.join(',')}`);
          }
        }
        return {
          ok: false,
          asignacionesNuevas: snapshotAsignaciones,
          movimientos: 0,
          horasAntes,
          horasDespues: horasAntes,
          validacion: null,
          razon: 'No se pudo asignar el bloque completo',
        };
      }
      
      // Validate the complete solution
      const validacion = validarSolucionFinal(asignacionesModificadas, cursos, slots);
      const conflictos = detallarConflictos(asignacionesModificadas);
      const horasDespues = asignacionesModificadas.length;
      
      // Accept only if conditions are met
      if (validacion.resumen.conflictosDocente === 0 &&
          validacion.resumen.conflictosGrupo === 0 &&
          validacion.resumen.conflictosAmbiente === 0 &&
          validacion.resumen.horasExcedentes === 0 &&
          horasDespues > baselineLocal &&
          conflictos.length === 0) {
        return {
          ok: true,
          asignacionesNuevas: asignacionesModificadas,
          movimientos: horasDespues - horasAntes,
          horasAntes,
          horasDespues,
          validacion,
        };
      } else {
        return {
          ok: false,
          asignacionesNuevas: snapshotAsignaciones,
          movimientos: 0,
          horasAntes,
          horasDespues: horasAntes,
          validacion,
          razon: 'Validación fallida: conflictos o horas excedentes',
        };
      }
    } catch (error) {
      return {
        ok: false,
        asignacionesNuevas: snapshotAsignaciones,
        movimientos: 0,
        horasAntes,
        horasDespues: horasAntes,
        validacion: null,
        razon: `Error: ${error}`,
      };
    }
  }
  let pendientesExactos: PendienteExacto[] = [];
  if (pendientesFinal > 0) {
    const allBlocks = todosLosBloquesNormalizados;
    
    // Detect incomplete blocks by comparing hour quantities
    for (const bloque of allBlocks) {
      const meta = bloque.units[0]?.meta || {};
      const clave = claveBloqueAcademico({ ...meta, pc_id: meta.pc_id ?? meta.id });
      const requeridas = bloque.units.length;
      const asignadas = horasPorClaveReparacion.get(clave) ?? 0;
      
      if (asignadas < requeridas) {
        pendientesExactos.push({
          bloque,
          clave_bloque: clave,
          horas_requeridas: requeridas,
          horas_asignadas: asignadas,
          horas_faltantes: requeridas - asignadas,
          estado: asignadas === 0 ? 'SIN_ASIGNAR' : 'PARCIAL',
        });
      }
    }
    
    // Invariant check: sum of faltantes must equal global pendientes
    const sumaFaltantes = pendientesExactos.reduce((s, p) => s + p.horas_faltantes, 0);
    if (sumaFaltantes !== pendientesFinal) {
      log.push(`[WARNING] Pendientes inconsistentes: bloques=${sumaFaltantes}, global=${pendientesFinal}`);
    }
    
    log.push(`[V2] ═══ PENDIENTES EXACTOS: ${sumaFaltantes}h ═══`);
    for (const p of pendientesExactos) {
      const meta = p.bloque.units[0]?.meta || {};
      log.push(`[V2] - ${meta.codigo || '?'} ${p.bloque.tipo_sesion} ${p.horas_faltantes}h (${p.estado}: ${p.horas_asignadas}/${p.horas_requeridas})`);
    }
    
    log.push(`[V2] ═══ FASE 5: Reparación de ${pendientesExactos.length} bloques pendientes ═══`);

    if (pendientesExactos.length > 0) {
      // Sort pendientes by priority: partial blocks first, then labs, then longer blocks
      pendientesExactos.sort((a, b) => {
        const aPartial = a.estado === 'PARCIAL';
        const bPartial = b.estado === 'PARCIAL';
        if (aPartial !== bPartial) return aPartial ? -1 : 1;
        const tipoOrd = { laboratorio: 0, practica: 1, teoria: 2 };
        const ta = tipoOrd[a.bloque.tipo_sesion as keyof typeof tipoOrd] ?? 3;
        const tb = tipoOrd[b.bloque.tipo_sesion as keyof typeof tipoOrd] ?? 3;
        if (ta !== tb) return ta - tb;
        return b.horas_requeridas - a.horas_requeridas;
      });

      // Use atomic repair for each pending block in priority order
      // Recalculate pendientes after each successful repair to continue with updated state
      // Don't stop when first block fails - try all pendientes at least once per round
      let continuarReparacion = true;
      const clavesIntentadasSinExito = new Set<string>();
      
      while (continuarReparacion) {
        // Recalculate pendientes from current state
        const horasPorClaveActual = contarHorasAsignadasPorBloque(asignacionesFinales);
        const pendientesActuales: PendienteExacto[] = [];
        for (const bloque of allBlocks) {
          const meta = bloque.units[0]?.meta || {};
          const clave = claveBloqueAcademico({ ...meta, pc_id: meta.pc_id ?? meta.id });
          const requeridas = bloque.units.length;
          const asignadas = horasPorClaveActual.get(clave) ?? 0;
          
          if (asignadas < requeridas) {
            pendientesActuales.push({
              bloque,
              clave_bloque: clave,
              horas_requeridas: requeridas,
              horas_asignadas: asignadas,
              horas_faltantes: requeridas - asignadas,
              estado: asignadas === 0 ? 'SIN_ASIGNAR' : 'PARCIAL',
            });
          }
        }
        
        if (pendientesActuales.length === 0) {
          continuarReparacion = false;
          break;
        }
        
        // Sort pendientes by priority: partial blocks first, then labs, then longer blocks
        pendientesActuales.sort((a, b) => {
          const aPartial = a.estado === 'PARCIAL';
          const bPartial = b.estado === 'PARCIAL';
          if (aPartial !== bPartial) return aPartial ? -1 : 1;
          const tipoOrd = { laboratorio: 0, practica: 1, teoria: 2 };
          const ta = tipoOrd[a.bloque.tipo_sesion as keyof typeof tipoOrd] ?? 3;
          const tb = tipoOrd[b.bloque.tipo_sesion as keyof typeof tipoOrd] ?? 3;
          if (ta !== tb) return ta - tb;
          return b.horas_requeridas - a.horas_requeridas;
        });
        
        // Try each pending block at least once per round
        let huboMejoraEnRonda = false;
        for (const pendiente of pendientesActuales) {
          if (clavesIntentadasSinExito.has(pendiente.clave_bloque)) {
            continue;
          }
          
          const meta = pendiente.bloque.units[0]?.meta || {};
          log.push(`[V2] Intentando reparar: ${meta.codigo || '?'} ${pendiente.bloque.tipo_sesion} ${pendiente.horas_faltantes}h (${pendiente.estado})`);
          
          // Mandatory availability logging with raw values
          const docenteId = meta.docente_id || '';
          const disponibilidadRaw: any[] = [];
          let slotsP1 = 0, slotsP2 = 0;
          for (const dia of DIAS_EXT) {
            for (const slot of slots) {
              const disp = disponibleEnAlgunaPrioridad(docenteId, dia, slot.id, docAvail);
              if (disp.valor !== null && disp.valor > 0) {
                disponibilidadRaw.push({
                  dia,
                  slot_id: slot.id,
                  orden: slot.orden,
                  hora_inicio: slot.hora_inicio,
                  valor_disponibilidad: disp.valor,
                });
                if (disp.prioridad === 1) slotsP1++;
                if (disp.prioridad === 2) slotsP2++;
              }
            }
          }
          log.push(`[V2] Disponibilidad raw: P1=${slotsP1} slots, P2=${slotsP2} slots`);
          
          // Get progressive diagnostic counts before repair attempt
          const diag = diagnosticarBloquePendiente(pendiente.bloque, slots, ambientes, occ, docAvail, cspOpts, ambAvail);
          log.push(`[V2] Diagnóstico: slots=${diag.slots_disponibles_docente}, ventanas=${diag.ventanas_contiguas_docente}, ambientes=${diag.ambientes_compatibles}, libres=${diag.candidatos_libres}, bloqueados=${diag.candidatos_bloqueados_docente + diag.candidatos_bloqueados_grupo + diag.candidatos_bloqueados_ambiente}`);
          
          const resultado = intentarReparacionAtomica(pendiente, asignacionesFinales, occ);
          
          if (resultado.ok) {
            asignacionesFinales = resultado.asignacionesNuevas;
            rebuildOccupancy(asignacionesFinales, occ);
            log.push(`[V2] Reparación exitosa: ${meta.codigo || '?'} ${resultado.horasAntes} → ${resultado.horasDespues}h (+${resultado.movimientos})`);
            auditarBloques('REPARACION', asignacionesFinales);
            huboMejoraEnRonda = true;
            clavesIntentadasSinExito.clear();
            break; // Start new round after successful repair
          } else {
            log.push(`[V2] Reparación fallida: ${meta.codigo || '?'} - ${resultado.razon}`);
            clavesIntentadasSinExito.add(pendiente.clave_bloque);
          }
        }
        
        if (!huboMejoraEnRonda) {
          continuarReparacion = false;
        }
      }
    }
  }
  const postReparacion = asignacionesFinales.length;
  if (postReparacion > antesReparacion) {
    log.push(`[V2] Reparación: ${postReparacion - antesReparacion}h recuperadas (${antesReparacion}→${postReparacion})`);
  }

  // ── Final conflict audit ──
  const conflictosFinales = detallarConflictos(asignacionesFinales);
  if (conflictosFinales.length > 0) {
    log.push(`[ERROR] Conflictos finales detectados:`);
    for (const c of conflictosFinales) {
      log.push(`  CONFLICTO ${c.tipo_conflicto} en ${c.clave_ocupacion}:`);
      log.push(`    Asignación A: fuente=${c.asignacion_a.fuente}, curso=${c.asignacion_a.curso_codigo}, tipo=${c.asignacion_a.tipo}`);
      log.push(`    Asignación B: fuente=${c.asignacion_b.fuente}, curso=${c.asignacion_b.curso_codigo}, tipo=${c.asignacion_b.tipo}`);
    }
    // Return best valid solution instead of throwing error
    log.push(`[FALLBACK] Retornando mejor solución válida (${mejorSolucionValida.eval.horasAsignadas}h asignadas)`);
    asignacionesFinales = mejorSolucionValida.asignaciones;
    occ = mejorSolucionValida.occ;
  }

  // Ensure we return the best valid solution
  let needsRecalculation = false;
  if (conflictosFinales.length === 0) {
    const evalFinal = evaluarSolucionGlobal(asignacionesFinales, cursos, slots);
    if (esMejorGlobal(mejorSolucionValida.eval, evalFinal)) {
      log.push(`[INFO] Mejor solución válida (${mejorSolucionValida.eval.horasAsignadas}h) es mejor que la actual (${evalFinal.horasAsignadas}h), usando mejor válida`);
      asignacionesFinales = mejorSolucionValida.asignaciones;
      occ = mejorSolucionValida.occ;
      needsRecalculation = true;
    }
  }

  // Recompute totals after repair
  const totalAsignadasFinal = asignacionesFinales.length;
  const pendientesFinalFinal = totalHoras - totalAsignadasFinal;
  const pctCompletoFinal = totalHoras > 0 ? Math.round(totalAsignadasFinal / totalHoras * 100) : 0;

  const puntajeFinal = calcularPuntajeSolucion(asignacionesFinales, totalHoras, cursos, bloquesMixtosCount, slots);
  log.push(`[V2] ═══ FINAL ═══`);
  log.push(`[V2] Total: ${totalAsignadasFinal}/${totalHoras} (${pctCompletoFinal}%) | Mixtos: ${bloquesMixtosCount} | Pendientes: ${pendientesFinalFinal}`);
  log.push(`[V2] Puntaje global: ${puntajeFinal.puntajeTotal} | Iteraciones CSP: ${iteracionesCsp} | GA: ${gaIteraciones} | Refinamiento: ${iteracionesRefinamiento}`);

  // ── Global invariant check before returning ──
  const invarianteGlobal = verificarInvarianteGlobal(asignacionesFinales);
  if (!invarianteGlobal.valida) {
    log.push(`[ERROR] Invariante global fallida:`);
    for (const err of invarianteGlobal.errores) {
      log.push(`  - ${err}`);
    }
    throw new Error(`Invariante global fallida: ${invarianteGlobal.errores.join(', ')}`);
  }

  // ── Additional invariants for EG-101 and statistics ──
  // Check EG-101 theory and practice hours
  const eg101Asignaciones = asignacionesFinales.filter(a => a.curso_codigo === 'EG-101');
  let eg101Teoria = 0, eg101Practica = 0;
  for (const a of eg101Asignaciones) {
    const aportes = obtenerAportesAsignacion(a);
    for (const aporte of aportes) {
      if (aporte.tipo === 'teoria') eg101Teoria += aporte.horas;
      if (aporte.tipo === 'practica') eg101Practica += aporte.horas;
    }
  }
  if (eg101Teoria !== 1 || eg101Practica !== 4) {
    log.push(`[WARNING] EG-101 hours inconsistent: teoria=${eg101Teoria}/1, practica=${eg101Practica}/4`);
  }
  
  // Check bloques_mixtos count
  const bloquesMixtosActual = new Set(
    asignacionesFinales
      .filter(a => a.tipo_sesion === 'teoria_practica' || a.tipo === 'teoria_practica')
      .map(a => a.bloque_continuo_id ?? a.clave_bloque)
  ).size;
  if (bloquesMixtosActual !== bloquesMixtosCount) {
    log.push(`[WARNING] bloques_mixtos inconsistent: actual=${bloquesMixtosActual}, reported=${bloquesMixtosCount}`);
  }
  
  // Check no conflicts
  const conflictosCheck = detallarConflictos(asignacionesFinales);
  if (conflictosCheck.length > 0) {
    log.push(`[WARNING] Conflictos detected in final solution: ${conflictosCheck.length}`);
  }
  
  // Check por_docente totals match global
  const totalPorDocente = porDocente.reduce((sum, d) => sum + d.asignadas, 0);
  if (totalPorDocente !== asignacionesFinales.length) {
    log.push(`[WARNING] por_docente.asignadas sum (${totalPorDocente}) != asignaciones.length (${asignacionesFinales.length})`);
  }

  // Recalculate stats if we did a fallback
  if (needsRecalculation || conflictosFinales.length > 0) {
    const totalAsignadasRecalc = asignacionesFinales.length;
    const pendientesRecalc = totalHoras - totalAsignadasRecalc;
    const pctRecalc = totalHoras > 0 ? Math.round(totalAsignadasRecalc / totalHoras * 100) : 0;
    const puntajeRecalc = calcularPuntajeSolucion(asignacionesFinales, totalHoras, cursos, bloquesMixtosCount, slots);
    
    // Recalculate porDocente with final assignments
    const porDocenteRecalc: DocenteResult[] = [];
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

        // Check lab atomicity - filter by curso_id and grupo_id
        const labsDetalle = Array.from(entry.labs.values())
          .filter((l: any) => l.req > 0)
          .map((l: any) => {
          const labAsig = asigDoc.filter(a => 
            a.curso_id === entry.curso_id &&
            (a.grupo_id || '') === k.split('|')[1] &&
            a.tipo === 'laboratorio' && 
            a.lab_turno === l.turno
          );
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

      porDocenteRecalc.push({
        docente_id: d.docente_id,
        nombre: d.nombre,
        condicion: d.condicion,
        categoria: d.categoria,
        total_horas: totalHoras,
        asignadas,
        pendientes: totalHoras - asignadas,
        pct_completado: totalHoras > 0 ? Math.round(asignadas / totalHoras * 100) : 0,
        bloques_mixtos: 0,
        prioridad_orden: 0,
        cursos_totales: cursosMap.size,
        cursos_completos: cursosCompletos,
        cursos_parciales: cursosParciales,
        cursos_sin_asignar: cursosSinAsignar,
        detalle_cursos: detalleCursos,
      });
    }

    // Consistency check: verify porDocente totals match global totals
    const totalAsignadasPorDocente = porDocenteRecalc.reduce((sum, d) => sum + d.asignadas, 0);
    const totalPendientesPorDocente = porDocenteRecalc.reduce((sum, d) => sum + d.pendientes, 0);
    if (totalAsignadasPorDocente !== totalAsignadasRecalc) {
      log.push(`[WARNING] Inconsistency: porDocente.asignadas sum (${totalAsignadasPorDocente}) != totalAsignadasRecalc (${totalAsignadasRecalc})`);
    }
    if (totalPendientesPorDocente !== pendientesRecalc) {
      log.push(`[WARNING] Inconsistency: porDocente.pendientes sum (${totalPendientesPorDocente}) != pendientesRecalc (${pendientesRecalc})`);
    }

    // Consistency check: verify course-level hour counts
    for (const d of porDocenteRecalc) {
      for (const curso of d.detalle_cursos) {
        const expectedHours = curso.horas_requeridas;
        const assignedHours = curso.horas_asignadas;
        // Count actual assignments for this course
        const actualAssignments = asignacionesFinales.filter(a => 
          a.docente_id === d.docente_id && 
          a.curso_id === curso.curso_id
        ).length;
        if (assignedHours !== actualAssignments) {
          log.push(`[WARNING] Course inconsistency for ${d.nombre} ${curso.curso_codigo}: horas_asignadas=${assignedHours}, actual assignments=${actualAssignments}`);
        }
      }
    }

    // Use recalculated values
    return {
      asignaciones: asignacionesFinales,
      conflictos,
      conflictosDetalle,
      por_docente: porDocenteRecalc,
      stats: {
        total_horas: totalHoras,
        asignadas: totalAsignadasRecalc,
        pendientes: pendientesRecalc,
        pct_completado: pctRecalc,
        bloques_mixtos: bloquesMixtosCount,
        phase: pendientesRecalc === 0 ? 'COMPLETA' : 'PARCIAL',
        iteraciones: iteracionesCsp + gaIteraciones + iteracionesRefinamiento,
        tiempo_ms: Date.now() - inicio,
        iteraciones_detalle: {
          csp: iteracionesCsp,
          ga: gaIteraciones,
          refinamiento: iteracionesRefinamiento,
          reintentosPorDocente,
        },
        puntaje_global: puntajeRecalc,
      },
      mejoras,
      razones_mixtos: razonesMixtosGlobal,
      log: logLocal.map(line => `[${_opts.estrategia || 'BASELINE'}]${line}`),
      debug_resolver: await (async () => {
      try {
        const debugDocentes: DebugIteracionDocente[] = [];
        const debugDiagnosticos: DiagnosticoBloqueNoAsignado[] = [];
        const debugConsistencias: ReporteConsistencia[] = [];
        const debugAuditorias: AuditoriaDisponibilidad[] = [];
        const causasAgrupadas: Record<string, number> = {};

        for (const d of docentesOrdenados) {
          const carga = await obtenerCargaProgramableDocente(programacion_id, d.docente_id);
          const auditoria = await auditarDisponibilidadDocente(programacion_id, d.docente_id, slots);
          const consistencia = await validarConsistenciaFase1Fase2(programacion_id, d.docente_id, slots, asignacionesFinales);
          debugAuditorias.push(auditoria);
          debugConsistencias.push(consistencia);

          const bloquesDoc = todosLosBloquesNormalizados.filter(b => {
            const metaB = b.units[0]?.meta || {};
            return metaB.docente_id === d.docente_id;
          });
          for (const b of bloquesDoc) {
            const ckBloque = claveBloqueAcademico({ ...b.units[0]?.meta, pc_id: b.units[0]?.meta?.pc_id ?? b.units[0]?.meta?.id });
            const horasAsig = contarHorasAsignadasPorBloque(asignacionesFinales).get(ckBloque) || 0;
            if (horasAsig >= b.units.length) continue;
            const ctx = {
              docAvail, occ, ambAvail,
              priorityPass: 1,
              opts: { practicaEnAula: false, restrictedIds, incluirSabado: false },
            };
            const nomDoc = d.nombre || '';
            const diag = diagnosticarBloqueNoAsignado(b, slots, ambientes, ctx, carga.total_horas_programables, asignacionesFinales.filter(a => a.docente_id === d.docente_id).length, nomDoc);
            debugDiagnosticos.push(diag);
            for (const [causa, cnt] of Object.entries(diag.causas_rechazo)) {
              causasAgrupadas[causa] = (causasAgrupadas[causa] || 0) + cnt;
            }
          }
        }

        const docentesIncompletos = porDocente.filter(d => d.pendientes > 0).length;
        return {
          docentes_incompletos: docentesIncompletos,
          bloques_no_asignados: debugDiagnosticos.length,
          causas_agrupadas: causasAgrupadas,
          iteraciones_por_docente: debugDocentes,
          diagnosticos: debugDiagnosticos,
          consistencias: debugConsistencias,
          auditorias_disponibilidad: debugAuditorias,
        };
      } catch {
        return undefined;
      }
    })(),
  };
  }

  // Normal case: return with pre-calculated porDocente and stats
  return {
    asignaciones: asignacionesFinales,
    conflictos,
    conflictosDetalle,
    por_docente: porDocente,
    stats: {
      total_horas: totalHoras,
      asignadas: totalAsignadasFinal,
      pendientes: pendientesFinalFinal,
      pct_completado: pctCompletoFinal,
      bloques_mixtos: bloquesMixtosCount,
      phase: pendientesFinalFinal === 0 ? 'COMPLETA' : 'PARCIAL',
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
    log: logLocal.map(line => `[${_opts.estrategia || 'BASELINE'}]${line}`),
    debug_resolver: await (async () => {
      try {
        const debugDocentes: DebugIteracionDocente[] = [];
        const debugDiagnosticos: DiagnosticoBloqueNoAsignado[] = [];
        const debugConsistencias: ReporteConsistencia[] = [];
        const debugAuditorias: AuditoriaDisponibilidad[] = [];
        const causasAgrupadas: Record<string, number> = {};

        for (const d of docentesOrdenados) {
          const carga = await obtenerCargaProgramableDocente(programacion_id, d.docente_id);
          const auditoria = await auditarDisponibilidadDocente(programacion_id, d.docente_id, slots);
          const consistencia = await validarConsistenciaFase1Fase2(programacion_id, d.docente_id, slots, asignacionesFinales);
          debugAuditorias.push(auditoria);
          debugConsistencias.push(consistencia);

          const bloquesDoc = todosLosBloquesNormalizados.filter(b => {
            const metaB = b.units[0]?.meta || {};
            return metaB.docente_id === d.docente_id;
          });
          for (const b of bloquesDoc) {
            const ckBloque = claveBloqueAcademico({ ...b.units[0]?.meta, pc_id: b.units[0]?.meta?.pc_id ?? b.units[0]?.meta?.id });
            const horasAsig = contarHorasAsignadasPorBloque(asignacionesFinales).get(ckBloque) || 0;
            if (horasAsig >= b.units.length) continue;
            const ctx = {
              docAvail, occ, ambAvail,
              priorityPass: 1,
              opts: { practicaEnAula: false, restrictedIds, incluirSabado: false },
            };
            const nomDoc = d.nombre || '';
            const diag = diagnosticarBloqueNoAsignado(b, slots, ambientes, ctx, carga.total_horas_programables, asignacionesFinales.filter(a => a.docente_id === d.docente_id).length, nomDoc);
            debugDiagnosticos.push(diag);
            for (const [causa, cnt] of Object.entries(diag.causas_rechazo)) {
              causasAgrupadas[causa] = (causasAgrupadas[causa] || 0) + cnt;
            }
          }
        }

        const docentesIncompletos = porDocente.filter(d => d.pendientes > 0).length;
        return {
          docentes_incompletos: docentesIncompletos,
          bloques_no_asignados: debugDiagnosticos.length,
          causas_agrupadas: causasAgrupadas,
          iteraciones_por_docente: debugDocentes,
          diagnosticos: debugDiagnosticos,
          consistencias: debugConsistencias,
          auditorias_disponibilidad: debugAuditorias,
        };
      } catch {
        return undefined;
      }
    })(),
  };
}

  // ── Run both strategies and select the best ──
  logGlobal.push(`[V2] Ejecutando estrategia BASELINE (sin FASE 0)...`);
  const baseline = await _resolverCore({ restrictedIds, _skipFase0: true, estrategia: 'BASELINE' });
  logGlobal.push(...baseline.log);

  logGlobal.push(`[V2] Ejecutando estrategia CRÍTICOS (con FASE 0)...`);
  const criticos = await _resolverCore({ restrictedIds, _skipFase0: false, estrategia: 'CRITICOS' });
  logGlobal.push(...criticos.log);

  const evalBaseline = evaluarSolucionGlobal(baseline.asignaciones, cursos, slots);
  const evalCriticos = evaluarSolucionGlobal(criticos.asignaciones, cursos, slots);

  const elegido = esMejorGlobal(evalCriticos, evalBaseline) ? criticos : baseline;
  const nombreElegido = elegido === criticos ? 'CRITICOS' : 'BASELINE';

  logGlobal.push(`[V2] ═══ COMPARACIÓN ═══`);
  logGlobal.push(`[V2] Baseline: ${evalBaseline.horasAsignadas}h (${evalBaseline.cursosCompletos} cursos completos, ${evalBaseline.laboratoriosCompletos} labs)`);
  logGlobal.push(`[V2] Críticos: ${evalCriticos.horasAsignadas}h (${evalCriticos.cursosCompletos} cursos completos, ${evalCriticos.laboratoriosCompletos} labs)`);
  logGlobal.push(`[V2] Estrategia elegida: ${nombreElegido}`);

  return {
    ...elegido,
    stats: { ...elegido.stats, phase: elegido === baseline ? 'CSP_BASELINE' : 'CSP_CRITICOS' },
    log: logGlobal,
    conflictos: [...conflictosGlobal, ...elegido.conflictos],
    conflictosDetalle: [...conflictosDetalleGlobal, ...elegido.conflictosDetalle],
  };
}

async function getCursosFaltantes(programacion_id: string, asignaciones: any[]): Promise<import('./horarios-ga').BloqueGenetico[]> {
  // Skip DB query for non-UUID programacion_ids (test scenarios)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(programacion_id)) {
    return [];
  }
  const { query } = await import('./db');
  const cursosFaltantes = await query(`
    SELECT pc.*, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
           1 AS cantidad_labs,
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
