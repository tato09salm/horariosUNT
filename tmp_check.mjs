import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'horariosUNT',
  user: 'postgres', password: '12345', connectionTimeoutMillis: 3000
});
try {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('Tables:', r.rows.map(t => t.table_name).join(', '));
} catch (e) {
  console.error('Error:', e.message);
}
await pool.end();
