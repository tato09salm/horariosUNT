module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('docentes', 'es_escuela_configurada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('docentes', 'es_escuela_configurada');
  },
};