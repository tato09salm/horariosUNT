import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: 'localhost', port: 5432, database: 'horariosUNT',
  user: 'postgres', password: '12345', connectionTimeoutMillis: 3000
});
try {
  const r = await pool.query("SELECT id, nombre, ciclo_id FROM programaciones ORDER BY created_at DESC LIMIT 5");
  console.log('Programaciones:', JSON.stringify(r.rows, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
await pool.end();
