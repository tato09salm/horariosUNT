
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'horariosUNT',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
});

const romanToNum = {
  'I': 1,
  'II': 2,
  'III': 3,
  'IV': 4,
  'V': 5,
  'VI': 6,
  'VII': 7,
  'VIII': 8,
  'IX': 9,
  'X': 10
};

async function importCargaHoraria() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find the active ciclo académico (first active one)
    const ciclosRes = await client.query("SELECT * FROM ciclos WHERE activo = true ORDER BY created_at DESC LIMIT 1");
    if (!ciclosRes.rows.length) {
      throw new Error('No hay ciclos académicos activos');
    }
    const cicloAcademico = ciclosRes.rows[0];
    console.log('Usando ciclo académico:', cicloAcademico.nombre, cicloAcademico.id);

    // Group CSV entries by (docente DNI, ciclo plan)
    const entries = [];
    const csvPath = path.join(__dirname, 'csvs', 'carga_2026_I_r.csv');

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          entries.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log('Leídos', entries.length, 'entradas del CSV');

    // Get all active cursos
    const cursosRes = await client.query('SELECT * FROM cursos WHERE activo = true');
    const cursosByCodigo = {};
    for (const curso of cursosRes.rows) {
      cursosByCodigo[curso.codigo] = curso;
    }

    // Get all active docentes
    const docentesRes = await client.query('SELECT * FROM docentes WHERE activo = true');
    const docentesByDNI = {};
    for (const docente of docentesRes.rows) {
      if (docente.dni) {
        docentesByDNI[docente.dni] = docente;
      }
    }

    console.log('Encontrados', Object.keys(cursosByCodigo).length, 'cursos y', Object.keys(docentesByDNI).length, 'docentes');

    // Group entries by docente DNI first
    const entriesByDocente = {};
    for (const entry of entries) {
      const docenteDNI = entry.DOCENTE;
      if (!entriesByDocente[docenteDNI]) {
        entriesByDocente[docenteDNI] = [];
      }
      entriesByDocente[docenteDNI].push(entry);
    }

    // For each docente, create carga horaria entries for each ciclo plan they are in
    const cargaHorarias = [];
    const cargaHorariaCursos = [];

    for (const [docenteDNI, docenteEntries] of Object.entries(entriesByDocente)) {
      const docente = docentesByDNI[docenteDNI];
      if (!docente) {
        console.warn('Docente no encontrado con DNI:', docenteDNI);
        continue;
      }

      // Group docente entries by ciclo plan
      const entriesByCicloPlan = {};
      for (const entry of docenteEntries) {
        const cicloPlan = romanToNum[entry.CICLO];
        if (!cicloPlan) {
          console.warn('Ciclo romano no reconocido:', entry.CICLO);
          continue;
        }
        if (!entriesByCicloPlan[cicloPlan]) {
          entriesByCicloPlan[cicloPlan] = [];
        }
        entriesByCicloPlan[cicloPlan].push(entry);
      }

      for (const [cicloPlanStr, cicloEntries] of Object.entries(entriesByCicloPlan)) {
        const cicloPlan = parseInt(cicloPlanStr);

        // Create or get carga horaria
        const existingCH = await client.query(
          'SELECT * FROM carga_horaria WHERE docente_id = $1 AND ciclo_academico_id = $2 AND ciclo_plan = $3',
          [docente.id, cicloAcademico.id, cicloPlan]
        );

        let chId;
        let totalHoras = 0;

        if (existingCH.rows.length > 0) {
          chId = existingCH.rows[0].id;
          totalHoras = existingCH.rows[0].horas_asignadas || 0;
        } else {
          const insertCH = await client.query(
            `INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, horas_asignadas, facultad, dpto_academico, modalidad, activo, created_at, updated_at)
             VALUES ($1, $2, $3, 0, $4, $5, 'Tiempo Completo', true, NOW(), NOW())
             RETURNING id`,
            [docente.id, cicloAcademico.id, cicloPlan, docente.facultad || 'Facultad de Ciencias', docente.dpto_academico || 'Dpto. de Informática']
          );
          chId = insertCH.rows[0].id;
        }

        // Process each course entry for this docente and ciclo plan
        for (const entry of cicloEntries) {
          const cursoCodigo = entry.CODIGO;
          const curso = cursosByCodigo[cursoCodigo];
          if (!curso) {
            console.warn('Curso no encontrado con código:', cursoCodigo);
            continue;
          }

          const horasTeoria = parseInt(entry.T) || 0;
          const horasPractica = parseInt(entry.P) || 0;
          const horasLaboratorio = parseInt(entry.L) || 0;
          const totalHorasCurso = horasTeoria + horasPractica + horasLaboratorio;

          // Insert into carga_horaria_cursos
          await client.query(
            `INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, horas_teoria, horas_practica, horas_laboratorio, total_horas, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
            [chId, curso.id, entry.GRUPO, curso.escuela || 'Ingeniería de Sistemas', 0, horasTeoria, horasPractica, horasLaboratorio, totalHorasCurso]
          );

          totalHoras += totalHorasCurso;
        }

        // Update total horas in carga horaria
        await client.query(
          'UPDATE carga_horaria SET horas_asignadas = $1 WHERE id = $2',
          [totalHoras, chId]
        );

        console.log(`Carga horaria creada/actualizada para docente ${docente.nombre} ${docente.apellidos}, ciclo ${cicloPlan}, total horas: ${totalHoras}`);
      }
    }

    await client.query('COMMIT');
    console.log('Importación completada exitosamente!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante la importación:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

importCargaHoraria().catch(console.error);
