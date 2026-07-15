import { Pool } from 'pg';
const pool = new Pool({
  host: 'localhost', port: 5432,
  database: 'horariosUNT', user: 'postgres', password: '12345',
  connectionTimeoutMillis: 5000,
});
pool.query('SELECT 1 as ok').then(r => {
  console.log('DB OK:', r.rows[0].ok);
  return pool.query('SELECT id, nombre FROM programacion ORDER BY created_at DESC LIMIT 5');
}).then(r2 => {
  console.log('Programaciones:', r2.rows.length);
  for (const p of r2.rows) console.log(`  ${p.id} | ${p.nombre}`);
  return pool.end();
}).catch(e => {
  console.error('DB Error:', e.message);
  process.exit(1);
});
