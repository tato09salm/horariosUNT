import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id } = await req.json();

    // Aquí integraríamos EmailJS o cualquier servicio SMTP.
    // Por ahora, simulamos el envío de correos.

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'UPDATE',
      tabla_afectada: 'programaciones',
      registro_id: programacion_id,
      descripcion: `Notificaciones de disponibilidad enviadas a los docentes`,
    });

    return NextResponse.json({ success: true, message: 'Notificaciones enviadas a los docentes exitosamente (Simulado).' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
