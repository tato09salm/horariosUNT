'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE docentes ADD COLUMN IF NOT EXISTS modalidad VARCHAR(100) DEFAULT 'TIEMPO COMPLETO 40 H'
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('docentes', 'modalidad');
  },
};
