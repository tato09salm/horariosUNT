module.exports = {
  up: async (qi, S) => {
    // Paso 1: Cambiar semestre de VARCHAR(2) a VARCHAR(3)
    await qi.changeColumn('ciclos', 'semestre', {
      type: S.STRING(3),
      allowNull: false
    });

    console.log('✅ Migración completada: Columna semestre cambiada a VARCHAR(3)');
  },
  down: async (qi, S) => {
    // Revertir
    await qi.changeColumn('ciclos', 'semestre', {
      type: S.STRING(2),
      allowNull: false
    });
  }
};
