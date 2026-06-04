module.exports = {
  up: async (qi) => {
    // Eliminar la constraint UNIQUE(programacion_id, grupo_id) que impide múltiples docentes por grupo
    try {
      await qi.removeConstraint('programacion_cursos', 'programacion_cursos_programacion_id_grupo_id_uk');
    } catch (e) {
      // La constraint podría no existir o tener otro nombre, continuar
      console.log('Constraint programacion_cursos_programacion_id_grupo_id_uk no encontrada o ya eliminada');
    }
    
    // Agregar nueva constraint UNIQUE(programacion_id, grupo_id, docente_id) 
    // para evitar que el mismo docente se asigne múltiples veces al mismo grupo
    await qi.addConstraint('programacion_cursos', { 
      fields: ['programacion_id', 'grupo_id', 'docente_id'], 
      type: 'unique',
      name: 'programacion_cursos_programacion_id_grupo_id_docente_id_uk'
    });
  },
  down: async (qi) => {
    // Revertir: eliminar la nueva constraint
    await qi.removeConstraint('programacion_cursos', 'programacion_cursos_programacion_id_grupo_id_docente_id_uk');
    
    // Restaurar la constraint original
    await qi.addConstraint('programacion_cursos', { 
      fields: ['programacion_id', 'grupo_id'], 
      type: 'unique',
      name: 'programacion_cursos_programacion_id_grupo_id_uk'
    });
  }
};
