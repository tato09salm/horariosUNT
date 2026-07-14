import { randomUUID } from 'crypto';

export type AmbAvailMap = Map<string, Set<string>>;

export function ambienteSlotDisponible(
  ambId: string,
  dia: string,
  slotId: string,
  ambAvail: AmbAvailMap,
  opts?: { esLaboratorio?: boolean }
): boolean {
  if (!ambAvail.has(ambId)) return true;
  if (opts?.esLaboratorio) return ambAvail.get(ambId)!.has(`${dia}-${slotId}`);
  return ambAvail.get(ambId)!.has(`${dia}-${slotId}`);
}

export interface SlotRow {
  id: string;
  orden: number;
  hora_inicio: string;
}

export interface BlockUnit {
  meta: Record<string, any>;
  tipo_sesion: string;
}

export interface BlockGroup {
  id: string;
  units: BlockUnit[];
  indivisible: boolean;
  tipo_sesion: string;
  estrategia_excepcional?: string;
  segmento_excepcional?: number;
}

/** Opciones comunes de la búsqueda CSP. `priorityPass` limita la búsqueda a una
 * prioridad concreta; sin ella se devuelven candidatos P1 y P2. */
export interface OpcionesCsp {
  practicaEnAula?: boolean;
  restrictedIds?: string[];
  incluirSabado?: boolean;
  rotacion?: number;
  priorityPass?: 1 | 2;
}

export interface CandidatoBloque {
  dia: string;
  slots: SlotRow[];
  ambiente: any;
  prioridad: 1 | 2;
}

export interface RechazoCandidato {
  dia: string;
  slot_ids: string[];
  ambiente_id: string;
  prioridad: 1 | 2;
  razones: string[];
}

export type ResultadoAsignacionGrupo =
  | { ok: true; asignaciones: any[]; prioridadUsada: number; candidato: CandidatoBloque }
  | {
      ok: false;
      asignaciones: [];
      prioridadUsada: null;
      candidatos_evaluados: number;
      causas_rechazo: Record<string, number>;
      ejemplos_rechazo: RechazoCandidato[];
    };

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DIAS_EXTENDIDO = [...DIAS, 'sabado'];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function cloneOccupancy(occ: Occupancy): Occupancy {
  const labClone = new Map<string, LabFranjaUso[]>();
  for (const [k, v] of occ.labEnFranja) {
    labClone.set(k, v.map(u => ({ ...u })));
  }
  return {
    docenteOcupado: new Set(occ.docenteOcupado),
    ambienteOcupado: new Set(occ.ambienteOcupado),
    grupoOcupado: new Set(occ.grupoOcupado),
    labEnFranja: labClone,
    franjaModo: new Map(occ.franjaModo),
    labParalelosFranjas: occ.labParalelosFranjas,
    aulaPreferidaTeoria: new Map(occ.aulaPreferidaTeoria),
    docenteCursoClase: new Set(occ.docenteCursoClase),
    cicloOcupado: new Set(occ.cicloOcupado),
  };
}

/** Evita que todo el CSP caiga en lunes 07:00 (primer día + primer slot) */
function diasRotados(meta: Record<string, any>, days?: string[], rotacion?: number): string[] {
  const dias = days || DIAS;
  const key = `${meta.docente_id || ''}-${meta.codigo || ''}-${meta.numero_grupo || '0'}-${meta.tipo_sesion || ''}${rotacion !== undefined ? `-r${rotacion}` : ''}`;
  const offset = hashSeed(key) % dias.length;
  return [...dias.slice(offset), ...dias.slice(0, offset)];
}

function slotsRotados(meta: Record<string, any>, util: SlotRow[], rotacion?: number): SlotRow[] {
  const key = `${meta.docente_id || ''}-${meta.codigo || ''}${rotacion !== undefined ? `-r${rotacion}` : ''}`;
  const offset = util.length > 1 ? hashSeed(key) % util.length : 0;
  return [...util.slice(offset), ...util.slice(0, offset)];
}

function ambientesRotados(ambientes: any[], meta: Record<string, any>, rotacion?: number): any[] {
  const key = `${meta.docente_id || ''}-${meta.codigo || ''}${rotacion !== undefined ? `-r${rotacion}` : ''}`;
  const offset = ambientes.length > 1 ? hashSeed(key) % ambientes.length : 0;
  return [...ambientes.slice(offset), ...ambientes.slice(0, offset)];
}

export function slotsUtiles(slots: SlotRow[], restrictedIds?: string[]): SlotRow[] {
  if (restrictedIds && restrictedIds.length > 0) {
    return slots.filter(s => !restrictedIds.includes(s.id));
  }
  return slots;
}

/** Bloque contiguo T→P→Lab (turno 1) por grupo de estudiantes; turnos lab adicionales aparte. */
export function construirGruposBloques(cursos: any[]): BlockGroup[] {
  const grupos: BlockGroup[] = [];

  for (const c of cursos) {
    const docName = c.docente_id ? `${c.docente_a}, ${c.docente_n}` : 'Sin asignar';
    const base = { ...c, docente_nombre_real: docName, cantidad_labs: c.cantidad_labs || 1 };

    const mkUnits = (tipo: string, horas: number, extra: Record<string, unknown> = {}): BlockUnit[] =>
      Array.from({ length: horas }, () => ({
        meta: { ...base, ...extra, tipo_sesion: tipo },
        tipo_sesion: tipo,
      }));

    const teoriaUnits = mkUnits('teoria', c.horas_teoria || 0);
    const practicaUnits = mkUnits('practica', c.horas_practica || 0);

    const horasPorTurno = Number(c.horas_laboratorio) || 0;
    const turnosLab = Math.max(1, Number(c.cantidad_labs) || 1);
    const tieneLab = horasPorTurno > 0 && turnosLab > 0;

    const pushBloque = (units: BlockUnit[], tipo_sesion: string) => {
      if (units.length === 0) return;
      grupos.push({ id: randomUUID(), units, indivisible: true, tipo_sesion });
    };

    const horasTp = teoriaUnits.length + practicaUnits.length;
    const horasBloque1 = horasTp + (tieneLab ? horasPorTurno : 0);

    if (tieneLab && horasBloque1 <= 4) {
      const lab1 = mkUnits('laboratorio', horasPorTurno, {
        lab_turno: 1,
        lab_turnos_total: turnosLab,
      });
      pushBloque([...teoriaUnits, ...practicaUnits, ...lab1], 'grupo_estudiante');
      for (let turno = 2; turno <= turnosLab; turno++) {
        pushBloque(
          mkUnits('laboratorio', horasPorTurno, { lab_turno: turno, lab_turnos_total: turnosLab }),
          'laboratorio'
        );
      }
    } else if (tieneLab) {
      pushBloque([...teoriaUnits, ...practicaUnits], 'grupo_estudiante');
      for (let turno = 1; turno <= turnosLab; turno++) {
        pushBloque(
          mkUnits('laboratorio', horasPorTurno, { lab_turno: turno, lab_turnos_total: turnosLab }),
          'laboratorio'
        );
      }
    } else {
      pushBloque([...teoriaUnits, ...practicaUnits], 'grupo_estudiante');
    }
  }

  return grupos;
}

/** Lab en paralelo en la misma franja (máx. 2, cursos y aulas distintos). */
export type LabFranjaUso = {
  curso_id: string;
  ambiente_id: string;
  docente_id: string;
  grupo_id: string | null;
  codigo: string;
};

export type FranjaModo = 'libre' | 'solo_lab' | 'exclusivo' | 'lleno';

export type Occupancy = {
  docenteOcupado: Set<string>;
  ambienteOcupado: Set<string>;
  grupoOcupado: Set<string>;
  labEnFranja: Map<string, LabFranjaUso[]>;
  /** Solo Lab+Lab en paralelo */
  franjaModo: Map<string, FranjaModo>;
  labParalelosFranjas: number;
  aulaPreferidaTeoria: Map<string, string>;
  docenteCursoClase: Set<string>;
  cicloOcupado: Set<string>;
};

export function puedeSlot(
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
    if (block.tipo_sesion !== 'laboratorio' && occ.cicloOcupado.has(`${block.ciclo_plan}-${seccion}-${timeKey}`)) {
      return false;
    }
  }

  // REGLA ESTRICTA: solo Lab+Lab de cursos distintos puede ir en paralelo.
  const franja = puedeUsarFranja(block, dia, slot.id, occ);
  if (!franja.ok) return false;

  return true;
}

function ambienteSlotKey(ambienteId: string, dia: string, slotId: string) {
  return `${ambienteId}-${dia}-${slotId}`;
}

function franjaKey(block: Record<string, any>, dia: string, slotId: string) {
  const cicloStr = block.ciclo_plan ? `${block.ciclo_plan}-${block.seccion || 'A'}` : 'global';
  return `${cicloStr}-${dia}-${slotId}`;
}

function modoFranja(block: Record<string, any>, dia: string, slotId: string, occ: Occupancy): FranjaModo {
  return occ.franjaModo.get(franjaKey(block, dia, slotId)) || 'libre';
}

/**
 * Paralelismo inviolable: única mezcla permitida = Lab + Lab (máx. 2).
 * Teoría, práctica y asesoría ocupan la franja en exclusiva.
 */
export function puedeUsarFranja(
  block: Record<string, any>,
  dia: string,
  slotId: string,
  occ: Occupancy
): { ok: boolean; razon?: string } {
  const fk = franjaKey(block, dia, slotId);
  const modo = modoFranja(block, dia, slotId, occ);
  const labs = occ.labEnFranja.get(fk) || [];
  const esLab = block.tipo_sesion === 'laboratorio';

  if (esLab) {
    if (modo === 'exclusivo') {
      return { ok: false, razon: 'VIOLACIÓN: franja con teoría/práctica/asesoría; no se puede agregar laboratorio' };
    }
    if (modo === 'lleno' || labs.length >= 2) {
      return { ok: false, razon: 'Máximo 2 laboratorios en paralelo por franja' };
    }
    return { ok: true };
  }

  if (modo !== 'libre' || labs.length > 0) {
    const det = labs.length
      ? `franja con ${labs.length} laboratorio(s)`
      : `franja en modo ${modo}`;
    return {
      ok: false,
      razon: `VIOLACIÓN: ${block.tipo_sesion} no puede ir en paralelo (${det}). Solo Lab+Lab.`,
    };
  }
  return { ok: true };
}

/** Paralelismo estricto: solo lab, máx. 2/franja, cursos y aulas distintos. */
function puedeLabParaleloEnFranja(
  block: Record<string, any>,
  ambienteId: string,
  dia: string,
  slotId: string,
  occ: Occupancy
): boolean {
  if (block.tipo_sesion !== 'laboratorio') return false;

  const usos = occ.labEnFranja.get(franjaKey(block, dia, slotId)) || [];
  if (usos.length >= 2) return false;

  const cursoId = block.curso_id as string;
  const docenteId = block.docente_id as string;
  for (const u of usos) {
    if (u.curso_id === cursoId) return false;
    if (u.docente_id === docenteId) return false;
    if (u.ambiente_id === ambienteId) return false;
  }
  return true;
}

export function ambienteDisponible(
  block: Record<string, any>,
  ambienteId: string,
  dia: string,
  slotId: string,
  occ: Occupancy
): boolean {
  const key = ambienteSlotKey(ambienteId, dia, slotId);
  if (occ.ambienteOcupado.has(key)) return false;

  // puedeUsarFranja ya fue validado en puedeSlot; aquí solo chequeamos lab-paralelo
  if (block.tipo_sesion === 'laboratorio') {
    return puedeLabParaleloEnFranja(block, ambienteId, dia, slotId, occ);
  }
  return true;
}

function registrarLabEnFranja(
  block: Record<string, any>,
  dia: string,
  slotId: string,
  ambienteId: string,
  occ: Occupancy
) {
  const fk = franjaKey(block, dia, slotId);
  const usos = occ.labEnFranja.get(fk) || [];
  usos.push({
    curso_id: block.curso_id,
    ambiente_id: ambienteId,
    docente_id: block.docente_id,
    grupo_id: block.grupo_id || null,
    codigo: block.codigo || block.curso_codigo || '',
  });
  occ.labEnFranja.set(fk, usos);
  occ.franjaModo.set(fk, usos.length >= 2 ? 'lleno' : 'solo_lab');
  if (usos.length === 2) occ.labParalelosFranjas++;
}

function marcarFranjaExclusiva(block: Record<string, any>, dia: string, slotId: string, occ: Occupancy) {
  occ.franjaModo.set(franjaKey(block, dia, slotId), 'exclusivo');
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

  const key = ambienteSlotKey(ambienteId, dia, slotId);
  occ.ambienteOcupado.add(key);
  if (block.tipo_sesion === 'laboratorio') {
    // Labs se rastrean por franja para controlar el máximo de 2 en paralelo
    registrarLabEnFranja(block, dia, slotId, ambienteId, occ);
  } else {
    // Teoría y práctica marcan la franja como exclusiva:
    // NINGUNA otra sesión (ni otro lab, ni otra teoría) puede ir en paralelo en este ciclo
    marcarFranjaExclusiva(block, dia, slotId, occ);
  }
}

export function ambienteSlotOk(
  ambId: string,
  dia: string,
  slotId: string,
  ambAvail: AmbAvailMap,
  _esLab: boolean
): boolean {
  if (!ambAvail.has(ambId)) return true;
  return ambAvail.get(ambId)!.has(`${dia}-${slotId}`);
}

export function ambientesValidosPara(
  block: Record<string, any>,
  ambientes: any[],
  opts?: { practicaEnAula?: boolean }
): any[] {
  return ambientes.filter((a: any) => {
    if ((block.num_alumnos || 0) > a.capacidad) return false;
    if (block.tipo_sesion === 'laboratorio') return a.tipo === 'laboratorio';
    if (block.tipo_sesion === 'teoria') return a.tipo !== 'laboratorio';
    if (block.tipo_sesion === 'practica') {
      if (opts?.practicaEnAula) return a.tipo === 'aula' || a.tipo === 'laboratorio';
      return a.tipo === 'laboratorio';
    }
    return true;
  });
}

/**
 * Compatibilidad académica estática. La disponibilidad y la ocupación se
 * verifican por slot en generarCandidatosBloque.
 */
export function ambienteCompatibleConBloque(
  bloque: BlockGroup,
  ambiente: any,
  opts: OpcionesCsp = {},
): boolean {
  const meta = bloque.units[0]?.meta || {};
  if (!ambiente || ambiente.disponible === false || ambiente.activo === false) return false;
  if (opts.restrictedIds?.includes(ambiente.id)) return false;
  if (Number(meta.num_alumnos || 0) > Number(ambiente.capacidad || 0)) return false;

  // A standalone block uses a single environment. Mixed student blocks are
  // handled by asignarBloqueEstudiante because they need aula + laboratorio.
  const tipos = new Set(bloque.units.map(u => u.tipo_sesion));
  if (tipos.size > 1) return false;
  const tipo = bloque.tipo_sesion === 'grupo_estudiante'
    ? bloque.units[0]?.tipo_sesion
    : bloque.tipo_sesion;
  if (tipo === 'laboratorio') return ambiente.tipo === 'laboratorio';
  if (tipo === 'teoria') return ambiente.tipo !== 'laboratorio';
  if (tipo === 'practica') {
    return opts.practicaEnAula
      ? ambiente.tipo === 'aula' || ambiente.tipo === 'laboratorio'
      : ambiente.tipo === 'laboratorio';
  }
  return false;
}

/** Ausencia de registro de disponibilidad del ambiente significa disponible. */
export function ambienteDisponibleSinOcupacion(
  ambienteId: string,
  dia: string,
  slotId: string,
  ambAvail: AmbAvailMap,
): boolean {
  return !ambAvail.has(ambienteId) || ambAvail.get(ambienteId)!.has(`${dia}-${slotId}`);
}

function razonesCandidato(
  group: BlockGroup,
  dia: string,
  ventana: SlotRow[],
  ambiente: any,
  prioridad: 1 | 2,
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  ambAvail: AmbAvailMap,
  opts: OpcionesCsp,
  ignorarOcupacion: boolean,
): string[] {
  const razones = new Set<string>();
  if (!ambienteCompatibleConBloque(group, ambiente, opts)) razones.add('AMBIENTE_INCOMPATIBLE');
  for (let i = 0; i < ventana.length; i++) {
    const slot = ventana[i];
    const meta = group.units[i]?.meta || group.units[0]?.meta || {};
    if (opts.restrictedIds?.includes(slot.id)) razones.add('FRANJA_ALMUERZO');
    if (!ambienteDisponibleSinOcupacion(ambiente.id, dia, slot.id, ambAvail)) razones.add('AMBIENTE_NO_DISPONIBLE');
    const timeKey = `${dia}-${slot.id}`;
    const docMap = docAvail.get(meta.docente_id);
    const valor = docMap?.get(timeKey);
    if (valor == null || (prioridad === 1 && valor !== 1)) razones.add('DOCENTE_NO_DISPONIBLE');
    if (!ignorarOcupacion) {
      if (meta.docente_id && occ.docenteOcupado.has(`${meta.docente_id}-${timeKey}`)) razones.add('DOCENTE_OCUPADO');
      if (meta.grupo_id && occ.grupoOcupado.has(`${meta.grupo_id}-${timeKey}`)) razones.add('GRUPO_OCUPADO');
      if (meta.docente_id && meta.curso_id && occ.docenteCursoClase.has(`${meta.docente_id}-${meta.curso_id}-${timeKey}`)) razones.add('DOCENTE_CURSO_OCUPADO');
      if (meta.ciclo_plan && meta.tipo_sesion !== 'laboratorio' && occ.cicloOcupado.has(`${meta.ciclo_plan}-${meta.seccion || 'A'}-${timeKey}`)) razones.add('CICLO_OCUPADO');
      const franja = puedeUsarFranja(meta, dia, slot.id, occ);
      if (!franja.ok) razones.add('LIMITE_LABORATORIOS_PARALELOS');
      if (!ambienteDisponible(meta, ambiente.id, dia, slot.id, occ)) razones.add('AMBIENTE_OCUPADO');
    }
  }
  return [...razones];
}

/** Fuente única de verdad para diagnóstico, asignación y reparación. */
export function generarCandidatosBloque(
  bloque: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  ambAvail: AmbAvailMap,
  opts: OpcionesCsp = {},
  ignorarOcupacion = false,
): { validos: CandidatoBloque[]; rechazados: RechazoCandidato[] } {
  const meta = bloque.units[0]?.meta || {};
  const duracion = bloque.units.length;
  const utiles = slotsUtiles(slots, opts.restrictedIds);
  const dias = diasRotados(meta, opts.incluirSabado ? DIAS_EXTENDIDO : undefined, opts.rotacion);
  const ventanas = slotsRotados(meta, utiles, opts.rotacion);
  // Keep incompatible environments in the traversal too: diagnostics must say
  // why they were rejected instead of silently inflating compatibility counts.
  let candidatosAmbiente = [...ambientes];
  if (opts.rotacion !== undefined && opts.rotacion >= 0) candidatosAmbiente = ambientesRotados(candidatosAmbiente, meta, opts.rotacion);
  const prioridades: (1 | 2)[] = opts.priorityPass ? [opts.priorityPass] : [1, 2];
  const validos: CandidatoBloque[] = [];
  const rechazados: RechazoCandidato[] = [];

  for (const dia of dias) for (let i = 0; i <= ventanas.length - duracion; i++) {
    const grupoSlots = ventanas.slice(i, i + duracion);
    if (!grupoSlots.every((s, n) => n === 0 || s.orden === grupoSlots[n - 1].orden + 1)) continue;
    for (const prioridad of prioridades) for (const ambiente of candidatosAmbiente) {
      const razones = razonesCandidato(bloque, dia, grupoSlots, ambiente, prioridad, docAvail, occ, ambAvail, opts, ignorarOcupacion);
      if (razones.length === 0) validos.push({ dia, slots: grupoSlots, ambiente, prioridad });
      else rechazados.push({ dia, slot_ids: grupoSlots.map(s => s.id), ambiente_id: ambiente.id, prioridad, razones });
    }
  }
  return { validos, rechazados };
}

export function crearAsignacionesDesdeCandidato(bloque: BlockGroup, candidato: CandidatoBloque): any[] {
  return candidato.slots.map((slot, idx) =>
    crearAsignacion(bloque.units[idx]?.meta || bloque.units[0].meta, candidato.dia, slot, candidato.ambiente,
      candidato.prioridad, bloque.id, idx + 1, candidato.slots.length)
  );
}

/** Franjas horarias con 2+ laboratorios distintos en paralelo */
/** Asigna T→P→Lab contiguos del mismo grupo de estudiantes (mismo día, sin huecos). */
export function asignarBloqueEstudiante(
  group: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  priorityPass: number,
  ambAvail: AmbAvailMap = new Map(),
  opts?: { practicaEnAula?: boolean; restrictedIds?: string[]; incluirSabado?: boolean; rotacion?: number }
): { ok: boolean; asignaciones: any[]; prioridadUsada: number | null } {
  const util = slotsUtiles(slots, opts?.restrictedIds);
  const meta0 = group.units[0].meta;
  const duracion = group.units.length;
  const tieneLab = group.units.some(u => u.tipo_sesion === 'laboratorio');

  let aulas = ambientes.filter((a: any) => {
    if (a.tipo === 'laboratorio') return false;
    if ((meta0.num_alumnos || 0) > a.capacidad) return false;
    return true;
  });
  
  const cicloPlanKey = meta0.ciclo_plan ? `${meta0.ciclo_plan}-${meta0.seccion || 'A'}` : undefined;
  const prefAulaId = cicloPlanKey ? occ.aulaPreferidaTeoria.get(cicloPlanKey) : undefined;
  if (prefAulaId) {
    aulas.sort((a, b) => (a.id === prefAulaId ? -1 : b.id === prefAulaId ? 1 : 0));
  } else if (opts?.rotacion !== undefined && opts.rotacion >= 0) {
    aulas = ambientesRotados(aulas, meta0, opts.rotacion);
  }
  const labs = ambientes.filter((a: any) => a.tipo === 'laboratorio' && (meta0.num_alumnos || 0) <= a.capacidad);

  const dias = diasRotados(meta0, opts?.incluirSabado ? DIAS_EXTENDIDO : undefined, opts?.rotacion);
  const slotsOrden = slotsRotados(meta0, util, opts?.rotacion);

  for (const dia of dias) {
    for (let i = 0; i <= slotsOrden.length - duracion; i++) {
      const ventana = slotsOrden.slice(i, i + duracion);
      const consecutivos = ventana.every((s, idx) =>
        idx === 0 || s.orden === ventana[idx - 1].orden + 1
      );
      if (!consecutivos) continue;

      const slotsLibres = ventana.every((s, idx) =>
        puedeSlot(group.units[idx].meta, dia, s, priorityPass, docAvail, occ)
      );
      if (!slotsLibres) continue;

      const aulasValidas = aulas.filter(aula =>
        ventana.every((s, idx) => {
          const u = group.units[idx];
          if (u.tipo_sesion === 'laboratorio') return true;
          return (
            ambienteDisponible(u.meta, aula.id, dia, s.id, occ) &&
            ambienteSlotOk(aula.id, dia, s.id, ambAvail, false)
          );
        })
      );

      for (const aula of aulasValidas) {
        const labsValidos = tieneLab
          ? labs.filter(lab =>
              ventana.every((s, idx) => {
                const u = group.units[idx];
                if (u.tipo_sesion !== 'laboratorio') return true;
                return (
                  ambienteDisponible(u.meta, lab.id, dia, s.id, occ) &&
                  ambienteSlotOk(lab.id, dia, s.id, ambAvail, true)
                );
              })
            )
          : [null];

        for (const labAmb of labsValidos) {
          const asignaciones: any[] = [];
          for (let idx = 0; idx < ventana.length; idx++) {
            const unit = group.units[idx];
            const slot = ventana[idx];
            const amb =
              unit.tipo_sesion === 'laboratorio'
                ? labAmb!
                : aula;
            marcarOcupado(unit.meta, dia, slot.id, amb.id, occ);
            asignaciones.push(
              crearAsignacion(unit.meta, dia, slot, amb, priorityPass, group.id, idx + 1, duracion)
            );
          }
          if (cicloPlanKey && group.tipo_sesion === 'teoria') occ.aulaPreferidaTeoria.set(cicloPlanKey, aula.id);
          return { ok: true, asignaciones, prioridadUsada: priorityPass };
        }
      }
    }
  }
  return { ok: false, asignaciones: [], prioridadUsada: null };
}

export function contarFranjasLabsParalelos(asignaciones: any[]): number {
  const porFranja = new Map<string, Set<string>>();
  for (const a of asignaciones) {
    if (a.tipo !== 'laboratorio' || !a.ambiente_id) continue;
    const k = `${a.dia}-${a.slot_id}`;
    if (!porFranja.has(k)) porFranja.set(k, new Set());
    porFranja.get(k)!.add(a.ambiente_id);
  }
  let n = 0;
  for (const labs of porFranja.values()) {
    if (labs.size >= 2) n++;
  }
  return n;
}

export function asignarGrupoContinuo(
  group: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  priorityPass: number,
  ambAvail: AmbAvailMap = new Map(),
  opts?: OpcionesCsp
): ResultadoAsignacionGrupo {
  const resultado = generarCandidatosBloque(
    group, slots, ambientes, docAvail, occ, ambAvail,
    { ...opts, priorityPass: priorityPass as 1 | 2 },
  );
  if (resultado.validos.length > 0) {
    // Do not run a second, subtly different search: place the validated candidate.
    const candidato = resultado.validos[0];
    const asignaciones = crearAsignacionesDesdeCandidato(group, candidato);
    for (let i = 0; i < candidato.slots.length; i++) {
      marcarOcupado(group.units[i]?.meta || group.units[0].meta, candidato.dia,
        candidato.slots[i].id, candidato.ambiente.id, occ);
    }
    const block = group.units[0].meta;
    const cicloPlanKey = block.ciclo_plan ? `${block.ciclo_plan}-${block.seccion || 'A'}` : undefined;
    if (cicloPlanKey && group.tipo_sesion === 'teoria') occ.aulaPreferidaTeoria.set(cicloPlanKey, candidato.ambiente.id);
    return { ok: true, asignaciones, prioridadUsada: candidato.prioridad, candidato };
  }
  const causas_rechazo: Record<string, number> = {};
  for (const rechazo of resultado.rechazados) for (const razon of rechazo.razones) {
    causas_rechazo[razon] = (causas_rechazo[razon] || 0) + 1;
  }
  return {
    ok: false,
    asignaciones: [],
    prioridadUsada: null,
    candidatos_evaluados: resultado.rechazados.length,
    causas_rechazo,
    ejemplos_rechazo: resultado.rechazados.slice(0, 15),
  };
}



/** Detecta violaciones Lab+Teoría u otras mezclas prohibidas en el resultado. */
export function auditarViolacionesParalelismo(asignaciones: any[]): string[] {
  const porFranja = new Map<string, any[]>();
  for (const a of asignaciones) {
    const fk = `${a.dia}-${a.slot_id}`;
    if (!porFranja.has(fk)) porFranja.set(fk, []);
    porFranja.get(fk)!.push(a);
  }
  const violaciones: string[] = [];
  for (const [fk, lista] of porFranja) {
    if (lista.length <= 1) continue;
    const tipos = [...new Set(lista.map(x => x.tipo))];
    if (tipos.length > 1 || lista.length > 2) {
      violaciones.push(
        `${fk}: ${lista.length} sesiones [${lista.map(x => `${x.curso_codigo}(${x.tipo})`).join(', ')}]`
      );
    } else if (tipos[0] !== 'laboratorio') {
      violaciones.push(`${fk}: paralelismo prohibido entre ${tipos[0]}`);
    }
  }
  return violaciones;
}

export function asignarUnidad(
  unit: BlockUnit,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  priorityPass: number,
  bloqueContinuoId?: string,
  ambAvail: AmbAvailMap = new Map(),
  opts?: { practicaEnAula?: boolean; restrictedIds?: string[]; incluirSabado?: boolean; rotacion?: number }
): { ok: boolean; asignacion?: any; prioridadUsada: number | null } {
  const block = unit.meta;

  let validAmbientes = ambientesValidosPara(block, ambientes, opts);
  if (opts?.rotacion !== undefined && opts.rotacion >= 0) {
    validAmbientes = ambientesRotados(validAmbientes, block, opts.rotacion);
  }

  const util = slotsUtiles(slots, opts?.restrictedIds);
  const dias = diasRotados(block, opts?.incluirSabado ? DIAS_EXTENDIDO : undefined, opts?.rotacion);
  const slotsOrden = slotsRotados(block, util, opts?.rotacion);

  const cicloPlanKey = block.ciclo_plan ? `${block.ciclo_plan}-${block.seccion || 'A'}` : undefined;
  const prefTeoria = cicloPlanKey ? occ.aulaPreferidaTeoria.get(cicloPlanKey) : undefined;
  const ambientesOrden = prefTeoria
    ? [...validAmbientes].sort((a, b) => (a.id === prefTeoria ? -1 : b.id === prefTeoria ? 1 : 0))
    : validAmbientes;

  for (const dia of dias) {
    for (const slot of slotsOrden) {
      if (!puedeSlot(block, dia, slot, priorityPass, docAvail, occ)) continue;

      for (const amb of ambientesOrden) {
        const isNull = amb.id === null;
        if (!isNull && !ambienteDisponible(block, amb.id, dia, slot.id, occ)) continue;
        if (!isNull && !ambienteSlotOk(amb.id, dia, slot.id, ambAvail, block.tipo_sesion === 'laboratorio')) continue;

        marcarOcupado(block, dia, slot.id, amb.id, occ);
        if (!isNull && block.tipo_sesion === 'teoria' && block.grupo_id) {
          occ.aulaPreferidaTeoria.set(block.grupo_id, amb.id);
        }
        return {
          ok: true,
          asignacion: crearAsignacion(block, dia, slot, amb, priorityPass, bloqueContinuoId),
          prioridadUsada: priorityPass,
        };
      }
    }
  }
  return { ok: false, prioridadUsada: null };
}

function _claveBloqueAcademico(block: any): string {
  const pc_id = block.pc_id || block.id || '';
  return [pc_id, block.docente_id ?? '', block.curso_id ?? '', block.grupo_id ?? '', block.tipo_sesion ?? '', block.lab_turno ?? 0].join('|');
}

function crearAsignacion(
  block: any,
  dia: string,
  slot: SlotRow,
  amb: any,
  prioridadUsada: number,
  bloqueContinuoId?: string,
  parte?: number,
  totalPartes?: number
) {
  return {
    id: randomUUID(),
    clave_bloque: _claveBloqueAcademico(block),
    pc_id: block.pc_id ?? block.id ?? null,
    curso_id: block.curso_id || null,
    grupo_id: block.grupo_id || null,
    docente_id: block.docente_id,
    ambiente_id: amb.id,
    slot_id: slot.id,
    dia,
    tipo: block.tipo_sesion,
    tipo_sesion: block.tipo_sesion,
    curso_codigo: block.codigo || block.curso_codigo,
    curso_nombre: block.curso_nombre,
    numero_grupo: block.numero_grupo,
    ambiente_codigo: amb.codigo,
    ambiente_nombre: amb.nombre,
    ambiente_tipo: amb.tipo,
    docente_nombre: block.docente_nombre_real,
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
    // Exceptional distribution metadata
    estrategia_excepcional: block.estrategia_excepcional ?? null,
    segmento_excepcional: block.segmento_excepcional ?? null,
    distribucion_id: block.distribucion_id ?? null,
    pc_id_teoria_origen: block.pc_id_teoria_origen ?? null,
    pc_id_practica_origen: block.pc_id_practica_origen ?? null,
    grupo_id_teoria_origen: block.grupo_id_teoria_origen ?? null,
    grupo_id_practica_origen: block.grupo_id_practica_origen ?? null,
    aporte_tipo: block.aporte_tipo ?? null,
    aporte_horas: block.aporte_horas ?? null,
    pc_id_aporte: block.pc_id_aporte ?? null,
    grupo_id_aporte: block.grupo_id_aporte ?? null,
  };
}

// ── Shared function for consistent hour counting across validation and reporting ──
export interface AporteAsignacion {
  curso_id: string | null;
  grupo_id: string | null;
  tipo: 'teoria' | 'practica' | 'laboratorio';
  horas: number;
  pc_id_origen: string | null;
  grupo_id_origen: string | null;
  lab_turno: number | null;
}

/**
 * Obtains the hour contribution of an assignment, handling exceptional distributions.
 * For normal assignments: returns 1 hour with the assignment's tipo.
 * For TP_2_MAS_P_3 exceptional assignments: returns the per-unit contribution (aporte_horas).
 */
export function obtenerAportesAsignacion(asignacion: any): AporteAsignacion[] {
  // Handle TP_2_MAS_P_3 exceptional distribution
  if (asignacion.estrategia_excepcional === 'TP_2_MAS_P_3') {
    const tipoAporte = asignacion.aporte_tipo as string | undefined;
    const horasAporte = Number(asignacion.aporte_horas) || 0;
    const pcIdOrigen = asignacion.pc_id_aporte as string | undefined || asignacion.pc_id as string | undefined || null;
    const grupoIdOrigen = asignacion.grupo_id_aporte as string | undefined || asignacion.grupo_id as string | undefined || null;
    const cursoId = asignacion.curso_id as string | undefined || null;
    const grupoId = asignacion.grupo_id_aporte as string | undefined || asignacion.grupo_id as string | undefined || null;
    
    if (tipoAporte && horasAporte > 0) {
      return [{
        curso_id: cursoId,
        grupo_id: grupoId,
        tipo: tipoAporte as 'teoria' | 'practica' | 'laboratorio',
        horas: horasAporte,
        pc_id_origen: pcIdOrigen,
        grupo_id_origen: grupoIdOrigen,
        lab_turno: asignacion.lab_turno || null,
      }];
    }
  }
  
  // Normal assignment: 1 hour of the assignment's tipo
  const tipoNormal = asignacion.tipo || asignacion.tipo_sesion;
  if (!tipoNormal) {
    return [];
  }
  
  return [{
    curso_id: asignacion.curso_id || null,
    grupo_id: asignacion.grupo_id || null,
    tipo: tipoNormal as 'teoria' | 'practica' | 'laboratorio',
    horas: 1,
    pc_id_origen: asignacion.pc_id || null,
    grupo_id_origen: asignacion.grupo_id || null,
    lab_turno: asignacion.lab_turno || null,
  }];
}
