'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      'programaciones',
      'estado_resolucion',
      {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'PENDIENTE',
      }
    );

    await queryInterface.sequelize.query(`
      ALTER TABLE programaciones
      ADD CONSTRAINT chk_programaciones_estado_resolucion
      CHECK (
        estado_resolucion IN (
          'PENDIENTE',
          'COMPLETA',
          'PARCIAL',
          'INVALIDA'
        )
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE programaciones
      DROP CONSTRAINT IF EXISTS chk_programaciones_estado_resolucion
    `);

    await queryInterface.removeColumn(
      'programaciones',
      'estado_resolucion'
    );
  },
};
