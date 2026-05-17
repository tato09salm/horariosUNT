module.exports = {
      up: async (qi, S) => {
        await qi.createTable('escuelas', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          nombre: { type: S.STRING(200), allowNull: false },
          codigo: { type: S.STRING(20), allowNull: false, unique: true },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
      },
      down: async qi => qi.dropTable('escuelas')
    };