import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, transaction } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const anterior = await queryOne('SELECT * FROM ciclos WHERE id = $1', [id]);
  if (!anterior) return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });

  const actualAnterior = await queryOne('SELECT * FROM ciclos WHERE activo = true ORDER BY created_at DESC LIMIT 1');

  const ciclo = await transaction(async client => {
    await client.query('UPDATE ciclos SET activo = false WHERE activo = true AND id <> $1', [id]);

    const result = await client.query(
      'UPDATE ciclos SET activo = true WHERE id = $1 RETURNING *',
      [id]
    );

    return result.rows[0] || null;
  });

  if (!ciclo) {
    return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
  }

  const mappedCiclo = { ...ciclo, estado: 'activo' };
  const mappedActualAnterior = actualAnterior ? { ...actualAnterior, estado: 'inactivo' } : null;

  await registrarAuditoria({
    usuario_id: session.id,
    accion: 'UPDATE',
    tabla_afectada: 'ciclos',
    registro_id: id,
    datos_anteriores: { ciclo_actual: mappedActualAnterior },
    datos_nuevos: { ciclo_actual: mappedCiclo },
    descripcion: `Ciclo establecido como actual: ${ciclo.nombre}`,
  });

  return NextResponse.json({ data: mappedCiclo });
}
