const fs = require('fs');
const {Pool} = require('pg');
const p = new Pool({user:'postgres',password:'12345',host:'localhost',database:'horariosUNT'});

async function generate() {
  const docentes = await p.query('SELECT * FROM docentes WHERE activo = true');
  const slots = await p.query("SELECT * FROM slots_tiempo WHERE hora_inicio != '13:00:00'");
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  let csv = 'DOCENTE,DIA,HORA_INICIO,PRIORIDAD\n';

  for (const d of docentes.rows) {
    for (const dia of dias) {
      for (const s of slots.rows) {
        const r = Math.random();
        let pri = 0;
        if (r < 0.6) pri = 1;      // 60% alta prioridad
        else if (r < 0.8) pri = 2; // 20% baja prioridad
        if (pri > 0) {
          csv += d.dni + ',' + dia + ',' + s.hora_inicio.substring(0, 5) + ',' + pri + '\n';
        }
      }
    }
  }
  fs.writeFileSync('C:/Users/USERJSSV/.gemini/antigravity/brain/8f7fc220-00fb-4086-9f3e-8bc1322e340e/disponibilidad.csv', csv, 'utf8');
  p.end();
}
generate();
