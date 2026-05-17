module.exports = {
      up: async (qi, S) => {
        await qi.createTable('ambientes', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          codigo: { type: S.STRING(20), allowNull: false, unique: true },
          nombre: { type: S.STRING(100), allowNull: false },
          tipo: { type: 'tipo_ambiente', allowNull: false },
          capacidad: { type: S.INTEGER, allowNull: false, defaultValue: 30 },
          piso: { type: S.INTEGER, defaultValue: 1 },
          edificio: { type: S.STRING(50) },
          equipamiento: { type: S.ARRAY(S.TEXT) },
          disponible: { type: S.BOOLEAN, defaultValue: true },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
      },
      down: async qi => qi.dropTable('ambientes')
    };