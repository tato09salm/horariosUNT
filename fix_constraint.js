const { Client } = require('pg');

async function fixConstraint() {
  const client = new Client({
    host: 'localhost',
    user: 'postgres',
    database: 'horariosUNT',
    password: '12345',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Fix the unique constraint
    await client.query(`
      ALTER TABLE carga_horaria DROP CONSTRAINT IF EXISTS unique_docente_ciclo_academico;
    `);
    console.log('Dropped old constraint');

    await client.query(`
      ALTER TABLE carga_horaria ADD CONSTRAINT unique_docente_ciclo_academico_ciclo_plan UNIQUE (docente_id, ciclo_academico_id, ciclo_plan);
    `);
    console.log('Added new constraint with ciclo_plan');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

fixConstraint();
