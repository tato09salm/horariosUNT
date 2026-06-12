module.exports = {
  up: async (qi, S) => {
    await qi.addColumn('carga_horaria', 'facultad', { type: S.STRING, allowNull: true });
    await qi.addColumn('carga_horaria', 'dpto_academico', { type: S.STRING, allowNull: true });
  },
  down: async qi => {
    await qi.removeColumn('carga_horaria', 'dpto_academico');
    await qi.removeColumn('carga_horaria', 'facultad');
  }
};
