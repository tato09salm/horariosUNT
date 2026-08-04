require('dotenv').config({ path: process.env.PWD_ENV_FILE || '.env.local' });
process.stderr.write('pw=' + (process.env.DB_PASSWORD ? 'set' : 'EMPTY') + '\n');
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
(async () => {
  try {
    const ok = await pool.query('SELECT 1 AS ok');
    process.stderr.write('connect ok\n');

    const progs = await pool.query(
      'SELECT id, nombre, fase, estado, estado_resolucion FROM programaciones ORDER BY created_at DESC LIMIT 5'
    );
    process.stderr.write('PROGRAMACIONES:\n');
    process.stderr.write(JSON.stringify(progs.rows, null, 1) + '\n');

    if (progs.rows.length > 0) {
      const pid = progs.rows[0].id;
      const disp = await pool.query(
        `SELECT docente_id, dia, COUNT(*)::int AS slots
         FROM disponibilidad_docente
         WHERE programacion_id = $1 AND disponible = true
         GROUP BY docente_id, dia
         ORDER BY docente_id, dia`,
        [pid]
      );
      process.stderr.write('\nDISPO POR DIA (programacion ' + pid + '):\n');
      const rowsByDoc = {};
      for (const r of disp.rows) {
        if (!rowsByDoc[r.docente_id]) rowsByDoc[r.docente_id] = [];
        rowsByDoc[r.docente_id].push(r.dia + ':' + r.slots);
      }
      process.stderr.write(JSON.stringify(rowsByDoc, null, 1) + '\n');

      const sab = disp.rows.filter(r => r.dia === 'sabado').length;
      process.stderr.write('\nDocentes con slots de sabado: ' + sab + ' grupos-dia\n');

      const pc = await pool.query(
        `SELECT pc.docente_id, cu.codigo, pc.horas_teoria, pc.horas_practica, pc.horas_laboratorio
         FROM programacion_cursos pc JOIN cursos cu ON cu.id = pc.curso_id
         WHERE pc.programacion_id = $1 AND pc.docente_id IS NOT NULL`,
        [pid]
      );
      process.stderr.write('\nCURSOS (' + pc.rowCount + '):\n');
      process.stderr.write(JSON.stringify(pc.rows, null, 1) + '\n');
    }

    await pool.end();
    process.exit(0);
  } catch (e) {
    process.stderr.write('ERR: ' + e.message + '\n');
    process.exit(1);
  }
})();
