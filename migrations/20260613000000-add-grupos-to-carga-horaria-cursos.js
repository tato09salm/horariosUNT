'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('carga_horaria_cursos', 'teoria_grupos', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });
    await queryInterface.addColumn('carga_horaria_cursos', 'practica_grupos', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });
    await queryInterface.addColumn('carga_horaria_cursos', 'laboratorio_grupos', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('carga_horaria_cursos', 'teoria_grupos');
    await queryInterface.removeColumn('carga_horaria_cursos', 'practica_grupos');
    await queryInterface.removeColumn('carga_horaria_cursos', 'laboratorio_grupos');
  },
};
