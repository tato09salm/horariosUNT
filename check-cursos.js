
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
    console.log('=== Cursos ===');
    const cursos = await pool.query('SELECT * FROM cursos WHERE activo = true');
    console.log(cursos.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
