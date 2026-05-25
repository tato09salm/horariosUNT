import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const ambiente = await queryOne(`SELECT * FROM ambientes WHERE id = $1`, [id]);
  if (!ambiente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json({ data: ambiente });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const anterior = await queryOne(`SELECT * FROM ambientes WHERE id = $1`, [id]);
    
    const codigoUpper = body.codigo?.toUpperCase() || '';
    const nombreUpper = body.nombre?.toUpperCase() || '';
    const edificioUpper = body.edificio?.toUpperCase() || '';

    const ambiente = await queryOne(
      `UPDATE ambientes SET codigo=$1, nombre=$2, tipo=$3, capacidad=$4, piso=$5, edificio=$6, disponible=$7
       WHERE id=$8 RETURNING *`,
      [codigoUpper, nombreUpper, body.tipo, body.capacidad, body.piso, edificioUpper, body.disponible, id]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'ambientes',
      registro_id: id,
      datos_anteriores: anterior,
      datos_nuevos: ambiente,
      descripcion: `Ambiente actualizado: ${nombreUpper}`,
    });

    return NextResponse.json({ data: ambiente });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const anterior = await queryOne(`SELECT * FROM ambientes WHERE id = $1`, [id]);
  await queryOne(`DELETE FROM ambientes WHERE id=$1`, [id]);

  await registrarAuditoria({
    usuario_id: session.id,
    accion: 'DELETE',
    tabla_afectada: 'ambientes',
    registro_id: id,
    datos_anteriores: anterior,
    descripcion: `Ambiente eliminado: ${anterior?.nombre}`,
  });

  return NextResponse.json({ success: true });
}
