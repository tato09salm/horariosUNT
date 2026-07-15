// Fix docente conditions: set specific docentes as nombrados with correct categorias,
// set all others as contratados

const NOMBRADOS = [
  { dni: '11111111', categoria: 'auxiliar' },    // Marcelino Torres Villanueva
  { dni: '20202020', categoria: 'auxiliar' },    // Zoraida Vidal Melgarejo
  { dni: '21212121', categoria: 'asociado' },    // Everson David Agreda Gamboa
  { dni: '22222222', categoria: 'auxiliar' },    // Alberto Mendoza de los Santos
  { dni: '22222223', categoria: 'asociado' },    // Juan Carlos Obando Roldán
  { dni: '28282828', categoria: 'asociado' },    // Luis Boy Chavil
  { dni: '29292929', categoria: 'auxiliar' },    // Robert Jerry Sánchez Ticona
  { dni: '30303030', categoria: 'auxiliar' },    // Cesar Arellano Salazar
  { dni: '31313131', categoria: 'auxiliar' },    // Camilo Suárez Rebaza
  { dni: '34343434', categoria: 'asociado' },    // Juan Pedro Santos Fernández
  { dni: '35353535', categoria: 'auxiliar' },    // Ricardo Mendoza Rivera
];

module.exports = {
  up: async (qi) => {
    // Step 1: Set all docentes as contratados first
    await qi.sequelize.query(
      `UPDATE docentes SET condicion = 'contratado', updated_at = NOW() WHERE activo = true`
    );

    // Step 2: Set the 11 specific docentes as nombrados with correct categorias
    for (const d of NOMBRADOS) {
      await qi.sequelize.query(
        `UPDATE docentes SET condicion = 'nombrado', categoria = :categoria, updated_at = NOW() WHERE dni = :dni AND activo = true`,
        { replacements: { dni: d.dni, categoria: d.categoria } }
      );
    }
  },

  down: async (qi) => {
    // Restore previous state is not needed; re-run seeder instead
    console.log('No down migration available for docente condition changes.');
  }
};
