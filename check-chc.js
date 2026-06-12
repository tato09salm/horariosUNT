
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
    console.log('Checking carga_horaria_cursos:');
    const chcData = await pool.query('SELECT * FROM carga_horaria_cursos');
    console.log(chcData.rows);

    console.log('\nChecking carga_horaria_preparacion etc.:');
    for (const s of ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites']) {
      const data = await pool.query(`SELECT * FROM carga_horaria_${s}`);
      console.log(`${s}:`, data.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
