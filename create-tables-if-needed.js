
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
    console.log('Checking and creating missing tables...');
    
    // Create carga_horaria_cursos if needed
    const createCargaHorariaCursos = `
      CREATE TABLE IF NOT EXISTS carga_horaria_cursos (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        carga_horaria_id UUID NOT NULL REFERENCES carga_horaria(id) ON DELETE CASCADE,
        curso_id UUID NOT NULL REFERENCES cursos(id),
        seccion VARCHAR(10) DEFAULT 'A',
        escuela VARCHAR(255),
        num_alumnos INTEGER DEFAULT 0,
        hrs_teo INTEGER DEFAULT 0,
        hrs_pra INTEGER DEFAULT 0,
        hrs_lab INTEGER DEFAULT 0,
        total_hrs INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await pool.query(createCargaHorariaCursos);
    console.log('carga_horaria_cursos table ready!');
    
    // Create all the section tables if needed!
    const sectionTables = [
      'preparacion',
      'consejeria',
      'investigacion',
      'capacitacion',
      'gobierno',
      'administracion',
      'asesoria',
      'rsu',
      'comites'
    ];
    
    for (const table of sectionTables) {
      const descColumn = 
        table === 'preparacion' ? 'descripcion' :
        table === 'investigacion' ? 'proyecto' :
        table === 'rsu' ? 'plan' : 'detalles';
        
      const createTable = `
        CREATE TABLE IF NOT EXISTS carga_horaria_${table} (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          carga_horaria_id UUID NOT NULL REFERENCES carga_horaria(id) ON DELETE CASCADE UNIQUE,
          horas INTEGER DEFAULT 0,
          ${descColumn} TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      await pool.query(createTable);
      console.log(`carga_horaria_${table} table ready!`);
    }
    
    console.log('All tables are set up!');
  } catch (err) {
    console.error('Error setting up tables:', err);
    console.error('Stack:', err.stack);
  } finally {
    await pool.end();
  }
}

main();
