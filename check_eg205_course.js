const { Pool } = require('pg');
const p = new Pool({
  user: 'postgres',
  password: '12345',
  host: 'localhost',
  database: 'horariosUNT'
});

async function main() {
  try {
    const res = await p.query(`
      SELECT * FROM cursos WHERE codigo = 'EG-205'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    p.end();
  }
}
main();
