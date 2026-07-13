import { query, queryOne } from './db';
import { filtrarDisponibilidadPorCargaAdicional } from './horarios';
import type { SlotRow } from './csp-asignacion';

// ── Interfaces ────────────────────────────────────────────────────────────
export interface BloqueGenetico {
  bloque_id: string;
  clave_bloque?: string;
  pc_id: string;
  curso_id: string;
  curso_codigo?: string;
  curso_nombre?: string;
  grupo_id: string;
  numero_grupo?: number;
  docente_id: string | null;
  tipo_sesion: 'teoria' | 'practica' | 'laboratorio' | 'mixto';
  lab_turno?: number | null;
  duracion: number;
  indivisible: boolean;
  num_alumnos: number;
  ciclo_plan?: string;
  condicion_orden?: number;
  categoria_orden?: number;
  fecha_ingreso?: Date;
  cantidad_labs?: number;
}

interface GenBloque {
  bloque: BloqueGenetico;
  dia: string;
  slot_inicio_id: string;
  ambiente_id: string;
}

interface Individuo {
  genes: GenBloque[];
  fitness: number;
  hardPenalty: number;
  softPenalty: number;
}

type LabUso = {
  codigo: string;
  grupo_id: string;
  curso_id: string;
  ambiente_id: string;
  docente_id: string;
};

const DIAS_BASE = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const POP_SIZE = 50;
const MAX_GEN = 500;
const MIN_GEN = 50;
const STALL_GEN = 20;

let slotOrdenMap: Map<string, number> = new Map();
let slotArray: SlotRow[] = [];
const MUTATION_INIT = 0.25;
const ELITE_COUNT = 2;
const TOURNAMENT_SIZE = 4;

const PENALIZACION_CONFLICTO_DURO = 10000;
const PENALIZACION_BLOQUE_MIXTO = 100;
const PENALIZACION_DIA_ADICIONAL = 20;
const PENALIZACION_TEORIA_TRAS_PRACTICA = 50;
const PENALIZACION_FRAGMENTACION = 30;
const PENALIZACION_BLOQUE_ROTO = 10000;
const BONIFICACION_DOCENTE_COMPLETO = 500;
const BONIFICACION_T_P_CONTIGUO = 50;

// ── Validación atómica de bloque ─────────────────────────────────────────
function validarBloqueAtomico(gen: GenBloque): string | null {
  const d = gen.bloque.duracion;
  if (d <= 1) return null;
  const inicio = slotOrdenMap.get(gen.slot_inicio_id);
  if (inicio === undefined) return 'slot_inicio_id no encontrado';
  for (let i = 0; i < d; i++) {
    const ord = inicio + i;
    const slot = slotArray.find(s => s.orden === ord);
    if (!slot) return `falta slot orden ${ord}`;
  }
  return null;
}

function slotsDelBloque(gen: GenBloque): { slot_id: string; orden: number }[] {
  const inicio = slotOrdenMap.get(gen.slot_inicio_id);
  if (inicio === undefined) return [];
  const result: { slot_id: string; orden: number }[] = [];
  for (let i = 0; i < gen.bloque.duracion; i++) {
    const ord = inicio + i;
    const slot = slotArray.find(s => s.orden === ord);
    if (slot) result.push({ slot_id: slot.id, orden: ord });
  }
  return result;
}

// ── Penalizaciones blandas ────────────────────────────────────────────────
function penalizarDiasDocente(genes: GenBloque[]): number {
  const porDocente = new Map<string, Set<string>>();
  for (const g of genes) {
    if (!g.bloque.docente_id) continue;
    if (!porDocente.has(g.bloque.docente_id)) porDocente.set(g.bloque.docente_id, new Set());
    porDocente.get(g.bloque.docente_id)!.add(g.dia);
  }
  let penalty = 0;
  for (const dias of porDocente.values()) {
    if (dias.size > 3) penalty += (dias.size - 3) * PENALIZACION_DIA_ADICIONAL;
  }
  return penalty;
}

function penalizarTeoriaTrasPractica(genes: GenBloque[]): number {
  const porDocenteDia = new Map<string, Map<string, { teoria: number; practica: number }>>();
  for (const g of genes) {
    if (!g.bloque.docente_id) continue;
    if (!porDocenteDia.has(g.bloque.docente_id)) porDocenteDia.set(g.bloque.docente_id, new Map());
    const dd = porDocenteDia.get(g.bloque.docente_id)!;
    if (!dd.has(g.dia)) dd.set(g.dia, { teoria: 99, practica: 99 });
    const slotO = slotOrdenMap.get(g.slot_inicio_id) ?? 0;
    const entry = dd.get(g.dia)!;
    if (g.bloque.tipo_sesion === 'teoria' && slotO < entry.teoria) entry.teoria = slotO;
    if (g.bloque.tipo_sesion === 'practica' && slotO < entry.practica) entry.practica = slotO;
  }
  let penalty = 0;
  for (const dd of porDocenteDia.values()) {
    for (const entry of dd.values()) {
      if (entry.teoria < 99 && entry.practica < 99 && entry.practica < entry.teoria) {
        penalty += PENALIZACION_TEORIA_TRAS_PRACTICA;
      }
    }
  }
  return penalty;
}

function penalizarGaps(genes: GenBloque[]): number {
  const porDocenteDia = new Map<string, Map<string, number[]>>();
  for (const g of genes) {
    if (!g.bloque.docente_id) continue;
    if (!porDocenteDia.has(g.bloque.docente_id)) porDocenteDia.set(g.bloque.docente_id, new Map());
    const dd = porDocenteDia.get(g.bloque.docente_id)!;
    if (!dd.has(g.dia)) dd.set(g.dia, []);
    const slotsG = slotsDelBloque(g);
    for (const s of slotsG) dd.get(g.dia)!.push(s.orden);
  }
  let penalty = 0;
  for (const dd of porDocenteDia.values()) {
    for (const slotsArr of dd.values()) {
      if (slotsArr.length < 2) continue;
      slotsArr.sort((a, b) => a - b);
      for (let i = 1; i < slotsArr.length; i++) {
        const diff = slotsArr[i] - slotsArr[i - 1];
        if (diff > 1) penalty += (diff - 1) * 10;
      }
    }
  }
  return penalty;
}

function penalizarConcentracion(genes: GenBloque[]): number {
  const porCursoGrupo = new Map<string, Set<string>>();
  for (const g of genes) {
    if (!g.bloque.docente_id) continue;
    const k = `${g.bloque.docente_id}|${g.bloque.curso_id}|${g.bloque.grupo_id}`;
    if (!porCursoGrupo.has(k)) porCursoGrupo.set(k, new Set());
    porCursoGrupo.get(k)!.add(g.dia);
  }
  let penalty = 0;
  for (const dias of porCursoGrupo.values()) {
    if (dias.size <= 1) penalty += 15;
    else if (dias.size === 2) penalty += 5;
  }
  return penalty;
}

// ── Fitness ───────────────────────────────────────────────────────────────
function calcularFitness(
  genes: GenBloque[],
  docAvail: Map<string, Map<string, number>>,
  base: ReturnType<typeof seedOcupacion>,
  ambAvail: Map<string, Set<string>>,
  ambTipo: Map<string, string>,
  reqCounts?: Map<string, number>,
): { hard: number; soft: number; total: number } {
  let hard = 0;
  let soft = 0;
  let bonus = 0;

  const docenteOcupado = new Set(base.docenteOcupado);
  const ambienteOcupado = new Set(base.ambienteOcupado);
  const grupoOcupado = new Set(base.grupoOcupado);
  const labEnFranja = new Map(base.labEnFranja);
  const franjaExclusiva = new Set(base.franjaExclusiva);

  for (const gen of genes) {
    const slotsB = slotsDelBloque(gen);
    if (slotsB.length !== gen.bloque.duracion) {
      hard += PENALIZACION_BLOQUE_ROTO;
      continue;
    }

    const esLab = gen.bloque.tipo_sesion === 'laboratorio';
    const esMixto = gen.bloque.tipo_sesion === 'mixto';
    if (esMixto) soft += PENALIZACION_BLOQUE_MIXTO;

    // Validar bloque atómico (consecutividad)
    for (let i = 1; i < slotsB.length; i++) {
      if (slotsB[i].orden !== slotsB[i - 1].orden + 1) {
        hard += PENALIZACION_BLOQUE_ROTO;
        break;
      }
    }

    // Check all slots for this block
    for (const { slot_id, orden: _orden } of slotsB) {
      const timeKey = `${gen.dia}-${slot_id}`;
      const ak = `${gen.ambiente_id}-${timeKey}`;

      // R1: Docente único
      if (gen.bloque.docente_id) {
        const dk = `${gen.bloque.docente_id}-${timeKey}`;
        if (docenteOcupado.has(dk)) hard += PENALIZACION_CONFLICTO_DURO;
        else docenteOcupado.add(dk);

        const docMap = docAvail.get(gen.bloque.docente_id);
        if (!docMap || !docMap.has(timeKey)) {
          let p = 8;
          if (gen.bloque.condicion_orden === 0) p += 4;
          if (gen.bloque.categoria_orden !== undefined && gen.bloque.categoria_orden < 3) p += (3 - gen.bloque.categoria_orden) * 2;
          soft += p;
        } else if (docMap.get(timeKey) === 2) {
          soft += 2;
        }
      }

      // R2: Ambiente único
      const labsEnFranja = labEnFranja.get(timeKey) || [];
      const esExclusiva = franjaExclusiva.has(timeKey);

      if (ambienteOcupado.has(ak)) {
        hard += PENALIZACION_CONFLICTO_DURO;
      } else if (esLab && (esExclusiva || !puedeLabParaleloGA(gen.bloque, gen.dia, slot_id, gen.ambiente_id, labEnFranja))) {
        hard += PENALIZACION_CONFLICTO_DURO;
      } else if (!esLab && (labsEnFranja.length > 0 || esExclusiva)) {
        hard += PENALIZACION_CONFLICTO_DURO;
      } else {
        if (!ambienteOcupado.has(ak)) {
          ambienteOcupado.add(ak);
          if (esLab) {
            const usos = labEnFranja.get(timeKey) || [];
            usos.push({ codigo: gen.bloque.curso_codigo || '', grupo_id: gen.bloque.grupo_id, curso_id: gen.bloque.curso_id, ambiente_id: gen.ambiente_id, docente_id: gen.bloque.docente_id || '' });
            labEnFranja.set(timeKey, usos);
          } else {
            franjaExclusiva.add(timeKey);
          }
        }
      }

      // R4: Tipo de ambiente
      const tipoAmb = ambTipo.get(gen.ambiente_id);
      if (esLab && tipoAmb !== 'laboratorio') hard += PENALIZACION_CONFLICTO_DURO;
      if (!esLab && tipoAmb === 'laboratorio') hard += PENALIZACION_CONFLICTO_DURO;

      if (ambAvail.has(gen.ambiente_id)) {
        const disp = ambAvail.get(gen.ambiente_id)!.has(timeKey);
        if (!disp) soft += esLab ? 3 : 6;
      }

      // R3: Grupo único
      if (gen.bloque.grupo_id) {
        const gk = `${gen.bloque.grupo_id}-${timeKey}`;
        if (grupoOcupado.has(gk)) hard += PENALIZACION_CONFLICTO_DURO;
        else grupoOcupado.add(gk);
      }
    }
  }

  soft += penalizarGaps(genes);
  soft += penalizarConcentracion(genes);
  soft += penalizarDiasDocente(genes);
  soft += penalizarTeoriaTrasPractica(genes);

  // B1: Bonificación por docente completo
  if (reqCounts) {
    const assignedCounts = new Map<string, number>();
    for (const g of genes) {
      const k = `${g.bloque.docente_id || '?'}-${g.bloque.curso_id || '?'}-${g.bloque.grupo_id || '?'}-${g.bloque.tipo_sesion || '?'}-${g.bloque.lab_turno || 0}`;
      assignedCounts.set(k, (assignedCounts.get(k) || 0) + g.bloque.duracion);
    }
    let todosOk = true;
    for (const [k, needed] of reqCounts) {
      if ((assignedCounts.get(k) || 0) < needed) { todosOk = false; break; }
    }
    if (todosOk) bonus += BONIFICACION_DOCENTE_COMPLETO;
  }

  // B2: T→P contiguo
  for (const g of genes) {
    if (!g.bloque.docente_id) continue;
    const inicio = slotOrdenMap.get(g.slot_inicio_id) ?? 0;
  }

  const total = Math.max(0, hard + soft - bonus);
  return { hard, soft, total };
}

// ── Crear individuo aleatorio (bloques completos) ─────────────────────────
function crearIndividuoAleatorio(
  bloques: BloqueGenetico[],
  slots: SlotRow[],
  ambientes: any[],
  incluirSabado: boolean,
): Individuo {
  const DIAS = incluirSabado ? [...DIAS_BASE, 'sabado'] : DIAS_BASE;
  const genes: GenBloque[] = [];

  for (const b of bloques) {
    const diasMezclados = [...DIAS].sort(() => Math.random() - 0.5);
    let encontrado = false;

    for (const dia of diasMezclados) {
      if (encontrado) break;
      const maxStart = slots.length - b.duracion;
      if (maxStart < 0) continue;

      const indices = Array.from({ length: maxStart + 1 }, (_, i) => i).sort(() => Math.random() - 0.5);

      for (const startIdx of indices) {
        const ventana = slots.slice(startIdx, startIdx + b.duracion);
        const consecutivos = ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
        if (!consecutivos) continue;

        const ambValidos = ambientes.filter(a => {
          if (b.num_alumnos > a.capacidad) return false;
          if (b.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
          if (b.tipo_sesion !== 'laboratorio' && a.tipo === 'laboratorio') return false;
          return true;
        });
        if (ambValidos.length === 0) continue;

        const amb = ambValidos[Math.floor(Math.random() * ambValidos.length)];
        genes.push({
          bloque: b,
          dia,
          slot_inicio_id: ventana[0].id,
          ambiente_id: amb.id,
        });
        encontrado = true;
        break;
      }
    }

    if (!encontrado) {
      genes.push({
        bloque: b,
        dia: DIAS[0],
        slot_inicio_id: slots[0]?.id || '',
        ambiente_id: ambientes[0]?.id || '',
      });
    }
  }

  return { genes, fitness: 0, hardPenalty: 0, softPenalty: 0 };
}

// ── Selección por torneo ──────────────────────────────────────────────────
function seleccionTorneo(poblacion: Individuo[]): Individuo {
  let mejor: Individuo | null = null;
  for (let i = 0; i < TOURNAMENT_SIZE; i++) {
    const candidato = poblacion[Math.floor(Math.random() * poblacion.length)];
    if (!mejor || candidato.hardPenalty < mejor.hardPenalty || (candidato.hardPenalty === mejor.hardPenalty && candidato.softPenalty < mejor.softPenalty)) mejor = candidato;
  }
  return mejor!;
}

// ── Crossover por bloque completo ─────────────────────────────────────────
function crossoverBloque(padre1: Individuo, padre2: Individuo): [Individuo, Individuo] {
  const bloqueKeys = new Set<string>();
  for (const g of padre1.genes) {
    bloqueKeys.add(`${g.bloque.docente_id || ''}|${g.bloque.curso_id}|${g.bloque.grupo_id}|${g.bloque.tipo_sesion}|${g.bloque.lab_turno || 0}`);
  }
  for (const g of padre2.genes) {
    bloqueKeys.add(`${g.bloque.docente_id || ''}|${g.bloque.curso_id}|${g.bloque.grupo_id}|${g.bloque.tipo_sesion}|${g.bloque.lab_turno || 0}`);
  }

  const keysArr = Array.from(bloqueKeys);
  const splitPoint = Math.floor(Math.random() * keysArr.length);
  const grupo1 = new Set(keysArr.slice(0, splitPoint));

  const build = (source: GenBloque[], donor: GenBloque[]) => {
    return source.map(g => {
      const k = `${g.bloque.docente_id || ''}|${g.bloque.curso_id}|${g.bloque.grupo_id}|${g.bloque.tipo_sesion}|${g.bloque.lab_turno || 0}`;
      if (grupo1.has(k)) return { ...g };
      const donorGen = donor.find(d =>
        d.bloque.docente_id === g.bloque.docente_id &&
        d.bloque.curso_id === g.bloque.curso_id &&
        d.bloque.grupo_id === g.bloque.grupo_id &&
        d.bloque.tipo_sesion === g.bloque.tipo_sesion &&
        (d.bloque.lab_turno || 0) === (g.bloque.lab_turno || 0)
      );
      return donorGen ? { ...donorGen } : { ...g };
    });
  };

  return [
    { genes: build(padre1.genes, padre2.genes), fitness: 0, hardPenalty: 0, softPenalty: 0 },
    { genes: build(padre2.genes, padre1.genes), fitness: 0, hardPenalty: 0, softPenalty: 0 },
  ];
}

// ── Mutación de bloque completo ──────────────────────────────────────────
function mutarBloque(individuo: Individuo, slots: SlotRow[], ambientes: any[], tasa: number, incluirSabado: boolean): Individuo {
  const DIAS = incluirSabado ? [...DIAS_BASE, 'sabado'] : DIAS_BASE;
  const genes = individuo.genes.map(g => {
    if (Math.random() >= tasa) return { ...g };

    const diasMezclados = [...DIAS].sort(() => Math.random() - 0.5);
    for (const dia of diasMezclados) {
      const maxStart = slots.length - g.bloque.duracion;
      if (maxStart < 0) break;

      const indices = Array.from({ length: maxStart + 1 }, (_, i) => i).sort(() => Math.random() - 0.5);
      for (const startIdx of indices) {
        const ventana = slots.slice(startIdx, startIdx + g.bloque.duracion);
        const consecutivos = ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
        if (!consecutivos) continue;

        const ambValidos = ambientes.filter(a => {
          if (g.bloque.num_alumnos > a.capacidad) return false;
          if (g.bloque.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
          if (g.bloque.tipo_sesion !== 'laboratorio' && a.tipo === 'laboratorio') return false;
          return true;
        });
        if (ambValidos.length === 0) continue;

        const amb = ambValidos[Math.floor(Math.random() * ambValidos.length)];
        return {
          ...g,
          dia,
          slot_inicio_id: ventana[0].id,
          ambiente_id: amb.id,
        };
      }
    }
    return { ...g };
  });
  return { genes, fitness: 0, hardPenalty: 0, softPenalty: 0 };
}

// ── Ocupación base ────────────────────────────────────────────────────────
function seedOcupacion(asignacionesExistentes: any[], docenteCursos: Map<string, Set<string>>) {
  const docenteOcupado = new Set<string>();
  const ambienteOcupado = new Set<string>();
  const grupoOcupado = new Set<string>();
  const labEnFranja = new Map<string, LabUso[]>();
  const franjaExclusiva = new Set<string>();
  const docenteCursoClase = new Set<string>();

  for (const a of asignacionesExistentes) {
    const timeKey = `${a.dia}-${a.slot_id}`;
    const ak = `${a.ambiente_id}-${timeKey}`;
    if (a.docente_id) {
      docenteOcupado.add(`${a.docente_id}-${timeKey}`);
      docenteCursoClase.add(`${a.docente_id}-${a.curso_id}-${timeKey}`);
    }
    if (a.ambiente_id) {
      ambienteOcupado.add(ak);
      if (a.tipo === 'laboratorio') {
        const usos = labEnFranja.get(timeKey) || [];
        usos.push({ codigo: a.curso_codigo || '', grupo_id: a.grupo_id, curso_id: a.curso_id, ambiente_id: a.ambiente_id, docente_id: a.docente_id || '' });
        labEnFranja.set(timeKey, usos);
      } else {
        franjaExclusiva.add(timeKey);
      }
    }
    if (a.grupo_id) {
      grupoOcupado.add(`${a.grupo_id}-${timeKey}`);
    }
  }

  return { docenteOcupado, ambienteOcupado, grupoOcupado, labEnFranja, franjaExclusiva, docenteCursoClase };
}

function puedeLabParaleloGA(bloque: BloqueGenetico, dia: string, slotId: string, ambienteId: string, labEnFranja: Map<string, LabUso[]>): boolean {
  const usos = labEnFranja.get(`${dia}-${slotId}`) || [];
  if (usos.length === 0) return true;
  const mismoGrupo = usos.some(u => u.grupo_id === bloque.grupo_id);
  if (mismoGrupo) return false;
  if (usos.length >= 2) return false;
  return true;
}

// ── Resultado ─────────────────────────────────────────────────────────────
export type GaResult = {
  asignaciones: any[];
  conflictos: string[];
  stats: { asignados: number; total: number; hardPenalty: number; softPenalty: number; generaciones: number };
  log: string[];
};

// ── Ejecutor principal ───────────────────────────────────────────────────
export async function ejecutarAlgoritmoGenetico(
  bloquesSinAsignar: BloqueGenetico[],
  programacion_id: string,
  asignacionesExistentes: any[] = [],
  incluirSabado = false,
): Promise<GaResult> {
  const log: string[] = [];
  if (bloquesSinAsignar.length === 0) return { asignaciones: [], conflictos: [], stats: { asignados: 0, total: 0, hardPenalty: 0, softPenalty: 0, generaciones: 0 }, log };

  const allSlots: SlotRow[] = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
  slotOrdenMap = new Map(allSlots.map(s => [s.id, s.orden]));
  slotArray = allSlots;

  let restrictedIds: string[] | null = null;
  const progRow = await queryOne(`SELECT config, ciclo_id FROM programaciones WHERE id = $1`, [programacion_id]);
  if (progRow && progRow.config) {
    try {
      const parsedConfig = typeof progRow.config === 'string' ? JSON.parse(progRow.config) : progRow.config;
      if (parsedConfig && parsedConfig.horarios_restringidos) {
        const hr = parsedConfig.horarios_restringidos;
        restrictedIds = Array.isArray(hr) ? hr : (hr && typeof hr === 'object' ? Object.keys(hr) : null);
      }
    } catch { /* ignore */ }
  }

  if (restrictedIds === null) {
    const config = await queryOne(`SELECT valor FROM configuracion WHERE clave = 'HORARIOS_RESTRINGIDOS'`);
    if (config) {
      try {
        const parsed = JSON.parse(config.valor);
        restrictedIds = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? Object.keys(parsed) : null);
      } catch { /* ignore */ }
    }
  }

  if (restrictedIds === null) {
    const foodSlot = allSlots.find(s => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
    restrictedIds = foodSlot ? [foodSlot.id] : [];
  }

  if (incluirSabado) {
    const satAfternoon = allSlots.filter(s => (s.hora_inicio || '') >= '13:00').map(s => s.id);
    restrictedIds = [...new Set([...restrictedIds, ...satAfternoon])];
  }

  const slots = allSlots.filter(s => !restrictedIds!.includes(s.id));
  const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true ORDER BY codigo`);

  const rawDisponibilidad = await query(`SELECT * FROM disponibilidad_docente WHERE programacion_id = $1 AND disponible = true AND prioridad IN (1, 2)`, [programacion_id]);
  const disponibilidad = await filtrarDisponibilidadPorCargaAdicional(rawDisponibilidad, progRow?.ciclo_id);

  let dispAmbiente: any[] = [];
  try { dispAmbiente = await query(`SELECT ambiente_id, slot_id, dia, estado FROM disponibilidad_ambiente`); } catch { /* ignore */ }

  const docAvail = new Map<string, Map<string, number>>();
  for (const d of disponibilidad) {
    if (!docAvail.has(d.docente_id)) docAvail.set(d.docente_id, new Map());
    docAvail.get(d.docente_id)!.set(`${d.dia}-${d.slot_id}`, d.prioridad);
  }

  const ambAvail = new Map<string, Set<string>>();
  const ambTipo = new Map<string, string>();
  for (const a of ambientes) {
    ambTipo.set(a.id, a.tipo);
    ambAvail.set(a.id, new Set());
  }
  for (const r of dispAmbiente) {
    if (r.estado === 'disponible' && ambAvail.has(r.ambiente_id)) {
      ambAvail.get(r.ambiente_id)!.add(`${r.dia}-${r.slot_id}`);
    }
  }
  const dias = incluirSabado ? [...DIAS_BASE, 'sabado'] : DIAS_BASE;
  for (const a of ambientes) {
    if (a.tipo === 'laboratorio' && ambAvail.get(a.id)!.size === 0) {
      for (const dia of dias) {
        for (const s of slots) {
          ambAvail.get(a.id)!.add(`${dia}-${s.id}`);
        }
      }
    }
  }

  const cursosDoc = await query(`SELECT docente_id, curso_id FROM programacion_cursos WHERE programacion_id = $1 AND docente_id IS NOT NULL`, [programacion_id]);
  const docenteCursos = new Map<string, Set<string>>();
  for (const r of cursosDoc) {
    if (!docenteCursos.has(r.docente_id)) docenteCursos.set(r.docente_id, new Set());
    docenteCursos.get(r.docente_id)!.add(r.curso_id);
  }

  const baseOcc = seedOcupacion(asignacionesExistentes, docenteCursos);

  // Build required hours
  const reqCounts = new Map<string, number>();
  for (const a of asignacionesExistentes) {
    const k = `${a.docente_id || '?'}-${a.curso_id || '?'}-${a.grupo_id || '?'}-${a.tipo || '?'}-${a.lab_turno || 0}`;
    reqCounts.set(k, (reqCounts.get(k) || 0) + 1);
  }
  for (const b of bloquesSinAsignar) {
    const k = `${b.docente_id || '?'}-${b.curso_id || '?'}-${b.grupo_id || '?'}-${b.tipo_sesion || '?'}-${b.lab_turno || 0}`;
    reqCounts.set(k, (reqCounts.get(k) || 0) + b.duracion);
  }

  let poblacion: Individuo[] = Array.from({ length: POP_SIZE }, () => crearIndividuoAleatorio(bloquesSinAsignar, slots, ambientes, incluirSabado));

  for (const ind of poblacion) {
    const f = calcularFitness(ind.genes, docAvail, baseOcc, ambAvail, ambTipo, reqCounts);
    ind.fitness = f.total;
    ind.hardPenalty = f.hard;
    ind.softPenalty = f.soft;
  }

  poblacion.sort((a, b) => a.fitness - b.fitness);
  let mejor = poblacion[0];
  log.push(`[GA] Gen 0: mejor=${mejor.fitness} (hard=${mejor.hardPenalty}, soft=${mejor.softPenalty})`);

  let generacion = 0;
  let stallCount = 0;
  let prevSoft = Infinity;
  for (generacion = 1; generacion <= MAX_GEN; generacion++) {
    const tasaMutacion = MUTATION_INIT * (1 - generacion / MAX_GEN);
    const nuevaPoblacion: Individuo[] = poblacion.slice(0, ELITE_COUNT);

    while (nuevaPoblacion.length < POP_SIZE) {
      const padre1 = seleccionTorneo(poblacion);
      const padre2 = seleccionTorneo(poblacion);
      const [hijo1, hijo2] = crossoverBloque(padre1, padre2);
      const m1 = mutarBloque(hijo1, slots, ambientes, tasaMutacion, incluirSabado);
      const f1 = calcularFitness(m1.genes, docAvail, baseOcc, ambAvail, ambTipo, reqCounts);
      m1.fitness = f1.total;
      m1.hardPenalty = f1.hard;
      m1.softPenalty = f1.soft;
      nuevaPoblacion.push(m1);
      if (nuevaPoblacion.length < POP_SIZE) {
        const m2 = mutarBloque(hijo2, slots, ambientes, tasaMutacion, incluirSabado);
        const f2 = calcularFitness(m2.genes, docAvail, baseOcc, ambAvail, ambTipo, reqCounts);
        m2.fitness = f2.total;
        m2.hardPenalty = f2.hard;
        m2.softPenalty = f2.soft;
        nuevaPoblacion.push(m2);
      }
    }

    poblacion = nuevaPoblacion;
    poblacion.sort((a, b) => a.fitness - b.fitness);
    if (poblacion[0].fitness < mejor.fitness) mejor = poblacion[0];

    if (generacion >= MIN_GEN) {
      if (mejor.softPenalty < prevSoft) {
        stallCount = 0;
        prevSoft = mejor.softPenalty;
      } else {
        stallCount++;
      }
      if (stallCount >= STALL_GEN) {
        log.push(`[GA] Detenido por estancamiento en gen ${generacion} (soft sin mejora ${STALL_GEN} gens)`);
        break;
      }
    }

    if (generacion % 50 === 0) {
      log.push(`[GA] Gen ${generacion}: mejor=${mejor.fitness} (hard=${mejor.hardPenalty}, soft=${mejor.softPenalty})`);
    }
  }

  log.push(`[GA] Final gen=${generacion} mejor=${mejor.fitness} hard=${mejor.hardPenalty} soft=${mejor.softPenalty}`);

  // Expand GenBloque → per-hour assignments with atomic block identity
  const ambienteMap = new Map(ambientes.map(a => [a.id, a]));
  const asignaciones: any[] = [];

  for (const g of mejor.genes) {
    const amb = ambienteMap.get(g.ambiente_id);
    const slotsB = slotsDelBloque(g);
    const ck = g.bloque.clave_bloque || [
      g.bloque.pc_id || '',
      g.bloque.docente_id || '',
      g.bloque.curso_id || '',
      g.bloque.grupo_id || '',
      g.bloque.tipo_sesion || '',
      g.bloque.lab_turno ?? 0,
    ].join('|');
    for (let idx = 0; idx < slotsB.length; idx++) {
      const { slot_id } = slotsB[idx];
      asignaciones.push({
        id: require('crypto').randomUUID(),
        clave_bloque: ck,
        pc_id: g.bloque.pc_id,
        curso_id: g.bloque.curso_id,
        grupo_id: g.bloque.grupo_id,
        docente_id: g.bloque.docente_id,
        ambiente_id: g.ambiente_id,
        slot_id,
        dia: g.dia,
        tipo: g.bloque.tipo_sesion,
        lab_turno: g.bloque.lab_turno ?? null,
        curso_codigo: g.bloque.curso_codigo,
        curso_nombre: g.bloque.curso_nombre,
        numero_grupo: g.bloque.numero_grupo,
        ambiente_codigo: amb?.codigo || '?',
        ambiente_nombre: amb?.nombre || '?',
        cantidad_labs: g.bloque.cantidad_labs || 1,
        bloque_continuo_id: g.bloque.bloque_id,
        bloque_parte: idx + 1,
        bloque_total: g.bloque.duracion,
        fuente: 'GA',
      });
    }
  }

  return {
    asignaciones,
    conflictos: mejor.hardPenalty > 0 ? [`GA no encontró solución óptima (hard=${mejor.hardPenalty})`] : [],
    stats: {
      asignados: mejor.genes.length,
      total: bloquesSinAsignar.length,
      hardPenalty: mejor.hardPenalty,
      softPenalty: mejor.softPenalty,
      generaciones: generacion,
    },
    log,
  };
}
