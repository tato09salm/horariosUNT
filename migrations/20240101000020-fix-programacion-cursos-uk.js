'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Remove the incorrect constraint that includes docente_id
      await queryInterface.removeConstraint(
        'programacion_cursos',
        'programacion_cursos_prog_grupo_docente_uk'
      );
    } catch (error) {
      console.log("No se pudo remover la constraint incorrecta:", error.message);
    }

    try {
      // Also check if it's an index and remove
      await queryInterface.removeIndex(
        'programacion_cursos',
        'programacion_cursos_prog_grupo_docente_uk'
      );
    } catch (error) {
      // Ignore if not found
    }

    // Add the correct constraint: UNIQUE on (programacion_id, grupo_id) only
    await queryInterface.addConstraint('programacion_cursos', {
      fields: ['programacion_id', 'grupo_id'],
      type: 'unique',
      name: 'programacion_cursos_programacion_id_grupo_id_uk'
    });
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeConstraint(
        'programacion_cursos',
        'programacion_cursos_programacion_id_grupo_id_uk'
      );
    } catch (error) {
      console.log(error);
    }

    // Restore the previous constraint
    await queryInterface.addConstraint('programacion_cursos', {
      fields: ['programacion_id', 'grupo_id', 'docente_id'],
      type: 'unique',
      name: 'programacion_cursos_prog_grupo_docente_uk'
    });
  }
};
