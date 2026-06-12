
module.exports = {
  up: async (qi, S) => {
    // Drop the old unique constraint
    await qi.removeConstraint('carga_horaria', 'unique_docente_ciclo_academico_ciclo_plan');
    
    // Drop the old index too
    await qi.removeIndex('carga_horaria', 'idx_carga_horaria_ciclo_academico_ciclo_plan');
    
    // Create a new unique constraint on just docente_id and ciclo_academico_id
    await qi.addConstraint('carga_horaria', {
      type: 'unique',
      fields: ['docente_id', 'ciclo_academico_id'],
      name: 'unique_docente_ciclo_academico'
    });
    
    // Create a new index for faster queries
    await qi.addIndex('carga_horaria', ['ciclo_academico_id'], {
      name: 'idx_carga_horaria_ciclo_academico'
    });
  },
  
  down: async (qi, S) => {
    // Restore the old constraints
    await qi.removeConstraint('carga_horaria', 'unique_docente_ciclo_academico');
    await qi.removeIndex('carga_horaria', 'idx_carga_horaria_ciclo_academico');
    
    await qi.addConstraint('carga_horaria', {
      type: 'unique',
      fields: ['docente_id', 'ciclo_academico_id', 'ciclo_plan'],
      name: 'unique_docente_ciclo_academico_ciclo_plan'
    });
    
    await qi.addIndex('carga_horaria', ['ciclo_academico_id', 'ciclo_plan'], {
      name: 'idx_carga_horaria_ciclo_academico_ciclo_plan'
    });
  }
};
