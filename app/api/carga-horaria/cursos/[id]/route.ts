import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  try {
    const { observaciones, estado_observaciones } = await req.json();

    const curso = await queryOne(`SELECT * FROM carga_horaria_cursos WHERE id = $1`, [id]);
    if (!curso) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    // Docente solo puede modificar observaciones (texto) de sus propios cursos
    if (session.rol === 'docente') {
      if (estado_observaciones) {
        return NextResponse.json({ error: 'No puedes cambiar el estado de las observaciones' }, { status: 403 });
      }
      const ch = await queryOne(`SELECT docente_id FROM carga_horaria WHERE id = $1`, [curso.carga_horaria_id]);
      if (!ch || ch.docente_id !== session.docente_id) {
        return NextResponse.json({ error: 'Sin permisos para modificar este curso' }, { status: 403 });
      }
    } else if (!['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Build dynamic UPDATE
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (observaciones !== undefined) {
      sets.push(`observaciones = $${idx++}`);
      vals.push(observaciones || null);
      // Cuando un docente edita observaciones, resetear estado a pendiente
      if (session.rol === 'docente' && curso.estado_observaciones !== 'pendiente') {
        sets.push(`estado_observaciones = $${idx++}`);
        vals.push('pendiente');
      }
    }
    if (estado_observaciones !== undefined) {
      if (session.rol === 'docente') {
        return NextResponse.json({ error: 'No puedes cambiar el estado' }, { status: 403 });
      }
      if (!['pendiente', 'validada', 'rechazada'].includes(estado_observaciones)) {
        return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
      }
      sets.push(`estado_observaciones = $${idx++}`);
      vals.push(estado_observaciones);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    vals.push(id);

    const updated = await queryOne(`
      UPDATE carga_horaria_cursos SET ${sets.join(', ')}
      WHERE id = $${idx} RETURNING *
    `, vals);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'UPDATE',
      tabla_afectada: 'carga_horaria_cursos',
      registro_id: id,
      datos_anteriores: { observaciones: curso.observaciones, estado_observaciones: curso.estado_observaciones },
      datos_nuevos: { observaciones: updated?.observaciones, estado_observaciones: updated?.estado_observaciones },
      descripcion: estado_observaciones
        ? `Observaciones ${estado_observaciones === 'validada' ? 'validadas' : 'rechazadas'} por ${session.rol}`
        : 'Observaciones de carga lectiva actualizadas',
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
