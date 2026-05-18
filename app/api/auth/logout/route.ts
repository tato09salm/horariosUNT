import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) {
    try {
      await registrarAuditoria({
        usuario_id: session.id,
        usuario_nombre: `${session.nombre} ${session.apellidos}`,
        usuario_email: session.email,
        accion: 'LOGOUT',
        descripcion: 'Cierre de sesión',
      });
    } catch (error) {
      console.warn('Error al registrar auditoría de logout (posible sesión huérfana):', error);
    }
  }
  
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}
