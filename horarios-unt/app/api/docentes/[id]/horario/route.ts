import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHorarioDocente } from '@/lib/horarios';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  if (!ciclo_id) return NextResponse.json({ error: 'ciclo_id requerido' }, { status: 400 });

  const horario = await getHorarioDocente(id, ciclo_id);
  return NextResponse.json({ data: horario });
}
