import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const resultado = await getAuditoria({
    usuario_id: searchParams.get('usuario_id') || undefined,
    accion: searchParams.get('accion') || undefined,
    tabla: searchParams.get('tabla') || undefined,
    desde: searchParams.get('desde') || undefined,
    hasta: searchParams.get('hasta') || undefined,
    pagina: parseInt(searchParams.get('pagina') || '1'),
    limite: parseInt(searchParams.get('limite') || '50'),
  });

  return NextResponse.json(resultado);
}
