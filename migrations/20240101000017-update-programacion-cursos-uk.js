'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // Intentar remover la restricción única anterior si existe
      await queryInterface.removeConstraint(
        'programacion_cursos',
        'programacion_cursos_programacion_id_grupo_id_uk'
      );
    } catch (error) {
      console.log("No se pudo remover la constraint anterior, posiblemente no exista o tenga otro nombre:", error.message);
    }

    try {
      // También puede existir como un índice único
      await queryInterface.removeIndex(
        'programacion_cursos',
        'programacion_cursos_programacion_id_grupo_id_uk'
      );
    } catch(error) {
      // Ignorar si no existe
    }

    // Agregar la nueva restricción única incluyendo al docente
    await queryInterface.addConstraint('programacion_cursos', {
      fields: ['programacion_id', 'grupo_id', 'docente_id'],
      type: 'unique',
      name: 'programacion_cursos_prog_grupo_docente_uk'
    });
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeConstraint(
        'programacion_cursos',
        'programacion_cursos_prog_grupo_docente_uk'
      );
    } catch (error) {
      console.log(error);
    }

    // Restaurar la restricción original
    await queryInterface.addConstraint('programacion_cursos', {
      fields: ['programacion_id', 'grupo_id'],
      type: 'unique',
      name: 'programacion_cursos_programacion_id_grupo_id_uk'
    });
  }
};
