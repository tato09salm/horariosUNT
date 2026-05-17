import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

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

  // Obtener cursos de la programación
  const cursos = await query(`
    SELECT 
      pc.*,
      cu.codigo as curso_codigo, cu.nombre as curso_nombre, cu.creditos,
      cu.horas_teoria as horas_teoria_catalogo, cu.horas_practica as horas_practica_catalogo,
      g.numero_grupo, g.max_alumnos, g.num_alumnos,
      d.nombre || ' ' || d.apellidos as docente_nombre, d.dni as docente_dni,
      d.categoria as docente_categoria, d.condicion as docente_condicion,
      d.horas_max_semana as docente_horas_max
    FROM programacion_cursos pc
    JOIN cursos cu ON cu.id = pc.curso_id
    LEFT JOIN grupos g ON g.id = pc.grupo_id
    LEFT JOIN docentes d ON d.id = pc.docente_id
    WHERE pc.programacion_id = $1
    ORDER BY cu.ciclo_plan, cu.codigo
  `, [id]);

  // Stats rápidos
  const stats = await queryOne(`
    SELECT 
      COUNT(*) as total_cursos,
      COUNT(DISTINCT pc.docente_id) FILTER (WHERE pc.docente_id IS NOT NULL) as total_docentes,
      SUM(pc.horas_teoria + pc.horas_practica + pc.horas_laboratorio) as total_horas,
      SUM(pc.horas_consejeria) as total_consejeria
    FROM programacion_cursos pc
    WHERE pc.programacion_id = $1
  `, [id]);

  return NextResponse.json({ data: { ...prog, cursos, stats } });
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

  if (anterior.estado === 'publicado') {
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
