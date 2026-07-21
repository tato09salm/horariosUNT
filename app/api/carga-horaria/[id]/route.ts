
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne, transaction } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { horas_asignadas, docente_id } = body;

    const cargaHoraria = await queryOne(
      `UPDATE carga_horaria
       SET horas_asignadas = COALESCE($1, horas_asignadas),
           docente_id = COALESCE($2, docente_id),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [horas_asignadas, docente_id, id]
    );

    if (!cargaHoraria) {
      return NextResponse.json({ error: 'Carga horaria no encontrada' }, { status: 404 });
    }

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'carga_horaria',
      registro_id: cargaHoraria?.id,
      datos_nuevos: cargaHoraria,
      descripcion: `Carga horaria actualizada: id=${id}`,
    });

    return NextResponse.json({ data: cargaHoraria });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await transaction(async (client) => {
      // First delete all related carga_horaria_cursos
      await client.query(
        'DELETE FROM carga_horaria_cursos WHERE carga_horaria_id = $1',
        [id]
      );
      // Then delete the carga_horaria itself
      const cargaHoraria = await client.query(
        `DELETE FROM carga_horaria
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (cargaHoraria.rows.length === 0) {
        throw new Error('Carga horaria no encontrada');
      }

      await registrarAuditoria({
        usuario_id: session.id,
        accion: 'DELETE',
        tabla_afectada: 'carga_horaria',
        registro_id: cargaHoraria.rows[0].id,
        descripcion: `Carga horaria eliminada: id=${id}`,
      });

      return cargaHoraria.rows[0];
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error deleting carga horaria:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

