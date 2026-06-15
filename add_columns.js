const { Client } = require('pg');

async function addColumns() {
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    database: 'horariosUNT',
    password: '12345',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Add missing columns to section tables
    const tables = [
      'carga_horaria_preparacion',
      'carga_horaria_consejeria',
      'carga_horaria_investigacion',
      'carga_horaria_capacitacion',
      'carga_horaria_gobierno',
      'carga_horaria_administracion',
      'carga_horaria_asesoria',
      'carga_horaria_rsu',
      'carga_horaria_comites',
    ];

    for (const table of tables) {
      console.log(`Checking columns for ${table}...`);
      // Check if columns exist
      const result = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = $1 AND column_name IN ('dia', 'hora_inicio', 'hora_fin', 'orden')
      `, [table]);

      const existingColumns = result.rows.map(r => r.column_name);
      const missingColumns = [];

      if (!existingColumns.includes('dia')) missingColumns.push('dia');
      if (!existingColumns.includes('hora_inicio')) missingColumns.push('hora_inicio');
      if (!existingColumns.includes('hora_fin')) missingColumns.push('hora_fin');
      if (!existingColumns.includes('orden')) missingColumns.push('orden');

      if (missingColumns.length > 0) {
        console.log(`${table}: Adding columns ${missingColumns.join(', ')}`);
        // Add missing columns
        for (const col of missingColumns) {
          let sql = `ALTER TABLE ${table} ADD COLUMN ${col} `;
          if (col === 'dia') sql += 'VARCHAR(10)';
          else if (col === 'hora_inicio' || col === 'hora_fin') sql += 'TIME';
          else if (col === 'orden') sql += 'INTEGER';
          await client.query(sql);
        }
      } else {
        console.log(`${table}: All columns already exist`);
      }
    }

    // Drop UNIQUE constraints
    console.log('Dropping UNIQUE constraints...');
    for (const table of tables) {
      try {
        await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_carga_horaria_id_key`);
        console.log(`Dropped constraint for ${table}`);
      } catch (err) {
        console.log(`Could not drop constraint for ${table}: ${err.message}`);
      }
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

addColumns();
