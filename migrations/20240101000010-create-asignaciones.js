module.exports = {
      up: async (qi, S) => {
        await qi.createTable('asignaciones', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          ciclo_id: { type: S.UUID, references: { model: 'ciclos', key: 'id' }, onDelete: 'CASCADE' },
          grupo_id: { type: S.UUID, references: { model: 'grupos', key: 'id' }, onDelete: 'CASCADE' },
          docente_id: { type: S.UUID, references: { model: 'docentes', key: 'id' } },
          ambiente_id: { type: S.UUID, references: { model: 'ambientes', key: 'id' } },
          slot_id: { type: S.UUID, references: { model: 'slots_tiempo', key: 'id' } },
          dia: { type: 'dia_semana', allowNull: false },
          tipo: { type: 'tipo_sesion', allowNull: false, defaultValue: 'teoria' },
          estado: { type: S.STRING(20), defaultValue: 'activo' },
          created_by: { type: S.UUID, references: { model: 'usuarios', key: 'id' } },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
          updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.sequelize.query(`CREATE UNIQUE INDEX idx_asig_docente_dia_slot ON asignaciones(docente_id, dia, slot_id, ciclo_id) WHERE estado = 'activo';`);
        await qi.sequelize.query(`CREATE UNIQUE INDEX idx_asig_ambiente_dia_slot ON asignaciones(ambiente_id, dia, slot_id, ciclo_id) WHERE estado = 'activo';`);
        await qi.sequelize.query(`CREATE UNIQUE INDEX idx_asig_grupo_dia_slot ON asignaciones(grupo_id, dia, slot_id, ciclo_id) WHERE estado = 'activo';`);
      },
      down: async qi => qi.dropTable('asignaciones')
    };