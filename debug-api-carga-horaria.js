
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function main() {
  try {
    const cicloAcademicoId = '92d41cbb-4404-495b-8eb3-85ba649b2b9e'; // 2026-I

    // Simulate API GET
    let querySql = `
      SELECT ch.*, 
             d.nombre as docente_nombre, 
             d.apellidos as docente_apellidos,
             d.dni as docente_dni,
             d.facultad as docente_facultad,
             d.dpto_academico as docente_dpto_academico,
             ca.nombre as ciclo_academico_nombre
      FROM carga_horaria ch
      JOIN docentes d ON ch.docente_id = d.id
      JOIN ciclos ca ON ch.ciclo_academico_id = ca.id
      WHERE ch.activo = true
    `;
    const params = [];
    let paramIndex = 1;

    if (cicloAcademicoId) {
      querySql += ` AND ch.ciclo_academico_id = $${paramIndex}`;
      params.push(cicloAcademicoId);
      paramIndex++;
    }

    querySql += ` ORDER BY ch.ciclo_plan, d.apellidos, d.nombre`;

    console.log('Running query:', querySql);
    console.log('With params:', params);

    let cargaHoraria = await query(querySql, params);
    console.log('\nInitial cargaHoraria:', cargaHoraria);

    // Add cursos and sections
    for (let i = 0; i < cargaHoraria.length; i++) {
      const ch = cargaHoraria[i];
      console.log('\nProcessing carga horaria:', ch.id, ch.docente_nombre);
      // Add cursos
      try {
        const cursos = await query(`
          SELECT chc.*, c.nombre as curso_nombre, c.codigo as curso_codigo, c.ciclo_plan
          FROM carga_horaria_cursos chc
          JOIN cursos c ON chc.curso_id = c.id
          WHERE chc.carga_horaria_id = $1
        `, [ch.id]);
        console.log('Found cursos:', cursos);
        cargaHoraria[i].cursos = cursos.map(c => ({
          ...c,
          curso_id: c.curso_id,
          curso_nombre: c.curso_nombre,
          curso_codigo: c.curso_codigo,
          ciclo_plan: c.ciclo_plan,
          total_horas: c.total_horas,
          horas_teoria: c.horas_teoria,
          horas_practica: c.horas_practica,
          horas_laboratorio: c.horas_laboratorio
        }));
        console.log('Mapped cursos:', cargaHoraria[i].cursos);
      } catch (err) {
        console.error('Error loading courses:', err);
        cargaHoraria[i].cursos = [];
      }
    }

    console.log('\nFinal cargaHoraria:', JSON.stringify(cargaHoraria, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
