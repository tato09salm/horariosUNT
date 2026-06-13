
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
    console.log('--- 1. Check carga_horaria ---');
    const carga = await pool.query('SELECT * FROM carga_horaria');
    console.log(carga.rows);

    console.log('\n--- 2. Check carga_horaria_cursos ---');
    const cursos = await pool.query('SELECT * FROM carga_horaria_cursos');
    console.log(cursos.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
