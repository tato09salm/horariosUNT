
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
    console.log('Checking carga_horaria columns:');
    const chCols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'carga_horaria' ORDER BY ordinal_position
    `);
    console.log(chCols.rows);

    console.log('\nChecking carga_horaria_cursos columns:');
    const chcCols = await pool.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'carga_horaria_cursos' ORDER BY ordinal_position
    `);
    console.log(chcCols.rows);

    const sectionTables = [
      'preparacion', 'consejeria', 'investigacion', 'capacitacion',
      'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'
    ];

    for (const s of sectionTables) {
      const tableName = `carga_horaria_${s}`;
      console.log(`\nChecking ${tableName}:`);
      try {
        const cols = await pool.query(`
          SELECT column_name, data_type FROM information_schema.columns 
          WHERE table_name = '${tableName}' ORDER BY ordinal_position
        `);
        console.log(cols.rows);
      } catch (e) {
        console.log(`❌ ${tableName} does NOT exist!`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
