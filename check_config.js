const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '12345', database: 'horariosUNT' });
(async () => {
  const r = await pool.query("SELECT id, config FROM programaciones WHERE id = $1", ['df7bbb0a-7128-43bb-8d1e-cbddc654c19f']);
  if (r.rows.length > 0) {
    const config = r.rows[0].config;
    const asigs = (config && config.asignaciones) || [];
    console.log('asignaciones count:', asigs.length);
    const docAsigs = asigs.filter(function(a) { return a.docente_id === 'ce5fc09a-82ce-4f00-9f71-a9681bad442f'; });
    console.log('docente asignaciones:', docAsigs.length);
    if (docAsigs.length > 0) {
      console.log('sample:', JSON.stringify(docAsigs[0], null, 2));
    }
  } else {
    console.log('no programacion found');
  }
  await pool.end();
})();
