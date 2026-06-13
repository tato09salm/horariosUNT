
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
    console.log('1. Renaming columns in carga_horaria_cursos if needed...');
    // Rename old columns
    const colRenames = [
      ['hrs_teo', 'horas_teoria'],
      ['hrs_pra', 'horas_practica'],
      ['hrs_lab', 'horas_laboratorio'],
      ['total_hrs', 'total_horas']
    ];

    for (const [oldName, newName] of colRenames) {
      try {
        await pool.query(`ALTER TABLE carga_horaria_cursos RENAME COLUMN ${oldName} TO ${newName}`);
        console.log(`Renamed ${oldName} → ${newName}`);
      } catch (e) {
        console.log(`${newName} already exists`);
      }
    }

    // Ensure all columns exist
    const columnsToAdd = [
      'horas_teoria INTEGER DEFAULT 0',
      'horas_practica INTEGER DEFAULT 0',
      'horas_laboratorio INTEGER DEFAULT 0',
      'total_horas INTEGER DEFAULT 0'
    ];
    for (const col of columnsToAdd) {
      try {
        await pool.query(`ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS ${col}`);
      } catch (e) {
        console.log('Column already there');
      }
    }
    console.log('✅ carga_horaria_cursos columns fixed');
    console.log('\nAll done!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

main();
