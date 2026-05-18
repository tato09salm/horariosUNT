'use strict';

/**
 * Seeder de grupos — intencionalmente vacío.
 * Los grupos se crean desde la interfaz de la aplicación (Fase 1 del horario).
 * Las programaciones también se crean desde la UI, por lo que este seeder
 * no genera datos de demostración para evitar conflictos con los cursos reales.
 */
module.exports = {
  up: async (qi) => {
    // No se insertan grupos ni programaciones de demostración.
    // Los datos se gestionan desde la interfaz de usuario.
  },
  down: async (qi) => {
    await qi.bulkDelete('grupos', null, {});
    await qi.bulkDelete('programaciones', null, {});
  }
};