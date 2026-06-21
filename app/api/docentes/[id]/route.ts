import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const docente = await queryOne(
    `SELECT d.*, u.email as usuario_email FROM docentes d LEFT JOIN usuarios u ON u.id = d.usuario_id WHERE d.id = $1`,
    [id]
  );
  if (!docente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ data: docente });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const anterior = await queryOne(`SELECT * FROM docentes WHERE id = $1`, [id]);
    
    const nombreUpper = body.nombre?.toUpperCase() || '';
    const apellidosUpper = body.apellidos?.toUpperCase() || '';

    const docente = await queryOne(
      `UPDATE docentes SET nombre=$1, apellidos=$2, email=$3, telefono=$4, categoria=$5,
       condicion=$6, fecha_ingreso=$7, grado_academico=$8, horas_max_semana=$9, activo=$10,
       facultad=$11, dpto_academico=$12, es_escuela_configurada=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [nombreUpper, apellidosUpper, body.email, body.telefono, body.categoria,
       body.condicion, body.fecha_ingreso, body.grado_academico, body.horas_max_semana, body.activo,
       body.facultad?.toUpperCase(), body.dpto_academico?.toUpperCase(), body.es_escuela_configurada === true, id]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'UPDATE',
      tabla_afectada: 'docentes',
      registro_id: id,
      datos_anteriores: anterior,
      datos_nuevos: docente,
      descripcion: `Docente actualizado: ${nombreUpper} ${apellidosUpper}`,
    });

    return NextResponse.json({ data: docente });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const anterior = await queryOne(`SELECT * FROM docentes WHERE id = $1`, [id]);
  await queryOne(`UPDATE docentes SET activo=false, updated_at=NOW() WHERE id=$1`, [id]);

  await registrarAuditoria({
    usuario_id: session.id,
    usuario_nombre: `${session.nombre} ${session.apellidos}`,
    accion: 'DELETE',
    tabla_afectada: 'docentes',
    registro_id: id,
    datos_anteriores: anterior,
    descripcion: `Docente desactivado: ${anterior?.nombre} ${anterior?.apellidos}`,
  });

  return NextResponse.json({ success: true });
}
