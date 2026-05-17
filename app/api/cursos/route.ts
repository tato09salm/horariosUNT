import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar');
  const ciclo = searchParams.get('ciclo');
  const activo = searchParams.get('activo');
  const reporte = searchParams.get('reporte') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  let sql = `SELECT c.*, e.nombre as escuela_nombre FROM cursos c LEFT JOIN escuelas e ON e.id = c.escuela_id WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (buscar) {
    sql += ` AND (c.nombre ILIKE $${idx} OR c.codigo ILIKE $${idx})`;
    params.push(`%${buscar}%`);
    idx++;
  }
  if (ciclo) {
    sql += ` AND c.ciclo_plan = $${idx++}`;
    params.push(parseInt(ciclo));
  }
  if (activo !== null && activo !== undefined && activo !== '') {
    sql += ` AND c.activo = $${idx++}`;
    params.push(activo === 'true');
  }

  // Count total for pagination
  const countSql = `SELECT COUNT(*) FROM (${sql}) as total`;
  const totalRes = await queryOne(countSql, params);
  const total = parseInt(totalRes?.count || '0');

  // Stats for KPIs
  const statsSql = `
    SELECT 
      COUNT(*) as total_cursos,
      SUM(creditos) as total_creditos,
      SUM(horas_teoria) as total_teoria,
      SUM(horas_practica) as total_practica
    FROM (${sql}) as filtered
  `;
  const statsRes = await queryOne(statsSql, params);
  const stats = {
    total_cursos: parseInt(statsRes?.total_cursos || '0'),
    total_creditos: parseInt(statsRes?.total_creditos || '0'),
    total_teoria: parseInt(statsRes?.total_teoria || '0'),
    total_practica: parseInt(statsRes?.total_practica || '0')
  };

  sql += ` ORDER BY c.ciclo_plan, c.nombre`;
  
  if (!reporte) {
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
  }

  const cursos = await query(sql, params);
  return NextResponse.json({ data: cursos, total, stats, page: reporte ? 1 : page, limit: reporte ? total : limit });
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
