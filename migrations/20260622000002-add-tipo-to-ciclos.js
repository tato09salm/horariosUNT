module.exports = {
  up: async (qi, S) => {
    // Paso 1: Agregar el tipo tipo_ciclo (si no existe)
    await qi.sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE tipo_ciclo AS ENUM ('regular', 'extraordinario');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Paso 2: Agregar la columna 'tipo' a la tabla ciclos (si no existe)
    try {
      await qi.addColumn('ciclos', 'tipo', {
        type: S.ENUM('regular', 'extraordinario'),
        allowNull: false,
        defaultValue: 'regular'
      });
    } catch (e) {
      console.log('ℹ️ La columna tipo ya existe en la tabla ciclos');
    }

    // Paso 3: Eliminar la antigua restricción de semestre (si existe)
    try {
      await qi.removeConstraint('ciclos', 'ciclos_semestre_check');
    } catch (e) {
      console.log('ℹ️ No se encontró la restricción ciclos_semestre_check');
    }

    // Paso 4: Modificar la columna semestre para admitir 'EXT' (cambiar de VARCHAR(2) a VARCHAR(3))
    await qi.changeColumn('ciclos', 'semestre', {
      type: S.STRING(3),
      allowNull: false
    });

    // Paso 5: Agregar nueva restricción de semestre según tipo de ciclo
    try {
      await qi.addConstraint('ciclos', {
        fields: ['semestre', 'tipo'],
        type: 'check',
        where: S.where(S.literal(`
          (tipo = 'regular' AND semestre IN ('I', 'II')) OR
          (tipo = 'extraordinario' AND semestre IN ('EXT'))
        `))
      });
    } catch (e) {
      console.log('ℹ️ La restricción ciclos_semestre_check ya existe');
    }

    console.log('✅ Migración 017 completada: Columna tipo agregada a ciclos');
  },
  down: async (qi) => {
    // Revertir la migración
    try {
      await qi.removeConstraint('ciclos', 'ciclos_semestre_check');
    } catch (e) {
      console.log('ℹ️ No se encontró la restricción ciclos_semestre_check');
    }
    
    await qi.changeColumn('ciclos', 'semestre', {
      type: S.STRING(2),
      allowNull: false
    });
    
    try {
      await qi.addConstraint('ciclos', {
        fields: ['semestre'],
        type: 'check',
        where: { semestre: ['I', 'II'] }
      });
    } catch (e) {
      console.log('ℹ️ No se pudo agregar la restricción original');
    }
    
    try {
      await qi.removeColumn('ciclos', 'tipo');
    } catch (e) {
      console.log('ℹ️ La columna tipo ya fue eliminada');
    }
    
    try {
      await qi.sequelize.query('DROP TYPE IF EXISTS tipo_ciclo CASCADE;');
    } catch (e) {
      console.log('ℹ️ El tipo tipo_ciclo ya fue eliminado');
    }
  }
};
