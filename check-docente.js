
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
    // First let's get ALL docentes to see what's there
    const allDocentes = await pool.query('SELECT id, nombre, apellidos, activo FROM docentes');
    console.log('=== TODOS LOS DOCENTES ===');
    allDocentes.rows.forEach((d) => {
      console.log(`${d.apellidos}, ${d.nombre} | activo: ${d.activo}`);
    });

    // Now check if "SÁNCHEZ TICONA ROBERT JERRY" is there
    console.log('\n=== BUSCANDO "SÁNCHEZ TICONA ROBERT JERRY" ===');
    const busqueda = await pool.query(
      "SELECT * FROM docentes WHERE nombre ILIKE $1 OR apellidos ILIKE $1",
      ['%SÁNCHEZ%']
    );
    console.log('Resultados:', busqueda.rows);
  } catch (e) {
    console.error('ERROR:', e);
  } finally {
    await pool.end();
  }
}

main();
