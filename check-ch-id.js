
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
    const result = await pool.query('SELECT * FROM carga_horaria WHERE id = $1', [chId]);
    console.log('carga_horaria with id', chId, 'exists:', result.rows.length > 0);
    if (result.rows.length > 0) {
      console.log('data:', result.rows[0]);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
