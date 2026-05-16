import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const ciclos = await query(`SELECT * FROM ciclos ORDER BY año DESC, semestre`);
  return NextResponse.json({ data: ciclos });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  try {
    const body = await req.json();
    const ciclo = await queryOne(
      `INSERT INTO ciclos (nombre, año, semestre, fecha_inicio, fecha_fin, activo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [body.nombre, body.año, body.semestre, body.fecha_inicio, body.fecha_fin, body.activo || false]
    );
    return NextResponse.json({ data: ciclo }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
