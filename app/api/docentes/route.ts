import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar');
  const categoria = searchParams.get('categoria');
  const condicion = searchParams.get('condicion');
  const activo = searchParams.get('activo');

  let sql = `
    SELECT d.*, 
      u.email as usuario_email, u.rol as usuario_rol,
      CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
      CASE d.categoria 
        WHEN 'principal' THEN 0 WHEN 'asociado' THEN 1 
        WHEN 'auxiliar' THEN 2 WHEN 'jefe_practica' THEN 3 
      END as categoria_orden
    FROM docentes d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let idx = 1;

  if (buscar) {
    sql += ` AND (d.nombre ILIKE $${idx} OR d.apellidos ILIKE $${idx} OR d.codigo ILIKE $${idx} OR d.dni ILIKE $${idx})`;
    params.push(`%${buscar}%`);
    idx++;
  }
  if (categoria) { sql += ` AND d.categoria = $${idx++}`; params.push(categoria); }
  if (condicion) { sql += ` AND d.condicion = $${idx++}`; params.push(condicion); }
  if (activo !== null && activo !== undefined && activo !== '') {
    sql += ` AND d.activo = $${idx++}`; params.push(activo === 'true');
  }

  sql += ` ORDER BY condicion_orden, categoria_orden, d.fecha_ingreso ASC`;

  const docentes = await query(sql, params);
  return NextResponse.json({ data: docentes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { codigo, nombre, apellidos, dni, email, telefono, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana } = body;

    const docente = await queryOne(
      `INSERT INTO docentes (codigo, nombre, apellidos, dni, email, telefono, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [codigo, nombre, apellidos, dni, email, telefono, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana || 20]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'docentes',
      registro_id: docente?.id,
      datos_nuevos: docente,
      descripcion: `Docente creado: ${nombre} ${apellidos}`,
    });

    return NextResponse.json({ data: docente }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
