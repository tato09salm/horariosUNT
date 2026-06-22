const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '12345', database: 'horariosUNT' });
(async () => {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%asign%' OR table_name LIKE '%program%') ORDER BY table_name");
  console.log(r.rows.map(t => t.table_name));
  await pool.end();
})();
