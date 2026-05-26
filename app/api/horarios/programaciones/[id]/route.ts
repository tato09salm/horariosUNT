import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { getProgramacionCursosData } from '@/lib/programacion-cursos';

// GET — Obtener programación por ID con detalle
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const prog = await queryOne(`
    SELECT 
      p.*,
      c.nombre as ciclo_nombre, c.año, c.semestre, c.activo as ciclo_activo,
      u.nombre || ' ' || u.apellidos as creador_nombre,
      up.nombre || ' ' || up.apellidos as publicador_nombre
    FROM programaciones p
    JOIN ciclos c ON c.id = p.ciclo_id
    LEFT JOIN usuarios u ON u.id = p.created_by
    LEFT JOIN usuarios up ON up.id = p.publicado_por
    WHERE p.id = $1
  `, [id]);

  if (!prog) return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });

  const pcData = await getProgramacionCursosData(id);
  const cursos = pcData?.cursos ?? [];
  const cargaDocentes = pcData?.cargaDocentes ?? [];

  // Stats rápidos
  const stats = await queryOne(`
    SELECT 
      COUNT(DISTINCT pc.curso_id) as total_cursos,
      COUNT(DISTINCT pc.docente_id) FILTER (WHERE pc.docente_id IS NOT NULL) as total_docentes,
      SUM(pc.horas_teoria + pc.horas_practica + pc.horas_laboratorio) as total_horas,
      SUM(pc.horas_consejeria) as total_consejeria
    FROM programacion_cursos pc
    WHERE pc.programacion_id = $1
  `, [id]);

  return NextResponse.json({ data: { ...prog, cursos, cargaDocentes, stats } });
}

// PUT — Actualizar programación (config, avanzar/retroceder fase)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const anterior = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!anterior) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const vuelveAProgramacionDesdePublicado = anterior.estado === 'publicado' && body.fase !== undefined && parseInt(body.fase) === 3;

  if (anterior.estado === 'publicado' && !vuelveAProgramacionDesdePublicado) {
    return NextResponse.json({ error: 'No se puede modificar una programación publicada' }, { status: 400 });
  }

  // Determinar qué se actualiza
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (body.config !== undefined) {
    updates.push(`config = $${idx++}`);
    values.push(JSON.stringify(body.config));
  }

  if (body.fase !== undefined) {
    const nuevaFase = parseInt(body.fase);
    // Validar transición de fase
    const faseActual = anterior.fase;
    if (nuevaFase < 1 || nuevaFase > 4) {
      return NextResponse.json({ error: 'Fase debe estar entre 1 y 4' }, { status: 400 });
    }
    if (nuevaFase > faseActual + 1) {
      return NextResponse.json({ error: 'No se puede saltar fases' }, { status: 400 });
    }

    // Mapear fase → estado
    const estadoMap: Record<number, string> = {
      1: 'borrador',
      2: 'en_disponibilidad',
      3: 'en_programacion',
      4: 'publicado',
    };

    updates.push(`fase = $${idx++}`);
    values.push(nuevaFase);
    updates.push(`estado = $${idx++}`);
    values.push(estadoMap[nuevaFase]);

    if (anterior.estado === 'publicado' && nuevaFase === 3) {
      await query(`DELETE FROM asignaciones WHERE ciclo_id = $1`, [anterior.ciclo_id]);
      updates.push('publicado_at = NULL');
      updates.push('publicado_por = NULL');
    }

    // Si avanza a fase 4 → publicar
    if (nuevaFase === 4) {
      updates.push(`publicado_at = NOW()`);
      updates.push(`publicado_por = $${idx++}`);
      values.push(session.id);
    }
  }

  if (body.nombre !== undefined) {
    updates.push(`nombre = $${idx++}`);
    values.push(body.nombre);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  updates.push('updated_at = NOW()');
  values.push(id);

  const result = await queryOne(
    `UPDATE programaciones SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  await registrarAuditoria({
    usuario_id: session.id,
    usuario_nombre: `${session.nombre} ${session.apellidos}`,
    accion: 'UPDATE',
    tabla_afectada: 'programaciones',
    registro_id: id,
    datos_anteriores: anterior,
    datos_nuevos: result,
    descripcion: body.fase
      ? `Programación avanzó a fase ${body.fase}: ${result.estado}`
      : `Programación actualizada: ${result.nombre}`,
  });

  return NextResponse.json({ data: result });
}

// DELETE — Cancelar programación (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const anterior = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!anterior) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  if (anterior.estado === 'publicado') {
    return NextResponse.json({ error: 'No se puede cancelar una programación publicada' }, { status: 400 });
  }

  await queryOne(
    `UPDATE programaciones SET estado = 'cancelado', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  await registrarAuditoria({
    usuario_id: session.id,
    usuario_nombre: `${session.nombre} ${session.apellidos}`,
    accion: 'DELETE',
    tabla_afectada: 'programaciones',
    registro_id: id,
    datos_anteriores: anterior,
    descripcion: `Programación cancelada: ${anterior.nombre}`,
  });

  return NextResponse.json({ success: true });
}
