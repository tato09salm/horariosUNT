module.exports = {
      up: async (qi) => {
        await qi.bulkInsert('usuarios', [
          { nombre: 'Administrador', apellidos: 'Sistema', email: 'admin@unt.edu.pe', password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', rol: 'admin' },
          { nombre: 'María', apellidos: 'García López', email: 'secretaria@unt.edu.pe', password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', rol: 'secretaria' }
        ], {});
      },
      down: async qi => qi.bulkDelete('usuarios', null, {})
    };