module.exports = {
  up: async (qi, S) => {
    await qi.createTable('roles', {
      codigo: { type: S.STRING(50), allowNull: false, primaryKey: true },
      nombre: { type: S.STRING(100), allowNull: false, unique: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });
  },
  down: async qi => qi.dropTable('roles')
};
