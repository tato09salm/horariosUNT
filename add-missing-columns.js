
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  try {
    console.log('Adding missing columns to carga_horaria...');
    
    // Add facultad
    try {
      await pool.query(`ALTER TABLE carga_horaria ADD COLUMN IF NOT EXISTS facultad TEXT;`);
      console.log('Added facultad column');
    } catch (e) {
      console.warn('facultad column already exists');
    }
    
    // Add dpto_academico
    try {
      await pool.query(`ALTER TABLE carga_horaria ADD COLUMN IF NOT EXISTS dpto_academico TEXT;`);
      console.log('Added dpto_academico column');
    } catch (e) {
      console.warn('dpto_academico column already exists');
    }
    
    // Add modalidad
    try {
      await pool.query(`ALTER TABLE carga_horaria ADD COLUMN IF NOT EXISTS modalidad TEXT;`);
      console.log('Added modalidad column');
    } catch (e) {
      console.warn('modalidad column already exists');
    }
    
    console.log('All columns added!');
  } catch (err) {
      console.error('Error adding columns:', err);
    } finally {
      await pool.end();
    }
  }
  
  main();
  