module.exports = {
      up: async (qi, S) => {
        await qi.createTable('grupos', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          ciclo_id: { type: S.UUID, references: { model: 'ciclos', key: 'id' } },
          curso_id: { type: S.UUID, references: { model: 'cursos', key: 'id' } },
          numero_grupo: { type: S.INTEGER, allowNull: false, defaultValue: 1 },
          max_alumnos: { type: S.INTEGER, defaultValue: 30 },
          num_alumnos: { type: S.INTEGER, defaultValue: 0 },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addConstraint('grupos', { fields: ['ciclo_id', 'curso_id', 'numero_grupo'], type: 'unique' });
      },
      down: async qi => qi.dropTable('grupos')
    };