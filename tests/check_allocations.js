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
      SELECT a.*, d.dni, d.nombre, d.apellidos, cu.codigo, cu.nombre as curso_nombre
      FROM asignaciones a
      JOIN grupos g ON a.grupo_id = g.id
      JOIN cursos cu ON g.curso_id = cu.id
      JOIN docentes d ON a.docente_id = d.id
      WHERE cu.codigo = 'EG-205' AND a.estado = 'activo'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    p.end();
  }
}
main();
