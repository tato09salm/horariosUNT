module.exports = {
      up: async (qi, S) => {
        await qi.createTable('slots_tiempo', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          nombre: { type: S.STRING(20), allowNull: false },
          hora_inicio: { type: S.TIME, allowNull: false },
          hora_fin: { type: S.TIME, allowNull: false },
          orden: { type: S.INTEGER, allowNull: false }
        });
        await qi.addConstraint('slots_tiempo', { fields: ['hora_inicio', 'hora_fin'], type: 'unique' });
      },
      down: async qi => qi.dropTable('slots_tiempo')
    };