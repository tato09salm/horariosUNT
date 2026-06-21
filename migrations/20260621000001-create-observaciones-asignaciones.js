module.exports = {
  up: async (qi, S) => {
    await qi.createTable('observaciones_asignaciones', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      asignacion_id: { type: S.UUID, allowNull: false },
      docente_id: { type: S.UUID, allowNull: false },
      ciclo_id: { type: S.UUID, allowNull: false },
      observaciones: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // Foreign keys
    await qi.addConstraint('observaciones_asignaciones', {
      type: 'foreign key',
      name: 'fk_obs_asignacion',
      fields: ['asignacion_id'],
      references: { table: 'asignaciones', field: 'id' },
      onDelete: 'CASCADE'
    });

    await qi.addConstraint('observaciones_asignaciones', {
      type: 'foreign key',
      name: 'fk_obs_docente',
      fields: ['docente_id'],
      references: { table: 'docentes', field: 'id' },
      onDelete: 'CASCADE'
    });

    await qi.addConstraint('observaciones_asignaciones', {
      type: 'foreign key',
      name: 'fk_obs_ciclo',
      fields: ['ciclo_id'],
      references: { table: 'ciclos', field: 'id' },
      onDelete: 'CASCADE'
    });

    // Unique constraint: una observación por asignación
    await qi.addConstraint('observaciones_asignaciones', {
      type: 'unique',
      name: 'unique_obs_asignacion',
      fields: ['asignacion_id']
    });

    // Indexes para consultas frecuentes
    await qi.addIndex('observaciones_asignaciones', ['docente_id'], {
      name: 'idx_obs_docente'
    });

    await qi.addIndex('observaciones_asignaciones', ['ciclo_id'], {
      name: 'idx_obs_ciclo'
    });
  },

  down: async qi => {
    await qi.dropTable('observaciones_asignaciones');
  }
};
