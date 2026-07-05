const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'horariosUNT',
  user: 'postgres',
  password: 'sa',
});

async function fix() {
  try {
    console.log('Intentando eliminar la columna "codigo" de la tabla "docentes"...');
    await pool.query('ALTER TABLE docentes DROP COLUMN IF EXISTS codigo;');
    console.log('Columna "codigo" eliminada exitosamente (o ya no existía).');
  } catch (error) {
    console.error('Error al modificar la tabla:', error);
  } finally {
    await pool.end();
  }
}

fix();
