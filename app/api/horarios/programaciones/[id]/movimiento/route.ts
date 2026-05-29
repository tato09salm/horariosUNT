import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const { asignaciones, movimiento } = body;
  // movimiento = { bloqueId, origen: { dia, slot_id }, destino: { dia, slot_id, ambiente_id }, advertenciasAceptadas }

  if (!asignaciones || !movimiento) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
  }

  const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!prog || prog.fase !== 3) {
    return NextResponse.json({ error: 'Programación no válida o no está en Fase 3' }, { status: 400 });
  }

  // Update config
  const newConfig = { ...(prog.config || {}), asignaciones };
  await queryOne(`UPDATE programaciones SET config = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newConfig), id]);

  // Registramos un log de auditoría especializado para el movimiento manual
  await registrarAuditoria({
    usuario_id: session.id,
    usuario_nombre: `${session.nombre} ${session.apellidos}`,
    accion: 'UPDATE',
    tabla_afectada: 'programaciones',
    registro_id: id,
    datos_anteriores: { bloque_id: movimiento.bloqueId, ...movimiento.origen },
    datos_nuevos: { bloque_id: movimiento.bloqueId, ...movimiento.destino, advertencias: movimiento.advertenciasAceptadas },
    descripcion: `Movimiento manual: Bloque ${movimiento.bloqueId} movido de ${movimiento.origen.dia} (${movimiento.origen.slot_id}) a ${movimiento.destino.dia} (${movimiento.destino.slot_id}). ${movimiento.advertenciasAceptadas ? '[Con advertencias aceptadas]' : ''}`,
  });

  return NextResponse.json({ success: true });
}
