import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    // Join entre malla_curricular y cursos
    const sql = `
      SELECT c.* 
      FROM cursos c
      JOIN malla_curricular m ON m.curso_id = c.id
      WHERE m.curricula_id = $1
      ORDER BY c.ciclo_plan ASC, c.codigo ASC
    `;
    const cursos = await query(sql, [id]);
    return NextResponse.json({ data: cursos });
  } catch (error: any) {
    console.error('Error GET curriculas/cursos:', error);
    return NextResponse.json({ error: 'Error al cargar cursos de la curricula' }, { status: 500 });
  }
}
