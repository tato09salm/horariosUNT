import { query, queryOne } from './db';

/**
 * Algoritmo Genético (GA) — Fallback cuando el CSP no encuentra solución completa.
 * Se ejecuta sobre los bloques que quedaron sin asignar del CSP.
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
  condicion_orden?: number;
  categoria_orden?: number;
  fecha_ingreso?: Date;
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

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const POP_SIZE = 40;
const MAX_GEN = 300;
const MUTATION_RATE = 0.15;
const TOURNAMENT_SIZE = 3;

function calcularFitness(genes: Gen[], docAvail: Map<string, Set<string>>): number {
  let penalizacion = 0;

  const docenteOcupado = new Set<string>();
  const ambienteOcupado = new Set<string>();
  const grupoOcupado = new Set<string>();

  for (const gen of genes) {
    const timeKey = `${gen.dia}-${gen.slot_id}`;

    // R1: Docente en dos lugares
    if (gen.bloque.docente_id) {
      const dk = `${gen.bloque.docente_id}-${timeKey}`;
      if (docenteOcupado.has(dk)) penalizacion += 10;
      else docenteOcupado.add(dk);

      // R4: Docente disponible
      if (!docAvail.get(gen.bloque.docente_id)?.has(timeKey)) {
        let penalty = 5;
        // Si es nombrado, penaliza mucho más
        if (gen.bloque.condicion_orden === 0) penalty += 5;
        // Si es principal, asociado, auxiliar, penaliza más
        if (gen.bloque.categoria_orden !== undefined && gen.bloque.categoria_orden < 3) {
          penalty += (3 - gen.bloque.categoria_orden) * 2; // principal +6, asociado +4, auxiliar +2
        }
        penalizacion += penalty;
      }
    }

    // R2: Ambiente ocupado
    const ak = `${gen.ambiente_id}-${timeKey}`;
    if (ambienteOcupado.has(ak)) penalizacion += 10;
    else ambienteOcupado.add(ak);

    // R3: Grupo ocupado
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
    // Filtrar ambiente válido
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
  programacion_id: string
) {
  if (bloquesSinAsignar.length === 0) return [];

  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
  const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true`);
  const disponibilidad = await query(`
    SELECT * FROM disponibilidad_docente WHERE programacion_id = $1 AND disponible = true
  `, [programacion_id]);

  const docAvail = new Map<string, Set<string>>();
  for (const d of disponibilidad) {
    if (!docAvail.has(d.docente_id)) docAvail.set(d.docente_id, new Set());
    docAvail.get(d.docente_id)!.add(`${d.dia}-${d.slot_id}`);
  }

  // Crear población inicial
  let poblacion: Individuo[] = Array.from({ length: POP_SIZE }, () =>
    crearIndividuoAleatorio(bloquesSinAsignar, slots, ambientes)
  );

  // Evaluar fitness inicial
  poblacion = poblacion.map(ind => ({
    ...ind,
    fitness: calcularFitness(ind.genes, docAvail)
  }));

  let mejorIndividuo = poblacion.reduce((a, b) => a.fitness < b.fitness ? a : b);

  // Evolución
  for (let gen = 0; gen < MAX_GEN; gen++) {
    if (mejorIndividuo.fitness === 0) break; // Solución perfecta

    const nuevaPoblacion: Individuo[] = [];

    // Elitismo — conservar el mejor
    nuevaPoblacion.push({ ...mejorIndividuo });

    while (nuevaPoblacion.length < POP_SIZE) {
      const padre1 = seleccionTorneo(poblacion);
      const padre2 = seleccionTorneo(poblacion);
      let hijo = crossover(padre1, padre2);
      hijo = mutar(hijo, slots, ambientes);
      hijo.fitness = calcularFitness(hijo.genes, docAvail);
      nuevaPoblacion.push(hijo);
    }

    poblacion = nuevaPoblacion;
    const candidato = poblacion.reduce((a, b) => a.fitness < b.fitness ? a : b);
    if (candidato.fitness < mejorIndividuo.fitness) mejorIndividuo = candidato;
  }

  // Convertir genes en formato de asignaciones
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
      fuente: 'GA', // Marcar que vino del GA, no del CSP
    };
  });
}
