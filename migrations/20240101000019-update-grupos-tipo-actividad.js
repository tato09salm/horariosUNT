'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Truncar tablas para evitar conflictos (destructivo)
      await queryInterface.sequelize.query('TRUNCATE TABLE programacion_cursos CASCADE', { transaction });
      await queryInterface.sequelize.query('TRUNCATE TABLE grupos CASCADE', { transaction });

      // 2. Añadir columna tipo_actividad a grupos
      await queryInterface.addColumn('grupos', 'tipo_actividad', {
        type: "tipo_sesion",
        allowNull: false,
        defaultValue: 'teoria'
      }, { transaction });

      // 3. Eliminar constraint unico anterior
      await queryInterface.removeConstraint('grupos', 'grupos_programacion_id_curso_id_numero_grupo_uk', { transaction });

      // 4. Añadir nuevo constraint unico
      await queryInterface.addConstraint('grupos', {
        fields: ['programacion_id', 'curso_id', 'tipo_actividad', 'numero_grupo'],
        type: 'unique',
        name: 'grupos_prog_curso_act_num_uk',
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

      await queryInterface.removeConstraint('grupos', 'grupos_prog_curso_act_num_uk', { transaction });
      await queryInterface.removeColumn('grupos', 'tipo_actividad', { transaction });

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
  }
};
