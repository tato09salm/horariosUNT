'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('curriculas', 'estado', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'ACTIVA',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('curriculas', 'estado');
  },
};