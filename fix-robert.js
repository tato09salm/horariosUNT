
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Find Robert's docente_id and current carga_horaria entries
    const robertDocente = await client.query(
      "SELECT id FROM docentes WHERE dni = '29292929'"
    );
    if (!robertDocente.rows.length) {
      throw new Error('Robert not found');
    }
    const docenteId = robertDocente.rows[0].id;
    const cicloAcademicoId = '92d41cbb-4404-495b-8eb3-85ba649b2b9e'; // 2026-I

    // Step 2: Get all existing carga_horaria_cursos for Robert
    const oldCursos = await client.query(
      "SELECT chc.* FROM carga_horaria_cursos chc JOIN carga_horaria ch ON chc.carga_horaria_id = ch.id WHERE ch.docente_id = $1 AND ch.ciclo_academico_id = $2",
      [docenteId, cicloAcademicoId]
    );
    const cursosData = oldCursos.rows;

    // Step 3: Delete all existing carga_horaria entries for Robert
    await client.query(
      "DELETE FROM carga_horaria WHERE docente_id = $1 AND ciclo_academico_id = $2",
      [docenteId, cicloAcademicoId]
    );

    // Step 4: Group cursos by ciclo_plan (from cursos table)
    const cursosByCiclo = {};
    for (const chc of cursosData) {
      const cursoInfo = await client.query(
        'SELECT ciclo_plan FROM cursos WHERE id = $1',
        [chc.curso_id]
      );
      const cp = cursoInfo.rows[0]?.ciclo_plan || 1;
      if (!cursosByCiclo[cp]) {
        cursosByCiclo[cp] = [];
      }
      cursosByCiclo[cp].push(chc);
    }

    // Step 5: Create new carga_horaria entries per ciclo_plan and insert courses
    for (const [cpStr, cursosForCiclo] of Object.entries(cursosByCiclo)) {
      const cp = parseInt(cpStr);
      // Calculate total horas for this ciclo
      const totalHoras = cursosForCiclo.reduce((sum, c) => sum + (c.total_horas || 0), 0);

      // Insert carga_horaria
      const chResult = await client.query(
        `INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, horas_asignadas, activo, created_at, updated_at, facultad, dpto_academico, modalidad)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW(), 'INGENIERIA', 'DTO. DE SISTEMAS', 'TIEMPO COMPLETO 40 H')
         RETURNING id`,
        [docenteId, cicloAcademicoId, cp, totalHoras]
      );
      const chId = chResult.rows[0].id;

      // Insert courses for this carga_horaria
      for (const c of cursosForCiclo) {
        await client.query(
          `INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, horas_teoria, horas_practica, horas_laboratorio, total_horas, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [chId, c.curso_id, c.seccion, c.escuela, c.num_alumnos, c.horas_teoria, c.horas_practica, c.horas_laboratorio, c.total_horas]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Fixed Robert\'s data!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
