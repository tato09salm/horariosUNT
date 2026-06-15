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
      
      // Add sections - return all rows for multi-item support
      const sections = ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'] as const;
      for (const section of sections) {
        const table = `carga_horaria_${section}`;
        try {
          const rows = await query(`
            SELECT * FROM ${table} WHERE carga_horaria_id = $1 ORDER BY orden ASC, id ASC
          `, [ch.id]);
          cargaHoraria[i][section] = rows.length > 0 ? rows : null;
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
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json();

  if (session.rol === 'docente') {
    const d = await queryOne<{ id: string }>('SELECT id FROM docentes WHERE email = $1 AND activo = true', [session.email]);
    if (!d || d.id !== body.docente_id) {
      return NextResponse.json({ error: 'Solo puedes guardar tu propia carga horaria' }, { status: 403 });
    }
  } else if (!['admin', 'director_escuela', 'docente', 'secretaria'].includes(session.rol)) {
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

    // Si es docente, verificar que sea su propia carga horaria (por email)
    if (session.rol === 'docente') {
      const docente = await queryOne(`SELECT id FROM docentes WHERE email = $1`, [session.email]);
      if (!docente || docente.id !== docente_id) {
        return NextResponse.json({ error: 'No puedes crear la carga horaria de otro docente' }, { status: 403 });
      }
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

      // 1. Validate and sanitize all courses
      const sanitizedCursos = (cursos || []).map((curso: any) => ({
        ...curso,
        numeroAlumnos: ensureNonNegative(curso.numeroAlumnos),
        teoriaHoras: ensureNonNegative(curso.teoriaHoras),
        teoriaGrupos: ensureNonNegative(curso.teoriaGrupos),
        practicaHoras: ensureNonNegative(curso.practicaHoras),
        practicaGrupos: ensureNonNegative(curso.practicaGrupos),
        laboratorioHoras: ensureNonNegative(curso.laboratorioHoras),
        laboratorioGrupos: ensureNonNegative(curso.laboratorioGrupos),
        totalHoras: ensureNonNegative(curso.totalHoras),
      }));

      // Sanitize all section fields (including per-item horas)
      const sanitizeSeccion = (s: any) => ({
        ...s,
        horas: ensureNonNegative(s?.horas),
        items: (s?.items || []).map((item: any) => ({
          ...item,
          horas: ensureNonNegative(item.horas || s?.horas || 0),
        })),
      });
      const sanitizedPreparacion = sanitizeSeccion(preparacion);
      const sanitizedConsejeria = sanitizeSeccion(consejeria);
      const sanitizedInvestigacion = sanitizeSeccion(investigacion);
      const sanitizedCapacitacion = sanitizeSeccion(capacitacion);
      const sanitizedGobierno = sanitizeSeccion(gobierno);
      const sanitizedAdministracion = sanitizeSeccion(administracion);
      const sanitizedAsesoria = sanitizeSeccion(asesoria);
      const sanitizedRsu = sanitizeSeccion(rsu);
      const sanitizedComites = sanitizeSeccion(comites);

      // Calculate total horas for all cursos
      const horasCursos = sanitizedCursos.reduce((sum: number, curso: any) => 
        sum + parseInt(curso.totalHoras || '0'), 0
      );

      // 2. Insert exactly ONE carga_horaria entry
      const result = await client.query(
        `INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, facultad, dpto_academico, horas_asignadas, activo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *`,
        [docente_id, ciclo_academico_id, ciclo_plan || 1, modalidad, facultad, dpto_academico, horasCursos || 0]
      );
      const ch = result.rows[0];
      const cargaHorariaId = ch.id;

      // Insert all courses for this carga_horaria
      await client.query('DELETE FROM carga_horaria_cursos WHERE carga_horaria_id = $1', [cargaHorariaId]);
      
      for (const curso of sanitizedCursos) {
        console.log('Inserting curso with curso_id:', curso.curso_id);
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
            curso.numeroAlumnos,
            curso.teoriaHoras,
            curso.practicaHoras,
            curso.laboratorioHoras,
            curso.totalHoras,
            curso.teoriaGrupos,
            curso.practicaGrupos,
            curso.laboratorioGrupos
          ]
        );
      }

      // Helper function to upsert section data (delete + insert each item)
      const upsertSection = async (tableName: string, data: any) => {
        if (!data) return;

        const descField = 
          tableName === 'carga_horaria_preparacion' ? 'descripcion' :
          tableName === 'carga_horaria_investigacion' ? 'proyecto' :
          tableName === 'carga_horaria_rsu' ? 'plan' :
          'detalles';
        
        await client.query('DELETE FROM ' + tableName + ' WHERE carga_horaria_id = $1', [cargaHorariaId]);

        const items = data.items || [];
        if (items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const horas = ensureNonNegative(item.horas || data.horas || 0);
            const descripcion = item.descripcion || '';
            const dia = item.dia || null;
            const hora_inicio = item.hora_inicio || null;
            const hora_fin = item.hora_fin || null;

            if (horas > 0 || descripcion) {
              await client.query(
                `INSERT INTO ${tableName} (carga_horaria_id, horas, ${descField}, dia, hora_inicio, hora_fin, orden)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [cargaHorariaId, horas, descripcion, dia, hora_inicio, hora_fin, i]
              );
            }
          }
        } else {
          // Legacy fallback: single row
          const horas = ensureNonNegative(data.horas || 0);
          const descripcion = data.descripcion || data.detalles || data.proyecto || data.plan || '';
          if (horas > 0) {
            await client.query(
              `INSERT INTO ${tableName} (carga_horaria_id, horas, ${descField})
               VALUES ($1, $2, $3)`,
              [cargaHorariaId, horas, descripcion]
            );
          }
        }
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

      return [ch];
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
    console.error('Error stack:', error?.stack);
    return NextResponse.json({ 
      error: error?.message || String(error), 
      stack: error?.stack 
    }, { status: 400 });
  }
}
