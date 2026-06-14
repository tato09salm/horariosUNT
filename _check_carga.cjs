const { Pool } = require('pg');
const pool = new Pool({host:'localhost',port:5432,database:'horariosUNT',user:'postgres',password:'12345'});
(async () => {
  try {
    const r = await pool.query("SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='carga_horaria')");
    console.log('carga_horaria exists:', r.rows[0].exists);
    if (r.rows[0].exists) {
      const r2 = await pool.query('SELECT count(*) as cnt FROM carga_horaria');
      console.log('carga_horaria rows:', r2.rows[0].cnt);
      const r3 = await pool.query('SELECT count(*) as cnt FROM carga_horaria_cursos');
      console.log('carga_horaria_cursos rows:', r3.rows[0].cnt);
      const r4 = await pool.query("SELECT d.nombre, d.apellidos, d.dni, c.codigo, c.nombre as curso_nombre, chc.hrs_teo, chc.hrs_pra, chc.hrs_lab, chc.teoria_grupos, chc.practica_grupos, chc.laboratorio_grupos FROM carga_horaria_cursos chc JOIN carga_horaria ch ON chc.carga_horaria_id = ch.id JOIN docentes d ON ch.docente_id = d.id JOIN cursos c ON chc.curso_id = c.id WHERE c.codigo = 'EE-101' ORDER BY d.dni, chc.hrs_teo DESC");
      console.log('EE-101 rows:', r4.rows.length);
      console.table(r4.rows);
    }
  } catch(e) { console.error('ERR:', e.message); }
  await pool.end();
})();
