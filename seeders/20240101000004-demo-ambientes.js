module.exports = {
      up: async (qi) => {
        await qi.bulkInsert('ambientes', [
          { codigo: 'A-101', nombre: 'Aula 101', tipo: 'aula', capacidad: 40, piso: 1, edificio: 'Pabellón A' },
          { codigo: 'A-102', nombre: 'Aula 102', tipo: 'aula', capacidad: 40, piso: 1, edificio: 'Pabellón A' },
          { codigo: 'A-201', nombre: 'Aula 201', tipo: 'aula', capacidad: 35, piso: 2, edificio: 'Pabellón A' },
          { codigo: 'A-301', nombre: 'Aula 301', tipo: 'aula', capacidad: 30, piso: 3, edificio: 'Pabellón A' },
          { codigo: 'A-303', nombre: 'Posgrado A-303', tipo: 'aula', capacidad: 30, piso: 3, edificio: 'Pabellón A' },
          { codigo: 'A-307', nombre: 'Posgrado A-307', tipo: 'aula', capacidad: 30, piso: 3, edificio: 'Pabellón A' },
          { codigo: 'A-311', nombre: 'Posgrado A-311', tipo: 'aula', capacidad: 30, piso: 3, edificio: 'Pabellón A' },
          { codigo: 'B-101', nombre: 'Aula B-101', tipo: 'aula', capacidad: 45, piso: 1, edificio: 'Pabellón B' },
          { codigo: 'LAB-1', nombre: 'Laboratorio 1', tipo: 'laboratorio', capacidad: 30, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'LAB-2', nombre: 'Laboratorio 2', tipo: 'laboratorio', capacidad: 30, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'LAB-3', nombre: 'Laboratorio 3', tipo: 'laboratorio', capacidad: 30, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'LAB-4', nombre: 'Laboratorio 4', tipo: 'laboratorio', capacidad: 30, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'LAB-FIS', nombre: 'Lab. Física', tipo: 'laboratorio', capacidad: 25, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'L-101', nombre: 'Lab. Computación I', tipo: 'laboratorio', capacidad: 30, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'L-102', nombre: 'Lab. Computación II', tipo: 'laboratorio', capacidad: 30, piso: 1, edificio: 'Laboratorios' },
          { codigo: 'EPG-1', nombre: 'Espacio Pedagógico General 1', tipo: 'aula', capacidad: 40, piso: 1, edificio: 'Pabellón EPG' },
          { codigo: 'EPG-2', nombre: 'Espacio Pedagógico General 2', tipo: 'aula', capacidad: 40, piso: 1, edificio: 'Pabellón EPG' },
          { codigo: 'EPG-3', nombre: 'Espacio Pedagógico General 3', tipo: 'aula', capacidad: 40, piso: 1, edificio: 'Pabellón EPG' },
          { codigo: 'EPG-4', nombre: 'Espacio Pedagógico General 4', tipo: 'aula', capacidad: 40, piso: 1, edificio: 'Pabellón EPG' },
          { codigo: 'TC-IND', nombre: 'Taller de Confecciones - Ing. Industrial', tipo: 'laboratorio', capacidad: 25, piso: 1, edificio: 'Talleres' }
        ], {});
      },
      down: async qi => qi.bulkDelete('ambientes', null, {})
    };