import { Pool } from 'pg';
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'horariosUNT',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
});

async function main() {
  const PROG_ID = '11b92901-3a77-4261-9f34-6eaf609f4b05';

  const rCursos = await pool.query(`
    SELECT pc.*, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
           cu.bloque_indivisible, cu.cantidad_labs,
           g.numero_grupo, g.num_alumnos,
           d.condicion, d.categoria, d.nombre as docente_nombre, d.apellidos as docente_apellidos,
           CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
           CASE d.categoria 
             WHEN 'principal' THEN 0 WHEN 'asociado' THEN 1 
             WHEN 'auxiliar' THEN 2 WHEN 'jefe_practica' THEN 3 ELSE 4
           END as categoria_orden,
           d.fecha_ingreso
    FROM programacion_cursos pc
    JOIN cursos cu ON cu.id = pc.curso_id
    LEFT JOIN grupos g ON g.id = pc.grupo_id
    LEFT JOIN docentes d ON d.id = pc.docente_id
    WHERE pc.programacion_id = $1
      AND pc.docente_id IS NOT NULL
    ORDER BY cu.codigo, g.numero_grupo
  `, [PROG_ID]);
  const cursos = rCursos.rows;
  console.log(`Cursos: ${cursos.length}`);

  const docMap = new Map();
  for (const c of cursos) {
    if (!docMap.has(c.docente_id)) {
      docMap.set(c.docente_id, {
        id: c.docente_id,
        nombre: c.docente_nombre || '',
        apellidos: c.docente_apellidos || '',
        condicion: c.condicion || 'nombrado',
        categoria: c.categoria || 'auxiliar',
        fecha_ingreso: c.fecha_ingreso || new Date('2000-01-01'),
        condicion_orden: c.condicion_orden ?? 0,
        categoria_orden: c.categoria_orden ?? 4,
      });
    }
  }
  const docentesProg = [...docMap.values()];
  console.log(`Docentes: ${docentesProg.length}`);

  const rSlots = await pool.query(`SELECT id, orden, hora_inicio FROM slots_tiempo ORDER BY orden`);
  const slots = rSlots.rows;

  const rAmb = await pool.query(`SELECT id, codigo, nombre, tipo, capacidad FROM ambientes WHERE disponible = true`);
  const ambientes = rAmb.rows;

  const rDisp = await pool.query(`
    SELECT docente_id, dia, slot_id, disponible, prioridad
    FROM disponibilidad_docente WHERE programacion_id = $1
  `, [PROG_ID]);
  const disponibilidad = rDisp.rows;

  // Run resolver
  const resolver = await import('./lib/horarios-resolver-v2');
  const { generarHorarioV2, evaluarSolucionGlobal, esMejorGlobal } = resolver;

  // Track critical blocks assigned per docente
  const LOG_LEVEL = 2;

  console.log('\n=== Ejecutando resolver V2 con FASE 0 ===');
  const result = await generarHorarioV2(
    PROG_ID, cursos, disponibilidad, ambientes, slots, docentesProg,
    { restrictedIds: [] }
  );

  console.log(`\n=== RESULTADO ===`);
  console.log(`Asignadas: ${result.stats.asignadas}/${result.stats.total_horas} (${result.stats.pct_completado}%)`);
  console.log(`Pendientes: ${result.stats.pendientes}`);
  console.log(`Bloques mixtos: ${result.stats.bloques_mixtos}`);

  // Show count by type
  const porTipo: Record<string, number> = {};
  for (const a of result.asignaciones) {
    const t = a.fuente || 'DESCONOCIDO';
    porTipo[t] = (porTipo[t] || 0) + 1;
  }
  console.log(`\n=== Por fuente ===`);
  for (const [t, c] of Object.entries(porTipo).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}h`);
  }

  const porTipoSesion: Record<string, number> = {};
  for (const a of result.asignaciones) {
    const t = a.tipo || a.tipo_sesion || '?';
    porTipoSesion[t] = (porTipoSesion[t] || 0) + 1;
  }
  console.log(`\n=== Por tipo de sesión ===`);
  for (const [t, c] of Object.entries(porTipoSesion).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${c}h`);
  }

  // Show last 20 log lines for critical phase details
  const critLines = result.log.filter((l: string) => l.includes('CRITICO') || l.includes('FASE 0') || l.includes('consolid'));
  console.log(`\n=== LOG DE FASE 0 (${critLines.length} líneas) ===`);
  for (const l of critLines.slice(-30)) console.log(l);

  // Count critical source assignments
  const criticos = result.asignaciones.filter((a: any) => a.fuente?.startsWith('CRITICO'));
  console.log(`\n=== Asignaciones críticas (FASE 0): ${criticos.length}h ===`);

  await pool.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
