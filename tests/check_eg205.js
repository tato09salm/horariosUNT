const { Pool } = require('pg');
const p = new Pool({
  user: 'postgres',
  password: '12345',
  host: 'localhost',
  database: 'horariosUNT'
});

async function main() {
  try {
    const res = await p.query(`
      SELECT pc.*, d.dni, d.nombre, d.apellidos, cu.codigo, cu.nombre as curso_nombre
      FROM programacion_cursos pc 
      JOIN docentes d ON pc.docente_id = d.id 
      JOIN cursos cu ON pc.curso_id = cu.id 
      WHERE cu.codigo = 'EG-205'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    p.end();
  }
}
main();
