import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const anterior = await queryOne(`SELECT * FROM asignaciones WHERE id = $1`, [id]);
  await queryOne(`UPDATE asignaciones SET estado='eliminado', updated_at=NOW() WHERE id=$1`, [id]);

  await registrarAuditoria({
    usuario_id: session.id,
    usuario_nombre: `${session.nombre} ${session.apellidos}`,
    accion: 'UNASSIGN',
    tabla_afectada: 'asignaciones',
    registro_id: id,
    datos_anteriores: anterior,
    descripcion: `Asignación eliminada`,
  });

  return NextResponse.json({ success: true });
}
