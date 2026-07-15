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
      d.modalidad as docente_modalidad,
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

      // Add cursos (or empty array if none)
      try {
        const cursos = await query(`
          SELECT chc.*, c.nombre as curso_nombre, c.codigo as curso_codigo, c.ciclo_plan
          FROM carga_horaria_cursos chc
          JOIN cursos c ON chc.curso_id = c.id
          WHERE chc.carga_horaria_id = $1
        `, [ch.id]);

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
          laboratorio_grupos: c.laboratorio_grupos ?? 1,
          observaciones: c.observaciones || '',
          estado_observaciones: c.estado_observaciones || 'pendiente',
          curricula_id: c.curricula_id,
          curricula_nombre: c.curricula_nombre,
          dia: c.dia,
          hora_inicio: c.hora_inicio,
          hora_fin: c.hora_fin,
          horario_slots: c.horario_slots
        }));
      } catch (err) {
        console.error('Error loading courses:', err);
        cargaHoraria[i].cursos = [];
      }
      
      // Add sections - return all rows for multi-item support and include _horarioSlots
      const sections = ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'] as const;
      for (const section of sections) {
        const table = `carga_horaria_${section}`;
        let rows: any[] = [];
        try {
          rows = await query(`
            SELECT * FROM ${table} WHERE carga_horaria_id = $1 ORDER BY orden ASC, id ASC
          `, [ch.id]);
        } catch (_) {
          // Fallback if orden column doesn't exist
          try {
            rows = await query(`
              SELECT * FROM ${table} WHERE carga_horaria_id = $1 ORDER BY id ASC
            `, [ch.id]);
          } catch (_2) {
            rows = [];
          }
        }
        try {
          
          if (rows.length > 0) {
            // Map DB rows to frontend's expected format
            const totalHoras = rows.reduce((sum, row) => sum + (parseInt(row.horas) || 0), 0);
            const sectionData: any = {
              items: rows.map(row => ({
                id: row.id,
                descripcion: row.descripcion || row.detalles || row.proyecto || row.plan || '',
                horas: String(row.horas || 0),
                dia: row.dia,
                hora_inicio: row.hora_inicio,
                hora_fin: row.hora_fin
              })),
              horas: String(totalHoras),
              _horarioSlots: rows[0]?.horario_slots // Get horario_slots from first row (since we store it on first item)
            };
            cargaHoraria[i][section] = sectionData;
          } else {
            // Initial state for empty sections
            cargaHoraria[i][section] = {
              items: [{ id: `${section}-1`, descripcion: '', horas: '0' }],
              horas: '0'
            };
          }
        } catch (err) {
          console.error('Error loading section:', section, err);
          // Fallback to initial state
          cargaHoraria[i][section] = {
            items: [{ id: `${section}-1`, descripcion: '', horas: '0' }],
            horas: '0'
          };
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
  try {
    const d = await queryOne<{ id: string }>(
      'SELECT id FROM docentes WHERE email = $1 AND activo = true', 
      [session.email]
    );
    if (!d || d.id !== body.docente_id) {
      return NextResponse.json({ error: 'Solo puedes guardar tu propia carga horaria' }, { status: 403 });
    }
  } catch (e) {
    console.error('Error verificando docente:', e);
  }
} else if (!['admin', 'director_escuela', 'docente', 'secretaria'].includes(session.rol)) {
  return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
}

  try {
    // Ensure all required columns exist on carga_horaria_cursos
    const cursoColumns = [
      { name: 'teoria_grupos', type: 'INTEGER DEFAULT 1' },
      { name: 'practica_grupos', type: 'INTEGER DEFAULT 1' },
      { name: 'laboratorio_grupos', type: 'INTEGER DEFAULT 1' },
      { name: 'observaciones', type: 'TEXT' },
      { name: 'estado_observaciones', type: 'VARCHAR(20) DEFAULT \'pendiente\'' },
      { name: 'curricula_id', type: 'UUID REFERENCES curriculas(id) ON DELETE SET NULL' },
      { name: 'curricula_nombre', type: 'TEXT' },
      { name: 'dia', type: 'TEXT' },
      { name: 'hora_inicio', type: 'TEXT' },
      { name: 'hora_fin', type: 'TEXT' },
      { name: 'horario_slots', type: 'JSONB' }
    ];
    for (const col of cursoColumns) {
      try {
        await query(`
          DO $$ BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'carga_horaria_cursos' 
              AND column_name = '${col.name}'
            ) THEN
              EXECUTE 'ALTER TABLE carga_horaria_cursos ADD COLUMN ${col.name} ${col.type}';
            END IF;
          END $$;
        `);
      } catch (_) {}
    }

    // Add time columns (dia, hora_inicio, hora_fin, orden) and horario_slots to all section tables if missing
    const sectionTables = [
      'carga_horaria_preparacion', 'carga_horaria_consejeria', 
      'carga_horaria_investigacion', 'carga_horaria_capacitacion',
      'carga_horaria_gobierno', 'carga_horaria_administracion',
      'carga_horaria_asesoria', 'carga_horaria_rsu', 
      'carga_horaria_comites'
    ];
    const sectionCols: [string, string][] = [
      ['dia', 'TEXT'],
      ['hora_inicio', 'TEXT'],
      ['hora_fin', 'TEXT'],
      ['orden', 'INTEGER DEFAULT 0'],
      ['horario_slots', 'JSONB'],
    ];
    for (const tbl of sectionTables) {
      for (const [col, colType] of sectionCols) {
        try {
          await query(`
            DO $$ BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = '${tbl}' 
                AND column_name = '${col}'
              ) THEN
                EXECUTE 'ALTER TABLE ${tbl} ADD COLUMN ${col} ${colType}';
              END IF;
            END $$;
          `);
        } catch (_) {}
      }
    }

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
      total_horas,
      adicional
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
        `INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, facultad, dpto_academico, horas_asignadas, activo, adicional)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING *`,
        [docente_id, ciclo_academico_id, ciclo_plan || 1, modalidad, facultad, dpto_academico, horasCursos || 0, adicional ? JSON.stringify(adicional) : null]
      );
      const ch = result.rows[0];
      const cargaHorariaId = ch.id;

      // Insert all courses for this carga_horaria
      await client.query('DELETE FROM carga_horaria_cursos WHERE carga_horaria_id = $1', [cargaHorariaId]);
      
      for (const curso of sanitizedCursos) {
        // Get custom schedule fields
        const dia = curso.dia || null;
        const hora_inicio = curso.hora_inicio || null;
        const hora_fin = curso.hora_fin || null;
        const horario_slots = curso._horarioSlots || null;

        await client.query(
          `INSERT INTO carga_horaria_cursos (
            carga_horaria_id, curso_id, seccion, escuela, num_alumnos, 
            hrs_teo, hrs_pra, hrs_lab, total_hrs,
            teoria_grupos, practica_grupos, laboratorio_grupos, observaciones,
            curricula_id, curricula_nombre,
            dia, hora_inicio, hora_fin, horario_slots
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
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
            curso.laboratorioGrupos,
            curso.observaciones || null,
            curso.curriculaId || null,
            curso.curriculaNombre || null,
            dia,
            hora_inicio,
            hora_fin,
            horario_slots ? JSON.stringify(horario_slots) : null
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

        // First check which columns exist on this table
        const columnsResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        const existingColumns = new Set(columnsResult.rows.map((row: any) => row.column_name));

        // Get _horarioSlots from section data
        const sectionHorarioSlots = data._horarioSlots || null;

        const items = data.items || [];
        if (items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const horas = ensureNonNegative(item.horas || data.horas || 0);
            const descripcion = item.descripcion || '';
            const dia = existingColumns.has('dia') ? (item.dia || null) : null;
            const hora_inicio = existingColumns.has('hora_inicio') ? (item.hora_inicio || null) : null;
            const hora_fin = existingColumns.has('hora_fin') ? (item.hora_fin || null) : null;
            const orden = existingColumns.has('orden') ? i : 0;
            const horario_slots = existingColumns.has('horario_slots') ? (i === 0 && sectionHorarioSlots ? sectionHorarioSlots : null) : null;

            if (horas > 0 || descripcion) {
              // Build INSERT query dynamically
              let insertColumns = ['carga_horaria_id', 'horas', descField];
              let insertValues = [cargaHorariaId, horas, descripcion];
              let paramIndex = 4;

              if (existingColumns.has('dia')) {
                insertColumns.push('dia');
                insertValues.push(dia);
              }
              if (existingColumns.has('hora_inicio')) {
                insertColumns.push('hora_inicio');
                insertValues.push(hora_inicio);
              }
              if (existingColumns.has('hora_fin')) {
                insertColumns.push('hora_fin');
                insertValues.push(hora_fin);
              }
              if (existingColumns.has('orden')) {
                insertColumns.push('orden');
                insertValues.push(orden);
              }
              if (existingColumns.has('horario_slots')) {
                insertColumns.push('horario_slots');
                insertValues.push(horario_slots ? JSON.stringify(horario_slots) : null);
              }

              const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(', ');
              const insertSql = `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`;
              await client.query(insertSql, insertValues);
            }
          }
        } else {
          // Legacy fallback: single row
          const horas = ensureNonNegative(data.horas || 0);
          const descripcion = data.descripcion || data.detalles || data.proyecto || data.plan || '';
          if (horas > 0) {
            // Build INSERT query dynamically for legacy case too
            let insertColumns = ['carga_horaria_id', 'horas', descField];
            let insertValues = [cargaHorariaId, horas, descripcion];
            let paramIndex = 4;

            // If time columns exist, insert NULLs to be consistent
            if (existingColumns.has('dia')) {
              insertColumns.push('dia');
              insertValues.push(null);
            }
            if (existingColumns.has('hora_inicio')) {
              insertColumns.push('hora_inicio');
              insertValues.push(null);
            }
            if (existingColumns.has('hora_fin')) {
              insertColumns.push('hora_fin');
              insertValues.push(null);
            }
            if (existingColumns.has('orden')) {
              insertColumns.push('orden');
              insertValues.push(0);
            }
            if (existingColumns.has('horario_slots')) {
              insertColumns.push('horario_slots');
              insertValues.push(sectionHorarioSlots ? JSON.stringify(sectionHorarioSlots) : null);
            }

            const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`).join(', ');
            const insertSql = `INSERT INTO ${tableName} (${insertColumns.join(', ')}) VALUES (${placeholders})`;
            await client.query(insertSql, insertValues);
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

    // Notificar al docente si quien guarda no es el mismo docente
    if (session.rol !== 'docente' && docente_id) {
      try {
        const docenteUser = await queryOne<{ usuario_id: string }>(
          'SELECT usuario_id FROM docentes WHERE id = $1',
          [docente_id]
        );
        if (docenteUser?.usuario_id) {
          const docenteEmail = session.rol === 'admin' || session.rol === 'secretaria' || session.rol === 'director_escuela';
          const rolLabel: Record<string, string> = { admin: 'Administrador', secretaria: 'Secretario/a', director_escuela: 'Director de Escuela' };
          const quien = rolLabel[session.rol] || session.rol;

          await query(`
            CREATE TABLE IF NOT EXISTS notificaciones (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
              titulo TEXT NOT NULL,
              mensaje TEXT NOT NULL,
              tipo VARCHAR(50) DEFAULT 'info',
              leida BOOLEAN DEFAULT false,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `);

          await query(`
            INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
            VALUES ($1, $2, $3, $4)
          `, [
            docenteUser.usuario_id,
            'Carga horaria modificada',
            `${quien} ha modificado tu carga horaria (${modalidad || 'sin modalidad'}). Revisa los cambios.`,
            'carga_modificada'
          ]);
        }
      } catch (notifErr) {
        console.error('Error creating notification:', notifErr);
      }
    }

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
