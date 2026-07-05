
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
    console.log('Applying migration...');
    
    // Drop old constraint
    console.log('Dropping old unique constraint...');
    await pool.query(`
      ALTER TABLE carga_horaria DROP CONSTRAINT IF EXISTS unique_docente_ciclo_academico_ciclo_plan;
    `);
    
    // Drop old index
    console.log('Dropping old index...');
    await pool.query(`
      DROP INDEX IF EXISTS idx_carga_horaria_ciclo_academico_ciclo_plan;
    `);
    
    // Create new unique constraint
    console.log('Creating new unique constraint...');
    await pool.query(`
      ALTER TABLE carga_horaria ADD CONSTRAINT unique_docente_ciclo_academico 
      UNIQUE (docente_id, ciclo_academico_id);
    `);
    
    // Create new index
    console.log('Creating new index...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_carga_horaria_ciclo_academico 
      ON carga_horaria (ciclo_academico_id);
    `);
    
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
