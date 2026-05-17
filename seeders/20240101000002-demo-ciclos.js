module.exports = {
      up: async (qi) => {
        await qi.bulkInsert('ciclos', [
          { nombre: '2026-I', "año": 2026, semestre: 'I', fecha_inicio: '2026-04-13', fecha_fin: '2026-08-08', activo: false },
          { nombre: '2025-II', "año": 2025, semestre: 'II', fecha_inicio: '2025-09-01', fecha_fin: '2025-12-20', activo: true }
        ], {});
      },
      down: async qi => qi.bulkDelete('ciclos', null, {})
    };