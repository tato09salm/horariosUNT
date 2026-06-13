module.exports = {
  up: async (qi, S) => {
    // First, update the carga_horaria table to add more fields
    await qi.addColumn('carga_horaria', 'modalidad', { type: S.STRING, allowNull: true });
    
    // 1. TRABAJO LECTIVO - Cursos asignados
    await qi.createTable('carga_horaria_cursos', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, onDelete: 'CASCADE' },
      curso_id: { type: S.UUID, references: { model: 'cursos', key: 'id' }, allowNull: false },
      seccion: { type: S.STRING, allowNull: true },
      escuela: { type: S.STRING, allowNull: true },
      num_alumnos: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      hrs_teo: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      hrs_pra: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      hrs_lab: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      total_hrs: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 2. PREPARACIÓN Y EVALUACIÓN
    await qi.createTable('carga_horaria_preparacion', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      descripcion: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 3. CONSEJERÍA Y TUTORÍA
    await qi.createTable('carga_horaria_consejeria', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      detalles: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 4. INVESTIGACIÓN
    await qi.createTable('carga_horaria_investigacion', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      proyecto: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 5. CAPACITACIÓN
    await qi.createTable('carga_horaria_capacitacion', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      detalles: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 6. ACTIVIDADES DE GOBIERNO
    await qi.createTable('carga_horaria_gobierno', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      detalles: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 7. ACTIVIDADES DE ADMINISTRACIÓN
    await qi.createTable('carga_horaria_administracion', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      detalles: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL
    await qi.createTable('carga_horaria_asesoria', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      detalles: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 9. RESPONSABILIDAD SOCIAL UNIVERSITARIA
    await qi.createTable('carga_horaria_rsu', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      plan: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });

    // 10. COMITÉS TÉCNICOS Y COMISIONES
    await qi.createTable('carga_horaria_comites', {
      id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
      carga_horaria_id: { type: S.UUID, references: { model: 'carga_horaria', key: 'id' }, allowNull: false, unique: true, onDelete: 'CASCADE' },
      horas: { type: S.INTEGER, allowNull: true, defaultValue: 0 },
      detalles: { type: S.TEXT, allowNull: true },
      created_at: { type: S.DATE, defaultValue: S.literal('NOW()') },
      updated_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
    });
  },

  down: async qi => {
    await qi.dropTable('carga_horaria_comites');
    await qi.dropTable('carga_horaria_rsu');
    await qi.dropTable('carga_horaria_asesoria');
    await qi.dropTable('carga_horaria_administracion');
    await qi.dropTable('carga_horaria_gobierno');
    await qi.dropTable('carga_horaria_capacitacion');
    await qi.dropTable('carga_horaria_investigacion');
    await qi.dropTable('carga_horaria_consejeria');
    await qi.dropTable('carga_horaria_preparacion');
    await qi.dropTable('carga_horaria_cursos');
    await qi.removeColumn('carga_horaria', 'modalidad');
  }
};
