
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  try {
    console.log('📋 Checking docentes in DB...');
    const docentesRes = await pool.query('SELECT id, nombre, apellidos, facultad, dpto_academico FROM docentes WHERE activo = true LIMIT 5');
    console.log('✅ Docentes:', docentesRes.rows);

    console.log('📋 Checking ciclos in DB...');
    const ciclosRes = await pool.query('SELECT id, nombre, anio, semestre FROM ciclos WHERE activo = true LIMIT 5');
    console.log('✅ Ciclos:', ciclosRes.rows);

    if (docentesRes.rows.length === 0 || ciclosRes.rows.length === 0) {
      console.log('❌ No docentes or ciclos to test with!');
      return;
    }

    const testDocente = docentesRes.rows[0];
    const testCiclo = ciclosRes.rows[0];
    console.log('🎯 Using docente:', testDocente.nombre, testDocente.apellidos, 'id:', testDocente.id);
    console.log('🎯 Using ciclo:', testCiclo.nombre, 'id:', testCiclo.id);

    console.log('🗑️  Deleting existing test carga horarias...');
    await pool.query(`UPDATE carga_horaria SET activo = false WHERE docente_id = $1 AND ciclo_academico_id = $2`, [
      testDocente.id, testCiclo.id
    ]);

    console.log('📝 Inserting test carga horaria...');
    const insertRes = await pool.query(`
      INSERT INTO carga_horaria (
        docente_id, ciclo_academico_id, ciclo_plan, horas_asignadas,
        facultad, dpto_academico, modalidad, activo, created_at, updated_at
      ) VALUES (
        $1, $2, 1, 10, 
        $3, $4, 'Tiempo Completo', true, NOW(), NOW()
      )
      RETURNING *
    `, [
      testDocente.id, testCiclo.id,
      testDocente.facultad, testDocente.dpto_academico
    ]);
    console.log('✅ Test carga horaria inserted:', insertRes.rows[0]);

    console.log('✨ Done! Now refresh the page to see the test data!');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

run();
