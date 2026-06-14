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
          total_horas: c.total_horas,
          horas_teoria: c.horas_teoria || c.hrs_teo,
          horas_practica: c.horas_practica || c.hrs_pra,
          horas_laboratorio: c.horas_laboratorio || c.hrs_lab,
          teoria_grupos: c.teoria_grupos ?? 1,
          practica_grupos: c.practica_grupos ?? 1,
          laboratorio_grupos: c.laboratorio_grupos ?? 1
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
    // First check if the grupos columns exist, add them if they don't
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'carga_horaria_cursos' 
          AND column_name = 'teoria_grupos'
        ) THEN
          ALTER TABLE carga_horaria_cursos ADD COLUMN teoria_grupos INTEGER DEFAULT 1;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'carga_horaria_cursos' 
          AND column_name = 'practica_grupos'
        ) THEN
          ALTER TABLE carga_horaria_cursos ADD COLUMN practica_grupos INTEGER DEFAULT 1;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'carga_horaria_cursos' 
          AND column_name = 'laboratorio_grupos'
        ) THEN
          ALTER TABLE carga_horaria_cursos ADD COLUMN laboratorio_grupos INTEGER DEFAULT 1;
        END IF;
      END $$;
    `, []);

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

    // Helper function to ensure non-negative number
    const ensureNonNegative = (val: any) => {
      const num = Number(val);
      return isNaN(num) ? 0 : Math.max(num, 0);
    };

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
          // Validate and sanitize curso numeric fields
          const sanitizedCurso = {
            ...curso,
            numeroAlumnos: ensureNonNegative(curso.numeroAlumnos),
            teoriaHoras: ensureNonNegative(curso.teoriaHoras),
            teoriaGrupos: ensureNonNegative(curso.teoriaGrupos),
            practicaHoras: ensureNonNegative(curso.practicaHoras),
            practicaGrupos: ensureNonNegative(curso.practicaGrupos),
            laboratorioHoras: ensureNonNegative(curso.laboratorioHoras),
            laboratorioGrupos: ensureNonNegative(curso.laboratorioGrupos),
            totalHoras: ensureNonNegative(curso.totalHoras),
          };
          cursosByCiclo[cp].push(sanitizedCurso);
        }
      } else {
        // If no cursos, create one entry for ciclo_plan 1
        cursosByCiclo[1] = [];
      }

      // Sanitize all section horas fields
      const sanitizedPreparacion = { ...preparacion, horas: ensureNonNegative(preparacion?.horas) };
      const sanitizedConsejeria = { ...consejeria, horas: ensureNonNegative(consejeria?.horas) };
      const sanitizedInvestigacion = { ...investigacion, horas: ensureNonNegative(investigacion?.horas) };
      const sanitizedCapacitacion = { ...capacitacion, horas: ensureNonNegative(capacitacion?.horas) };
      const sanitizedGobierno = { ...gobierno, horas: ensureNonNegative(gobierno?.horas) };
      const sanitizedAdministracion = { ...administracion, horas: ensureNonNegative(administracion?.horas) };
      const sanitizedAsesoria = { ...asesoria, horas: ensureNonNegative(asesoria?.horas) };
      const sanitizedRsu = { ...rsu, horas: ensureNonNegative(rsu?.horas) };
      const sanitizedComites = { ...comites, horas: ensureNonNegative(comites?.horas) };

      // 2. For each ciclo_plan group, create a carga_horaria entry and insert the cursos
      const allCh = [];
      for (const [cpStr, cursosForCiclo] of Object.entries(cursosByCiclo)) {
        const cp = parseInt(cpStr);
        // Calculate total horas for this ciclo_plan's cursos
        const horasForCiclo = (cursosForCiclo || []).reduce((sum, curso) => 
          sum + parseInt(curso.totalHoras || '0'), 0
        );

        // Insert carga_horaria for this ciclo_plan
        // Note: previous DELETE already removed existing rows, so plain INSERT is safe
        const result = await client.query(
          `INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, facultad, dpto_academico, horas_asignadas, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           RETURNING *`,
          [docente_id, ciclo_academico_id, cp, modalidad, facultad, dpto_academico, horasForCiclo || 0]
        );
        const ch = result.rows[0];
        const cargaHorariaId = ch.id;
        allCh.push(ch);

        // Insert the cursos for this carga_horaria
        // First delete existing cursos for this carga_horaria_id
        await client.query('DELETE FROM carga_horaria_cursos WHERE carga_horaria_id = $1', [cargaHorariaId]);
        
        if (cursosForCiclo && cursosForCiclo.length > 0) {
          for (const curso of cursosForCiclo) {
            console.log('Inserting curso with curso_id:', curso.curso_id);
            console.log('Full curso data:', curso);
            await client.query(
              `INSERT INTO carga_horaria_cursos (
                carga_horaria_id, curso_id, seccion, escuela, num_alumnos, 
                hrs_teo, hrs_pra, hrs_lab, total_hrs,
                teoria_grupos, practica_grupos, laboratorio_grupos
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                cargaHorariaId,
                curso.curso_id,
                curso.seccion,
                curso.escuela,
                ensureNonNegative(curso.numeroAlumnos),
                ensureNonNegative(curso.teoriaHoras),
                ensureNonNegative(curso.practicaHoras),
                ensureNonNegative(curso.laboratorioHoras),
                ensureNonNegative(curso.totalHoras),
                ensureNonNegative(curso.teoriaGrupos),
                ensureNonNegative(curso.practicaGrupos),
                ensureNonNegative(curso.laboratorioGrupos)
              ]
            );
          }
        }

        // Helper function to upsert section data (delete + insert to avoid needing unique constraint)
        const upsertSection = async (tableName: string, data: any) => {
          if (!data) return;
          
          const horas = ensureNonNegative(data.horas);
          const descripcion = data.items?.[0]?.descripcion || data.descripcion || data.detalles || data.proyecto || data.plan || '';
          const descField = 
            tableName === 'carga_horaria_preparacion' ? 'descripcion' :
            tableName === 'carga_horaria_investigacion' ? 'proyecto' :
            tableName === 'carga_horaria_rsu' ? 'plan' :
            'detalles';
          
          await client.query('DELETE FROM ' + tableName + ' WHERE carga_horaria_id = $1', [cargaHorariaId]);
          
          await client.query(
            `INSERT INTO ${tableName} (carga_horaria_id, horas, ${descField})
             VALUES ($1, $2, $3)`,
            [cargaHorariaId, horas, descripcion]
          );
        };

        // 3. Upsert all sections for this carga_horaria
        await upsertSection('carga_horaria_preparacion', sanitizedPreparacion);
        await upsertSection('carga_horaria_consejeria', sanitizedConsejeria);
        await upsertSection('carga_horaria_investigacion', sanitizedInvestigacion);
        await upsertSection('carga_horaria_capacitacion', sanitizedCapacitacion);
        await upsertSection('carga_horaria_gobierno', sanitizedGobierno);
        await upsertSection('carga_horaria_administracion', sanitizedAdministracion);
        await upsertSection('carga_horaria_asesoria', sanitizedAsesoria);
        await upsertSection('carga_horaria_rsu', sanitizedRsu);
        await upsertSection('carga_horaria_comites', sanitizedComites);
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
