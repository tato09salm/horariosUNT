const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '12345', database: 'horariosUNT' });
(async () => {
  const r = await pool.query(`
    SELECT a.id, a.dia, a.grupo_id, a.docente_id,
      g.numero_grupo, g.curso_id,
      c.codigo as curso_codigo, c.nombre as curso_nombre
    FROM programacion_asignaciones a
    JOIN grupos g ON g.id = a.grupo_id
    JOIN cursos c ON c.id = g.curso_id
    WHERE a.programacion_id = $1 AND a.docente_id = $2
    LIMIT 10
  `, ['df7bbb0a-7128-43bb-8d1e-cbddc654c19f', 'ce5fc09a-82ce-4f00-9f71-a9681bad442f']);
  console.log('count:', r.rows.length);
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
