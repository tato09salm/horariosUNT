'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Truncar tablas para evitar conflictos (destructivo)
      await queryInterface.sequelize.query('TRUNCATE TABLE programacion_cursos CASCADE', { transaction });
      await queryInterface.sequelize.query('TRUNCATE TABLE grupos CASCADE', { transaction });

      // 2. Añadir programacion_id
      await queryInterface.addColumn('grupos', 'programacion_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'programaciones',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction });

      // 3. Eliminar constraint unico anterior
      await queryInterface.removeConstraint('grupos', 'grupos_ciclo_id_curso_id_numero_grupo_uk', { transaction });

      // 4. Eliminar columna ciclo_id
      await queryInterface.removeColumn('grupos', 'ciclo_id', { transaction });

      // 5. Añadir nuevo constraint unico
      await queryInterface.addConstraint('grupos', {
        fields: ['programacion_id', 'curso_id', 'numero_grupo'],
        type: 'unique',
        name: 'grupos_programacion_id_curso_id_numero_grupo_uk',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query('TRUNCATE TABLE programacion_cursos CASCADE', { transaction });
      await queryInterface.sequelize.query('TRUNCATE TABLE grupos CASCADE', { transaction });

      await queryInterface.removeConstraint('grupos', 'grupos_programacion_id_curso_id_numero_grupo_uk', { transaction });
      await queryInterface.removeColumn('grupos', 'programacion_id', { transaction });

      await queryInterface.addColumn('grupos', 'ciclo_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'ciclos',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addConstraint('grupos', {
        fields: ['ciclo_id', 'curso_id', 'numero_grupo'],
        type: 'unique',
        name: 'grupos_ciclo_id_curso_id_numero_grupo_uk',
        transaction
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
