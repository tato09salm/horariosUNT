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
    console.log('🔍 Verificando estructura de la tabla ciclos...');
    
    // Verificar la longitud actual de la columna semestre
    const [results] = await sequelize.query(`
      SELECT column_name, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'ciclos' 
      AND column_name = 'semestre'
    `);
    
    console.log('Longitud actual de semestre:', results[0]?.character_maximum_length);
    
    if (results[0]?.character_maximum_length <= 2) {
      console.log('🔄 Actualizando columna semestre a VARCHAR(3)...');
      await sequelize.query('ALTER TABLE ciclos ALTER COLUMN semestre TYPE VARCHAR(3);');
      console.log('✅ Columna semestre actualizada exitosamente!');
    } else {
      console.log('✅ La columna semestre ya tiene la longitud correcta!');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
})();
