const { sequelize } = require('./models/init-models');

async function fixCicloActivo() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa');

    // Primero desactivar todos los ciclos
    await sequelize.query('UPDATE ciclos SET activo = false');
    console.log('✅ Todos los ciclos desactivados');

    // Activar 2026-I
    const [result] = await sequelize.query(
      'UPDATE ciclos SET activo = true WHERE nombre = $1 RETURNING *',
      { bind: ['2026-I'] }
    );
    
    if (result.length > 0) {
      console.log('✅ Ciclo 2026-I activado correctamente');
      console.log('Ciclo activado:', result[0]);
    } else {
      console.log('⚠️ No se encontró el ciclo 2026-I');
    }

    await sequelize.close();
    console.log('✅ Proceso terminado');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixCicloActivo();
