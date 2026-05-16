import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar');

  let sql = `SELECT c.*, e.nombre as escuela_nombre FROM cursos c LEFT JOIN escuelas e ON e.id = c.escuela_id WHERE c.activo = true`;
  const params: any[] = [];
  if (buscar) {
    sql += ` AND (c.nombre ILIKE $1 OR c.codigo ILIKE $1)`;
    params.push(`%${buscar}%`);
  }
  sql += ` ORDER BY c.ciclo_plan, c.nombre`;

  const cursos = await query(sql, params);
  return NextResponse.json({ data: cursos });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const curso = await queryOne(
      `INSERT INTO cursos (escuela_id, codigo, nombre, creditos, horas_teoria, horas_practica, ciclo_plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.escuela_id, body.codigo, body.nombre, body.creditos, body.horas_teoria, body.horas_practica, body.ciclo_plan]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'CREATE', tabla_afectada: 'cursos', registro_id: curso?.id,
      datos_nuevos: curso, descripcion: `Curso creado: ${body.nombre}`,
    });

    return NextResponse.json({ data: curso }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
