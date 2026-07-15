import { query } from './lib/db';
async function main() {
  const r = await query('SELECT id, codigo, nombre, tipo FROM ambientes');
  console.log('Ambientes:', JSON.stringify(r, null, 2));
  console.log('Count:', r.length);
}
main().catch(e => console.error('Error:', e.message));
