
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0];
}

async function main() {
  try {
    const chId = '6019642c-0032-48d0-a343-8e33ad79298d';
    console.log('Calling UPDATE carga_horaria SET activo = false WHERE id = $1', chId);
    const cargaHoraria = await queryOne(
      `UPDATE carga_horaria
       SET activo = false, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [chId]
    );
    console.log('Result:', cargaHoraria);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
