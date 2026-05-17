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
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

/** Evita que todo el CSP caiga en lunes 07:00 (primer día + primer slot) */
function diasRotados(meta: Record<string, any>): string[] {
  const key = `${meta.docente_id || ''}-${meta.codigo || ''}-${meta.grupo_id || ''}`;
  const offset = hashSeed(key) % DIAS.length;
  return [...DIAS.slice(offset), ...DIAS.slice(0, offset)];
}

function slotsRotados(meta: Record<string, any>, util: SlotRow[]): SlotRow[] {
  const key = `${meta.docente_id || ''}-${meta.codigo || ''}`;
  const offset = util.length > 1 ? hashSeed(key) % util.length : 0;
  return [...util.slice(offset), ...util.slice(0, offset)];
}

export function esSlotComida(slot: SlotRow): boolean {
  return slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00';
}

export function slotsUtiles(slots: SlotRow[]): SlotRow[] {
  return slots.filter(s => !esSlotComida(s));
}

/** Agrupa horas: teoría/práctica pueden ser bloque continuo; lab siempre hora a hora. */
export function construirGruposBloques(cursos: any[]): BlockGroup[] {
  const grupos: BlockGroup[] = [];

  for (const c of cursos) {
    const docName = c.docente_id ? `${c.docente_a}, ${c.docente_n}` : 'Sin asignar';
    const base = { ...c, docente_nombre_real: docName, cantidad_labs: c.cantidad_labs || 1 };
    const indivisible = c.bloque_indivisible !== false;

    const pushHoras = (
      tipo: string,
      horas: number,
      metaExtra: Record<string, unknown> = {},
      opts: { forceDivisible?: boolean } = {}
    ) => {
      if (horas <= 0) return;
      const meta = { ...base, ...metaExtra, tipo_sesion: tipo };
      const forceDivisible = opts.forceDivisible === true;
      const divisible = forceDivisible || !indivisible || tipo === 'laboratorio';

      if (divisible) {
        for (let i = 0; i < horas; i++) {
          grupos.push({
            id: randomUUID(),
            units: [{ meta: { ...meta }, tipo_sesion: tipo }],
            indivisible: false,
            tipo_sesion: tipo,
          });
        }
      } else {
        grupos.push({
          id: randomUUID(),
          units: Array.from({ length: horas }, () => ({
            meta: { ...meta },
            tipo_sesion: tipo,
          })),
          indivisible: true,
          tipo_sesion: tipo,
        });
      }
    };

    pushHoras('teoria', c.horas_teoria || 0);
    pushHoras('practica', c.horas_practica || 0);

    const horasLabPc = Number(c.horas_laboratorio) || 0;
    const horasLabCat = Number(c.horas_laboratorio_catalogo) || 0;
    const horasPorTurno = horasLabPc > 0 ? horasLabPc : horasLabCat;
    const turnosLab = Math.max(1, Number(c.cantidad_labs) || 1);

    if (horasPorTurno > 0) {
      if (turnosLab > 1) {
        for (let turno = 1; turno <= turnosLab; turno++) {
          pushHoras(
            'laboratorio',
            horasPorTurno,
            { lab_turno: turno, lab_turnos_total: turnosLab },
            { forceDivisible: true }
          );
        }
      } else {
        pushHoras('laboratorio', horasPorTurno, {}, { forceDivisible: true });
      }
    }
  }

  return grupos;
}

export type LabSlotUso = {
  grupo_id: string | null;
  codigo: string;
  cantidad_labs: number;
  lab_turno?: number;
};

export type Occupancy = {
  docenteOcupado: Set<string>;
  ambienteOcupado: Set<string>;
  grupoOcupado: Set<string>;
  cicloOcupado: Set<string>;
  /** Hasta 2 labs de cursos distintos en la misma franja y mismo ambiente */
  labSlots: Map<string, LabSlotUso[]>;
  /** Franjas con 2 labs compartidos (estadística) */
  labCoexistenciasUsadas: number;
  aulaPreferidaTeoria: Map<string, string>;
  /** Docente + curso + franja: bloquea asesoría en horario de clase del mismo curso */
  docenteCursoClase: Set<string>;
};

function puedeSlot(
  block: Record<string, any>,
  dia: string,
  slot: SlotRow,
  priorityPass: number,
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy
): boolean {
  const timeKey = `${dia}-${slot.id}`;
  if (block.ciclo_plan && occ.cicloOcupado.has(`${block.ciclo_plan}-${timeKey}`)) return false;

  if (block.docente_id) {
    const docMap = docAvail.get(block.docente_id);
    if (!docMap?.has(timeKey)) return false;
    const p = docMap.get(timeKey)!;
    if (priorityPass === 1 && p !== 1) return false;
    if (priorityPass === 2 && p !== 2) return false;
    if (occ.docenteOcupado.has(`${block.docente_id}-${timeKey}`)) return false;
  }

  if (block.grupo_id && occ.grupoOcupado.has(`${block.grupo_id}-${timeKey}`)) return false;

  if (block.tipo_sesion === 'asesoria' && block.docente_id && block.docente_cursos) {
    for (const cursoId of block.docente_cursos as string[]) {
      if (occ.docenteCursoClase.has(`${block.docente_id}-${cursoId}-${timeKey}`)) return false;
    }
  }

  return true;
}

function ambienteSlotKey(ambienteId: string, dia: string, slotId: string) {
  return `${ambienteId}-${dia}-${slotId}`;
}

/**
 * Mismo laboratorio, misma franja: hasta 2 cursos distintos (grupos distintos).
 * Labs en distintos ambientes no se validan aquí (cada ambiente_id es independiente).
 */
function puedeCompartirLab(
  block: Record<string, any>,
  ambienteId: string,
  dia: string,
  slotId: string,
  occ: Occupancy
): boolean {
  if (block.tipo_sesion !== 'laboratorio') return false;

  const key = ambienteSlotKey(ambienteId, dia, slotId);
  const usos = occ.labSlots.get(key);
  if (!usos?.length) return false;
  if (usos.length >= 2) return false;
  if (usos.some(u => u.grupo_id && u.grupo_id === block.grupo_id)) return false;

  const codigo = block.codigo || block.curso_codigo || '';
  if (usos.some(u => u.codigo === codigo)) return false;

  return true;
}

function ambienteDisponible(
  block: Record<string, any>,
  ambienteId: string,
  dia: string,
  slotId: string,
  occ: Occupancy
): boolean {
  const key = ambienteSlotKey(ambienteId, dia, slotId);
  if (!occ.ambienteOcupado.has(key)) return true;
  return puedeCompartirLab(block, ambienteId, dia, slotId, occ);
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
  if (block.ciclo_plan) occ.cicloOcupado.add(`${block.ciclo_plan}-${timeKey}`);
  if (block.docente_id && block.curso_id && block.tipo_sesion !== 'asesoria') {
    occ.docenteCursoClase.add(`${block.docente_id}-${block.curso_id}-${timeKey}`);
  }

  if (!ambienteId) return;

  const key = ambienteSlotKey(ambienteId, dia, slotId);
  const yaOcupado = occ.ambienteOcupado.has(key);

  if (!yaOcupado) {
    occ.ambienteOcupado.add(key);
    if (block.tipo_sesion === 'laboratorio') {
      occ.labSlots.set(key, [{
        grupo_id: block.grupo_id || null,
        codigo: block.codigo || block.curso_codigo || '',
        cantidad_labs: block.cantidad_labs || 1,
        lab_turno: block.lab_turno,
      }]);
    }
    return;
  }

  if (puedeCompartirLab(block, ambienteId, dia, slotId, occ)) {
    const usos = occ.labSlots.get(key) || [];
    usos.push({
      grupo_id: block.grupo_id || null,
      codigo: block.codigo || block.curso_codigo || '',
      cantidad_labs: block.cantidad_labs || 1,
      lab_turno: block.lab_turno,
    });
    occ.labSlots.set(key, usos);
    if (usos.length === 2) occ.labCoexistenciasUsadas++;
  }
}

function ambienteSlotOk(
  ambId: string,
  dia: string,
  slotId: string,
  ambAvail: AmbAvailMap,
  esLab: boolean
): boolean {
  if (!ambAvail.has(ambId)) return true;
  return ambAvail.get(ambId)!.has(`${dia}-${slotId}`);
}

function ambientesValidosPara(
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

/** Franjas horarias con 2+ laboratorios distintos en paralelo */
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
  opts?: { practicaEnAula?: boolean }
): { ok: boolean; asignaciones: any[]; prioridadUsada: number | null } {
  const block = group.units[0].meta;
  const duracion = group.units.length;
  const util = slotsUtiles(slots);
  const validAmbientes = ambientesValidosPara(block, ambientes, opts);

  const dias = diasRotados(block);
  const slotsOrden = slotsRotados(block, util);

  for (const dia of dias) {
    for (let i = 0; i <= slotsOrden.length - duracion; i++) {
      const ventana = slotsOrden.slice(i, i + duracion);
      const indicesOrden = ventana.map(s => s.orden);
      const consecutivos = ventana.every((s, idx) =>
        idx === 0 || s.orden === ventana[idx - 1].orden + 1
      );
      if (!consecutivos) continue;

      const todosLibres = ventana.every(s => puedeSlot(block, dia, s, priorityPass, docAvail, occ));
      if (!todosLibres) continue;

      const prefTeoria = block.grupo_id ? occ.aulaPreferidaTeoria.get(block.grupo_id) : undefined;
      const ambientesOrden = prefTeoria
        ? [...validAmbientes].sort((a, b) => (a.id === prefTeoria ? -1 : b.id === prefTeoria ? 1 : 0))
        : validAmbientes;

      for (const amb of ambientesOrden) {
        const ambLibre = ventana.every(s =>
          ambienteDisponible(block, amb.id, dia, s.id, occ) &&
          ambienteSlotOk(amb.id, dia, s.id, ambAvail, group.tipo_sesion === 'laboratorio')
        );
        if (!ambLibre) continue;

        const asignaciones: any[] = [];
        ventana.forEach((slot, idx) => {
          const unit = group.units[idx];
          marcarOcupado(unit.meta, dia, slot.id, amb.id, occ);
          asignaciones.push(crearAsignacion(unit.meta, dia, slot, amb, priorityPass, group.id, idx + 1, duracion));
        });
        if (block.grupo_id && group.tipo_sesion === 'teoria') {
          occ.aulaPreferidaTeoria.set(block.grupo_id, amb.id);
        }
        return { ok: true, asignaciones, prioridadUsada: priorityPass };
      }
    }
  }
  return { ok: false, asignaciones: [], prioridadUsada: null };
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
  opts?: { practicaEnAula?: boolean }
): { ok: boolean; asignacion?: any; prioridadUsada: number | null } {
  const block = unit.meta;
  const validAmbientes =
    block.tipo_sesion === 'asesoria'
      ? [{ id: null, codigo: 'VIRT/CUB', nombre: 'Virtual / Cubículo', tipo: 'asesoria' }]
      : ambientesValidosPara(block, ambientes, opts);

  const util = slotsUtiles(slots);
  const dias = diasRotados(block);
  const slotsOrden = slotsRotados(block, util);

  const prefTeoria =
    block.tipo_sesion === 'teoria' && block.grupo_id
      ? occ.aulaPreferidaTeoria.get(block.grupo_id)
      : undefined;
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
    pc_id: block.id || null,
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
  };
}
