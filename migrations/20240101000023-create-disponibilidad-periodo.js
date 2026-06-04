module.exports = {
  up: async (qi, S) => {
    await qi.createTable('disponibilidad_periodo', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      programacion_id: { type: S.UUID, references: { model: 'programaciones', key: 'id' }, onDelete: 'CASCADE' },
      fecha_inicio: { type: S.DATE, allowNull: false },
      fecha_cierre: { type: S.DATE, allowNull: false },
      notificacion_enviada: { type: S.BOOLEAN, defaultValue: false },
      creado_por: { type: S.UUID, references: { model: 'usuarios', key: 'id' } },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });
    await qi.addConstraint('disponibilidad_periodo', { 
      fields: ['programacion_id'], 
      type: 'unique',
      name: 'disponibilidad_periodo_programacion_id_uk'
    });
    await qi.addIndex('disponibilidad_periodo', ['programacion_id'], { name: 'idx_disp_periodo_prog' });
  },
  down: async qi => qi.dropTable('disponibilidad_periodo')
};
