import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const prog_id = searchParams.get('programacion_id');
  const doc_id = searchParams.get('docente_id');

  if (!prog_id) return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });

  let docente_id = doc_id;
  if (session.rol === 'docente') {
    const doc = await queryOne(`SELECT id FROM docentes WHERE usuario_id = $1`, [session.id]);
    if (!doc) return NextResponse.json({ error: 'No tienes un perfil de docente asociado' }, { status: 404 });
    docente_id = doc.id;

    // Validar que el docente tenga al menos un curso en esta programación
    const tieneCursos = await queryOne(`
      SELECT 1 FROM programacion_cursos 
      WHERE programacion_id = $1 AND docente_id = $2 LIMIT 1
    `, [prog_id, doc.id]);
    if (!tieneCursos) return NextResponse.json({
      error: 'No estás registrado como docente en ningún curso de esta programación.'
    }, { status: 403 });
  }

  if (!docente_id) return NextResponse.json({ error: 'docente_id requerido' }, { status: 400 });

  const data = await query(`
    SELECT * FROM disponibilidad_docente
    WHERE programacion_id = $1 AND docente_id = $2
  `, [prog_id, docente_id]);

  return NextResponse.json({ data, docente_id });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const { programacion_id, docente_id: req_docente_id, disponibilidades } = body;

    if (!programacion_id || !disponibilidades) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });

    let docente_id = req_docente_id;
    if (session.rol === 'docente') {
      const doc = await queryOne(`SELECT id FROM docentes WHERE usuario_id = $1`, [session.id]);
      if (!doc) return NextResponse.json({ error: 'No tienes perfil de docente' }, { status: 404 });
      docente_id = doc.id;
    }

    if (!docente_id) return NextResponse.json({ error: 'docente_id requerido' }, { status: 400 });

    const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [programacion_id]);
    if (!prog || prog.estado === 'publicado' || prog.estado === 'cancelado') {
      return NextResponse.json({ error: 'La programación ya está publicada o cancelada, no se puede modificar la disponibilidad' }, { status: 400 });
    }

    for (const d of disponibilidades) {
      const prioridad = d.prioridad === 1 || d.prioridad === 2 ? d.prioridad : null;
      const disponible = prioridad !== null;

      if (!disponible) {
        await queryOne(`
          DELETE FROM disponibilidad_docente
          WHERE programacion_id = $1 AND docente_id = $2 AND slot_id = $3 AND dia = $4
        `, [programacion_id, docente_id, d.slot_id, d.dia]);
        continue;
      }

      await queryOne(`
        INSERT INTO disponibilidad_docente (programacion_id, docente_id, slot_id, dia, disponible, prioridad, registrado_por, updated_at)
        VALUES ($1, $2, $3, $4, true, $5, $6, NOW())
        ON CONFLICT (programacion_id, docente_id, slot_id, dia)
        DO UPDATE SET disponible = true, prioridad = EXCLUDED.prioridad, registrado_por = EXCLUDED.registrado_por, updated_at = NOW()
      `, [programacion_id, docente_id, d.slot_id, d.dia, prioridad, session.id]);
    }

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'UPDATE',
      tabla_afectada: 'disponibilidad_docente',
      registro_id: programacion_id,
      descripcion: `Disponibilidad (prioridades) actualizada para docente_id: ${docente_id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}