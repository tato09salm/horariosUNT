import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { enviarEmail } from '@/lib/email';

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
        a.grupo_id || null,
        a.docente_id || null,
        a.ambiente_id || null,
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

    // Notificar por correo a los docentes con asignaciones (no bloquea la publicación)
    let notificados = 0;
    let notificacionExito: boolean | null = null;
    try {
      if (process.env.EMAILS_DISABLED !== 'true') {
        const docentes = await query(`
          SELECT DISTINCT d.id, d.nombre, d.apellidos, u.email
          FROM asignaciones a
          JOIN docentes d ON d.id = a.docente_id
          LEFT JOIN usuarios u ON u.email = CONCAT(d.dni, '@unt.edu.pe')
          WHERE a.ciclo_id = $1 AND a.docente_id IS NOT NULL
          GROUP BY d.id, d.nombre, d.apellidos, u.email
          HAVING COUNT(*) > 0
        `, [prog.ciclo_id]);

        const progNombre = prog.nombre || 'Horario académico';
        for (const d of docentes) {
          const email = d.email;
          if (!email) continue;
          try {
            await enviarEmail({
              to: email,
              subject: `Horario publicado - ${progNombre}`,
              text: `Estimado(a) ${d.nombre} ${d.apellidos},\n\nSu horario de clases ya fue publicado en el sistema SI Horarios UNT para el ciclo ${progNombre}.\n\nConsulte su horario desde el sistema para conocer sus asignaciones vigentes.\n\nAtentamente,\nEl equipo de SI Horarios UNT`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #2563eb;">Horario publicado</h2>
                  <p>Estimado(a) <strong>${d.nombre} ${d.apellidos}</strong>,</p>
                  <p>Su horario de clases ya fue publicado en el sistema SI Horarios UNT para el ciclo <strong>${progNombre}</strong>.</p>
                  <p>Consulte su horario desde el sistema para conocer sus asignaciones vigentes.</p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                  <p style="font-size: 0.8em; color: #6b7280;">Este es un mensaje automático, por favor no responda a este correo.</p>
                </div>
              `,
            });
            notificados++;
          } catch (emailErr) {
            console.error(`No se pudo notificar a ${email}:`, emailErr);
          }
        }
        notificacionExito = notificados > 0;
      } else {
        notificacionExito = null;
      }
    } catch (notifyErr) {
      console.error('Error preparando notificaciones por correo:', notifyErr);
      notificacionExito = false;
    }

    return NextResponse.json({ success: true, count: asignaciones.length, notificados, notificacionExito });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
