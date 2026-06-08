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

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

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

export function slotsUtiles(slots: SlotRow[], restrictedIds?: string[]): SlotRow[] {
  if (restrictedIds && restrictedIds.length > 0) {
    return slots.filter(s => !restrictedIds.includes(s.id));
  }
  if (restrictedIds !== undefined) {
    return slots;
  }
  return slots.filter(s => !esSlotComida(s));
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
    const turnosLab = Math.max(0, Number(c.cantidad_labs) || 0);
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
  /** Tracks how many asesorías are in each time slot for even distribution */
  _asesoriaSlotCount: Map<string, number>;
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

  if (block.docente_id) {
    const docMap = docAvail.get(block.docente_id);
    if (!docMap?.has(timeKey)) return false;
    const p = docMap.get(timeKey)!;
    if (priorityPass === 1 && p !== 1) return false;
    if (priorityPass === 2 && p !== 2) return false;
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
  // Teoría, práctica y asesoría marcan la franja globalmente exclusiva.
  const franja = puedeUsarFranja(block, dia, slot.id, occ);
  if (!franja.ok) return false;

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

function ambienteDisponible(
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
  if (block.docente_id && block.curso_id && block.tipo_sesion !== 'asesoria') {
    occ.docenteCursoClase.add(`${block.docente_id}-${block.curso_id}-${timeKey}`);
  }
  if (block.ciclo_plan && block.tipo_sesion !== 'laboratorio') {
    const seccion = block.seccion || 'A';
    occ.cicloOcupado.add(`${block.ciclo_plan}-${seccion}-${timeKey}`);
  }

  // Asesoría sin ambiente físico: marca franja exclusiva igualmente
  if (!ambienteId) {
    if (block.tipo_sesion === 'asesoria') marcarFranjaExclusiva(block, dia, slotId, occ);
    return;
  }

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
/** Asigna T→P→Lab contiguos del mismo grupo de estudiantes (mismo día, sin huecos). */
export function asignarBloqueEstudiante(
  group: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  priorityPass: number,
  ambAvail: AmbAvailMap = new Map(),
  opts?: { practicaEnAula?: boolean; restrictedIds?: string[] }
): { ok: boolean; asignaciones: any[]; prioridadUsada: number | null } {
  const util = slotsUtiles(slots, opts?.restrictedIds);
  const meta0 = group.units[0].meta;
  const duracion = group.units.length;
  const tieneLab = group.units.some(u => u.tipo_sesion === 'laboratorio');

  const aulas = ambientes.filter((a: any) => {
    if (a.tipo === 'laboratorio') return false;
    if ((meta0.num_alumnos || 0) > a.capacidad) return false;
    return true;
  });
  
  const cicloPlanKey = meta0.ciclo_plan ? `${meta0.ciclo_plan}-${meta0.seccion || 'A'}` : undefined;
  const prefAulaId = cicloPlanKey ? occ.aulaPreferidaTeoria.get(cicloPlanKey) : undefined;
  if (prefAulaId) {
    // Si el ciclo ya tiene un aula preferida, la intentamos poner primera
    aulas.sort((a, b) => (a.id === prefAulaId ? -1 : b.id === prefAulaId ? 1 : 0));
  }
  const labs = ambientes.filter((a: any) => a.tipo === 'laboratorio' && (meta0.num_alumnos || 0) <= a.capacidad);

  const dias = diasRotados(meta0);
  const slotsOrden = slotsRotados(meta0, util);

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
  opts?: { practicaEnAula?: boolean; restrictedIds?: string[] }
): { ok: boolean; asignaciones: any[]; prioridadUsada: number | null } {
  const block = group.units[0].meta;
  const duracion = group.units.length;
  const util = slotsUtiles(slots, opts?.restrictedIds);
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

      const cicloPlanKey = block.ciclo_plan ? `${block.ciclo_plan}-${block.seccion || 'A'}` : undefined;
      const prefTeoria = cicloPlanKey ? occ.aulaPreferidaTeoria.get(cicloPlanKey) : undefined;
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
        if (cicloPlanKey && group.tipo_sesion === 'teoria') {
          occ.aulaPreferidaTeoria.set(cicloPlanKey, amb.id);
        }
        return { ok: true, asignaciones, prioridadUsada: priorityPass };
      }
    }
  }
  return { ok: false, asignaciones: [], prioridadUsada: null };
}

/** Asesorías en horarios de baja demanda (sábado mañana, viernes tarde).
 *  Distribuye asesorías: slots con menos asesorías ya asignadas se prefieren. */
export function asignarAsesoria(
  unit: BlockUnit,
  slots: SlotRow[],
  docAvail: Map<string, Map<string, number>>,
  occ: Occupancy,
  priorityPass: number,
  opts?: { restrictedIds?: string[] }
): { ok: boolean; asignacion?: any; prioridadUsada: number | null } {
  const block = unit.meta;
  const amb = { id: null, codigo: 'VIRT/CUB', nombre: 'Virtual / Cubículo', tipo: 'asesoria' };
  const util = slotsUtiles(slots, opts?.restrictedIds);

  const horaNum = (s: SlotRow) => parseInt(String(s.hora_inicio).slice(0, 2), 10);

  // Ensure _asesoriaSlotCount is initialized (safety for retry passes)
  if (!occ._asesoriaSlotCount) occ._asesoriaSlotCount = new Map<string, number>();

  const candidatos: { dia: string; slot: SlotRow; prio: number }[] = [];
  for (const dia of DIAS) {
    for (const slot of util) {
      const h = horaNum(slot);
      let basePrio = 100;
      if (dia === 'sabado' && h >= 7 && h < 12) basePrio = 0;
      else if (dia === 'viernes' && h >= 18) basePrio = 1;
      else if (dia === 'jueves' && h >= 17) basePrio = 2;
      else if (dia === 'miercoles' && h >= 18) basePrio = 3;
      else if (dia === 'sabado' && h >= 12) basePrio = 4;
      else if (h >= 7 && h < 9 && (dia === 'lunes' || dia === 'martes')) basePrio = 90;
      // Add existing asesoria load to spread them out (each existing adds +10 priority)
      const slotKey = `${dia}-${slot.id}`;
      const existing = occ._asesoriaSlotCount.get(slotKey) || 0;
      candidatos.push({ dia, slot, prio: basePrio + existing * 10 });
    }
  }
  candidatos.sort((a, b) => a.prio - b.prio);

  for (const { dia, slot } of candidatos) {
    if (!puedeSlot(block, dia, slot, priorityPass, docAvail, occ)) continue;
    marcarOcupado(block, dia, slot.id, null, occ);
    // Track asesoria distribution
    const slotKey = `${dia}-${slot.id}`;
    occ._asesoriaSlotCount.set(slotKey, (occ._asesoriaSlotCount.get(slotKey) || 0) + 1);
    return {
      ok: true,
      asignacion: crearAsignacion(block, dia, slot, amb, priorityPass),
      prioridadUsada: priorityPass,
    };
  }
  return { ok: false, prioridadUsada: null };
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
  opts?: { practicaEnAula?: boolean; restrictedIds?: string[] }
): { ok: boolean; asignacion?: any; prioridadUsada: number | null } {
  const block = unit.meta;
  if (block.tipo_sesion === 'asesoria') {
    return asignarAsesoria(unit, slots, docAvail, occ, priorityPass, opts);
  }

  const validAmbientes = ambientesValidosPara(block, ambientes, opts);

  const util = slotsUtiles(slots, opts?.restrictedIds);
  const dias = diasRotados(block);
  const slotsOrden = slotsRotados(block, util);

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
