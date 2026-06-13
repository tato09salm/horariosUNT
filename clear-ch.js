
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
    console.log('Clearing carga_horaria and all related tables...');
    // ON DELETE CASCADE will clear related tables
    const result = await pool.query('DELETE FROM carga_horaria');
    console.log(`✅ Deleted ${result.rowCount} records from carga_horaria`);
    console.log('All related records also deleted!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

main();
