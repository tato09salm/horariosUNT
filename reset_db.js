const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'horariosUNT',
  user: 'postgres',
  password: 'sa',
});

async function reset() {
  try {
    console.log('Cargando archivo SQL...');
    const sqlPath = path.join(__dirname, 'lib', 'schema-data-real.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Limpiando base de datos...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    
    console.log('Ejecutando schema y cargando datos reales...');
    await pool.query(sql);
    
    console.log('Base de datos reseteada exitosamente con datos reales.');
  } catch (error) {
    console.error('Error durante el reset:', error);
  } finally {
    await pool.end();
  }
}

reset();
