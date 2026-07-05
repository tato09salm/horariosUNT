
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  console.log('=== Checking DB ===');
  
  console.log('\n--- Carga Horaria ---');
  const chResult = await pool.query('SELECT * FROM carga_horaria ORDER BY created_at DESC LIMIT 5');
  console.table(chResult.rows);

  console.log('\n--- Carga Horaria Cursos ---');
  const chcResult = await pool.query('SELECT * FROM carga_horaria_cursos ORDER BY created_at DESC LIMIT 10');
  console.table(chcResult.rows);

  console.log('\n--- Cursos ---');
  const cursoResult = await pool.query('SELECT id, codigo, nombre, ciclo_plan FROM cursos WHERE activo = true LIMIT 10');
  console.table(cursoResult.rows);

  await pool.end();
}

main().catch(console.error);
