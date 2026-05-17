module.exports = {
      up: async (qi, S) => {
        await qi.createTable('usuarios', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          nombre: { type: S.STRING(100), allowNull: false },
          apellidos: { type: S.STRING(150), allowNull: false },
          email: { type: S.STRING(200), allowNull: false, unique: true },
          password_hash: { type: S.STRING(255), allowNull: false },
          rol: { type: 'rol_usuario', allowNull: false, defaultValue: 'docente' },
          activo: { type: S.BOOLEAN, defaultValue: true },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
          updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
      },
      down: async qi => qi.dropTable('usuarios')
    };