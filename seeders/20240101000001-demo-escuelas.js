module.exports = {
      up: async (qi) => {
        await qi.bulkInsert('escuelas', [{ nombre: 'Escuela de Ingeniería de Sistemas', codigo: 'EIS' }], {});
      },
      down: async qi => qi.bulkDelete('escuelas', null, {})
    };