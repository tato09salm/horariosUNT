import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const sql = `
      SELECT * FROM curriculas ORDER BY "año_curricula" DESC, nombre_carrera ASC
    `;
    const curriculas = await query(sql, []);
    return NextResponse.json({ data: curriculas });
  } catch (error: any) {
    console.error('Error GET curriculas:', error);
    return NextResponse.json({ error: 'Error al cargar curriculas' }, { status: 500 });
  }
}
