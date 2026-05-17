module.exports = {
      up: async (qi, S) => {
        await qi.createTable('auditoria', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          usuario_id: { type: S.UUID, references: { model: 'usuarios', key: 'id' } },
          usuario_nombre: { type: S.STRING(255) },
          usuario_email: { type: S.STRING(255) },
          accion: { type: 'accion_auditoria', allowNull: false },
          tabla_afectada: { type: S.STRING(100) },
          registro_id: { type: S.UUID },
          datos_anteriores: { type: S.JSONB },
          datos_nuevos: { type: S.JSONB },
          ip_address: { type: S.STRING(45) },
          user_agent: { type: S.TEXT },
          descripcion: { type: S.TEXT },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addIndex('auditoria', ['usuario_id'], { name: 'idx_auditoria_usuario' });
        await qi.addIndex('auditoria', ['accion'], { name: 'idx_auditoria_accion' });
        await qi.addIndex('auditoria', ['created_at'], { name: 'idx_auditoria_fecha' });
        await qi.addIndex('auditoria', ['tabla_afectada'], { name: 'idx_auditoria_tabla' });
      },
      down: async qi => qi.dropTable('auditoria')
    };