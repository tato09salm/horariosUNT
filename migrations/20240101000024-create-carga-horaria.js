module.exports = {
  up: async (qi, S) => {
    await qi.createTable('carga_horaria', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      docente_id: { type: S.UUID, references: { model: 'docentes', key: 'id' }, allowNull: false },
      ciclo_academico_id: { type: S.UUID, references: { model: 'ciclos', key: 'id' }, allowNull: false },
      ciclo_plan: { type: S.INTEGER, allowNull: false },
      horas_asignadas: { type: S.INTEGER, defaultValue: 0 },
      activo: { type: S.BOOLEAN, defaultValue: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // Unique constraint: a docente can only have one carga horaria entry per ciclo academico and ciclo plan
    await qi.addConstraint('carga_horaria', {
      type: 'unique',
      fields: ['docente_id', 'ciclo_academico_id', 'ciclo_plan'],
      name: 'unique_docente_ciclo_academico_ciclo_plan'
    });

    // Index for faster queries
    await qi.addIndex('carga_horaria', ['ciclo_academico_id', 'ciclo_plan'], {
      name: 'idx_carga_horaria_ciclo_academico_ciclo_plan'
    });
  },
  down: async qi => {
    await qi.dropTable('carga_horaria');
  }
};
