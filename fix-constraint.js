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
    
    // Eliminar las restricciones de check si existen
    console.log('\n🔄 Actualizando restricciones...');
    await sequelize.query(`ALTER TABLE ciclos DROP CONSTRAINT IF EXISTS "ciclos_semestre_check" CASCADE;`);
    await sequelize.query(`ALTER TABLE ciclos DROP CONSTRAINT IF EXISTS "ciclos_semestre_tipo_ck" CASCADE;`);
    console.log('✅ Restricciones de check eliminadas exitosamente!');
    
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
