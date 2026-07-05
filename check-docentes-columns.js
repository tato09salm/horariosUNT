
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
    console.log('=== Checking docentes table columns ===');
    const columnsResult = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'docentes'
    `);
    console.log('Columns:', columnsResult.rows.map(r => r.column_name));

    // Now get the docente again without 'codigo'!
    console.log('\n=== Checking SÁNCHEZ docente ===');
    const result = await pool.query(`
      SELECT id, nombre, apellidos, dni, activo 
      FROM docentes 
      WHERE apellidos ILIKE '%SÁNCHEZ%'
    `);
    console.log('Result:', result.rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

main();
