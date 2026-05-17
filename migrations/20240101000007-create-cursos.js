module.exports = {
      up: async (qi, S) => {
        await qi.createTable('cursos', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          escuela_id: { type: S.UUID, references: { model: 'escuelas', key: 'id' } },
          codigo: { type: S.STRING(20), allowNull: false, unique: true },
          nombre: { type: S.STRING(200), allowNull: false },
          creditos: { type: S.INTEGER, allowNull: false, defaultValue: 3 },
          horas_teoria: { type: S.INTEGER, allowNull: false, defaultValue: 3 },
          horas_practica: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          horas_laboratorio: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          bloque_indivisible: { type: S.BOOLEAN, defaultValue: true },
          cantidad_labs: { type: S.INTEGER, defaultValue: 1 },
          ciclo_plan: { type: S.INTEGER },
          semestre: { type: S.INTEGER },
          prerequisitos: { type: S.ARRAY(S.UUID) },
          activo: { type: S.BOOLEAN, defaultValue: true },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
      },
      down: async qi => qi.dropTable('cursos')
    };