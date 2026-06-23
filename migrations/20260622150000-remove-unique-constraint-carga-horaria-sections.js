'use strict';

const TABLES = [
  'carga_horaria_preparacion',
  'carga_horaria_consejeria',
  'carga_horaria_investigacion',
  'carga_horaria_capacitacion',
  'carga_horaria_gobierno',
  'carga_horaria_administracion',
  'carga_horaria_asesoria',
  'carga_horaria_rsu',
  'carga_horaria_comites',
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      try {
        await queryInterface.removeConstraint(table, `${table}_carga_horaria_id_key`);
        console.log(`Removed UNIQUE constraint on ${table}.carga_horaria_id`);
      } catch (err) {
        console.log(`Constraint not found on ${table}, skipping: ${err.message}`);
      }
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (const table of TABLES) {
      try {
        await queryInterface.addConstraint(table, {
          type: 'unique',
          fields: ['carga_horaria_id'],
          name: `${table}_carga_horaria_id_key`,
        });
        console.log(`Restored UNIQUE constraint on ${table}.carga_horaria_id`);
      } catch (err) {
        console.log(`Could not restore constraint on ${table}: ${err.message}`);
      }
    }
  },
};
