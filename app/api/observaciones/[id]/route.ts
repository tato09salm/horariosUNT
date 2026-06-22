import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

// GET - Obtener observación por ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await queryOne(`
      SELECT 
        oa.*,
        d.nombre as docente_nombre,
        d.apellidos as docente_apellidos,
        c.nombre as ciclo_nombre,
        COALESCE(oa.dia::text, a.dia::text) as dia,
        COALESCE(oa.tipo, a.tipo::text) as tipo,
        COALESCE(oa.hora_inicio::text, s.hora_inicio::text) as hora_inicio,
        COALESCE(oa.hora_fin::text, s.hora_fin::text) as hora_fin,
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
      WHERE oa.id = $1
    `, [id]);

    if (!result) {
      return NextResponse.json({ error: 'Observación no encontrada' }, { status: 404 });
    }

    if (session.rol === 'docente' && result.docente_id !== session.docente_id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Actualizar observación (texto solamente)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'docente'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { observaciones } = await req.json();

    const existente = await queryOne(`
      SELECT docente_id FROM observaciones_asignaciones
      WHERE id = $1
    `, [id]);

    if (!existente) {
      return NextResponse.json({ error: 'Observación no encontrada' }, { status: 404 });
    }

    if (session.rol === 'docente' && existente.docente_id !== session.docente_id) {
      return NextResponse.json({ error: 'Sin permisos para esta observación' }, { status: 403 });
    }

    const result = await queryOne(`
      UPDATE observaciones_asignaciones
      SET observaciones = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [observaciones || null, id]);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Actualizar estado de observación (secretaria/director)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const { estado } = await req.json();

    if (!['pendiente', 'validada', 'rechazada'].includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const existente = await queryOne(`SELECT id FROM observaciones_asignaciones WHERE id = $1`, [id]);
    if (!existente) {
      return NextResponse.json({ error: 'Observación no encontrada' }, { status: 404 });
    }

    const result = await queryOne(`
      UPDATE observaciones_asignaciones
      SET estado = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [estado, id]);

    return NextResponse.json({ data: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar observación (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'docente'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const existente = await queryOne(`
      SELECT docente_id FROM observaciones_asignaciones
      WHERE id = $1
    `, [id]);

    if (!existente) {
      return NextResponse.json({ error: 'Observación no encontrada' }, { status: 404 });
    }

    if (session.rol === 'docente' && existente.docente_id !== session.docente_id) {
      return NextResponse.json({ error: 'Sin permisos para esta observación' }, { status: 403 });
    }

    await query(`
      UPDATE observaciones_asignaciones SET estado = 'eliminado', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
