module.exports = {
  up: async (qi) => {
    await qi.bulkInsert('roles', [
      { codigo: 'admin', nombre: 'Administrador(a)' },
      { codigo: 'director_escuela', nombre: 'Director de Escuela' },
      { codigo: 'secretaria', nombre: 'Secretario/a' },
      { codigo: 'docente', nombre: 'Docente' }
    ], {});
  },
  down: async qi => qi.bulkDelete('roles', null, {})
};
