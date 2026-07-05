
// apply_migration.js
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function main() {
  const sql = readFileSync(join(__dirname, 'lib', 'migrations', '016_add_no_lectiva_scheduling.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✅ MIGRACIÓN APLICADA EXITOSAMENTE!');
  } catch (err) {
    console.error('❌ ERROR:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
