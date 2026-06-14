const fs = require('fs');
const path = require('path');

module.exports = {
  up: async (qi) => {
    const sqlPath = path.join(__dirname, '..', 'lib', 'migrations', '013_seeder_carga_horaria_2026I.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await qi.sequelize.query(sql);
  },

  down: async (qi) => {
    await qi.sequelize.query(`
      DELETE FROM carga_horaria_cursos
      WHERE carga_horaria_id IN (
        SELECT ch.id FROM carga_horaria ch
        JOIN ciclos c ON ch.ciclo_academico_id = c.id
        WHERE c.nombre = '2026-I'
      );
      DELETE FROM carga_horaria
      WHERE ciclo_academico_id IN (SELECT id FROM ciclos WHERE nombre = '2026-I');
    `);
  }
};
