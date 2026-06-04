import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { getProgramacionCursosData } from '@/lib/programacion-cursos';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const data = await getProgramacionCursosData(id);
    if (!data) {
      return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ data: data.cursos, cargaDocentes: data.cargaDocentes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[programacion-cursos GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!prog) return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });
  if (prog.fase !== 1) {
    return NextResponse.json({ error: 'Solo se pueden agregar cursos en la Fase 1' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { curso_id, grupo_id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria, seccion, notas } = body;

    if (!curso_id || !grupo_id) {
      return NextResponse.json({ error: 'curso_id y grupo_id son requeridos' }, { status: 400 });
    }

    const curso = await queryOne(`SELECT * FROM cursos WHERE id = $1`, [curso_id]);
    if (!curso) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    if (docente_id) {
      const docente = await queryOne(`SELECT * FROM docentes WHERE id = $1`, [docente_id]);
      if (!docente) return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

      const cargaActual = await queryOne(`
        SELECT COALESCE(SUM(horas_teoria + horas_practica + COALESCE(horas_laboratorio, 0) + COALESCE(horas_consejeria, 0)), 0) as total
        FROM programacion_cursos WHERE programacion_id = $1 AND docente_id = $2
      `, [id, docente_id]);

      const horasNuevas =
        (horas_teoria ?? curso.horas_teoria) +
        (horas_practica ?? curso.horas_practica) +
        (horas_laboratorio ?? curso.horas_laboratorio ?? 0) +
        (horas_consejeria ?? 0);
      const totalCarga = parseInt(cargaActual?.total || '0', 10) + horasNuevas;

      if (totalCarga > docente.horas_max_semana) {
        return NextResponse.json({
          error: `El docente ${docente.nombre} ${docente.apellidos} excedería su límite de ${docente.horas_max_semana}h/semana (actual: ${cargaActual?.total || 0}h + nuevo: ${horasNuevas}h = ${totalCarga}h)`,
        }, { status: 400 });
      }
    }

    const pc = await queryOne(`
      INSERT INTO programacion_cursos 
        (programacion_id, curso_id, grupo_id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria, seccion, notas)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id, curso_id, grupo_id, docente_id || null,
      horas_teoria ?? curso.horas_teoria,
      horas_practica ?? curso.horas_practica,
      horas_laboratorio ?? curso.horas_laboratorio ?? 0,
      horas_consejeria ?? 0,
      seccion || null,
      notas || null,
    ]);

    await queryOne(`UPDATE programaciones SET updated_at = NOW() WHERE id = $1`, [id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'programacion_cursos',
      registro_id: pc.id,
      datos_nuevos: pc,
      descripcion: `Curso agregado a programación: ${curso.codigo} - ${curso.nombre}`,
    });

    return NextResponse.json({ data: pc }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error';
    if (message.includes('unique') || message.includes('duplicate') || message.includes('unicidad') || message.includes('duplicada')) {
      return NextResponse.json({ error: 'No se puede asignar el mismo docente más de una vez al mismo grupo. Por favor, selecciona un docente diferente.' }, { status: 409 });
    }
    console.error('[programacion-cursos POST]', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!prog) return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });
  if (prog.fase !== 1) {
    return NextResponse.json({ error: 'Solo se pueden editar cursos en la Fase 1' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { pc_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria } = body;

    if (!pc_id) return NextResponse.json({ error: 'pc_id es requerido' }, { status: 400 });

    const pc = await queryOne(`SELECT * FROM programacion_cursos WHERE id = $1 AND programacion_id = $2`, [pc_id, id]);
    if (!pc) return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 });

    // TODO: Se podría validar que no exceda las horas del docente aquí también
    
    const updated = await queryOne(`
      UPDATE programacion_cursos 
      SET horas_teoria = $1, horas_practica = $2, horas_laboratorio = $3, horas_consejeria = $4
      WHERE id = $5 RETURNING *
    `, [
      horas_teoria ?? pc.horas_teoria,
      horas_practica ?? pc.horas_practica,
      horas_laboratorio ?? pc.horas_laboratorio,
      horas_consejeria ?? pc.horas_consejeria,
      pc_id
    ]);

    await queryOne(`UPDATE programaciones SET updated_at = NOW() WHERE id = $1`, [id]);

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const pc_id = searchParams.get('pc_id');

  if (!pc_id) return NextResponse.json({ error: 'pc_id requerido' }, { status: 400 });

  const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!prog || prog.fase !== 1) {
    return NextResponse.json({ error: 'Solo se pueden eliminar cursos en la Fase 1' }, { status: 400 });
  }

  if (pc_id === 'all') {
    const todosCursos = await query(`SELECT * FROM programacion_cursos WHERE programacion_id = $1`, [id]);
    await queryOne(`DELETE FROM programacion_cursos WHERE programacion_id = $1`, [id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'DELETE',
      tabla_afectada: 'programacion_cursos',
      registro_id: id,
      datos_anteriores: { count: todosCursos.length },
      descripcion: `Removidos todos los cursos (${todosCursos.length}) de la programación`,
    });

    return NextResponse.json({ success: true });
  }

  const anterior = await queryOne(`SELECT * FROM programacion_cursos WHERE id = $1 AND programacion_id = $2`, [pc_id, id]);
  if (!anterior) return NextResponse.json({ error: 'Curso no encontrado en esta programación' }, { status: 404 });

  await queryOne(`DELETE FROM programacion_cursos WHERE id = $1`, [pc_id]);

  await registrarAuditoria({
    usuario_id: session.id,
    usuario_nombre: `${session.nombre} ${session.apellidos}`,
    accion: 'DELETE',
    tabla_afectada: 'programacion_cursos',
    registro_id: pc_id,
    datos_anteriores: anterior,
    descripcion: 'Curso removido de programación',
  });

  return NextResponse.json({ success: true });
}
