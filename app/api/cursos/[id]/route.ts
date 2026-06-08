import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import db from '@/lib/sequelize';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { id } = await params;
    const curso = await db.Cursos.findByPk(id, {
      include: [{
        model: db.Escuelas,
        as: 'escuela'
      }]
    });
    
    if (!curso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    
    const data = {
      ...curso.toJSON(),
      escuela_nombre: (curso as any).escuela?.nombre
    };
    
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const curso = await db.Cursos.findByPk(id);
    
    if (!curso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    
    const anterior = curso.toJSON();
    const codigoUpper = body.codigo?.toUpperCase() || '';
    const nombreUpper = body.nombre?.toUpperCase() || '';

    await curso.update({
      escuela_id: body.escuela_id,
      codigo: codigoUpper,
      nombre: nombreUpper,
      creditos: body.creditos,
      horas_teoria: body.horas_teoria,
      horas_practica: body.horas_practica,
      horas_laboratorio: body.horas_laboratorio || 0,
      ciclo_plan: body.ciclo_plan,
      activo: body.activo !== undefined ? body.activo : (curso as any).activo
    });

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'cursos',
      registro_id: id,
      datos_anteriores: anterior,
      datos_nuevos: curso.toJSON(),
      descripcion: `Curso actualizado: ${nombreUpper}`,
    });

    return NextResponse.json({ data: curso });
  } catch (error: any) {
    console.error('Error PUT curso:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const curso = await db.Cursos.findByPk(id);
    if (!curso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    
    const anterior = curso.toJSON();
    await curso.destroy();

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'DELETE',
      tabla_afectada: 'cursos',
      registro_id: id,
      datos_anteriores: anterior,
      descripcion: `Curso eliminado: ${anterior.nombre}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error DELETE curso:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
