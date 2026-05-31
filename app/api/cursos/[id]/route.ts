import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const curso = await queryOne(`SELECT c.*, e.nombre as escuela_nombre FROM cursos c LEFT JOIN escuelas e ON e.id = c.escuela_id WHERE c.id = $1`, [id]);
  if (!curso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ data: curso });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const anterior = await queryOne(`SELECT * FROM cursos WHERE id = $1`, [id]);
    
    const codigoUpper = body.codigo?.toUpperCase() || '';
    const nombreUpper = body.nombre?.toUpperCase() || '';

    const curso = await queryOne(
      `UPDATE cursos SET escuela_id=$1, codigo=$2, nombre=$3, creditos=$4, horas_teoria=$5, horas_practica=$6, ciclo_plan=$7, activo=$8
       WHERE id=$9 RETURNING *`,
      [body.escuela_id, codigoUpper, nombreUpper, body.creditos, body.horas_teoria, body.horas_practica, body.ciclo_plan, body.activo, id]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'cursos',
      registro_id: id,
      datos_anteriores: anterior,
      datos_nuevos: curso,
      descripcion: `Curso actualizado: ${nombreUpper}`,
    });

    return NextResponse.json({ data: curso });
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
  const anterior = await queryOne(`SELECT * FROM cursos WHERE id = $1`, [id]);
  
  // Desactivar en lugar de eliminar físicamente si se prefiere, 
  // pero aquí seguimos el patrón de los otros módulos
  await queryOne(`DELETE FROM cursos WHERE id=$1`, [id]);

  await registrarAuditoria({
    usuario_id: session.id,
    accion: 'DELETE',
    tabla_afectada: 'cursos',
    registro_id: id,
    datos_anteriores: anterior,
    descripcion: `Curso eliminado: ${anterior?.nombre}`,
  });

  return NextResponse.json({ success: true });
}
