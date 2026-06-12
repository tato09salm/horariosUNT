
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
    const chId = '6019642c-0032-48d0-a343-8e33ad79298d';
    await pool.query('UPDATE carga_horaria SET activo = true WHERE id = $1', [chId]);
    console.log('Restored carga_horaria with id', chId);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
