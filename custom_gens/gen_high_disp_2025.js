const fs = require('fs');
const { Pool } = require('pg');
const p = new Pool({
  user: 'postgres',
  password: '12345',
  host: 'localhost',
  database: 'horariosUNT'
});

const targetDnis = [
  '42424242', '40404040', '41414141', '43434343', '77777777',
  '44444445', '20202020', '30303030', '52525252', '22222223',
  '38383838', '31313131', '11111111', '29292929', '33333334',
  '28282828', '57575757', '56565656', '36363636', '22222222',
  '35353535', '21212121', '34343434', '62626262', '33333333',
  '37373737'
];

async function generate() {
  try {
    const slots = await p.query("SELECT * FROM slots_tiempo WHERE hora_inicio != '13:00:00' ORDER BY orden ASC");
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    
    let csv = 'DOCENTE,DIA,HORA_INICIO,PRIORIDAD\n';
    
    for (const dni of targetDnis) {
      for (const dia of dias) {
        for (const s of slots.rows) {
          const horaStr = s.hora_inicio.substring(0, 5); // '07:00'
          csv += `${dni},${dia},${horaStr},1\n`; // Alta prioridad (1) para todos los slots
        }
      }
    }
    
    fs.writeFileSync('C:/Users/USERJSSV/.gemini/antigravity/brain/8f7fc220-00fb-4086-9f3e-8bc1322e340e/disponibilidad_2025_II.csv', csv, 'utf8');
    console.log('CSV generado con éxito.');
  } catch (err) {
    console.error('Error al generar:', err);
  } finally {
    p.end();
  }
}

generate();
