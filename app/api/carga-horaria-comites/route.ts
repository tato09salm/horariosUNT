import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cargaHorariaId = searchParams.get('carga_horaria_id');

    let sql = `SELECT * FROM carga_horaria_comites WHERE 1=1`;
    const params: any[] = [];

    if (cargaHorariaId) {
      sql += ` AND carga_horaria_id = $${params.length + 1}`;
      params.push(cargaHorariaId);
    }

    const data = await query(sql, params);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/carga-horaria-comites:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { carga_horaria_id, horas, detalles } = body;

    const data = await queryOne(
      `
      INSERT INTO carga_horaria_comites (carga_horaria_id, horas, detalles)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [carga_horaria_id, horas, detalles]
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/carga-horaria-comites:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
