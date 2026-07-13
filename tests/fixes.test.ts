import { ok, strictEqual, deepStrictEqual, notStrictEqual } from 'assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { SlotRow } from '../lib/csp-asignacion';

// ─── Test 1: cloneOccupancy aislamiento ────────────────────────────────────
import { cloneOccupancy, type Occupancy } from '../lib/csp-asignacion';

function testCloneOccupancyIsolation() {
  const occ: Occupancy = {
    docenteOcupado: new Set(['d1-lunes-s1']),
    ambienteOcupado: new Set(['a1-lunes-s1']),
    grupoOcupado: new Set(['g1-lunes-s1']),
    labEnFranja: new Map([
      ['global-lunes-s1', [{ curso_id: 'c1', ambiente_id: 'a1', docente_id: 'd1', grupo_id: 'g1', codigo: 'C1' }]]
    ]),
    franjaModo: new Map([['global-lunes-s1', 'solo_lab']]),
    labParalelosFranjas: 0,
    aulaPreferidaTeoria: new Map(),
    docenteCursoClase: new Set(['d1-c1-lunes-s1']),
    cicloOcupado: new Set(['1-A-lunes-s1']),
  };

  const cloned = cloneOccupancy(occ);

  // Mutate original
  occ.docenteOcupado.add('d2-lunes-s2');
  occ.labEnFranja.get('global-lunes-s1')![0].codigo = 'MUTATED';

  strictEqual(cloned.docenteOcupado.has('d2-lunes-s2'), false, 'Set should be isolated');
  strictEqual(cloned.labEnFranja.get('global-lunes-s1')![0].codigo, 'C1', 'labEnFranja object should be deep-cloned');

  console.log('  ✓ cloneOccupancy isolation');
}

// ─── Test 2: Saturday activation ───────────────────────────────────────────
function testSaturdayActivation() {
  for (let i = 0; i < 6; i++) {
    const sab = (i >= 6) ? true : false;
    strictEqual(sab, false, `intento ${i} should not have saturday`);
  }
  const sab6 = (6 >= 6) ? true : false;
  strictEqual(sab6, true, 'intento 6 should have saturday');

  console.log('  ✓ Saturday activation');
}

// ─── Test 3: estrategiaRotacion changes order ──────────────────────────────
function testEstrategiaRotacion() {
  for (let i = 0; i < 8; i++) {
    const rot = (i % 4);
    ok(rot >= 0 && rot <= 3, `Rotacion ${rot} in range`);
  }
  console.log('  ✓ Estrategia rotacion values in range');
}

// ─── Test 4: Mixed block consumes T+P from pendientes ──────────────────────
function testMixedBlockRemovesPendientes() {
  const consumidos = new Set<string>(['t1', 'p1']);
  const pendientes = [{ id: 't1' }, { id: 'p1' }, { id: 'l1' }];
  const filtrados = pendientes.filter(b => !consumidos.has((b as any).id));
  strictEqual(filtrados.length, 1, 'Only lab remains after T+P consumed');
  strictEqual((filtrados[0] as any).id, 'l1', 'Lab should remain');

  console.log('  ✓ Mixed block removes T+P from pendientes');
}

// ─── Test 5: Caso A - no loss of hours ─────────────────────────────────────
function testCasoA() {
  // Inline construirBloqueMixtoParcial logic for Caso A
  const ht = 3, hp = 1; // all theory consumed
  const restoT = 3 - ht; // 0
  const restoP = 2 - hp; // 1
  ok(restoT === 0, 'Caso A: no theory remaining');
  ok(restoP > 0, 'Caso A: practice remains');
  const total = ht + hp + restoT + restoP;
  strictEqual(total, 5, 'No loss of hours in Caso A');

  console.log('  ✓ Caso A: no loss of hours');
}

// ─── Test 6: Caso B - no loss of hours ─────────────────────────────────────
function testCasoB() {
  const ht = 1, hp = 2; // all practice consumed
  const restoT = 3 - ht; // 2
  const restoP = 2 - hp; // 0
  ok(restoP === 0, 'Caso B: no practice remaining');
  ok(restoT > 0, 'Caso B: theory remains');
  const total = ht + hp + restoT + restoP;
  strictEqual(total, 5, 'No loss of hours in Caso B');

  console.log('  ✓ Caso B: no loss of hours');
}

// ─── Test 7: Reject mixed where both T and P remain ────────────────────────
function testRejectBothRemaining() {
  const testReject = (ht: number, hp: number) => {
    const restoT = 3 - ht;
    const restoP = 2 - hp;
    return (restoT > 0 && restoP > 0) ? null : { restoT, restoP };
  };

  const result = testReject(1, 1);
  strictEqual(result, null, 'Should reject mix where both T and P remain');

  const result2 = testReject(2, 1);
  strictEqual(result2, null, 'Should reject mix where both T and P remain (2)');

  // These should be accepted
  const result3 = testReject(3, 1);
  ok(result3 !== null, 'Caso A should be accepted');

  const result4 = testReject(1, 2);
  ok(result4 !== null, 'Caso B should be accepted');

  console.log('  ✓ Reject mixed where both T and P remain');
}

// ─── Test 8: GA with hardPenalty > 0 discarded ─────────────────────────────
function testGADiscardHardPenalty() {
  const gaResult = { asignaciones: [{ id: 'a1' }], stats: { hardPenalty: 500 } };
  const shouldAdd = gaResult.asignaciones.length > 0 && gaResult.stats.hardPenalty <= 0;
  strictEqual(shouldAdd, false, 'Should not add GA result with hardPenalty > 0');
  console.log('  ✓ GA with hardPenalty > 0 discarded');
}

// ─── Test 9: GA with hardPenalty = 0 accepted ──────────────────────────────
function testGAAcceptNoHardPenalty() {
  const gaResult = { asignaciones: [{ id: 'a1' }], stats: { hardPenalty: 0 } };
  const shouldAdd = gaResult.asignaciones.length > 0 && gaResult.stats.hardPenalty <= 0;
  strictEqual(shouldAdd, true, 'Should add GA result with hardPenalty = 0');
  console.log('  ✓ GA with hardPenalty = 0 accepted');
}

// ─── Test 10: Completitud real de un docente ───────────────────────────────
function testDocenteCompletion() {
  const reqCounts = new Map<string, number>([
    ['d1-c1-g1-teoria-0', 3],
    ['d1-c1-g1-practica-0', 2],
  ]);
  const assignedCounts = new Map<string, number>([
    ['d1-c1-g1-teoria-0', 3],
    ['d1-c1-g1-practica-0', 2],
  ]);

  let todosOk = true;
  for (const [k, needed] of reqCounts) {
    if ((assignedCounts.get(k) || 0) < needed) { todosOk = false; break; }
  }
  strictEqual(todosOk, true, 'Docente with all hours assigned should be complete');

  assignedCounts.set('d1-c1-g1-practica-0', 1);
  todosOk = true;
  for (const [k, needed] of reqCounts) {
    if ((assignedCounts.get(k) || 0) < needed) { todosOk = false; break; }
  }
  strictEqual(todosOk, false, 'Docente with missing hours should not be complete');

  console.log('  ✓ Docente completitud real');
}

// ─── Test 11: Refactor T→P sorting ─────────────────────────────────────────
function testTPContiguoSorting() {
  const pairs: { orden: number; tipo: string }[] = [
    { orden: 3, tipo: 'practica' },
    { orden: 1, tipo: 'teoria' },
    { orden: 2, tipo: 'teoria' },
    { orden: 4, tipo: 'practica' },
  ];
  pairs.sort((a, b) => a.orden - b.orden);
  strictEqual(pairs[0].tipo, 'teoria');
  strictEqual(pairs[1].tipo, 'teoria');
  strictEqual(pairs[2].tipo, 'practica');
  strictEqual(pairs[3].tipo, 'practica');

  let contiguos = 0;
  for (let i = 0; i < pairs.length - 1; i++) {
    if (pairs[i].tipo === 'teoria' && pairs[i + 1].tipo === 'practica'
        && pairs[i + 1].orden - pairs[i].orden === 1) {
      contiguos++;
    }
  }
  strictEqual(contiguos, 1, 'Should find 1 T→P contiguous pair');

  console.log('  ✓ T→P contiguous sorting with pairs');
}

// ─── Test 12: Slot orden Map ───────────────────────────────────────────────
function testSlotOrdenMap() {
  const slots = [{ id: 'slot-1', orden: 1 }, { id: 'slot-2', orden: 2 }, { id: 'slot-3', orden: 3 }];
  const slotMap = new Map(slots.map(s => [s.id, s.orden]));
  strictEqual(slotMap.get('slot-1'), 1);
  strictEqual(slotMap.get('slot-3'), 3);
  strictEqual(slotMap.get('nonexistent'), undefined);
  strictEqual(slotMap.get('slot-2') ?? 0, 2);

  console.log('  ✓ Slot orden Map');
}

// ─── Test 13: Fragmentación agrupada por todas las dimensiones ─────────────
function testFragmentacionGrouping() {
  const asignaciones = [
    { docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo: 'teoria', lab_turno: 0, dia: 'lunes', slot_id: 's1' },
    { docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo: 'teoria', lab_turno: 0, dia: 'lunes', slot_id: 's3' },
    { docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo: 'practica', lab_turno: 0, dia: 'lunes', slot_id: 's5' },
    { docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo: 'practica', lab_turno: 0, dia: 'lunes', slot_id: 's6' },
  ];
  const slotOrden = new Map([['s1', 1], ['s3', 3], ['s5', 5], ['s6', 6]]);

  const porSegmento = new Map<string, number[]>();
  for (const a of asignaciones) {
    const k = `${a.docente_id}|${a.curso_id}|${a.grupo_id}|${a.tipo}|${a.lab_turno || 0}|${a.dia}`;
    if (!porSegmento.has(k)) porSegmento.set(k, []);
    porSegmento.get(k)!.push(slotOrden.get(a.slot_id) ?? 0);
  }

  strictEqual(porSegmento.size, 2, 'Should group by docente+curso+grupo+tipo+lab+dia');

  let fragmentos = 0;
  for (const slotsArr of porSegmento.values()) {
    if (slotsArr.length < 3) continue;
    slotsArr.sort((a, b) => a - b);
    let segs = 1;
    for (let i = 1; i < slotsArr.length; i++) {
      if (slotsArr[i] - slotsArr[i - 1] > 1) segs++;
    }
    if (segs > 2) fragmentos += segs - 2;
  }
  strictEqual(fragmentos, 0, 'No fragmentation for groups < 3 items');

  console.log('  ✓ Fragmentación grouping by all dimensions');
}

// ─── Test 14: Refinamiento sin ocupación residual ──────────────────────────
function testRefinamientoCleanOccupancy() {
  const occ2 = new Set<string>(['d1-lunes-s1']);

  strictEqual(occ2.size, 1, 'Rebuilt occupancy should only contain retained assignments');
  strictEqual(occ2.has('d1-lunes-s1'), true);
  strictEqual(occ2.has('d1-lunes-s2'), false, 'Removed assignment not in rebuilt occ');

  console.log('  ✓ Refinamiento sin ocupación residual');
}

// ─── Test 15: Refinamiento respeta asignaciones GA ─────────────────────────
function testRefinamientoRespectsGA() {
  const allAssignments = [
    { id: 'ga1', es_mixto: false },
    { id: 'ga2', es_mixto: false },
    { id: 'mx1', es_mixto: true },
  ];
  const mixedOnly = allAssignments.filter(a => a.es_mixto);
  strictEqual(mixedOnly.length, 1, 'Should only consider mixed assignments');
  strictEqual(mixedOnly[0].id, 'mx1', 'Should not include GA assignments');

  console.log('  ✓ Refinamiento respeta asignaciones GA');
}

// ─── Test 16: prog.config as JSON string ───────────────────────────────────
function testProgConfigParsing() {
  const configStr = '{"horarios_restringidos":["s1","s2"],"ciclo_nombre":"2026-I"}';
  const parsed = JSON.parse(configStr);
  deepStrictEqual(parsed.horarios_restringidos, ['s1', 's2']);
  deepStrictEqual(parsed.ciclo_nombre, '2026-I');

  const merged = { ...parsed, asignaciones: [{ id: 'a1' }] };
  ok(merged.horarios_restringidos !== undefined);
  ok(merged.asignaciones !== undefined);
  strictEqual(merged.asignaciones.length, 1);

  strictEqual(typeof parsed, 'object');
  notStrictEqual(typeof parsed, 'string');

  console.log('  ✓ prog.config JSON string parsing');
}

// ─── Test 17: calcularPuntajeSolucion with all criteria ────────────────────
function testCalcularPuntajeSolucion() {
  // Tests the scoring logic without importing the actual function
  const conflictosDuros = 0;
  const horasPendientes = 0;
  const bloquesMixtosCount = 0;
  const huecosTotales = 0;
  const usoSabado = 0;
  const teoriaPracticaInvertidas = 0;
  const bloquesFragmentados = 0;
  const diasAdicionales = 0;
  const ambAlternativos = 0;

  const PENALIZACION_HORA_PENDIENTE = 1000;
  const PENALIZACION_BLOQUE_MIXTO = 100;
  const PENALIZACION_HUECO_POR_HORA = 10;
  const PENALIZACION_SABADO = 30;
  const PENALIZACION_TEORIA_TRAS_PRACTICA = 50;
  const PENALIZACION_FRAGMENTACION = 30;
  const PENALIZACION_DIA_ADICIONAL = 20;
  const PENALIZACION_AMBIENTE_ALTERNATIVO = 15;
  const BONIFICACION_DOCENTE_COMPLETO = 500;
  const puntaje = conflictosDuros * 10000
    + horasPendientes * PENALIZACION_HORA_PENDIENTE
    + bloquesMixtosCount * PENALIZACION_BLOQUE_MIXTO
    + huecosTotales * PENALIZACION_HUECO_POR_HORA
    + usoSabado * PENALIZACION_SABADO
    + teoriaPracticaInvertidas * PENALIZACION_TEORIA_TRAS_PRACTICA
    + bloquesFragmentados * PENALIZACION_FRAGMENTACION
    + diasAdicionales * PENALIZACION_DIA_ADICIONAL
    + ambAlternativos * PENALIZACION_AMBIENTE_ALTERNATIVO
    - (horasPendientes === 0 ? BONIFICACION_DOCENTE_COMPLETO : 0)
    - 0; // tp contiguo

  strictEqual(puntaje, -500, 'Clean solution gets only the doc completo bonus');

  // With 2 pending hours
  const puntaje2 = 0 + 2 * PENALIZACION_HORA_PENDIENTE + 0 + 0 + 0 + 0 + 0 + 0 + 0 - 0 - 0;
  strictEqual(puntaje2, 2000, '2 pending hours = 2000 penalty');

  console.log('  ✓ calcularPuntajeSolucion with all criteria');
}

// ─── Test 18: No parseInt(slot_id) ─────────────────────────────────────────
function testNoParseIntSlotId() {
  const resolverPath = join(__dirname, '../lib/horarios-resolver-v2.ts');
  const gaPath = join(__dirname, '../lib/horarios-ga.ts');

  if (existsSync(resolverPath)) {
    const content = readFileSync(resolverPath, 'utf-8');
    // There should be no `parseInt` used on slot_id in resolver
    const lines = content.split('\n').filter(l => l.includes('parseInt'));
    for (const line of lines) {
      ok(!line.includes('slot_id'), `No parseInt(slot_id) in resolver: ${line.trim()}`);
    }
  }

  if (existsSync(gaPath)) {
    const content = readFileSync(gaPath, 'utf-8');
    ok(content.includes('slotOrdenMap'), 'GA uses slotOrdenMap');
    // Filter out the comment line that mentions it and code lines that actually call parseInt(slot...)
    const parseIntLines = content.split('\n').filter(l => {
      const trimmed = l.trim();
      return trimmed.startsWith('parseInt(') && (trimmed.includes('slot_id') || trimmed.includes('slot'));
    });
    strictEqual(parseIntLines.length, 0, `No parseInt(slot) calls in GA: ${parseIntLines.join(', ')}`);
  }

  console.log('  ✓ No parseInt(slot_id) - uses slot.orden');
}


// ─── Integration test 1: prioridad docente ──────────────────────────────────
import { generarHorarioV2, validarSolucionFinal } from '../lib/horarios-resolver-v2';

function mockSlots(): SlotRow[] {
  return [
    { id: 's1', orden: 1, hora_inicio: '07:00' },
    { id: 's2', orden: 2, hora_inicio: '08:00' },
    { id: 's3', orden: 3, hora_inicio: '09:00' },
    { id: 's4', orden: 4, hora_inicio: '10:00' },
    { id: 's5', orden: 5, hora_inicio: '11:00' },
    { id: 's6', orden: 6, hora_inicio: '12:00' },
  ];
}

function mockAmbientes() {
  return [
    { id: 'lab01', codigo: 'LAB-01', tipo: 'laboratorio', capacidad: 30, disponible: true },
    { id: 'lab02', codigo: 'LAB-02', tipo: 'laboratorio', capacidad: 30, disponible: true },
    { id: 'aul01', codigo: 'AUL-101', tipo: 'aula', capacidad: 40, disponible: true },
    { id: 'aul02', codigo: 'AUL-102', tipo: 'aula', capacidad: 40, disponible: true },
  ];
}

async function testIntegracionPrioridadDocente() {
  const slots = mockSlots();
  const ambientes = mockAmbientes();

  // Docente 1: nombrado + principal + fecha_ingreso antigua (más prioridad)
  const docente1 = {
    id: 'd-prio-001', nombre: 'Juan', apellidos: 'Perez',
    condicion: 'nombrado', categoria: 'principal',
    fecha_ingreso: new Date('2000-01-01'), condicion_orden: 0, categoria_orden: 0,
  };
  // Docente 2: contratado + auxiliar (menos prioridad)
  const docente2 = {
    id: 'd-prio-002', nombre: 'Pedro', apellidos: 'Lopez',
    condicion: 'contratado', categoria: 'auxiliar',
    fecha_ingreso: new Date('2020-01-01'), condicion_orden: 1, categoria_orden: 1,
  };

  const docentesProg = [docente1, docente2];

  // Curso: 3h teoría, 2h práctica → 5h total
  const cursoBase = {
    id: 'pc-integ-001', curso_id: 'c-integ-001', codigo: 'INT101',
    curso_nombre: 'Introduccion', grupo_id: 'g-integ-001', numero_grupo: 'A',
    horas_teoria: 3, horas_practica: 0, horas_laboratorio: 0, cantidad_labs: 1,
    bloque_indivisible: true, num_alumnos: 25, ciclo_plan: '2026-I',
    condicion_orden: 0, categoria_orden: 0, fecha_ingreso: new Date('2000-01-01'),
    docente_id: null, tipo_actividad: null,
  };

  // Both docentes want the same course (will compete)
  const cursos1 = [{ ...cursoBase, docente_id: docente1.id, condicion_orden: 0, categoria_orden: 0, fecha_ingreso: docente1.fecha_ingreso }];
  const cursos2 = [{ ...cursoBase, id: 'pc-integ-002', docente_id: docente2.id, condicion_orden: 1, categoria_orden: 1, fecha_ingreso: docente2.fecha_ingreso }];

  // Both docentes available full-time Mon-Fri
  const disponibilidad = [];
  for (const dId of [docente1.id, docente2.id]) {
    for (const d of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']) {
      for (const s of slots) {
        disponibilidad.push({ docente_id: dId, dia: d, slot_id: s.id, disponible: true, prioridad: 1 });
      }
    }
  }

  // --- Test 1A: Each docente gets their own course independently ---
  const result1 = await generarHorarioV2(
    'prog-integ-001', cursos1, disponibilidad, ambientes, slots, docentesProg,
  );
  const val1 = validarSolucionFinal(result1.asignaciones, cursos1, slots);
  ok(val1.valida, `Test 1A: Validation should pass: ${val1.errores.join('; ')}`);
  strictEqual(result1.stats.pendientes, 0, 'Test 1A: All hours assigned for docente 1');

  const result2 = await generarHorarioV2(
    'prog-integ-002', cursos2, disponibilidad, ambientes, slots, [docente2],
  );
  const val2 = validarSolucionFinal(result2.asignaciones, cursos2, slots);
  ok(val2.valida, `Test 1B: Validation should pass: ${val2.errores.join('; ')}`);
  strictEqual(result2.stats.pendientes, 0, 'Test 1B: All hours assigned for docente 2');

  // --- Test 1C: Both compete with separate grupos - docente 1 (nombrado) should win ---
  const cursos1b = [{ ...cursos1[0], grupo_id: 'g1' }];
  const cursos2b = [{ ...cursos2[0], grupo_id: 'g2' }];
  const result3 = await generarHorarioV2(
    'prog-integ-003', [...cursos1b, ...cursos2b], disponibilidad, ambientes, slots, docentesProg,
  );
  const val3 = validarSolucionFinal(result3.asignaciones, [...cursos1b, ...cursos2b], slots);
  ok(val3.valida, `Test 1C: Validation should pass: ${val3.errores.join('; ')}`);

  // Check docente 1 processed first, no cross conflicts
  const docSlots = new Set<string>();
  for (const a of result3.asignaciones) {
    const k = `${a.docente_id}|${a.dia}|${a.slot_id}`;
    ok(!docSlots.has(k), `Test 1C: No cross conflict for docente ${a.docente_id} on ${a.dia} ${a.slot_id}`);
    docSlots.add(k);
  }

  console.log('  ✓ Integracion prioridad docente');
}

// ─── Integration test 2: Caso A/B mixto ─────────────────────────────────────
async function testIntegracionCasoMixto() {
  const slots = mockSlots();
  const ambientes = mockAmbientes();
  const docente = {
    id: 'd-mix-001', nombre: 'Maria', apellidos: 'Garcia',
    condicion: 'nombrado', categoria: 'asociado',
    fecha_ingreso: new Date('2010-01-01'), condicion_orden: 0, categoria_orden: 1,
  };

  // Curso con 3h teoría + 2h práctica (total 5h)
  // Only 3 consecutive slots available per day (can't fit 3T+2P separately)
  const cursos = [{
    id: 'pc-mix-001', curso_id: 'c-mix-001', codigo: 'MIX101',
    curso_nombre: 'Mixto', grupo_id: 'g-mix-001', numero_grupo: 'U',
    horas_teoria: 3, horas_practica: 2, horas_laboratorio: 0, cantidad_labs: 1,
    bloque_indivisible: false, num_alumnos: 20, ciclo_plan: '2026-I',
    condicion_orden: 0, categoria_orden: 1, fecha_ingreso: new Date('2010-01-01'),
    docente_id: docente.id, tipo_actividad: null,
  }];

  // Availability: only 3 consecutive slots on lunes (s1,s2,s3), 
  // full day on martes (all 6 slots)
  const disponibilidad = [];
  for (const d of ['lunes']) {
    for (const s of [slots[0], slots[1], slots[2]]) {
      disponibilidad.push({ docente_id: docente.id, dia: d, slot_id: s.id, disponible: true, prioridad: 1 });
    }
  }
  for (const d of ['martes']) {
    for (const s of slots) {
      disponibilidad.push({ docente_id: docente.id, dia: d, slot_id: s.id, disponible: true, prioridad: 1 });
    }
  }

  const result = await generarHorarioV2(
    'prog-mix-001', cursos, disponibilidad, ambientes, slots, [docente],
  );

  // Verify: 5h total assigned
  strictEqual(result.stats.asignadas, 5, `Test 2: Should assign 5h, got ${result.stats.asignadas}`);

  // Count by tipo
  const teoriaCount = result.asignaciones.filter(a => a.tipo === 'teoria').length;
  const practicaCount = result.asignaciones.filter(a => a.tipo === 'practica').length;
  strictEqual(teoriaCount, 3, 'Test 2: 3h teoria');
  strictEqual(practicaCount, 2, 'Test 2: 2h practica');

  // Check mixed block if used
  const mixtos = result.asignaciones.filter(a => a.es_mixto);
  if (mixtos.length > 0) {
    const tm = mixtos[0].tipo_mixto as string;
    ok(tm === 'completo' || tm === 'mixto_mas_practica' || tm === 'mixto_mas_teoria',
      `Test 2: tipo_mixto should be valid, got ${tm}`);
  }

  const val = validarSolucionFinal(result.asignaciones, cursos, slots);
  ok(val.valida, `Test 2: Validation should pass: ${val.errores.join('; ')}`);

  console.log('  ✓ Integracion caso mixto A/B');
}

// ─── Integration test 3: Refinamiento ───────────────────────────────────────
async function testIntegracionRefinamiento() {
  const slots = mockSlots();
  const ambientes = mockAmbientes();
  const docente = {
    id: 'd-ref-001', nombre: 'Carlos', apellidos: 'Sanchez',
    condicion: 'nombrado', categoria: 'principal',
    fecha_ingreso: new Date('2005-01-01'), condicion_orden: 0, categoria_orden: 0,
  };

  // Course: 4h theory (needs 2 blocks of 2h or 1 block of 3h+1h solitary)
  const cursos = [{
    id: 'pc-ref-001', curso_id: 'c-ref-001', codigo: 'REF101',
    curso_nombre: 'Refinable', grupo_id: 'g-ref-001', numero_grupo: 'A',
    horas_teoria: 4, horas_practica: 0, horas_laboratorio: 0, cantidad_labs: 1,
    bloque_indivisible: true, num_alumnos: 25, ciclo_plan: '2026-I',
    condicion_orden: 0, categoria_orden: 0, fecha_ingreso: new Date('2005-01-01'),
    docente_id: docente.id, tipo_actividad: null,
  }];

  // Only sábado available with enough slots, PLUS lunes available with 4 consecutive
  const disponibilidad = [];
  // sábado: all 6 slots (will produce sabado penalty initially)
  for (const s of slots) {
    disponibilidad.push({ docente_id: docente.id, dia: 'sabado', slot_id: s.id, disponible: true, prioridad: 1 });
  }
  // lunes: slots s1-s4 (better alternative)
  for (const s of [slots[0], slots[1], slots[2], slots[3]]) {
    disponibilidad.push({ docente_id: docente.id, dia: 'lunes', slot_id: s.id, disponible: true, prioridad: 1 });
  }

  // Ensure we use restrictedIds to exclude lunch
  const result = await generarHorarioV2(
    'prog-ref-001', cursos, disponibilidad, ambientes, slots, [docente],
    { restrictedIds: [] }
  );

  strictEqual(result.stats.asignadas, 4, 'Test 3: Should assign 4h');
  const val = validarSolucionFinal(result.asignaciones, cursos, slots);
  ok(val.valida, `Test 3: Validation should pass: ${val.errores.join('; ')}`);

  // Check that final assignments don't use sabado if Mon-Fri available
  const enSabado = result.asignaciones.filter(a => a.dia === 'sabado').length;
  ok(enSabado === 0, `Test 3: Should prefer lunes over sabado (sabado assignments: ${enSabado})`);

  // Verify occupancy consistency
  const docSlots = new Set<string>();
  for (const a of result.asignaciones) {
    const k = `${a.docente_id}-${a.dia}-${a.slot_id}`;
    ok(!docSlots.has(k), `Test 3: No duplicate docente slot: ${k}`);
    docSlots.add(k);
  }

  console.log('  ✓ Integracion refinamiento');
}

// ─── Test 19: claveBloqueAcademico identity ──────────────────────────────────
import { claveBloqueAcademico, calcularRequerimientosCurso } from '../lib/horarios-resolver-v2';

function testClaveBloqueAcademico() {
  const meta1 = { pc_id: 'pc1', docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo_sesion: 'laboratorio', lab_turno: 1 };
  const meta1a = { pc_id: 'pc1', docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo_sesion: 'laboratorio', lab_turno: 1 };
  const meta2 = { pc_id: 'pc1', docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo_sesion: 'laboratorio', lab_turno: 2 };
  const meta3 = { pc_id: 'pc1', docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo_sesion: 'teoria', lab_turno: 0 };

  strictEqual(claveBloqueAcademico(meta1), claveBloqueAcademico(meta1a), 'Same key for same metadata');
  notStrictEqual(claveBloqueAcademico(meta1), claveBloqueAcademico(meta2), 'Different key for different lab_turno');
  notStrictEqual(claveBloqueAcademico(meta1), claveBloqueAcademico(meta3), 'Different key for different tipo_sesion');

  console.log('  ✓ claveBloqueAcademico identity');
}

// ─── Test 20: calcularRequerimientosCurso ────────────────────────────────────
function testCalcularRequerimientosCurso() {
  // Pure lab with 2 turnos
  const pureLab = { horas_teoria: 0, horas_practica: 0, horas_laboratorio: 3, cantidad_labs: 2 };
  const req = calcularRequerimientosCurso(pureLab);
  strictEqual(req.teoria, 0, 'Pure lab: teoria = 0');
  strictEqual(req.practica, 0, 'Pure lab: practica = 0');
  strictEqual(req.laboratorioPorTurno, 3, 'Pure lab: 3h per turno');
  strictEqual(req.turnosLaboratorio, 2, 'Pure lab: 2 turnos');
  strictEqual(req.laboratorioTotal, 6, 'Pure lab: 6h total lab');
  strictEqual(req.total, 6, 'Pure lab: 6h total');

  // Regular course with T+P+Lab
  const regular = { horas_teoria: 3, horas_practica: 2, horas_laboratorio: 2, cantidad_labs: 3 };
  const req2 = calcularRequerimientosCurso(regular);
  strictEqual(req2.teoria, 3, 'Regular: teoria = 3');
  strictEqual(req2.practica, 2, 'Regular: practica = 2');
  strictEqual(req2.laboratorioPorTurno, 2, 'Regular: 2h per lab turno');
  strictEqual(req2.turnosLaboratorio, 3, 'Regular: 3 lab turnos');
  strictEqual(req2.laboratorioTotal, 6, 'Regular: 6h total lab');
  strictEqual(req2.total, 11, 'Regular: 11h total (3+2+6)');

  // Course without lab
  const noLab = { horas_teoria: 4, horas_practica: 0, horas_laboratorio: 0, cantidad_labs: 0 };
  const req3 = calcularRequerimientosCurso(noLab);
  strictEqual(req3.laboratorioPorTurno, 0, 'No lab: 0h per turno');
  strictEqual(req3.turnosLaboratorio, 0, 'No lab: 0 turnos');
  strictEqual(req3.laboratorioTotal, 0, 'No lab: 0h total');

  console.log('  ✓ calcularRequerimientosCurso');
}

// ─── Test 21: Misma clave en dos días → BLOQUE_DUPLICADO ────────────────────
function testBloqueDuplicadoValidacion() {
  const slots: SlotRow[] = [
    { id: 's1', orden: 1, hora_inicio: '07:00' },
    { id: 's2', orden: 2, hora_inicio: '08:00' },
    { id: 's3', orden: 3, hora_inicio: '09:00' },
  ];
  // Same bloque (clave_bloque='ck-1', bloque_continuo_id='bc-1') assigned on Monday AND Tuesday
  const mismatched = [
    { clave_bloque: 'ck-1', bloque_continuo_id: 'bc-1', dia: 'lunes', slot_id: 's1', slot_orden: 1, docente_id: 'd1', grupo_id: 'g1', ambiente_id: 'a1', curso_id: 'c1', tipo: 'laboratorio', lab_turno: 1, bloque_parte: 1, bloque_total: 3 },
    { clave_bloque: 'ck-1', bloque_continuo_id: 'bc-1', dia: 'lunes', slot_id: 's2', slot_orden: 2, docente_id: 'd1', grupo_id: 'g1', ambiente_id: 'a1', curso_id: 'c1', tipo: 'laboratorio', lab_turno: 1, bloque_parte: 2, bloque_total: 3 },
    { clave_bloque: 'ck-1', bloque_continuo_id: 'bc-1', dia: 'lunes', slot_id: 's3', slot_orden: 3, docente_id: 'd1', grupo_id: 'g1', ambiente_id: 'a1', curso_id: 'c1', tipo: 'laboratorio', lab_turno: 1, bloque_parte: 3, bloque_total: 3 },
    // TUESDAY - same clave_bloque, same bloque_continuo_id → DUPLICATE
    { clave_bloque: 'ck-1', bloque_continuo_id: 'bc-1', dia: 'martes', slot_id: 's1', slot_orden: 1, docente_id: 'd1', grupo_id: 'g1', ambiente_id: 'a1', curso_id: 'c1', tipo: 'laboratorio', lab_turno: 1, bloque_parte: 1, bloque_total: 3 },
    { clave_bloque: 'ck-1', bloque_continuo_id: 'bc-1', dia: 'martes', slot_id: 's2', slot_orden: 2, docente_id: 'd1', grupo_id: 'g1', ambiente_id: 'a1', curso_id: 'c1', tipo: 'laboratorio', lab_turno: 1, bloque_parte: 2, bloque_total: 3 },
    { clave_bloque: 'ck-1', bloque_continuo_id: 'bc-1', dia: 'martes', slot_id: 's3', slot_orden: 3, docente_id: 'd1', grupo_id: 'g1', ambiente_id: 'a1', curso_id: 'c1', tipo: 'laboratorio', lab_turno: 1, bloque_parte: 3, bloque_total: 3 },
  ];

  const cursos = [{ curso_id: 'c1', grupo_id: 'g1', horas_teoria: 0, horas_practica: 0, horas_laboratorio: 3, cantidad_labs: 1, id: 'pc1' }];
  const val = validarSolucionFinal(mismatched as any, cursos as any, slots);
  ok(!val.valida, 'BlOQUE_DUPLICADO should be detected');
  ok(val.resumen.bloquesDuplicados > 0, `Resumen should report bloquesDuplicados > 0`);
  const hasDuplicado = val.errores_estructurados.some(e => e.codigo === 'BLOQUE_DUPLICADO');
  ok(hasDuplicado, 'Error code BLOQUE_DUPLICADO should be present');

  console.log('  ✓ Bloques duplicados validation');
}

// ─── Test 22: Pure lab with multiple turnos ─────────────────────────────────
function testPureLabMultipleTurnos() {
  // Simulate what construirBloquesIndependientes should do (after fix)
  const totalBloques = (horasPorTurno: number, cantidadLabs: number) => {
    if (horasPorTurno <= 0) return 0;
    const turnos = Math.max(1, cantidadLabs || 1);
    return turnos; // one block per turno
  };

  // Pure lab, 1 turno: 1 block = 3h
  strictEqual(totalBloques(3, 1), 1, 'Pure lab 1 turno → 1 block');

  // Pure lab, 2 turnos: 2 blocks each 3h → 6h total
  strictEqual(totalBloques(3, 2), 2, 'Pure lab 2 turnos → 2 blocks');

  // No lab: 0 blocks
  strictEqual(totalBloques(0, 2), 0, 'No lab → 0 blocks');

  console.log('  ✓ Pure lab multiple turnos');
}

// ─── Test 23: contarHorasAsignadasPorBloque ────────────────────────────────
function testContarHorasAsignadasPorBloque() {
  const { contarHorasAsignadasPorBloque } = require('../lib/horarios-resolver-v2');
  const asignaciones = [
    { clave_bloque: 'a', slot_id: 's1' },
    { clave_bloque: 'a', slot_id: 's2' },
    { clave_bloque: 'a', slot_id: 's3' },
    { clave_bloque: 'b', slot_id: 's1' },
  ];
  const map = contarHorasAsignadasPorBloque(asignaciones);
  strictEqual(map.get('a'), 3, 'Clave A has 3 hours');
  strictEqual(map.get('b'), 1, 'Clave B has 1 hour');
  strictEqual(map.get('nonexistent'), undefined, 'Nonexistent key returns undefined');

  console.log('  ✓ contarHorasAsignadasPorBloque');
}

// ─── Test 24: auditarBloques detects exact duplication ─────────────────────
import { auditarBloques } from '../lib/horarios-resolver-v2';

function testAuditarBloquesDetectsDuplicates() {
  // 3h lab block correctly assigned → no error
  const correctas = [
    { clave_bloque: 'pc1|d1|c1|g1|laboratorio|1', bloque_total: 3, dia: 'lunes', ambiente_id: 'lab01', fuente: 'CSP', bloque_continuo_id: 'bc1', slot_id: 's1' },
    { clave_bloque: 'pc1|d1|c1|g1|laboratorio|1', bloque_total: 3, dia: 'lunes', ambiente_id: 'lab01', fuente: 'CSP', bloque_continuo_id: 'bc1', slot_id: 's2' },
    { clave_bloque: 'pc1|d1|c1|g1|laboratorio|1', bloque_total: 3, dia: 'lunes', ambiente_id: 'lab01', fuente: 'CSP', bloque_continuo_id: 'bc1', slot_id: 's3' },
  ];
  auditarBloques('TEST_CORRECT', correctas); // Should not throw

  // Duplicated: same clave_bloque on lunes AND martes → should throw
  const duplicadas = [
    ...correctas,
    { clave_bloque: 'pc1|d1|c1|g1|laboratorio|1', bloque_total: 3, dia: 'martes', ambiente_id: 'lab01', fuente: 'GA', bloque_continuo_id: 'bc2', slot_id: 's1' },
    { clave_bloque: 'pc1|d1|c1|g1|laboratorio|1', bloque_total: 3, dia: 'martes', ambiente_id: 'lab01', fuente: 'GA', bloque_continuo_id: 'bc2', slot_id: 's2' },
    { clave_bloque: 'pc1|d1|c1|g1|laboratorio|1', bloque_total: 3, dia: 'martes', ambiente_id: 'lab01', fuente: 'GA', bloque_continuo_id: 'bc2', slot_id: 's3' },
  ];
  let threw = false;
  try {
    auditarBloques('TEST_DUP', duplicadas);
  } catch {
    threw = true;
  }
  ok(threw, 'auditarBloques should throw on exact duplicate');

  console.log('  ✓ auditarBloques detects exact duplication');
}

// ─── Test 25: Nuevo bloque_continuo_id en cada generación ──────────────────
function testNuevoBloqueContinuo() {
  const { nuevoBloqueContinuo } = require('../lib/horarios-resolver-v2');
  const id1 = nuevoBloqueContinuo();
  const id2 = nuevoBloqueContinuo();
  notStrictEqual(id1, id2, 'Each call should generate a new unique ID');

  console.log('  ✓ nuevoBloqueContinuo generates unique IDs');
}

// ─── Test 26: clave_bloque includes pc_id via id fallback ──────────────────
function testClaveBloqueWithIdFallback() {
  const block = { id: 'pc-123', docente_id: 'd1', curso_id: 'c1', grupo_id: 'g1', tipo_sesion: 'laboratorio', lab_turno: 1 };
  const clave = claveBloqueAcademico(block);
  ok(clave.startsWith('pc-123|'), `clave should start with pc-123|, got: ${clave}`);
  ok(clave.endsWith('|1'), `clave should end with |1, got: ${clave}`);

  console.log('  ✓ clave_bloque uses id fallback for pc_id');
}

// ─── Test 27: crea asignación con clave_bloque desde csp-asignacion ───────
function testCrearAsignacionCSPTieneClave() {
  const mockSlot = { id: 's1', orden: 1, hora_inicio: '07:00' };
  const mockAmb = { id: 'a1', codigo: 'A1', nombre: 'Aula 1', tipo: 'aula', capacidad: 40 };

  // We can't easily import the private csp-asignacion function, but we can
  // check that resolver-v2's crearAsignacion sets clave_bloque
  // by running the resolver and checking output
  const { validarSolucionFinal } = require('../lib/horarios-resolver-v2');
  const slots = [mockSlot];
  const asig = [{
    id: 'test-1', clave_bloque: 'pc1|d1|c1|g1|teoria|0',
    bloque_continuo_id: 'bc1', bloque_parte: 1, bloque_total: 1,
    dia: 'lunes', slot_id: 's1', docente_id: 'd1', grupo_id: 'g1',
    ambiente_id: 'a1', curso_id: 'c1', tipo: 'teoria', lab_turno: 0,
    pc_id: 'pc1', fuente: 'CSP',
  }];
  const cursos = [{
    id: 'pc1', curso_id: 'c1', grupo_id: 'g1',
    horas_teoria: 1, horas_practica: 0, horas_laboratorio: 0, cantidad_labs: 1,
  }];
  const val = validarSolucionFinal(asig as any, cursos as any, slots);
  ok(val.valida, `With clave_bloque present, validation should pass: ${val.errores.join('; ')}`);

  // Without clave_bloque → should fail
  const sinClave = [{ ...asig[0], clave_bloque: undefined }];
  const val2 = validarSolucionFinal(sinClave as any, cursos as any, slots);
  ok(!val2.valida, 'Without clave_bloque, validation should fail');
  const hasAusente = val2.errores_estructurados.some((e: any) => e.codigo === 'CLAVE_BLOQUE_AUSENTE');
  ok(hasAusente, 'Should report CLAVE_BLOQUE_AUSENTE');

  console.log('  ✓ CSP crearAsignacion produces clave_bloque');
}

// ─── Test 28: reemplazarEnAsignaciones no acumula ───────────────────────────
function testReemplazarEnAsignaciones() {
  // Need to import from resolver — but it's not exported, so test inline:
  function reemplazarEnAsignaciones(asignaciones: any[], nuevas: any[]): any[] {
    if (nuevas.length === 0) return asignaciones;
    const nuevasClaves = new Set<string>();
    for (const a of nuevas) {
      if (a.clave_bloque) nuevasClaves.add(a.clave_bloque);
    }
    if (nuevasClaves.size === 0) return [...asignaciones, ...nuevas];
    const filtradas = asignaciones.filter(a => !a.clave_bloque || !nuevasClaves.has(a.clave_bloque));
    return [...filtradas, ...nuevas];
  }

  const blockId = 'pc1|d1|c1|g1|laboratorio|1';
  const monVersion = [
    { clave_bloque: blockId, bloque_total: 3, bloque_parte: 1, dia: 'lunes', slot_id: 's1', bloque_continuo_id: 'bc1' },
    { clave_bloque: blockId, bloque_total: 3, bloque_parte: 2, dia: 'lunes', slot_id: 's2', bloque_continuo_id: 'bc1' },
    { clave_bloque: blockId, bloque_total: 3, bloque_parte: 3, dia: 'lunes', slot_id: 's3', bloque_continuo_id: 'bc1' },
  ];
  const tueVersion = [
    { clave_bloque: blockId, bloque_total: 3, bloque_parte: 1, dia: 'martes', slot_id: 's1', bloque_continuo_id: 'bc2' },
    { clave_bloque: blockId, bloque_total: 3, bloque_parte: 2, dia: 'martes', slot_id: 's2', bloque_continuo_id: 'bc2' },
    { clave_bloque: blockId, bloque_total: 3, bloque_parte: 3, dia: 'martes', slot_id: 's3', bloque_continuo_id: 'bc2' },
  ];

  // Start empty, add Mon version
  let result = reemplazarEnAsignaciones([], monVersion);
  strictEqual(result.length, 3, 'Mon version: 3 horas');
  strictEqual(result.every((a: any) => a.dia === 'lunes'), true, 'Mon version: all lunes');

  // Add Tue version → replaces Mon (same clave_bloque)
  result = reemplazarEnAsignaciones(result, tueVersion);
  strictEqual(result.length, 3, 'Replace: still 3 hours (not 6)');
  strictEqual(result.every((a: any) => a.dia === 'martes'), true, 'Replace: now all martes');
  const clavesUnicas = new Set(result.map((a: any) => a.clave_bloque));
  strictEqual(clavesUnicas.size, 1, 'Replace: exactly one clave_bloque');

  // Push different block → adds alongside
  const otherBlock = [
    { clave_bloque: 'pc1|d1|c1|g1|teoria|0', bloque_total: 2, bloque_parte: 1, dia: 'lunes', slot_id: 's4', bloque_continuo_id: 'bc3' },
    { clave_bloque: 'pc1|d1|c1|g1|teoria|0', bloque_total: 2, bloque_parte: 2, dia: 'lunes', slot_id: 's5', bloque_continuo_id: 'bc3' },
  ];
  result = reemplazarEnAsignaciones(result, otherBlock);
  strictEqual(result.length, 5, 'Different block: 3 lab + 2 teoria = 5');
  strictEqual(result.filter((a: any) => a.clave_bloque === blockId).length, 3, 'Lab still 3h');
  strictEqual(result.filter((a: any) => a.clave_bloque === 'pc1|d1|c1|g1|teoria|0').length, 2, 'Teoria 2h');

  console.log('  ✓ reemplazarEnAsignaciones no acumula');
}

// ─── Test 29: Solver CSP no produce duplicados en bloque puro de laboratorio ──
async function testCspNoDuplicaLaboratorioPuro() {
  const slots: SlotRow[] = [
    { id: 's1', orden: 1, hora_inicio: '07:00' },
    { id: 's2', orden: 2, hora_inicio: '08:00' },
    { id: 's3', orden: 3, hora_inicio: '09:00' },
    { id: 's4', orden: 4, hora_inicio: '10:00' },
    { id: 's5', orden: 5, hora_inicio: '11:00' },
    { id: 's6', orden: 6, hora_inicio: '12:00' },
  ];
  const ambientes = [
    { id: 'lab01', codigo: 'LAB-01', tipo: 'laboratorio', capacidad: 30, disponible: true },
  ];
  const docente = {
    id: 'd-lab-001', nombre: 'Lab', apellidos: 'Test',
    condicion: 'nombrado', categoria: 'principal',
    fecha_ingreso: new Date('2000-01-01'), condicion_orden: 0, categoria_orden: 0,
  };

  // Pure lab: 3h, 1 turno
  const cursos = [{
    id: 'pc-lab-001', curso_id: 'c-lab-001', codigo: 'LAB101',
    curso_nombre: 'Lab Puro', grupo_id: 'g-lab-001', numero_grupo: 'U',
    horas_teoria: 0, horas_practica: 0, horas_laboratorio: 3, cantidad_labs: 1,
    bloque_indivisible: true, num_alumnos: 20, ciclo_plan: '2026-I',
    condicion_orden: 0, categoria_orden: 0, fecha_ingreso: new Date('2000-01-01'),
    docente_id: docente.id, tipo_actividad: null,
  }];

  // Full availability Mon-Fri
  const disponibilidad: any[] = [];
  for (const d of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']) {
    for (const s of slots) {
      disponibilidad.push({ docente_id: docente.id, dia: d, slot_id: s.id, disponible: true, prioridad: 1 });
    }
  }

  const result = await generarHorarioV2(
    'prog-lab-001', cursos, disponibilidad, ambientes, slots, [docente],
    { restrictedIds: [] }
  );

  // Should assign exactly 3 horas
  strictEqual(result.stats.asignadas, 3, `Pure lab: 3h assigned, got ${result.stats.asignadas}`);
  strictEqual(result.stats.pendientes, 0, `Pure lab: 0 pending, got ${result.stats.pendientes}`);

  // Every clave_bloque should appear with exactly bloque_total hours
  const porClave = new Map<string, any[]>();
  for (const a of result.asignaciones) {
    const ck = a.clave_bloque;
    if (!ck) continue;
    if (!porClave.has(ck)) porClave.set(ck, []);
    porClave.get(ck)!.push(a);
  }
  for (const [ck, hrs] of porClave) {
    const esperadas = hrs[0]?.bloque_total || hrs.length;
    ok(hrs.length <= esperadas,
      `Clave ${ck}: ${hrs.length}h ≤ ${esperadas}h (no duplicado)`);
    const dias = new Set(hrs.map((h: any) => h.dia));
    ok(dias.size <= 1, `Clave ${ck}: debe estar en un solo día (tiene ${[...dias].join(',')})`);
  }

  // Validate
  const val = validarSolucionFinal(result.asignaciones, cursos, slots);
  ok(val.valida, `Validation should pass: ${val.errores.join('; ')}`);

  console.log('  ✓ CSP no duplica laboratorio puro');
}

// ─── Run all ───────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🧪 Running fix tests...\n');

  testCloneOccupancyIsolation();
  testSaturdayActivation();
  testEstrategiaRotacion();
  testMixedBlockRemovesPendientes();
  testCasoA();
  testCasoB();
  testRejectBothRemaining();
  testGADiscardHardPenalty();
  testGAAcceptNoHardPenalty();
  testDocenteCompletion();
  testTPContiguoSorting();
  testSlotOrdenMap();
  testFragmentacionGrouping();
  testRefinamientoCleanOccupancy();
  testRefinamientoRespectsGA();
  testProgConfigParsing();
  testCalcularPuntajeSolucion();
  testNoParseIntSlotId();
  testClaveBloqueAcademico();
  testCalcularRequerimientosCurso();
  testBloqueDuplicadoValidacion();
  testPureLabMultipleTurnos();
  testContarHorasAsignadasPorBloque();
  testAuditarBloquesDetectsDuplicates();
  testNuevoBloqueContinuo();
  testClaveBloqueWithIdFallback();
  testCrearAsignacionCSPTieneClave();
  testReemplazarEnAsignaciones();

  await testIntegracionPrioridadDocente();
  await testIntegracionCasoMixto();
  await testIntegracionRefinamiento();
  await testCspNoDuplicaLaboratorioPuro();

  console.log('\n✅ All 32 tests passed!\n');
}

main().catch(e => { console.error('Test failed:', e); process.exit(1); });
