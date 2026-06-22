module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add column safely (IF NOT EXISTS)
    await queryInterface.sequelize.query(`
      ALTER TABLE docentes ADD COLUMN IF NOT EXISTS codigo VARCHAR(50)
    `);
    // Generate codigo for existing docentes: APELLIDOS_NOMBRES_DNI
    await queryInterface.sequelize.query(`
      UPDATE docentes
      SET codigo = UPPER(TRIM(REGEXP_REPLACE(CONCAT(COALESCE(apellidos,''), '_', COALESCE(nombre,''), '_', COALESCE(dni,'')), E'\\\\s+', '_', 'g')))
      WHERE codigo IS NULL
    `);
    // Set NOT NULL and UNIQUE only after all nulls are filled
    await queryInterface.sequelize.query(`
      ALTER TABLE docentes ALTER COLUMN codigo SET NOT NULL
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE docentes ADD CONSTRAINT docentes_codigo_key UNIQUE (codigo)
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE docentes DROP CONSTRAINT IF EXISTS docentes_codigo_key
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE docentes ALTER COLUMN codigo DROP NOT NULL
    `);
    await queryInterface.removeColumn('docentes', 'codigo');
  },
};
