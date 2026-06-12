
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('docentes', 'facultad', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn('docentes', 'dpto_academico', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('docentes', 'facultad');
    await queryInterface.removeColumn('docentes', 'dpto_academico');
  },
};
