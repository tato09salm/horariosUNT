import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generarHorarioAutomatico } from '@/lib/horarios';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const resultado = await generarHorarioAutomatico({
      ...body,
      created_by: session.id,
    });
    return NextResponse.json(resultado);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
