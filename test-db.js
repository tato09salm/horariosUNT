
const { Pool } = require('pg');
require('dotenv').config();

console.log('DB config (partial):', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function test() {
  try {
    console.log('Connecting to DB...');
    const res = await pool.query('SELECT id, nombre, apellidos, facultad, dpto_academico FROM docentes LIMIT 5');
    console.log('✅ Docentes from DB (limit 5):');
    res.rows.forEach((row, i) => {
      console.log(`\n📋 ${i+1}. ${row.nombre} ${row.apellidos} (ID: ${row.id})`);
      console.log('   facultad:', JSON.stringify(row.facultad));
      console.log('   dpto_academico:', JSON.stringify(row.dpto_academico));
    });
    
    // Also check all column names in docentes
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'docentes' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\n📊 All columns in docentes table:');
    console.log(columnsRes.rows.map(c => `${c.column_name} (${c.data_type})`));
    
  } catch (err) {
    console.error('❌ Error querying DB:', err);
  } finally {
    await pool.end();
    console.log('\n✅ Connection closed');
  }
}

test();
