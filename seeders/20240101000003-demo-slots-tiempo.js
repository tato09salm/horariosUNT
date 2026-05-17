module.exports = {
      up: async (qi) => {
        await qi.bulkInsert('slots_tiempo', [
          { nombre: '07:00 - 08:00', hora_inicio: '07:00', hora_fin: '08:00', orden: 1 },
          { nombre: '08:00 - 09:00', hora_inicio: '08:00', hora_fin: '09:00', orden: 2 },
          { nombre: '09:00 - 10:00', hora_inicio: '09:00', hora_fin: '10:00', orden: 3 },
          { nombre: '10:00 - 11:00', hora_inicio: '10:00', hora_fin: '11:00', orden: 4 },
          { nombre: '11:00 - 12:00', hora_inicio: '11:00', hora_fin: '12:00', orden: 5 },
          { nombre: '12:00 - 13:00', hora_inicio: '12:00', hora_fin: '13:00', orden: 6 },
          { nombre: '13:00 - 14:00', hora_inicio: '13:00', hora_fin: '14:00', orden: 7 },
          { nombre: '14:00 - 15:00', hora_inicio: '14:00', hora_fin: '15:00', orden: 8 },
          { nombre: '15:00 - 16:00', hora_inicio: '15:00', hora_fin: '16:00', orden: 9 },
          { nombre: '16:00 - 17:00', hora_inicio: '16:00', hora_fin: '17:00', orden: 10 },
          { nombre: '17:00 - 18:00', hora_inicio: '17:00', hora_fin: '18:00', orden: 11 },
          { nombre: '18:00 - 19:00', hora_inicio: '18:00', hora_fin: '19:00', orden: 12 },
          { nombre: '19:00 - 20:00', hora_inicio: '19:00', hora_fin: '20:00', orden: 13 },
          { nombre: '20:00 - 21:00', hora_inicio: '20:00', hora_fin: '21:00', orden: 14 }
        ], {});
      },
      down: async qi => qi.bulkDelete('slots_tiempo', null, {})
    };