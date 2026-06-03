import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const ciclo = await queryOne('SELECT * FROM ciclos WHERE id = $1', [id]);
  if (!ciclo) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

  return NextResponse.json({ data: ciclo });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    if (!body.nombre || !body.año || !body.semestre) {
      return NextResponse.json({ error: 'Nombre, año y semestre son requeridos' }, { status: 400 });
    }

    const anterior = await queryOne('SELECT * FROM ciclos WHERE id = $1', [id]);
    if (!anterior) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

    const ciclo = await queryOne(
      `UPDATE ciclos
       SET nombre = $1, año = $2, semestre = $3, fecha_inicio = $4, fecha_fin = $5
       WHERE id = $6
       RETURNING *`,
      [body.nombre, body.año, body.semestre, body.fecha_inicio || null, body.fecha_fin || null, id]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'ciclos',
      registro_id: id,
      datos_anteriores: anterior,
      datos_nuevos: ciclo,
      descripcion: `Ciclo actualizado: ${ciclo?.nombre}`,
    });

    return NextResponse.json({ data: ciclo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const anterior = await queryOne('SELECT * FROM ciclos WHERE id = $1', [id]);
  if (!anterior) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

  const ciclo = await queryOne(
    'UPDATE ciclos SET activo = false WHERE id = $1 RETURNING *',
    [id]
  );

  await registrarAuditoria({
    usuario_id: session.id,
    accion: 'DELETE',
    tabla_afectada: 'ciclos',
    registro_id: id,
    datos_anteriores: anterior,
    datos_nuevos: ciclo,
    descripcion: `Ciclo desactivado: ${anterior.nombre}`,
  });

  return NextResponse.json({ data: ciclo });
}
