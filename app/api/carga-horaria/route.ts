import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne, transaction } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloAcademicoId = searchParams.get('ciclo_academico_id');
  const cicloPlan = searchParams.get('ciclo_plan');
  const docenteId = searchParams.get('docente_id');
  const soloSinAsignacion = searchParams.get('solo_sin_asignacion') === 'true';

  try {
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
    const params: any[] = [];
    let paramIndex = 1;

    if (cicloAcademicoId) {
      querySql += ` AND ch.ciclo_academico_id = $${paramIndex}`;
      params.push(cicloAcademicoId);
      paramIndex++;
    }

    if (cicloPlan) {
      querySql += ` AND ch.ciclo_plan = $${paramIndex}`;
      params.push(parseInt(cicloPlan));
      paramIndex++;
    }

    if (docenteId) {
      querySql += ` AND ch.docente_id = $${paramIndex}`;
      params.push(docenteId);
      paramIndex++;
    }

    querySql += ` ORDER BY ch.ciclo_plan, d.apellidos, d.nombre`;

    let cargaHoraria: any[] = [];
    try {
      cargaHoraria = await query(querySql, params);
    } catch (dbErr) {
      console.error('Error fetching carga horaria base data:', dbErr);
    }

    // Add cursos and sections to each carga horaria
    for (let i = 0; i < cargaHoraria.length; i++) {
      const ch = cargaHoraria[i];
      console.log('Processing carga horaria:', ch.id, ch.docente_nombre);
      // Add cursos (or empty array if none)
      try {
        const cursos = await query(`
          SELECT chc.*, c.nombre as curso_nombre, c.codigo as curso_codigo, c.ciclo_plan
          FROM carga_horaria_cursos chc
          JOIN cursos c ON chc.curso_id = c.id
          WHERE chc.carga_horaria_id = $1
        `, [ch.id]);
        console.log('Found cursos for carga horaria:', cursos);
        // Map columns to what the frontend expects
        cargaHoraria[i].cursos = cursos.map(c => ({
          ...c,
          curso_id: c.curso_id,
          curso_nombre: c.curso_nombre,
          curso_codigo: c.curso_codigo,
          ciclo_plan: c.ciclo_plan,
          total_hrs: c.total_horas,
          hrs_teo: c.horas_teoria,
          hrs_pra: c.horas_practica,
          hrs_lab: c.horas_laboratorio
        }));
      } catch (err) {
        console.error('Error loading courses:', err);
        cargaHoraria[i].cursos = [];
      }
      
      // Add sections (or null if table doesn't exist)
      const sections = ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'] as const;
      for (const section of sections) {
        const table = `carga_horaria_${section}`;
        try {
          const result = await query(`
            SELECT * FROM ${table} WHERE carga_horaria_id = $1
          `, [ch.id]);
          cargaHoraria[i][section] = result[0] || null;
        } catch (err) {
          cargaHoraria[i][section] = null;
        }
      }
    }

    // Get total number of cursos per ciclo_plan (I-X)
    let totalCursosMap: Record<number, number> = {};
    try {
      const totalCursosPorCiclo = await query(`
        SELECT ciclo_plan, COUNT(*) as total
        FROM cursos
        WHERE activo = true
        GROUP BY ciclo_plan
        ORDER BY ciclo_plan
      `);
      // Create a map for easy access
      totalCursosPorCiclo.forEach((item: any) => {
        totalCursosMap[item.ciclo_plan] = item.total;
      });
    } catch (err) {
      console.error('Error getting total cursos:', err);
    }

    // If solo_sin_asignacion is true, filter out cycles that already have assignments
    if (soloSinAsignacion && cicloAcademicoId) {
      const assignedCycles = new Set(cargaHoraria.map((ch: any) => ch.ciclo_plan));
      // Return cycles 1-10 that don't have assignments
      const availableCycles = [];
      for (let i = 1; i <= 10; i++) {
        if (!assignedCycles.has(i)) {
          availableCycles.push({ ciclo_plan: i, tiene_asignacion: false });
        }
      }
      return NextResponse.json({ data: availableCycles });
    }

    return NextResponse.json({ 
      data: cargaHoraria,
      total_cursos_por_ciclo: totalCursosMap 
    });
  } catch (error: any) {
    console.error('❌ Error in GET /api/carga-horaria:', error);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json({ 
      data: [], 
      total_cursos_por_ciclo: {}, 
      error: error.message 
    }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      docente_id,
      ciclo_academico_id,
      ciclo_plan,
      modalidad,
      facultad,
      dpto_academico,
      cursos,
      preparacion,
      consejeria,
      investigacion,
      capacitacion,
      gobierno,
      administracion,
      asesoria,
      rsu,
      comites,
      total_horas
    } = body;

    if (!docente_id || !ciclo_academico_id) {
      return NextResponse.json({ error: 'docente_id y ciclo_academico_id son requeridos' }, { status: 400 });
    }

    const cargaHorariaResults = await transaction(async (client) => {
      // 0. First, delete all existing carga_horaria entries for this docente and ciclo_academico
      await client.query(
        'DELETE FROM carga_horaria WHERE docente_id = $1 AND ciclo_academico_id = $2',
        [docente_id, ciclo_academico_id]
      );

      // 1. Group cursos by their ciclo_plan (parse curso.ciclo_plan from string to number, default 1)
      const cursosByCiclo: Record<number, typeof cursos> = {};
      if (cursos && cursos.length > 0) {
        for (const curso of cursos) {
          const cp = parseInt(curso.ciclo_plan || curso.curso) || 1;
          if (!cursosByCiclo[cp]) {
            cursosByCiclo[cp] = [];
          }
          cursosByCiclo[cp].push(curso);
        }
      } else {
        // If no cursos, create one entry for ciclo_plan 1
        cursosByCiclo[1] = [];
      }

      // 2. For each ciclo_plan group, create a carga_horaria entry and insert the cursos
      const allCh = [];
      for (const [cpStr, cursosForCiclo] of Object.entries(cursosByCiclo)) {
        const cp = parseInt(cpStr);
        // Calculate total horas for this ciclo_plan's cursos
        const horasForCiclo = (cursosForCiclo || []).reduce((sum, curso) => 
          sum + parseInt(curso.totalHoras || '0'), 0
        );

        // Insert carga_horaria for this ciclo_plan
        const result = await client.query(
          `INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, facultad, dpto_academico, horas_asignadas, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (docente_id, ciclo_academico_id, ciclo_plan)
           DO UPDATE SET
             modalidad = EXCLUDED.modalidad,
             facultad = EXCLUDED.facultad,
             dpto_academico = EXCLUDED.dpto_academico,
             horas_asignadas = EXCLUDED.horas_asignadas,
             activo = true,
             updated_at = NOW()
           RETURNING *`,
          [docente_id, ciclo_academico_id, cp, modalidad, facultad, dpto_academico, horasForCiclo || 0]
        );
        const ch = result.rows[0];
        const cargaHorariaId = ch.id;
        allCh.push(ch);

        // Insert the cursos for this carga_horaria
        if (cursosForCiclo && cursosForCiclo.length > 0) {
          for (const curso of cursosForCiclo) {
            console.log('Inserting curso with curso_id:', curso.curso_id);
            console.log('Full curso data:', curso);
            await client.query(
              `INSERT INTO carga_horaria_cursos (
                carga_horaria_id, curso_id, seccion, escuela, num_alumnos, 
                horas_teoria, horas_practica, horas_laboratorio, total_horas
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                cargaHorariaId,
                curso.curso_id, // ONLY use curso.curso_id (valid UUID from cursos table)
                curso.seccion,
                curso.escuela,
                parseInt(curso.numeroAlumnos || '0'),
                parseInt(curso.teoriaHoras || '0'),
                parseInt(curso.practicaHoras || '0'),
                parseInt(curso.laboratorioHoras || '0'),
                parseInt(curso.totalHoras || '0')
              ]
            );
          }
        }

        // Helper function to upsert section data
        const upsertSection = async (tableName: string, data: any) => {
          if (!data) return;
          
          const horas = parseInt(data.horas || 0);
          const descripcion = data.items?.[0]?.descripcion || data.descripcion || data.detalles || data.proyecto || data.plan || '';
          const descField = 
            tableName === 'carga_horaria_preparacion' ? 'descripcion' :
            tableName === 'carga_horaria_investigacion' ? 'proyecto' :
            tableName === 'carga_horaria_rsu' ? 'plan' :
            'detalles';
          
          await client.query(
            `INSERT INTO ${tableName} (carga_horaria_id, horas, ${descField})
             VALUES ($1, $2, $3)
             ON CONFLICT (carga_horaria_id)
             DO UPDATE SET
               horas = EXCLUDED.horas,
               ${descField} = EXCLUDED.${descField},
               updated_at = NOW()`,
            [cargaHorariaId, horas, descripcion]
          );
        };

        // 3. Upsert all sections for this carga_horaria
        await upsertSection('carga_horaria_preparacion', preparacion);
        await upsertSection('carga_horaria_consejeria', consejeria);
        await upsertSection('carga_horaria_investigacion', investigacion);
        await upsertSection('carga_horaria_capacitacion', capacitacion);
        await upsertSection('carga_horaria_gobierno', gobierno);
        await upsertSection('carga_horaria_administracion', administracion);
        await upsertSection('carga_horaria_asesoria', asesoria);
        await upsertSection('carga_horaria_rsu', rsu);
        await upsertSection('carga_horaria_comites', comites);
      }

      return allCh;
    });

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'CREATE',
      tabla_afectada: 'carga_horaria',
      registro_id: cargaHorariaResults[0]?.id,
      datos_nuevos: body,
      descripcion: `Carga horaria completa guardada: docente_id=${docente_id}`,
    });

    return NextResponse.json({ data: cargaHorariaResults }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/carga-horaria:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 400 });
  }
}
