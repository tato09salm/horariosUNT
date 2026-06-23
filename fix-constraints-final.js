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
    console.log('🔄 Reinstalando restricciones importantes...');
    
    // 1. Reinstalar PRIMARY KEY
    await sequelize.query(`
      ALTER TABLE ciclos 
      ADD CONSTRAINT ciclos_pkey PRIMARY KEY (id);
    `);
    console.log('✅ Restricción PRIMARY KEY reinstalada');
    
    // 2. Reinstalar UNIQUE constraint para nombre
    await sequelize.query(`
      ALTER TABLE ciclos 
      ADD CONSTRAINT ciclos_nombre_key UNIQUE (nombre);
    `);
    console.log('✅ Restricción UNIQUE para nombre reinstalada');
    
    console.log('\n✅ Todas las restricciones están correctas ahora!');
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  }
})();
