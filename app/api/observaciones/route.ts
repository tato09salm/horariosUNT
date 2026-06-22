import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

// GET - Listar observaciones (con filtros opcionales)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const grupo_id = searchParams.get('grupo_id');
    const asignacion_id = searchParams.get('asignacion_id');
    const docente_id = searchParams.get('docente_id');
    const ciclo_id = searchParams.get('ciclo_id');

    let queryStr = `
      SELECT 
        oa.*,
        d.nombre as docente_nombre,
        d.apellidos as docente_apellidos,
        c.nombre as ciclo_nombre,
<<<<<<< HEAD
        COALESCE(oa.dia::text, a.dia::text) as dia,
        COALESCE(oa.tipo, a.tipo::text) as tipo,
        COALESCE(oa.hora_inicio::text, s.hora_inicio::text) as hora_inicio,
        COALESCE(oa.hora_fin::text, s.hora_fin::text) as hora_fin,
=======
        COALESCE(oa.dia, a.dia) as dia,
        COALESCE(oa.tipo, a.tipo::text) as tipo,
        COALESCE(oa.hora_inicio, s.hora_inicio) as hora_inicio,
        COALESCE(oa.hora_fin, s.hora_fin) as hora_fin,
>>>>>>> 38f1f41de45b79a37428d4694f91b2fd2630bd29
        cu.codigo as curso_codigo,
        cu.nombre as curso_nombre,
        g.numero_grupo
      FROM observaciones_asignaciones oa
      JOIN docentes d ON d.id = oa.docente_id
      JOIN ciclos c ON c.id = oa.ciclo_id
      LEFT JOIN asignaciones a ON a.id = oa.asignacion_id
      LEFT JOIN slots_tiempo s ON s.id = COALESCE(oa.slot_id, a.slot_id)
      LEFT JOIN grupos g ON g.id = COALESCE(oa.grupo_id, a.grupo_id)
      LEFT JOIN cursos cu ON cu.id = g.curso_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (grupo_id) {
      queryStr += ` AND (oa.grupo_id = $${idx++} OR a.grupo_id = $${idx-1})`;
      params.push(grupo_id);
    }

    if (asignacion_id) {
      queryStr += ` AND oa.asignacion_id = $${idx++}`;
      params.push(asignacion_id);
    }

    if (docente_id) {
      queryStr += ` AND oa.docente_id = $${idx++}`;
      params.push(docente_id);
    }

    if (ciclo_id) {
      queryStr += ` AND oa.ciclo_id = $${idx++}`;
      params.push(ciclo_id);
    }

<<<<<<< HEAD
    // Excluir eliminados por defecto, a menos que se pida explicitamente
    const incluirEliminados = searchParams.get('incluir_eliminados');
    if (!incluirEliminados) {
      queryStr += ` AND (oa.estado IS NULL OR oa.estado != 'eliminado')`;
    }

    // Si es docente, solo ver sus propias observaciones
    if (session.rol === 'docente') {
      let docenteId = session.docente_id;
      // Fallback: look up docente_id by email if not in JWT
      if (!docenteId && session.email) {
        const d = await queryOne<{ id: string }>(
          'SELECT id FROM docentes WHERE email = $1 AND activo = true',
          [session.email]
        );
        if (d) docenteId = d.id;
      }
      if (docenteId) {
        queryStr += ` AND oa.docente_id = $${idx++}`;
        params.push(docenteId);
      } else {
        return NextResponse.json({ data: [] });
      }
=======
    // Si es docente, solo ver sus propias observaciones
    if (session.rol === 'docente') {
      queryStr += ` AND oa.docente_id = $${idx++}`;
      params.push(session.docente_id);
>>>>>>> 38f1f41de45b79a37428d4694f91b2fd2630bd29
    }

    queryStr += ` ORDER BY oa.created_at DESC`;

    const result = await query(queryStr, params);
    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

<<<<<<< HEAD
// POST - Crear o actualizar observación
=======
// POST - Crear o actualizar observación (1 por grupo)
>>>>>>> 38f1f41de45b79a37428d4694f91b2fd2630bd29
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'docente'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
<<<<<<< HEAD
    const { asignacion_id, grupo_id, observaciones, dia, slot_id, tipo, hora_inicio, hora_fin, estado, ciclo_id } = await req.json();

    let docenteId = session.docente_id;
    // Fallback: look up docente_id by email if not in JWT
    if (!docenteId && session.rol === 'docente' && session.email) {
      const d = await queryOne<{ id: string }>(
        'SELECT id FROM docentes WHERE email = $1 AND activo = true',
        [session.email]
      );
      if (d) docenteId = d.id;
    }
    let cicloId = null;

    if (grupo_id) {
      // Con grupo_id: buscar docente y ciclo desde programacion_cursos
      if (session.rol === 'docente' && docenteId) {
        const pc = await queryOne(`
          SELECT p.ciclo_id
          FROM programacion_cursos pc
          JOIN programaciones p ON p.id = pc.programacion_id
          WHERE pc.grupo_id = $1 AND pc.docente_id = $2 LIMIT 1
        `, [grupo_id, docenteId]);
        if (pc) cicloId = pc.ciclo_id;
      } else {
        const pc = await queryOne(`
          SELECT pc.docente_id, p.ciclo_id
          FROM programacion_cursos pc
          JOIN programaciones p ON p.id = pc.programacion_id
          WHERE pc.grupo_id = $1 LIMIT 1
        `, [grupo_id]);
        if (pc) { docenteId = pc.docente_id; cicloId = pc.ciclo_id; }
      }
      // Fallback: usar ciclo activo si no se pudo resolver
      if (!cicloId) {
        const activeCiclo = await queryOne(`SELECT id FROM ciclos WHERE activo = true LIMIT 1`);
        cicloId = activeCiclo?.id || null;
      }
    } else if (session.rol === 'docente' && docenteId) {
      // Sin grupo_id: el docente crea una observación libre
      cicloId = ciclo_id || null;
      if (!cicloId) {
        const activeCiclo = await queryOne(`SELECT id FROM ciclos WHERE activo = true LIMIT 1`);
        cicloId = activeCiclo?.id || null;
      }
    }

    if (!docenteId) {
      return NextResponse.json({ error: 'No se pudo determinar el docente' }, { status: 404 });
    }
    if (!cicloId) {
      return NextResponse.json({ error: 'No se pudo determinar el ciclo' }, { status: 404 });
    }

    if (grupo_id) {
      // Upsert: buscar si ya existe una observación para este grupo+docente
      const existente = await queryOne(`
        SELECT id FROM observaciones_asignaciones
        WHERE grupo_id = $1 AND docente_id = $2
        LIMIT 1
      `, [grupo_id, docenteId]);

      if (existente) {
        const updateFields = ['observaciones = $1', 'dia = $2', 'slot_id = $3', 'tipo = $4', 'hora_inicio = $5', 'hora_fin = $6', 'updated_at = NOW()'];
        const updateParams = [observaciones || null, dia || null, slot_id || null, tipo || null, hora_inicio || null, hora_fin || null];
        if (estado) {
          updateFields.push(`estado = $${updateParams.length + 1}`);
          updateParams.push(estado);
        }
        updateParams.push(existente.id);
        const result = await queryOne(`
          UPDATE observaciones_asignaciones
          SET ${updateFields.join(', ')}
          WHERE id = $${updateParams.length}
          RETURNING *
        `, updateParams);
        return NextResponse.json({ data: result, updated: true });
      }
    }

    // INSERT nueva
    const insertFields = ['asignacion_id', 'grupo_id', 'docente_id', 'ciclo_id', 'observaciones', 'dia', 'slot_id', 'tipo', 'hora_inicio', 'hora_fin'];
    const insertValues: any[] = [asignacion_id || null, grupo_id || null, docenteId, cicloId, observaciones || null, dia || null, slot_id || null, tipo || null, hora_inicio || null, hora_fin || null];
    let insertPlaceholders = '$1, $2, $3, $4, $5, $6, $7, $8, $9, $10';
    if (estado) {
      insertFields.push('estado');
      insertValues.push(estado);
      insertPlaceholders += `, $${insertValues.length}`;
    }
    const result = await queryOne(`
      INSERT INTO observaciones_asignaciones (${insertFields.join(', ')})
      VALUES (${insertPlaceholders})
      RETURNING *
    `, insertValues);
    return NextResponse.json({ data: result, updated: false }, { status: 201 });
  } catch (error: any) {
    console.error('[observaciones POST] Error:', error.message, error.stack?.substring(0,500));
=======
    const { asignacion_id, grupo_id, observaciones, dia, slot_id, tipo, hora_inicio, hora_fin } = await req.json();

    if (!grupo_id) {
      return NextResponse.json({ error: 'grupo_id requerido' }, { status: 400 });
    }

    // For docente, prioritize finding a record that matches their own docente_id
    let asignacion: any = null;

    if (session.rol === 'docente' && session.docente_id) {
      asignacion = { docente_id: session.docente_id, ciclo_id: null };

      // Try to get ciclo_id from programacion_cursos
      const pc = await queryOne(`
        SELECT p.ciclo_id
        FROM programacion_cursos pc
        JOIN programaciones p ON p.id = pc.programacion_id
        WHERE pc.grupo_id = $1 AND pc.docente_id = $2 LIMIT 1
      `, [grupo_id, session.docente_id]);
      if (pc) {
        asignacion.ciclo_id = pc.ciclo_id;
      }
      if (!asignacion.ciclo_id) {
        const activeCiclo = await queryOne(`SELECT id FROM ciclos WHERE activo = true LIMIT 1`);
        asignacion.ciclo_id = activeCiclo?.id || null;
      }
    } else {
      // Admin/secretaria: try programacion_cursos
      const pc = await queryOne(`
        SELECT pc.docente_id, p.ciclo_id
        FROM programacion_cursos pc
        JOIN programaciones p ON p.id = pc.programacion_id
        WHERE pc.grupo_id = $1 LIMIT 1
      `, [grupo_id]);
      if (pc) {
        asignacion = { docente_id: pc.docente_id, ciclo_id: pc.ciclo_id };
      }
    }

    if (!asignacion || !asignacion.docente_id) {
      return NextResponse.json({ error: 'No se pudo determinar el docente de esta asignación' }, { status: 404 });
    }
    if (!asignacion.ciclo_id) {
      return NextResponse.json({ error: 'No se pudo determinar el ciclo de esta asignación' }, { status: 404 });
    }

    // Buscar si ya existe una observación para este grupo (por grupo_id en la propia tabla)
    const existente = await queryOne(`
      SELECT id FROM observaciones_asignaciones
      WHERE grupo_id = $1 AND docente_id = $2
      LIMIT 1
    `, [grupo_id, asignacion.docente_id]);

    if (existente) {
      // UPDATE existente
      const result = await queryOne(`
        UPDATE observaciones_asignaciones
        SET observaciones = $1, dia = $2, slot_id = $3, tipo = $4, hora_inicio = $5, hora_fin = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [observaciones || null, dia || null, slot_id || null, tipo || null, hora_inicio || null, hora_fin || null, existente.id]);
      return NextResponse.json({ data: result, updated: true });
    } else {
      // INSERT nueva
      const result = await queryOne(`
        INSERT INTO observaciones_asignaciones (asignacion_id, grupo_id, docente_id, ciclo_id, observaciones, dia, slot_id, tipo, hora_inicio, hora_fin)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [asignacion_id || grupo_id, grupo_id, asignacion.docente_id, asignacion.ciclo_id, observaciones || null, dia || null, slot_id || null, tipo || null, hora_inicio || null, hora_fin || null]);
      return NextResponse.json({ data: result, updated: false }, { status: 201 });
    }
  } catch (error: any) {
>>>>>>> 38f1f41de45b79a37428d4694f91b2fd2630bd29
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
