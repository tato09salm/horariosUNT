module.exports = {
      up: async (qi, S) => {
        await qi.createTable('ciclos', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          nombre: { type: S.STRING(50), allowNull: false, unique: true },
          "año": { type: S.INTEGER, allowNull: false },
          semestre: { type: S.STRING(2), allowNull: false },
          fecha_inicio: { type: S.DATEONLY },
          fecha_fin: { type: S.DATEONLY },
          activo: { type: S.BOOLEAN, defaultValue: false },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addConstraint('ciclos', { fields: ['semestre'], type: 'check', where: { semestre: ['I', 'II'] } });
      },
      down: async qi => qi.dropTable('ciclos')
    };