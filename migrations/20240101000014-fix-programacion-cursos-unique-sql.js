module.exports = {
  up: async (qi) => {
    // Eliminar la constraint antigua usando SQL directo
    await qi.sequelize.query(`
      ALTER TABLE programacion_cursos 
      DROP CONSTRAINT IF EXISTS programacion_cursos_programacion_id_grupo_id_uk
    `);
    
    // Agregar nueva constraint usando SQL directo con IF NOT EXISTS logic
    try {
      await qi.sequelize.query(`
        ALTER TABLE programacion_cursos 
        ADD CONSTRAINT programacion_cursos_programacion_id_grupo_id_docente_id_uk 
        UNIQUE(programacion_id, grupo_id, docente_id)
      `);
    } catch (e) {
      // La constraint ya existe, continuar
      console.log('Constraint programacion_cursos_programacion_id_grupo_id_docente_id_uk ya existe');
    }
  },
  down: async (qi) => {
    // Revertir: eliminar la nueva constraint
    await qi.sequelize.query(`
      ALTER TABLE programacion_cursos 
      DROP CONSTRAINT IF EXISTS programacion_cursos_programacion_id_grupo_id_docente_id_uk
    `);
    
    // Restaurar la constraint original
    await qi.sequelize.query(`
      ALTER TABLE programacion_cursos 
      ADD CONSTRAINT programacion_cursos_programacion_id_grupo_id_uk 
      UNIQUE(programacion_id, grupo_id)
    `);
  }
};
