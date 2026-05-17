module.exports = {
      up: async (qi, S) => {
        await qi.createTable('docentes', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          usuario_id: { type: S.UUID, references: { model: 'usuarios', key: 'id' }, onDelete: 'SET NULL' },
          nombre: { type: S.STRING(100), allowNull: false },
          apellidos: { type: S.STRING(150), allowNull: false },
          dni: { type: S.STRING(8), allowNull: false, unique: true },
          email: { type: S.STRING(200) },
          telefono: { type: S.STRING(15) },
          categoria: { type: 'categoria_docente', allowNull: false },
          condicion: { type: 'condicion_docente', allowNull: false },
          fecha_ingreso: { type: S.DATEONLY, allowNull: false },
          grado_academico: { type: 'tipo_grado' },
          horas_max_semana: { type: S.INTEGER, defaultValue: 20 },
          activo: { type: S.BOOLEAN, defaultValue: true },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
          updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
      },
      down: async qi => qi.dropTable('docentes')
    };