
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
    console.log('1. Checking and creating carga_horaria_cursos');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS carga_horaria_cursos (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        carga_horaria_id UUID NOT NULL REFERENCES carga_horaria(id) ON DELETE CASCADE,
        curso_id UUID NOT NULL REFERENCES cursos(id),
        seccion VARCHAR(10) DEFAULT 'A',
        escuela VARCHAR(255),
        num_alumnos INTEGER DEFAULT 0,
        horas_teoria INTEGER DEFAULT 0,
        horas_practica INTEGER DEFAULT 0,
        horas_laboratorio INTEGER DEFAULT 0,
        total_horas INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ carga_horaria_cursos ready');

    // Section tables
    const sections = [
      { name: 'preparacion', descCol: 'descripcion' },
      { name: 'consejeria', descCol: 'detalles' },
      { name: 'investigacion', descCol: 'proyecto' },
      { name: 'capacitacion', descCol: 'detalles' },
      { name: 'gobierno', descCol: 'detalles' },
      { name: 'administracion', descCol: 'detalles' },
      { name: 'asesoria', descCol: 'detalles' },
      { name: 'rsu', descCol: 'plan' },
      { name: 'comites', descCol: 'detalles' },
    ];

    for (const s of sections) {
      console.log(`2. Checking and creating carga_horaria_${s.name}`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS carga_horaria_${s.name} (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          carga_horaria_id UUID NOT NULL REFERENCES carga_horaria(id) ON DELETE CASCADE UNIQUE,
          horas INTEGER DEFAULT 0,
          ${s.descCol} TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log(`✅ carga_horaria_${s.name} ready`);
    }

    // Check if carga_horaria has all columns
    try {
      await pool.query('ALTER TABLE carga_horaria ADD COLUMN IF NOT EXISTS facultad TEXT');
      await pool.query('ALTER TABLE carga_horaria ADD COLUMN IF NOT EXISTS dpto_academico TEXT');
      await pool.query('ALTER TABLE carga_horaria ADD COLUMN IF NOT EXISTS modalidad TEXT');
      console.log('✅ All columns added to carga_horaria');
    } catch (e) {
      console.log('Columns already exist in carga_horaria');
    }

    console.log('All DB setup complete!');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await pool.end();
  }
}

main();
