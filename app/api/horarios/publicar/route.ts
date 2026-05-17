import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id } = await req.json();

    if (!programacion_id) return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });

    const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [programacion_id]);
    if (!prog || prog.fase !== 4) {
      return NextResponse.json({ error: 'La programación debe estar en Fase 4 para publicarse' }, { status: 400 });
    }

    if (prog.estado === 'publicado') {
      return NextResponse.json({ error: 'Esta programación ya fue publicada' }, { status: 400 });
    }

    const asignaciones = prog.config?.asignaciones || [];
    if (asignaciones.length === 0) {
      return NextResponse.json({ error: 'No hay asignaciones en el borrador para publicar' }, { status: 400 });
    }

    // Insertar en la tabla real 'asignaciones' (la de la Persona 1)
    // Primero, eliminamos asignaciones previas del mismo ciclo que pudieran estar en conflicto si se sobreescribe
    await query(`DELETE FROM asignaciones WHERE ciclo_id = $1`, [prog.ciclo_id]);

    for (const a of asignaciones) {
      await queryOne(`
        INSERT INTO asignaciones (ciclo_id, grupo_id, docente_id, ambiente_id, slot_id, dia, tipo, estado, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', $8)
      `, [
        prog.ciclo_id,
        a.grupo_id,
        a.docente_id || null,
        a.ambiente_id,
        a.slot_id,
        a.dia,
        a.tipo,
        session.id
      ]);
    }

    // Marcar como publicado
    await queryOne(`
      UPDATE programaciones 
      SET estado = 'publicado', publicado_at = NOW(), publicado_por = $1
      WHERE id = $2
    `, [session.id, programacion_id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE', // Equivalente a publicar un recurso final
      tabla_afectada: 'asignaciones',
      registro_id: programacion_id,
      descripcion: `Programación publicada. Se insertaron ${asignaciones.length} bloques en el horario oficial.`,
    });

    return NextResponse.json({ success: true, count: asignaciones.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
