module.exports = {
  up: async (qi) => {
    try {
      await qi.sequelize.query('ALTER TABLE ciclos DROP CONSTRAINT IF EXISTS ciclos_semestre_check CASCADE;');
      await qi.sequelize.query('ALTER TABLE ciclos DROP CONSTRAINT IF EXISTS ciclos_semestre_tipo_ck CASCADE;');
    } catch (e) {
      console.log('ℹ️ No se pudieron eliminar las restricciones de ciclos:', e.message);
    }
  },
  down: async (qi) => {}
};
