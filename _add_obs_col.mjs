import pg from 'pg';
const { Pool } = pg;
const p = new Pool({host:'localhost',port:5432,database:'horariosUNT',user:'postgres',password:'12345'});
try {
  await p.query("ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS observaciones TEXT");
  console.log('Column observaciones added');
} catch(e) {
  console.error('Error:', e.message);
}
const r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='carga_horaria_cursos' ORDER BY ordinal_position");
console.log('Columns:', JSON.stringify(r.rows.map(c => c.column_name)));
await p.end();
