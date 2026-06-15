import { query, queryOne } from './db';

interface Bloque {
  pc_id: string;
  curso_id: string;
  curso_codigo: string;
  curso_nombre: string;
  grupo_id: string;
  numero_grupo: number;
  docente_id: string | null;
  tipo_sesion: 'teoria' | 'practica' | 'laboratorio';
  num_alumnos: number;
  ciclo_plan?: number;
  condicion_orden?: number;
  categoria_orden?: number;
  fecha_ingreso?: Date;
  cantidad_labs?: number;
}

interface Gen {
  bloque: Bloque;
  dia: string;
  slot_id: string;
  ambiente_id: string;
}

interface Individuo {
  genes: Gen[];
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
const MUTATION_INIT = 0.25;
const ELITE_COUNT = 2;
const TOURNAMENT_SIZE = 4;

function seedOcupacion(asignacionesExistentes: any[], docenteCursos: Map<string, Set<string>>) {
  const docenteOcupado = new Set<string>();
  const ambienteOcupado = new Set<string>();
  const grupoOcupado = new Set<string>();
  const labEnFranja = new Map<string, LabUso[]>();
  const franjaExclusiva = new Set<string>();
  const docenteCursoClase = new Set<string>();

  for (const a of asignacionesExistentes) {
    const timeKey = `${a.dia}-${a.slot_id}`;
    if (a.docente_id) {
      docenteOcupado.add(`${a.docente_id}-${timeKey}`);
      if (a.curso_id) docenteCursoClase.add(`${a.docente_id}-${a.curso_id}-${timeKey}`);
    }
    if (a.grupo_id) grupoOcupado.add(`${a.grupo_id}-${timeKey}`);
    if (a.ambiente_id) {
      ambienteOcupado.add(`${a.ambiente_id}-${timeKey}`);
      if (a.tipo === 'laboratorio' && a.curso_id) {
        const usos = labEnFranja.get(timeKey) || [];
        usos.push({ codigo: a.curso_codigo || '', grupo_id: a.grupo_id || '', curso_id: a.curso_id, ambiente_id: a.ambiente_id, docente_id: a.docente_id || '' });
        labEnFranja.set(timeKey, usos);
      } else {
        franjaExclusiva.add(timeKey);
      }
    }
  }

  return { docenteOcupado, ambienteOcupado, grupoOcupado, labEnFranja, franjaExclusiva, docenteCursoClase, docenteCursos };
}

function puedeLabParaleloGA(bloque: Bloque, dia: string, slotId: string, ambienteId: string, labEnFranja: Map<string, LabUso[]>): boolean {
  const usos = labEnFranja.get(`${dia}-${slotId}`) || [];
  if (usos.length >= 2) return false;
  for (const u of usos) {
    if (u.curso_id === bloque.curso_id) return false;
    if (u.docente_id === bloque.docente_id) return false;
    if (u.ambiente_id === ambienteId) return false;
  }
  return true;
}

function penalizarGaps(genes: Gen[]): number {
  const porDocenteDia = new Map<string, Map<string, number[]>>();
  for (const g of genes) {
    if (!g.bloque.docente_id) continue;
    if (!porDocenteDia.has(g.bloque.docente_id)) porDocenteDia.set(g.bloque.docente_id, new Map());
    const dd = porDocenteDia.get(g.bloque.docente_id)!;
    if (!dd.has(g.dia)) dd.set(g.dia, []);
    const slotIdx = parseInt(g.slot_id.replace(/\D/g, '')) || 0;
    dd.get(g.dia)!.push(slotIdx);
  }
  let penalty = 0;
  for (const dd of porDocenteDia.values()) {
    for (const slots of dd.values()) {
      if (slots.length < 2) continue;
      slots.sort((a, b) => a - b);
      let gaps = 0;
      for (let i = 1; i < slots.length; i++) {
        const diff = slots[i] - slots[i - 1];
        if (diff > 1) gaps += diff - 1;
      }
      penalty += gaps * 2;
    }
  }
  return penalty;
}

function penalizarConcentracion(genes: Gen[]): number {
  const porCursoGrupo = new Map<string, Set<string>>();
  for (const g of genes) {
    const key = `${g.bloque.curso_id}-${g.bloque.grupo_id}`;
    if (!porCursoGrupo.has(key)) porCursoGrupo.set(key, new Set());
    porCursoGrupo.get(key)!.add(g.dia);
  }
  let penalty = 0;
  for (const dias of porCursoGrupo.values()) {
    if (dias.size <= 1) penalty += 15;
    else if (dias.size === 2) penalty += 5;
  }
  return penalty;
}

function calcularFitness(
  genes: Gen[],
  docAvail: Map<string, Map<string, number>>,
  base: ReturnType<typeof seedOcupacion>,
  ambAvail: Map<string, Set<string>>,
  ambTipo: Map<string, string>,
): { hard: number; soft: number; total: number } {
  let hard = 0;
  let soft = 0;

  const docenteOcupado = new Set(base.docenteOcupado);
  const ambienteOcupado = new Set(base.ambienteOcupado);
  const grupoOcupado = new Set(base.grupoOcupado);
  const labEnFranja = new Map(base.labEnFranja);
  const franjaExclusiva = new Set(base.franjaExclusiva);
  const docenteCursoClase = new Set(base.docenteCursoClase);

  for (const gen of genes) {
    const timeKey = `${gen.dia}-${gen.slot_id}`;
    const ak = `${gen.ambiente_id}-${timeKey}`;
    const esLab = gen.bloque.tipo_sesion === 'laboratorio';

    // R1: Docente único en el bloque
    if (gen.bloque.docente_id) {
      const dk = `${gen.bloque.docente_id}-${timeKey}`;
      if (docenteOcupado.has(dk)) hard += 100;
      else docenteOcupado.add(dk);

      // S3: Preferencia horaria
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
      hard += 100;
    } else if (esLab && (esExclusiva || !puedeLabParaleloGA(gen.bloque, gen.dia, gen.slot_id, gen.ambiente_id, labEnFranja))) {
      hard += 100;
    } else if (!esLab && (labsEnFranja.length > 0 || esExclusiva)) {
      hard += 100;
    } else {
      ambienteOcupado.add(ak);
      if (esLab) {
        const usos = labEnFranja.get(timeKey) || [];
        usos.push({ codigo: gen.bloque.curso_codigo, grupo_id: gen.bloque.grupo_id, curso_id: gen.bloque.curso_id, ambiente_id: gen.ambiente_id, docente_id: gen.bloque.docente_id || '' });
        labEnFranja.set(timeKey, usos);
      } else {
        franjaExclusiva.add(timeKey);
      }
    }

    // R4: Tipo de ambiente
    const tipoAmb = ambTipo.get(gen.ambiente_id);
    if (esLab && tipoAmb !== 'laboratorio') hard += 100;
    if (!esLab && tipoAmb === 'laboratorio') hard += 100;

    // Disponibilidad del ambiente
    if (ambAvail.has(gen.ambiente_id)) {
      const disp = ambAvail.get(gen.ambiente_id)!.has(timeKey);
      if (!disp) soft += esLab ? 3 : 6;
    }

    // R3: Grupo único
    if (gen.bloque.grupo_id) {
      const gk = `${gen.bloque.grupo_id}-${timeKey}`;
      if (grupoOcupado.has(gk)) hard += 100;
      else grupoOcupado.add(gk);
    }
  }

  // S1: Horas ventana
  soft += penalizarGaps(genes);

  // S2: Concentración
  soft += penalizarConcentracion(genes);

  return { hard, soft, total: hard + soft };
}

function crearIndividuoAleatorio(bloques: Bloque[], slots: any[], ambientes: any[], incluirSabado: boolean): Individuo {
  const DIAS = incluirSabado ? [...DIAS_BASE, 'sabado'] : DIAS_BASE;
  const genes: Gen[] = bloques.map(b => {
    const dia = DIAS[Math.floor(Math.random() * DIAS.length)];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const ambientesValidos = ambientes.filter(a => {
      if (b.num_alumnos > a.capacidad) return false;
      if (b.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
      if (b.tipo_sesion !== 'laboratorio' && a.tipo === 'laboratorio') return false;
      return true;
    });
    const amb = ambientesValidos.length > 0 ? ambientesValidos[Math.floor(Math.random() * ambientesValidos.length)] : ambientes[0];
    return { bloque: b, dia, slot_id: slot.id, ambiente_id: amb.id };
  });
  return { genes, fitness: 0, hardPenalty: 0, softPenalty: 0 };
}

function seleccionTorneo(poblacion: Individuo[]): Individuo {
  let mejor: Individuo | null = null;
  for (let i = 0; i < TOURNAMENT_SIZE; i++) {
    const candidato = poblacion[Math.floor(Math.random() * poblacion.length)];
    if (!mejor || candidato.hardPenalty < mejor.hardPenalty || (candidato.hardPenalty === mejor.hardPenalty && candidato.softPenalty < mejor.softPenalty)) mejor = candidato;
  }
  return mejor!;
}

function crossoverDocente(padre1: Individuo, padre2: Individuo): [Individuo, Individuo] {
  // Find all unique teacher IDs in both parents
  const docentes = new Set<string>();
  for (const g of padre1.genes) if (g.bloque.docente_id) docentes.add(g.bloque.docente_id);
  for (const g of padre2.genes) if (g.bloque.docente_id) docentes.add(g.bloque.docente_id);

  const docentesArr = Array.from(docentes);
  const splitPoint = Math.floor(Math.random() * docentesArr.length);
  const grupo1 = new Set(docentesArr.slice(0, splitPoint));
  const grupo2 = new Set(docentesArr.slice(splitPoint));

  const genes1 = padre1.genes.map(g => (g.bloque.docente_id && grupo2.has(g.bloque.docente_id)) ? { ...padre2.genes.find(pg => pg.bloque.pc_id === g.bloque.pc_id) || g } : { ...g });
  const genes2 = padre2.genes.map(g => (g.bloque.docente_id && grupo1.has(g.bloque.docente_id)) ? { ...padre1.genes.find(pg => pg.bloque.pc_id === g.bloque.pc_id) || g } : { ...g });

  return [
    { genes: genes1, fitness: 0, hardPenalty: 0, softPenalty: 0 },
    { genes: genes2, fitness: 0, hardPenalty: 0, softPenalty: 0 },
  ];
}

function mutar(individuo: Individuo, slots: any[], ambientes: any[], tasa: number, incluirSabado: boolean): Individuo {
  const DIAS = incluirSabado ? [...DIAS_BASE, 'sabado'] : DIAS_BASE;
  const genes = individuo.genes.map(g => {
    if (Math.random() >= tasa) return g;
    const dia = DIAS[Math.floor(Math.random() * DIAS.length)];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const ambientesValidos = ambientes.filter(a => {
      if (g.bloque.num_alumnos > a.capacidad) return false;
      if (g.bloque.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
      if (g.bloque.tipo_sesion !== 'laboratorio' && a.tipo === 'laboratorio') return false;
      return true;
    });
    const amb = ambientesValidos.length > 0 ? ambientesValidos[Math.floor(Math.random() * ambientesValidos.length)] : ambientes[0];
    return { ...g, dia, slot_id: slot.id, ambiente_id: amb.id };
  });
  return { genes, fitness: 0, hardPenalty: 0, softPenalty: 0 };
}

export type GaResult = {
  asignaciones: any[];
  conflictos: string[];
  stats: { asignados: number; total: number; hardPenalty: number; softPenalty: number; generaciones: number };
  log: string[];
};

export async function ejecutarAlgoritmoGenetico(
  bloquesSinAsignar: Bloque[],
  programacion_id: string,
  asignacionesExistentes: any[] = [],
  incluirSabado = false,
): Promise<GaResult> {
  const log: string[] = [];
  if (bloquesSinAsignar.length === 0) return { asignaciones: [], conflictos: [], stats: { asignados: 0, total: 0, hardPenalty: 0, softPenalty: 0, generaciones: 0 }, log };

  const allSlots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

  let restrictedIds: string[] | null = null;
  const progRow = await queryOne(`SELECT config FROM programaciones WHERE id = $1`, [programacion_id]);
  if (progRow && progRow.config) {
    try {
      const parsedConfig = typeof progRow.config === 'string' ? JSON.parse(progRow.config) : progRow.config;
      if (parsedConfig && parsedConfig.horarios_restringidos) {
        const hr = parsedConfig.horarios_restringidos;
        restrictedIds = Array.isArray(hr) ? hr : (hr && typeof hr === 'object' ? Object.keys(hr) : null);
      }
    } catch (e) { /* ignore */ }
  }

  if (restrictedIds === null) {
    const config = await queryOne(`SELECT valor FROM configuracion WHERE clave = 'HORARIOS_RESTRINGIDOS'`);
    if (config) {
      try {
        const parsed = JSON.parse(config.valor);
        restrictedIds = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? Object.keys(parsed) : null);
      } catch (e) { /* ignore */ }
    }
  }

  if (restrictedIds === null) {
    const foodSlot = allSlots.find((s: any) => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
    restrictedIds = foodSlot ? [foodSlot.id] : [];
  }

  // When Saturday is enabled, restrict to 7–13 (block slots from 13:00 onward)
  if (incluirSabado) {
    const satAfternoon = allSlots.filter((s: any) => (s.hora_inicio || '') >= '13:00').map((s: any) => s.id);
    restrictedIds = [...new Set([...restrictedIds, ...satAfternoon])];
  }

  const slots = allSlots.filter((s: any) => !restrictedIds!.includes(s.id));
  const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true ORDER BY codigo`);
  const disponibilidad = await query(`SELECT * FROM disponibilidad_docente WHERE programacion_id = $1 AND disponible = true AND prioridad IN (1, 2)`, [programacion_id]);

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

  // Population initialization
  let poblacion: Individuo[] = Array.from({ length: POP_SIZE }, () => crearIndividuoAleatorio(bloquesSinAsignar, slots, ambientes, incluirSabado));

  for (const ind of poblacion) {
    const f = calcularFitness(ind.genes, docAvail, baseOcc, ambAvail, ambTipo);
    ind.fitness = f.total;
    ind.hardPenalty = f.hard;
    ind.softPenalty = f.soft;
  }

  poblacion.sort((a, b) => a.fitness - b.fitness);
  let mejor = poblacion[0];
  log.push(`[GA] Gen 0: mejor=${mejor.fitness} (hard=${mejor.hardPenalty}, soft=${mejor.softPenalty})`);

  let generacion = 0;
  for (generacion = 1; generacion <= MAX_GEN; generacion++) {
    if (mejor.hardPenalty === 0) {
      log.push(`[GA] Solución sin violaciones duras encontrada en gen ${generacion}`);
      break;
    }

    const tasaMutacion = MUTATION_INIT * (1 - generacion / MAX_GEN);
    const nuevaPoblacion: Individuo[] = poblacion.slice(0, ELITE_COUNT);

    while (nuevaPoblacion.length < POP_SIZE) {
      const padre1 = seleccionTorneo(poblacion);
      const padre2 = seleccionTorneo(poblacion);
      const [hijo1, hijo2] = crossoverDocente(padre1, padre2);
      const m1 = mutar(hijo1, slots, ambientes, tasaMutacion, incluirSabado);
      const f1 = calcularFitness(m1.genes, docAvail, baseOcc, ambAvail, ambTipo);
      m1.fitness = f1.total;
      m1.hardPenalty = f1.hard;
      m1.softPenalty = f1.soft;
      nuevaPoblacion.push(m1);
      if (nuevaPoblacion.length < POP_SIZE) {
        const m2 = mutar(hijo2, slots, ambientes, tasaMutacion, incluirSabado);
        const f2 = calcularFitness(m2.genes, docAvail, baseOcc, ambAvail, ambTipo);
        m2.fitness = f2.total;
        m2.hardPenalty = f2.hard;
        m2.softPenalty = f2.soft;
        nuevaPoblacion.push(m2);
      }
    }

    poblacion = nuevaPoblacion;
    poblacion.sort((a, b) => a.fitness - b.fitness);
    if (poblacion[0].fitness < mejor.fitness) mejor = poblacion[0];

    if (generacion % 50 === 0) {
      log.push(`[GA] Gen ${generacion}: mejor=${mejor.fitness} (hard=${mejor.hardPenalty}, soft=${mejor.softPenalty})`);
    }
  }

  log.push(`[GA] Final gen=${generacion} mejor=${mejor.fitness} hard=${mejor.hardPenalty} soft=${mejor.softPenalty}`);

  const ambienteMap = new Map(ambientes.map((a: any) => [a.id, a]));
  const asignaciones = mejor.genes.map(g => {
    const amb = ambienteMap.get(g.ambiente_id) as any;
    return {
      id: require('crypto').randomUUID(),
      pc_id: g.bloque.pc_id,
      curso_id: g.bloque.curso_id,
      grupo_id: g.bloque.grupo_id,
      docente_id: g.bloque.docente_id,
      ambiente_id: g.ambiente_id,
      slot_id: g.slot_id,
      dia: g.dia,
      tipo: g.bloque.tipo_sesion,
      curso_codigo: g.bloque.curso_codigo,
      curso_nombre: g.bloque.curso_nombre,
      numero_grupo: g.bloque.numero_grupo,
      ambiente_codigo: amb?.codigo || '?',
      ambiente_nombre: amb?.nombre || '?',
      cantidad_labs: g.bloque.cantidad_labs || 1,
      fuente: 'GA',
    };
  });

  return { asignaciones, conflictos: mejor.hardPenalty > 0 ? [`GA no encontró solución óptima (hard=${mejor.hardPenalty})`] : [], stats: { asignados: mejor.genes.length, total: bloquesSinAsignar.length, hardPenalty: mejor.hardPenalty, softPenalty: mejor.softPenalty, generaciones: generacion }, log };
}
