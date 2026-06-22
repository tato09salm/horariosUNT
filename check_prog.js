const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '12345', database: 'horariosUNT' });
(async () => {
  const r = await pool.query("SELECT id, nombre, ciclo_id, estado FROM programaciones WHERE ciclo_id = $1 LIMIT 5", ['1aa1362d-85da-4779-9ad2-ed04bf547f57']);
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();
