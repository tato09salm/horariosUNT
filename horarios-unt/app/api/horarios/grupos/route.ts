import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');
  const curso_id = searchParams.get('curso_id');

  let sql = `
    SELECT g.*, c.nombre as curso_nombre, c.codigo as curso_codigo, 
           c.horas_teoria, c.horas_practica, c.creditos,
           ci.nombre as ciclo_nombre,
           (SELECT COUNT(*) FROM asignaciones a WHERE a.grupo_id = g.id AND a.estado = 'activo') as total_asignaciones
    FROM grupos g
    JOIN cursos c ON c.id = g.curso_id
    JOIN ciclos ci ON ci.id = g.ciclo_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let idx = 1;

  if (ciclo_id) { sql += ` AND g.ciclo_id = $${idx++}`; params.push(ciclo_id); }
  if (curso_id) { sql += ` AND g.curso_id = $${idx++}`; params.push(curso_id); }

  sql += ` ORDER BY c.nombre, g.numero_grupo`;
  const grupos = await query(sql, params);
  return NextResponse.json({ data: grupos });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const grupo = await queryOne(
      `INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [body.ciclo_id, body.curso_id, body.numero_grupo || 1, body.max_alumnos || 30, body.num_alumnos || 0]
    );
    return NextResponse.json({ data: grupo }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
