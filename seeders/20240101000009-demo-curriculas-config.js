'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const curriculaId = uuidv4();

    // 1. Insertar la Currícula por defecto
    await queryInterface.bulkInsert('curriculas', [{
      id: curriculaId,
      nombre_carrera: 'INGENIERÍA DE SISTEMAS',
      año_curricula: 2018,
      modalidad_estudios: 'PRESENCIAL',
      creditos_totales: 224,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);

    // 2. Insertar el valor en la tabla Configuración
    await queryInterface.bulkInsert('configuracion', [{
      id: uuidv4(),
      clave: 'ID_MALLA_CURRICULAR_ACTUAL',
      valor: curriculaId,
      createdAt: new Date(),
      updatedAt: new Date()
    }]);

    // 3. Obtener todos los cursos existentes
    const cursos = await queryInterface.sequelize.query(
      `SELECT id from cursos;`
    );

    const cursosRows = cursos[0]; // [0] contiene los resultados en consultas raw de sequelize

    // 4. Vincular todos los cursos a la currícula creada
    if (cursosRows.length > 0) {
      const mallaInsertData = cursosRows.map(curso => ({
        id: uuidv4(),
        curricula_id: curriculaId,
        curso_id: curso.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await queryInterface.bulkInsert('malla_curricular', mallaInsertData);
    }
  },

  async down(queryInterface, Sequelize) {
    // Para el down, eliminaremos la configuración, la malla y luego la currícula
    await queryInterface.bulkDelete('configuracion', { clave: 'ID_MALLA_CURRICULAR_ACTUAL' }, {});
    
    // Al eliminar la currícula, si onUpdate/onDelete es CASCADE, la malla se eliminará automáticamente.
    // Pero por si acaso, lo eliminamos de forma manual
    const curr = await queryInterface.sequelize.query(
      `SELECT valor from configuracion WHERE clave='ID_MALLA_CURRICULAR_ACTUAL';`
    );
    
    if (curr[0].length > 0) {
        const cId = curr[0][0].valor;
        await queryInterface.bulkDelete('malla_curricular', { curricula_id: cId }, {});
        await queryInterface.bulkDelete('curriculas', { id: cId }, {});
    } else {
        await queryInterface.bulkDelete('malla_curricular', null, {});
        await queryInterface.bulkDelete('curriculas', { nombre_carrera: 'INGENIERÍA DE SISTEMAS' }, {});
    }
  }
};
