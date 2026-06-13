import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cargaHorariaId = searchParams.get('carga_horaria_id');

    let sql = `
      SELECT chc.*, c.codigo as curso_codigo, c.nombre as curso_nombre
      FROM carga_horaria_cursos chc
      JOIN cursos c ON chc.curso_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (cargaHorariaId) {
      sql += ` AND chc.carga_horaria_id = $${params.length + 1}`;
      params.push(cargaHorariaId);
    }

    sql += ` ORDER BY c.nombre`;
    const data = await query(sql, params);

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in GET /api/carga-horaria-cursos:', error);
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
    const {
      carga_horaria_id,
      curso_id,
      seccion,
      escuela,
      num_alumnos,
      hrs_teo,
      hrs_pra,
      hrs_lab,
      total_hrs
    } = body;

    const data = await queryOne(
      `
      INSERT INTO carga_horaria_cursos
        (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs]
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/carga-horaria-cursos:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
