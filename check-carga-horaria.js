
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
    console.log('=== carga_horaria ===');
    const cargaHoraria = await pool.query('SELECT * FROM carga_horaria');
    console.log(cargaHoraria.rows);

    console.log('\n=== carga_horaria_cursos ===');
    const cargaHorariaCursos = await pool.query('SELECT * FROM carga_horaria_cursos');
    console.log(cargaHorariaCursos.rows);

    console.log('\n=== docentes (first 5) ===');
    const docentes = await pool.query('SELECT id, nombre, apellidos, dni FROM docentes LIMIT 5');
    console.log(docentes.rows);

    console.log('\n=== cursos (first 5) ===');
    const cursos = await pool.query('SELECT id, codigo, nombre, ciclo_plan FROM cursos LIMIT 5');
    console.log(cursos.rows);

    console.log('\n=== ciclos ===');
    const ciclos = await pool.query('SELECT * FROM ciclos');
    console.log(ciclos.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
