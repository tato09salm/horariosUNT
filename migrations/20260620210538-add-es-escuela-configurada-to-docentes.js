module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('docentes', 'es_escuela_configurada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('docentes', 'es_escuela_configurada');
  },
};