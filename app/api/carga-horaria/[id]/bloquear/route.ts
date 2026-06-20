import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

// PATCH /api/carga-horaria/[id]/bloquear
// body: { formatos_generados: true/false }
// Solo secretaria/admin puede desbloquear (formatos_generados: false)
// El docente puede bloquear (formatos_generados: true) al generar sus formatos

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { formatos_generados } = body;

  // Solo admin/secretaria pueden DESBLOQUEAR (poner en false)
  if (formatos_generados === false) {
    if (!['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
      return NextResponse.json({ error: 'Solo la secretaria o admin puede desbloquear' }, { status: 403 });
    }
  }

  try {
    const updated = await queryOne(
      `UPDATE carga_horaria
       SET formatos_generados = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [formatos_generados, id]
    );

    if (!updated) {
      return NextResponse.json({ error: 'Carga horaria no encontrada' }, { status: 404 });
    }

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'carga_horaria',
      registro_id: id,
      datos_nuevos: { formatos_generados },
      descripcion: formatos_generados
        ? `Formatos generados — carga horaria bloqueada: id=${id}`
        : `Carga horaria desbloqueada por secretaria/admin: id=${id}`,
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}