
const { Pool } = require('pg');

// Configure your PostgreSQL connection here
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'horarios',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 5432,
});

async function main() {
  console.log('Starting to add missing columns...');
  
  const tables = [
    'carga_horaria_preparacion',
    'carga_horaria_consejeria',
    'carga_horaria_investigacion',
    'carga_horaria_capacitacion',
    'carga_horaria_gobierno',
    'carga_horaria_administracion',
    'carga_horaria_asesoria',
    'carga_horaria_rsu',
    'carga_horaria_comites'
  ];
  
  for (const tableName of tables) {
    console.log(`Processing table: ${tableName}`);
    try {
      // Check and add dia
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = 'dia'
          ) THEN
            ALTER TABLE ${tableName} ADD COLUMN dia TEXT;
            RAISE NOTICE 'Added column dia to %', $1;
          ELSE
            RAISE NOTICE 'Column dia already exists in %', $1;
          END IF;
        END $$;
      `, [tableName]);
      
      // Check and add hora_inicio
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = 'hora_inicio'
          ) THEN
            ALTER TABLE ${tableName} ADD COLUMN hora_inicio TEXT;
            RAISE NOTICE 'Added column hora_inicio to %', $1;
          ELSE
            RAISE NOTICE 'Column hora_inicio already exists in %', $1;
          END IF;
        END $$;
      `, [tableName]);
      
      // Check and add hora_fin
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = 'hora_fin'
          ) THEN
            ALTER TABLE ${tableName} ADD COLUMN hora_fin TEXT;
            RAISE NOTICE 'Added column hora_fin to %', $1;
          ELSE
            RAISE NOTICE 'Column hora_fin already exists in %', $1;
          END IF;
        END $$;
      `, [tableName]);
      
      // Check and add orden
      await pool.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 
            AND column_name = 'orden'
          ) THEN
            ALTER TABLE ${tableName} ADD COLUMN orden INTEGER DEFAULT 0;
            RAISE NOTICE 'Added column orden to %', $1;
          ELSE
            RAISE NOTICE 'Column orden already exists in %', $1;
          END IF;
        END $$;
      `, [tableName]);
      
    } catch (err) {
      console.error(`Error processing table ${tableName}:`, err.message);
    }
  }
  
  console.log('Done!');
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
