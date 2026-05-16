import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session) {
    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      usuario_email: session.email,
      accion: 'LOGOUT',
      descripcion: 'Cierre de sesión',
    });
  }
  
  const response = NextResponse.json({ success: true });
  response.cookies.delete('auth-token');
  return response;
}
