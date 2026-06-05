module.exports = {
  up: async qi => {
    await qi.sequelize.query('ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;');
    await qi.sequelize.query('ALTER TABLE usuarios ALTER COLUMN rol TYPE VARCHAR(50) USING rol::text;');
    await qi.sequelize.query("ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'docente';");
    await qi.addConstraint('usuarios', {
      fields: ['rol'],
      type: 'foreign key',
      name: 'usuarios_rol_fkey',
      references: {
        table: 'roles',
        field: 'codigo'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
  },
  down: async qi => {
    await qi.removeConstraint('usuarios', 'usuarios_rol_fkey');
    await qi.sequelize.query('ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;');
    await qi.sequelize.query('ALTER TABLE usuarios ALTER COLUMN rol TYPE rol_usuario USING rol::rol_usuario;');
    await qi.sequelize.query("ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'docente';");
  }
};
