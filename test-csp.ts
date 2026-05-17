import { generarHorarioCSP } from './lib/horarios-csp';
async function run() {
  console.log("Iniciando CSP...");
  const progId = process.argv[2];
  try {
    const res = await generarHorarioCSP(progId);
    console.log(`Conflictos: ${res.conflictos.length}`);
    res.conflictos.slice(0, 5).forEach(c => console.log("Conflicto:", c));
    console.log(`Asignaciones creadas: ${res.asignaciones.length}`);
    
    // Verifiquemos si respetó los ciclos en la misma franja
    const testOcupacion = new Map();
    let hayParalelo = false;
    for (const a of res.asignaciones) {
      if (!a.ciclo_plan) continue;
      const key = `${a.ciclo_plan}-${a.seccion || 'A'}-${a.dia}-${a.slot_id}`;
      if (testOcupacion.has(key)) {
        const existente = testOcupacion.get(key);
        if (a.tipo !== 'laboratorio' || existente !== 'laboratorio') {
          console.log(`VIOLACIÓN DETECTADA: ${key} (${a.tipo} vs ${existente})`);
          hayParalelo = true;
        }
      }
      testOcupacion.set(key, a.tipo);
    }
    console.log(`¿Solapamiento de ciclos detectado?: ${hayParalelo ? 'SI' : 'NO'}`);
    
    // Check aulas per cycle
    const aulasCiclo = new Map();
    for (const a of res.asignaciones) {
      if (!a.ciclo_plan || a.tipo === 'laboratorio') continue;
      const key = `${a.ciclo_plan}-${a.seccion || 'A'}`;
      if (!aulasCiclo.has(key)) aulasCiclo.set(key, new Set());
      aulasCiclo.get(key).add(a.ambiente_id);
    }
    for (const [ciclo, aulas] of aulasCiclo.entries()) {
      console.log(`Ciclo ${ciclo} usa aulas: ${Array.from(aulas).join(', ')}`);
    }
    
  } catch (e) {
    console.error(e);
  }
}

run();
