
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    console.log('=== CHECKING JUAN PEDRO SANTOS FERNÁNDEZ ===');
    const docentesResult = await pool.query("SELECT * FROM docentes WHERE apellidos ILIKE '%SANTOS FERNÁNDEZ%'");
    console.log('\nDocente encontrado:');
    console.table(docentesResult.rows);

    if (docentesResult.rows.length > 0) {
      const docenteId = docentesResult.rows[0].id;
      console.log(`\nChecking carga horaria for docente ${docenteId}...`);
      const cargaResult = await pool.query(`SELECT ch.*, ca.nombre as ciclo_nombre FROM carga_horaria ch JOIN ciclos ca ON ch.ciclo_academico_id = ca.id WHERE ch.docente_id = $1`, [docenteId]);
      console.log('\nCarga horaria encontrada:');
      console.table(cargaResult.rows);

      if (cargaResult.rows.length > 0) {
        const cargaId = cargaResult.rows[0].id;
        console.log(`\nChecking carga_horaria_cursos for carga_horaria ${cargaId}...`);
        const cursosResult = await pool.query(`SELECT chc.*, c.nombre as curso_nombre, c.ciclo_plan FROM carga_horaria_cursos chc JOIN cursos c ON chc.curso_id = c.id WHERE chc.carga_horaria_id = $1`, [cargaId]);
        console.log('\nCursos asignados:');
        console.table(cursosResult.rows);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
