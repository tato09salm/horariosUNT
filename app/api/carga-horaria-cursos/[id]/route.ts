
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne, transaction } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const result = await transaction(async (client) => {
      // 1. Get the carga_horaria_id for this curso
      const chc = await client.query(
        'SELECT * FROM carga_horaria_cursos WHERE id = $1',
        [id]
      );

      if (chc.rows.length === 0) {
        throw new Error('Curso no encontrado en carga horaria');
      }

      const cargaHorariaId = chc.rows[0].carga_horaria_id;
      const horasCurso = chc.rows[0].total_horas || 0;

      // 2. Delete the curso from carga_horaria_cursos
      await client.query(
        'DELETE FROM carga_horaria_cursos WHERE id = $1',
        [id]
      );

      // 3. Check if there are any remaining cursos for this carga_horaria
      const remainingCursos = await client.query(
        'SELECT COUNT(*) FROM carga_horaria_cursos WHERE carga_horaria_id = $1',
        [cargaHorariaId]
      );

      if (parseInt(remainingCursos.rows[0].count) === 0) {
        // 4. If no remaining cursos, delete the whole carga_horaria
        await client.query(
          'DELETE FROM carga_horaria WHERE id = $1',
          [cargaHorariaId]
        );
        await registrarAuditoria({
          usuario_id: session.id,
          accion: 'DELETE',
          tabla_afectada: 'carga_horaria',
          registro_id: cargaHorariaId,
          descripcion: `Carga horaria eliminada por quedarse sin cursos: id=${cargaHorariaId}`,
        });
      } else {
        // 5. If there are remaining courses, update the horas_asignadas
        const newTotalHorasResult = await client.query(
          'SELECT COALESCE(SUM(total_horas), 0) as total FROM carga_horaria_cursos WHERE carga_horaria_id = $1',
          [cargaHorariaId]
        );
        const newTotalHoras = parseInt(newTotalHorasResult.rows[0].total);
        await client.query(
          'UPDATE carga_horaria SET horas_asignadas = $1, updated_at = NOW() WHERE id = $2',
          [newTotalHoras, cargaHorariaId]
        );
      }

      await registrarAuditoria({
        usuario_id: session.id,
        accion: 'DELETE',
        tabla_afectada: 'carga_horaria_cursos',
        registro_id: id,
        descripcion: `Curso eliminado de carga horaria: id=${id}, carga_horaria_id=${cargaHorariaId}`,
      });

      return { cargaHorariaId, remainingCursos: parseInt(remainingCursos.rows[0].count) };
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('Error deleting curso from carga horaria:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

