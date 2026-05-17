module.exports = {
      up: async (qi, S) => {
        await qi.createTable('programaciones', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          ciclo_id: { type: S.UUID, references: { model: 'ciclos', key: 'id' }, allowNull: false },
          nombre: { type: S.STRING(100), allowNull: false },
          fase: { type: S.INTEGER, allowNull: false, defaultValue: 1 },
          estado: { type: S.STRING(20), defaultValue: 'borrador' },
          config: { type: S.JSONB, defaultValue: {} },
          created_by: { type: S.UUID, references: { model: 'usuarios', key: 'id' } },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
          updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
          publicado_at: { type: S.DATE },
          publicado_por: { type: S.UUID, references: { model: 'usuarios', key: 'id' } }
        });
        await qi.addConstraint('programaciones', { fields: ['fase'], type: 'check', where: { fase: [1, 2, 3, 4] } });
        await qi.addConstraint('programaciones', { fields: ['estado'], type: 'check', where: { estado: ['borrador','en_disponibilidad','en_programacion','publicado','cancelado'] } });
        await qi.addIndex('programaciones', ['ciclo_id'], { name: 'idx_prog_ciclo' });
        await qi.addIndex('programaciones', ['estado'], { name: 'idx_prog_estado' });

        await qi.createTable('programacion_cursos', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          programacion_id: { type: S.UUID, references: { model: 'programaciones', key: 'id' }, onDelete: 'CASCADE' },
          curso_id: { type: S.UUID, references: { model: 'cursos', key: 'id' } },
          grupo_id: { type: S.UUID, references: { model: 'grupos', key: 'id' } },
          docente_id: { type: S.UUID, references: { model: 'docentes', key: 'id' } },
          horas_teoria: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          horas_practica: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          horas_laboratorio: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          horas_consejeria: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          seccion: { type: S.STRING(10) },
          notas: { type: S.TEXT },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addConstraint('programacion_cursos', { fields: ['programacion_id', 'grupo_id'], type: 'unique' });
        await qi.addIndex('programacion_cursos', ['programacion_id'], { name: 'idx_pc_prog' });

        await qi.createTable('disponibilidad_docente', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          programacion_id: { type: S.UUID, references: { model: 'programaciones', key: 'id' }, onDelete: 'CASCADE' },
          docente_id: { type: S.UUID, references: { model: 'docentes', key: 'id' } },
          slot_id: { type: S.UUID, references: { model: 'slots_tiempo', key: 'id' } },
          dia: { type: 'dia_semana', allowNull: false },
          disponible: { type: S.BOOLEAN, defaultValue: true },
          prioridad: { type: S.INTEGER },
          registrado_por: { type: S.UUID, references: { model: 'usuarios', key: 'id' } },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
          updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addConstraint('disponibilidad_docente', { fields: ['prioridad'], type: 'check', where: { prioridad: [1, 2] } });
        await qi.addConstraint('disponibilidad_docente', { fields: ['programacion_id', 'docente_id', 'slot_id', 'dia'], type: 'unique' });
        await qi.addIndex('disponibilidad_docente', ['programacion_id'], { name: 'idx_disp_prog' });
        await qi.addIndex('disponibilidad_docente', ['docente_id'], { name: 'idx_disp_doc' });

        await qi.createTable('conflictos_horario', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          programacion_id: { type: S.UUID, references: { model: 'programaciones', key: 'id' }, onDelete: 'CASCADE' },
          tipo: { type: S.STRING(50), allowNull: false },
          severidad: { type: S.STRING(20), defaultValue: 'error' },
          descripcion: { type: S.TEXT, allowNull: false },
          datos: { type: S.JSONB },
          sugerencia: { type: S.TEXT },
          resuelto: { type: S.BOOLEAN, defaultValue: false },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addConstraint('conflictos_horario', { fields: ['severidad'], type: 'check', where: { severidad: ['error','warning','info'] } });
        await qi.addIndex('conflictos_horario', ['programacion_id'], { name: 'idx_conf_prog' });

        await qi.createTable('disponibilidad_ambiente', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          ambiente_id: { type: S.UUID, references: { model: 'ambientes', key: 'id' }, onDelete: 'CASCADE', allowNull: false },
          slot_id: { type: S.UUID, references: { model: 'slots_tiempo', key: 'id' }, allowNull: false },
          dia: { type: 'dia_semana', allowNull: false },
          estado: { type: S.STRING(20), allowNull: false, defaultValue: 'disponible' },
          motivo: { type: S.STRING(200) },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        await qi.addConstraint('disponibilidad_ambiente', { fields: ['estado'], type: 'check', where: { estado: ['disponible', 'mantenimiento', 'reservado', 'bloqueado'] } });
        await qi.addConstraint('disponibilidad_ambiente', { fields: ['ambiente_id', 'slot_id', 'dia'], type: 'unique' });
        await qi.addIndex('disponibilidad_ambiente', ['ambiente_id', 'dia'], { name: 'idx_disp_ambiente_dia' });
      },
      down: async qi => {
        await qi.dropTable('disponibilidad_ambiente');
        await qi.dropTable('conflictos_horario');
        await qi.dropTable('disponibilidad_docente');
        await qi.dropTable('programacion_cursos');
        await qi.dropTable('programaciones');
      }
    };