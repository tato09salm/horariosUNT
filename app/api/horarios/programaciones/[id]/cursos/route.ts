import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

// GET — Listar cursos de una programación
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;

  const cursos = await query(`
    SELECT 
      pc.*,
      cu.codigo as curso_codigo, cu.nombre as curso_nombre, cu.creditos, cu.ciclo_plan,
      cu.horas_teoria as horas_teoria_catalogo, cu.horas_practica as horas_practica_catalogo,
      g.numero_grupo, g.max_alumnos, g.num_alumnos,
      d.nombre || ' ' || d.apellidos as docente_nombre, d.codigo as docente_codigo,
      d.categoria as docente_categoria, d.condicion as docente_condicion,
      d.horas_max_semana as docente_horas_max
    FROM programacion_cursos pc
    JOIN cursos cu ON cu.id = pc.curso_id
    LEFT JOIN grupos g ON g.id = pc.grupo_id
    LEFT JOIN docentes d ON d.id = pc.docente_id
    WHERE pc.programacion_id = $1
    ORDER BY cu.ciclo_plan, cu.codigo
  `, [id]);

  // Calcular carga docente
  const cargaDocentes = await query(`
    SELECT 
      d.id, d.nombre || ' ' || d.apellidos as nombre, d.horas_max_semana,
      d.categoria, d.condicion,
      COALESCE(SUM(pc.horas_teoria + pc.horas_practica + pc.horas_laboratorio + pc.horas_consejeria), 0) as horas_asignadas
    FROM docentes d
    JOIN programacion_cursos pc ON pc.docente_id = d.id
    WHERE pc.programacion_id = $1
    GROUP BY d.id, d.nombre, d.apellidos, d.horas_max_semana, d.categoria, d.condicion
    ORDER BY d.apellidos
  `, [id]);

  return NextResponse.json({ data: cursos, cargaDocentes });
}

// POST — Agregar curso a la programación
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;

  // Verificar que la programación existe y está en fase 1
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

    // Obtener datos del curso del catálogo para defaults
    const curso = await queryOne(`SELECT * FROM cursos WHERE id = $1`, [curso_id]);
    if (!curso) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    // Validar horas máximas del docente si se asigna
    if (docente_id) {
      const docente = await queryOne(`SELECT * FROM docentes WHERE id = $1`, [docente_id]);
      if (!docente) return NextResponse.json({ error: 'Docente no encontrado' }, { status: 404 });

      // Sumar horas ya asignadas al docente en esta programación
      const cargaActual = await queryOne(`
        SELECT COALESCE(SUM(horas_teoria + horas_practica + horas_laboratorio + horas_consejeria), 0) as total
        FROM programacion_cursos WHERE programacion_id = $1 AND docente_id = $2
      `, [id, docente_id]);

      const horasNuevas = (horas_teoria ?? curso.horas_teoria) + (horas_practica ?? curso.horas_practica) + (horas_laboratorio ?? 0) + (horas_consejeria ?? 0);
      const totalCarga = parseInt(cargaActual?.total || '0') + horasNuevas;

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
      horas_laboratorio ?? 0,
      horas_consejeria ?? 0,
      seccion || null,
      notas || null,
    ]);

    // Actualizar timestamp de la programación
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
  } catch (error: any) {
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Este grupo ya está agregado a la programación' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE — Eliminar un curso de la programación (por query param pc_id)
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
    descripcion: `Curso removido de programación`,
  });

  return NextResponse.json({ success: true });
}
