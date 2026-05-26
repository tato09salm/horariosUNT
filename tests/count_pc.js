const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'horariosUNT',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sa',
  });
  await client.connect();
  
  const resProg = await client.query('SELECT id, nombre, estado FROM programaciones');
  console.log("Programaciones:");
  console.log(resProg.rows);
  
  for (const prog of resProg.rows) {
    const pcCount = await client.query('SELECT COUNT(*) as count FROM programacion_cursos WHERE programacion_id = $1', [prog.id]);
    console.log(`Programacion ${prog.id} (${prog.nombre}): ${pcCount.rows[0].count} cursos (rows count)`);
    
    // Let's count distinct courses
    const distCourses = await client.query('SELECT COUNT(DISTINCT curso_id) as count FROM programacion_cursos WHERE programacion_id = $1', [prog.id]);
    console.log(`Programacion ${prog.id} (${prog.nombre}): ${distCourses.rows[0].count} cursos únicos (distinct curso_id)`);
  }
  
  await client.end();
}

run();
