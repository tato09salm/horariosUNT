module.exports = {
  up: async (qi) => {
    // Eliminar la constraint antigua usando SQL directo
    try {
      await qi.sequelize.query(`
        ALTER TABLE programacion_cursos 
        DROP CONSTRAINT IF EXISTS programacion_cursos_programacion_id_grupo_id_uk
      `);
    } catch (e) {
      console.log('Error eliminando constraint antigua:', e.message);
    }
    
    // Agregar nueva constraint usando SQL directo
    try {
      await qi.sequelize.query(`
        ALTER TABLE programacion_cursos 
        ADD CONSTRAINT programacion_cursos_programacion_id_grupo_id_docente_id_uk 
        UNIQUE(programacion_id, grupo_id, docente_id)
      `);
    } catch (e) {
      console.log('Error agregando constraint nueva (ya existe):', e.message);
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
