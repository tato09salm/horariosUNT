import { query } from './db';

/**
 * Algoritmo Genético (GA) — Fallback cuando el CSP no encuentra solución completa.
 * Respeta asignaciones CSP existentes, labs compartidos (máx. 2 cursos) y disponibilidad.
 */

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
}

type LabUso = {
  codigo: string;
  grupo_id: string;
  curso_id: string;
  ambiente_id: string;
  docente_id: string;
};

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const POP_SIZE = 40;
const MAX_GEN = 300;
const MUTATION_RATE = 0.15;
const TOURNAMENT_SIZE = 3;

function seedOcupacion(
  asignacionesExistentes: any[],
  docenteCursos: Map<string, Set<string>>
) {
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
      if (a.curso_id && a.tipo !== 'asesoria') {
        docenteCursoClase.add(`${a.docente_id}-${a.curso_id}-${timeKey}`);
      }
    }
    if (a.grupo_id) grupoOcupado.add(`${a.grupo_id}-${timeKey}`);
    if (a.ambiente_id) {
      ambienteOcupado.add(`${a.ambiente_id}-${timeKey}`);
      if (a.tipo === 'laboratorio' && a.curso_id) {
        const fk = timeKey;
        const usos = labEnFranja.get(fk) || [];
        usos.push({
          codigo: a.curso_codigo || '',
          grupo_id: a.grupo_id || '',
          curso_id: a.curso_id,
          ambiente_id: a.ambiente_id,
          docente_id: a.docente_id || '',
        });
        labEnFranja.set(fk, usos);
      } else if (a.tipo && a.tipo !== 'laboratorio') {
        franjaExclusiva.add(timeKey);
      }
    } else if (a.tipo === 'asesoria') {
      franjaExclusiva.add(timeKey);
    }
  }

  return {
    docenteOcupado,
    ambienteOcupado,
    grupoOcupado,
    labEnFranja,
    franjaExclusiva,
    docenteCursoClase,
    docenteCursos,
  };
}

function puedeLabParaleloGA(
  bloque: Bloque,
  dia: string,
  slotId: string,
  ambienteId: string,
  labEnFranja: Map<string, LabUso[]>
): boolean {
  const usos = labEnFranja.get(`${dia}-${slotId}`) || [];
  if (usos.length >= 2) return false;
  for (const u of usos) {
    if (u.curso_id === bloque.curso_id) return false;
    if (u.docente_id === bloque.docente_id) return false;
    if (u.ambiente_id === ambienteId) return false;
  }
  return true;
}

function calcularFitness(
  genes: Gen[],
  docAvail: Map<string, Map<string, number>>,
  base: ReturnType<typeof seedOcupacion>,
  ambAvail: Map<string, Set<string>>,
  ambTipo: Map<string, string>
): number {
  let penalizacion = 0;

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

    if (gen.bloque.docente_id) {
      const dk = `${gen.bloque.docente_id}-${timeKey}`;
      if (docenteOcupado.has(dk)) penalizacion += 10;
      else docenteOcupado.add(dk);

      const docMap = docAvail.get(gen.bloque.docente_id);
      if (!docMap || !docMap.has(timeKey)) {
        let penalty = 5;
        if (gen.bloque.condicion_orden === 0) penalty += 5;
        if (gen.bloque.categoria_orden !== undefined && gen.bloque.categoria_orden < 3) {
          penalty += (3 - gen.bloque.categoria_orden) * 2;
        }
        penalizacion += penalty;
      } else if (docMap.get(timeKey) === 2) {
        penalizacion += 1;
      }

      const cursosDoc = base.docenteCursos.get(gen.bloque.docente_id);
      if (cursosDoc?.has(gen.bloque.curso_id)) {
        if (docenteCursoClase.has(`${gen.bloque.docente_id}-${gen.bloque.curso_id}-${timeKey}`)) {
          penalizacion += 8;
        }
      }
    }

    const labsEnFranja = labEnFranja.get(timeKey) || [];
    const esExclusiva = franjaExclusiva.has(timeKey);

    if (ambienteOcupado.has(ak)) {
      penalizacion += 10;
    } else if (esLab && (esExclusiva || !puedeLabParaleloGA(gen.bloque, gen.dia, gen.slot_id, gen.ambiente_id, labEnFranja))) {
      penalizacion += 15;
    } else if (!esLab && (labsEnFranja.length > 0 || esExclusiva)) {
      penalizacion += 20;
    } else {
      ambienteOcupado.add(ak);
      if (esLab) {
        const usos = labEnFranja.get(timeKey) || [];
        usos.push({
          codigo: gen.bloque.curso_codigo,
          grupo_id: gen.bloque.grupo_id,
          curso_id: gen.bloque.curso_id,
          ambiente_id: gen.ambiente_id,
          docente_id: gen.bloque.docente_id || '',
        });
        labEnFranja.set(timeKey, usos);
      } else {
        franjaExclusiva.add(timeKey);
      }
    }

    const tipoAmb = ambTipo.get(gen.ambiente_id);
    if (ambAvail.has(gen.ambiente_id)) {
      const disp = ambAvail.get(gen.ambiente_id)!.has(timeKey);
      if (!disp) penalizacion += esLab ? 3 : 8;
    }

    if (gen.bloque.grupo_id) {
      const gk = `${gen.bloque.grupo_id}-${timeKey}`;
      if (grupoOcupado.has(gk)) penalizacion += 10;
      else grupoOcupado.add(gk);
    }
  }

  return penalizacion;
}

function crearIndividuoAleatorio(
  bloques: Bloque[],
  slots: any[],
  ambientes: any[]
): Individuo {
  const genes: Gen[] = bloques.map(b => {
    const dia = DIAS[Math.floor(Math.random() * DIAS.length)];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    const ambientesValidos = ambientes.filter(a => {
      if (b.num_alumnos > a.capacidad) return false;
      if (b.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
      if (b.tipo_sesion === 'teoria' && a.tipo === 'laboratorio') return false;
      return true;
    });
    const amb = ambientesValidos.length > 0
      ? ambientesValidos[Math.floor(Math.random() * ambientesValidos.length)]
      : ambientes[0];

    return { bloque: b, dia, slot_id: slot.id, ambiente_id: amb.id };
  });

  return { genes, fitness: 0 };
}

function seleccionTorneo(poblacion: Individuo[]): Individuo {
  let mejor: Individuo | null = null;
  for (let i = 0; i < TOURNAMENT_SIZE; i++) {
    const candidato = poblacion[Math.floor(Math.random() * poblacion.length)];
    if (!mejor || candidato.fitness < mejor.fitness) mejor = candidato;
  }
  return mejor!;
}

function crossover(padre1: Individuo, padre2: Individuo): Individuo {
  const genes: Gen[] = padre1.genes.map((g, i) =>
    Math.random() < 0.5 ? { ...g } : { ...padre2.genes[i] }
  );
  return { genes, fitness: 0 };
}

function mutar(individuo: Individuo, slots: any[], ambientes: any[]): Individuo {
  const genes = individuo.genes.map(g => {
    if (Math.random() < MUTATION_RATE) {
      const dia = DIAS[Math.floor(Math.random() * DIAS.length)];
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const ambientesValidos = ambientes.filter(a => {
        if (g.bloque.num_alumnos > a.capacidad) return false;
        if (g.bloque.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
        if (g.bloque.tipo_sesion === 'teoria' && a.tipo === 'laboratorio') return false;
        return true;
      });
      const amb = ambientesValidos.length > 0
        ? ambientesValidos[Math.floor(Math.random() * ambientesValidos.length)]
        : ambientes[0];
      return { ...g, dia, slot_id: slot.id, ambiente_id: amb.id };
    }
    return g;
  });
  return { genes, fitness: 0 };
}

export async function ejecutarAlgoritmoGenetico(
  bloquesSinAsignar: Bloque[],
  programacion_id: string,
  asignacionesExistentes: any[] = []
) {
  if (bloquesSinAsignar.length === 0) return [];

  const allSlots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
  const slots = allSlots.filter((s: any) => s.hora_inicio !== '13:00' && s.hora_inicio !== '13:00:00');

  const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true`);
  const disponibilidad = await query(`
    SELECT * FROM disponibilidad_docente WHERE programacion_id = $1 AND disponible = true AND prioridad IN (1, 2)
  `, [programacion_id]);

  let dispAmbiente: { ambiente_id: string; slot_id: string; dia: string; estado: string }[] = [];
  try {
    dispAmbiente = await query(`SELECT ambiente_id, slot_id, dia, estado FROM disponibilidad_ambiente`);
  } catch {
    dispAmbiente = [];
  }

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
  for (const a of ambientes) {
    if (a.tipo === 'laboratorio' && ambAvail.get(a.id)!.size === 0) {
      for (const dia of DIAS) {
        for (const s of slots) {
          ambAvail.get(a.id)!.add(`${dia}-${s.id}`);
        }
      }
    }
  }

  const cursosDoc = await query(`
    SELECT docente_id, curso_id FROM programacion_cursos
    WHERE programacion_id = $1 AND docente_id IS NOT NULL
  `, [programacion_id]);
  const docenteCursos = new Map<string, Set<string>>();
  for (const r of cursosDoc) {
    if (!docenteCursos.has(r.docente_id)) docenteCursos.set(r.docente_id, new Set());
    docenteCursos.get(r.docente_id)!.add(r.curso_id);
  }

  const baseOcc = seedOcupacion(asignacionesExistentes, docenteCursos);

  let poblacion: Individuo[] = Array.from({ length: POP_SIZE }, () =>
    crearIndividuoAleatorio(bloquesSinAsignar, slots, ambientes)
  );

  poblacion = poblacion.map(ind => ({
    ...ind,
    fitness: calcularFitness(ind.genes, docAvail, baseOcc, ambAvail, ambTipo),
  }));

  let mejorIndividuo = poblacion.reduce((a, b) => a.fitness < b.fitness ? a : b);

  for (let gen = 0; gen < MAX_GEN; gen++) {
    if (mejorIndividuo.fitness === 0) break;

    const nuevaPoblacion: Individuo[] = [{ ...mejorIndividuo }];

    while (nuevaPoblacion.length < POP_SIZE) {
      const padre1 = seleccionTorneo(poblacion);
      const padre2 = seleccionTorneo(poblacion);
      let hijo = crossover(padre1, padre2);
      hijo = mutar(hijo, slots, ambientes);
      hijo.fitness = calcularFitness(hijo.genes, docAvail, baseOcc, ambAvail, ambTipo);
      nuevaPoblacion.push(hijo);
    }

    poblacion = nuevaPoblacion;
    const candidato = poblacion.reduce((a, b) => a.fitness < b.fitness ? a : b);
    if (candidato.fitness < mejorIndividuo.fitness) mejorIndividuo = candidato;
  }

  const ambienteMap = new Map(ambientes.map((a: any) => [a.id, a]));
  return mejorIndividuo.genes.map(g => {
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
}
