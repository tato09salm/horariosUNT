
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function addColumns() {
  const client = await pool.connect();
  try {
    console.log('Adding facultad column...');
    await client.query(`
      ALTER TABLE docentes
      ADD COLUMN IF NOT EXISTS facultad VARCHAR(200)
    `);
    
    console.log('Adding dpto_academico column...');
    await client.query(`
      ALTER TABLE docentes
      ADD COLUMN IF NOT EXISTS dpto_academico VARCHAR(200)
    `);
    
    console.log('✅ Columnas agregadas exitosamente!');
  } catch (err) {
    console.error('❌ Error al agregar columnas:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns();
