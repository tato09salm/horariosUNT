import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const data = await query(`
    SELECT id, nombre, hora_inicio, hora_fin, orden
    FROM slots_tiempo
    ORDER BY orden
  `);

  return NextResponse.json({ data });
}
