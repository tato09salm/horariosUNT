import { Pool } from 'pg';
const pool = new Pool({ connectionTimeoutMillis: 3000 });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
  .then(r => { console.log('Tables:', r.rows.map(t=>t.table_name).join(', ')); return pool.end(); })
  .catch(e => { console.error(e.message); process.exit(1); });
