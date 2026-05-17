import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const programacion_id = searchParams.get('programacion_id');

  if (!programacion_id) {
    return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });
  }

  const conflictos = await query(`
    SELECT * FROM conflictos_horario
    WHERE programacion_id = $1
    ORDER BY severidad DESC, created_at DESC
  `, [programacion_id]);

  return NextResponse.json({ data: conflictos });
}
