'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('malla_curricular', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      curricula_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'curriculas',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      curso_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'cursos',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Añadir restricción única para evitar que un mismo curso esté más de una vez en la misma currícula
    await queryInterface.addConstraint('malla_curricular', {
      fields: ['curricula_id', 'curso_id'],
      type: 'unique',
      name: 'unique_curso_por_curricula'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('malla_curricular');
  }
};
