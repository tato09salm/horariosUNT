const { Sequelize } = require('sequelize');
require('dotenv').config({ path: '.env.local' });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false
  }
);

(async () => {
  try {
    console.log('🔍 Verificando restricciones de la tabla ciclos...');
    
    // Ver todas las restricciones de la tabla
    const [results] = await sequelize.query(`
      SELECT 
        conname, 
        pg_get_constraintdef(oid) AS definition 
      FROM pg_constraint 
      WHERE conrelid = 'ciclos'::regclass;
    `);
    
    console.log('Restricciones encontradas:', results);
    
    // Eliminar la restricción antigua si existe
    console.log('\n🔄 Actualizando restricciones...');
    
    // Intentamos eliminar restricciones relacionadas con semestre primero
    for (const constraint of results) {
      console.log(`👉 Eliminando restricción: ${constraint.conname}`);
      await sequelize.query(`ALTER TABLE ciclos DROP CONSTRAINT IF EXISTS "${constraint.conname}" CASCADE;`);
      console.log(`✅ Restricción ${constraint.conname} eliminada`);
    }
    
    // Agregar la nueva restricción
    await sequelize.query(`
      ALTER TABLE ciclos 
      ADD CONSTRAINT ciclos_semestre_check 
      CHECK (
        (tipo = 'regular' AND semestre IN ('I', 'II')) OR
        (tipo = 'extraordinario' AND semestre IN ('EXT'))
      );
    `);
    console.log('✅ Nueva restricción agregada exitosamente!');
    
    // Verificar la estructura final
    const [finalResults] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'ciclos'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n✅ Estructura final de la tabla ciclos:', finalResults);
    
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
})();
