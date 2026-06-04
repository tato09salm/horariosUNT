module.exports = {
  up: async (qi) => {
    try {
      await qi.bulkInsert('roles', [
        { codigo: 'admin', nombre: 'Administrador(a)' },
        { codigo: 'director_escuela', nombre: 'Director de Escuela' },
        { codigo: 'secretaria', nombre: 'Secretario/a' },
        { codigo: 'docente', nombre: 'Docente' }
      ], {});
    } catch (e) {
      // La tabla roles podría no existir, continuar
      console.log('Tabla roles no encontrada o ya tiene datos:', e.message);
    }
  },
  down: async qi => {
    try {
      await qi.bulkDelete('roles', null, {});
    } catch (e) {
      // No-op si la tabla no existe
    }
  }
};
