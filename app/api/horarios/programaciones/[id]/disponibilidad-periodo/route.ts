import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { enviarEmail, plantillaCorreo } from '@/lib/email';

// Correo que recibe el resumen/lista de notificaciones de disponibilidad.
// Se puede sobrescribir con la variable de entorno NOTIFICACION_EMAIL_TO.
const NOTIFICACION_EMAIL_TO = process.env.NOTIFICACION_EMAIL_TO || 'dalucanoni@unitru.edu.pe';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const periodo = await queryOne(`
      SELECT * FROM disponibilidad_periodo 
      WHERE programacion_id = $1
    `, [id]);

    return NextResponse.json({ data: periodo });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[disponibilidad-periodo GET]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: programacion_id } = await params;

  try {
    const body = await req.json();
    const { fecha_inicio, fecha_cierre, enviar_notificacion, docente_id } = body;

    if (!fecha_inicio || !fecha_cierre) {
      return NextResponse.json({ error: 'fecha_inicio y fecha_cierre son requeridos' }, { status: 400 });
    }

    const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [programacion_id]);
    if (!prog) return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });

    // datetime-local ya viene en formato YYYY-MM-DDTHH:mm (local del navegador)
    // PostgreSQL interpretará esto como hora local si el timezone está configurado correctamente
    // Para asegurar que se guarde como hora local de Perú, agregamos la zona horaria
    const fechaInicioLocal = fecha_inicio + ':00-05:00'; // UTC-5 (Perú)
    const fechaCierreLocal = fecha_cierre + ':00-05:00';

    // Verificar si ya existe un período para esta programación
    const existente = await queryOne(`
      SELECT * FROM disponibilidad_periodo 
      WHERE programacion_id = $1
    `, [programacion_id]);

    let periodo;
    if (existente) {
      // Actualizar período existente
      periodo = await queryOne(`
        UPDATE disponibilidad_periodo 
        SET fecha_inicio = $1, fecha_cierre = $2, updated_at = NOW()
        WHERE programacion_id = $3
        RETURNING *
      `, [fechaInicioLocal, fechaCierreLocal, programacion_id]);
    } else {
      // Crear nuevo período
      periodo = await queryOne(`
        INSERT INTO disponibilidad_periodo (programacion_id, fecha_inicio, fecha_cierre, notificacion_enviada, creado_por)
        VALUES ($1, $2, $3, false, $4)
        RETURNING *
      `, [programacion_id, fechaInicioLocal, fechaCierreLocal, session.id]);
    }

    await queryOne(`UPDATE programaciones SET updated_at = NOW() WHERE id = $1`, [programacion_id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'disponibilidad_periodo',
      registro_id: periodo.id,
      datos_nuevos: periodo,
      descripcion: `Período de disponibilidad configurado para programación ${programacion_id}`,
    });

    // Si se solicitó enviar notificación, enviar correos a docentes con asignación
    if (enviar_notificacion) {
      try {
        console.log('=== INICIANDO ENVÍO DE NOTIFICACIONES ===');
        console.log('Programación ID:', programacion_id);
        console.log('Programación nombre:', prog.nombre);
        console.log('Docente destino:', docente_id || 'TODOS');

        // Obtener docentes con asignación en esta programación
        // Si se indica docente_id, notificar solo a ese docente.
        // Se prioriza el correo de contacto del docente (d.email) antes que el de
        // su cuenta de usuario (u.email), porque al editar un docente solo se
        // actualiza docentes.email y ahí se registra el correo al que desea recibir.
        const docentesAsignados = docente_id
          ? await query(`
              SELECT DISTINCT
                d.id,
                d.nombre,
                d.apellidos,
                COALESCE(NULLIF(d.email, ''), NULLIF(u.email, '')) AS email
              FROM docentes d
              INNER JOIN programacion_cursos pc ON pc.docente_id = d.id
              LEFT JOIN usuarios u ON u.id = d.usuario_id
              WHERE pc.programacion_id = $1 AND d.id = $2
              ORDER BY d.apellidos, d.nombre
            `, [programacion_id, docente_id])
          : await query(`
              SELECT DISTINCT
                d.id,
                d.nombre,
                d.apellidos,
                COALESCE(NULLIF(d.email, ''), NULLIF(u.email, '')) AS email
              FROM docentes d
              INNER JOIN programacion_cursos pc ON pc.docente_id = d.id
              LEFT JOIN usuarios u ON u.id = d.usuario_id
              WHERE pc.programacion_id = $1
              ORDER BY d.apellidos, d.nombre
            `, [programacion_id]);

        console.log('Docentes asignados encontrados:', docentesAsignados.length);

        if (docentesAsignados.length > 0) {
          const fechaInicioStr = new Date(fecha_inicio).toLocaleString('es-PE', { timeZone: 'America/Lima' });
          const fechaCierreStr = new Date(fecha_cierre).toLocaleString('es-PE', { timeZone: 'America/Lima' });

          const enviados: { nombre: string; email: string }[] = [];
          const omitidos: { nombre: string; motivo: string }[] = [];
          const fallidos: { nombre: string; email: string; motivo: string }[] = [];

          for (const docente of docentesAsignados as Array<{ id: string; nombre: string; apellidos: string; email: string | null }>) {
            const nombreCompleto = `${docente.nombre} ${docente.apellidos}`.trim();
            const email = (docente.email || '').trim();

            if (!email) {
              omitidos.push({ nombre: nombreCompleto, motivo: 'Sin correo registrado' });
              continue;
            }

            try {
              await enviarEmail({
                to: email,
                subject: `Registro de Disponibilidad - ${prog.nombre}`,
                text: [
                  `Estimado(a) ${nombreCompleto},`,
                  '',
                  `Se ha configurado el período para registrar su disponibilidad docente en la programación ${prog.nombre}.`,
                  '',
                  `Fecha de inicio: ${fechaInicioStr}`,
                  `Fecha de cierre: ${fechaCierreStr}`,
                  '',
                  'Por favor, ingrese al sistema y registre su disponibilidad dentro del período indicado.',
                  '',
                  'Este es un mensaje automático. Por favor, no responda este correo.',
                ].join('\n'),
                html: plantillaCorreo({
                  titulo: 'Registro de Disponibilidad Docente',
                  contenido: `
                    <p>Estimado(a) <strong>${nombreCompleto}</strong>,</p>
                    <p>Se ha configurado el período para registrar su disponibilidad docente en la programación <strong>${prog.nombre}</strong>.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                      <p style="margin: 8px 0;"><strong>Fecha de inicio:</strong> ${fechaInicioStr}</p>
                      <p style="margin: 8px 0;"><strong>Fecha de cierre:</strong> ${fechaCierreStr}</p>
                    </div>
                    <p>Por favor, ingrese al sistema y registre su disponibilidad dentro del período indicado.</p>
                  `,
                }),
              });
              console.log(`✓ Correo enviado a ${email}`);
              enviados.push({ nombre: nombreCompleto, email });
            } catch (err: unknown) {
              const motivo = err instanceof Error ? err.message : 'Error desconocido';
              console.error(`✗ Error enviando correo a ${email}:`, err);
              fallidos.push({ nombre: nombreCompleto, email, motivo });
            }
          }

          console.log(`=== RESUMEN: ${enviados.length}/${docentesAsignados.length} correos enviados exitosamente ===`);

          const ccSummary = session.email && session.email !== NOTIFICACION_EMAIL_TO ? session.email : undefined;

          if (session.email || NOTIFICACION_EMAIL_TO) {
            const destinoTexto = docente_id ? 'al docente seleccionado' : 'a los docentes asignados';
            const bloqueEnviados = enviados.length > 0
              ? `<ul>${enviados.map(item => `<li><strong>${item.nombre}</strong> (${item.email})</li>`).join('')}</ul>`
              : '<p>No se envió ningún correo a docentes.</p>';
            const bloqueOmitidos = omitidos.length > 0
              ? `<p><strong>Docentes omitidos por falta de correo:</strong></p><ul>${omitidos.map(item => `<li>${item.nombre}: ${item.motivo}</li>`).join('')}</ul>`
              : '';
            const bloqueFallidos = fallidos.length > 0
              ? `<p><strong>Errores de envío:</strong></p><ul>${fallidos.map(item => `<li>${item.nombre} (${item.email}): ${item.motivo}</li>`).join('')}</ul>`
              : '';

            await enviarEmail({
              to: NOTIFICACION_EMAIL_TO,
              cc: ccSummary,
              subject: `Resumen de notificación de disponibilidad - ${prog.nombre}`,
              text: [
                `Se registró el envío de notificaciones de disponibilidad ${destinoTexto} para ${prog.nombre}.`,
                '',
                `Enviados: ${enviados.length}`,
                ...enviados.map(item => `- ${item.nombre} (${item.email})`),
                '',
                `Omitidos: ${omitidos.length}`,
                ...omitidos.map(item => `- ${item.nombre}: ${item.motivo}`),
                '',
                `Fallidos: ${fallidos.length}`,
                ...fallidos.map(item => `- ${item.nombre} (${item.email}): ${item.motivo}`),
              ].join('\n'),
              html: plantillaCorreo({
                titulo: 'Resumen de notificación de disponibilidad',
                contenido: `
                  <p>Se registró el envío de notificaciones de disponibilidad ${destinoTexto} para la programación <strong>${prog.nombre}</strong>.</p>
                  <p><strong>Total enviados:</strong> ${enviados.length}</p>
                  ${bloqueEnviados}
                  ${bloqueOmitidos}
                  ${bloqueFallidos}
                `,
              }),
            });
          }

          // Marcar como notificación enviada (pero permitir múltiples envíos)
          await queryOne(`
            UPDATE disponibilidad_periodo 
            SET notificacion_enviada = true
            WHERE programacion_id = $1
          `, [programacion_id]);

          return NextResponse.json({
            data: periodo,
            notificationSummary: {
              sent: enviados.length,
              skipped: omitidos.length,
              failed: fallidos.length,
              target: docente_id ? 'single' : 'all',
            },
          }, { status: 201 });
        } else {
          console.log('No se encontraron docentes asignados para notificar');
          const ccSummary = session.email && session.email !== NOTIFICACION_EMAIL_TO ? session.email : undefined;
          if (session.email || NOTIFICACION_EMAIL_TO) {
            await enviarEmail({
              to: NOTIFICACION_EMAIL_TO,
              cc: ccSummary,
              subject: `Resumen de notificación de disponibilidad - ${prog.nombre}`,
              text: [
                `Se intentó enviar notificaciones de disponibilidad para ${prog.nombre}.`,
                '',
                'No se encontraron docentes asignados para notificar.',
              ].join('\n'),
              html: plantillaCorreo({
                titulo: 'Resumen de notificación de disponibilidad',
                contenido: `
                  <p>Se intentó enviar notificaciones de disponibilidad para la programación <strong>${prog.nombre}</strong>.</p>
                  <p>No se encontraron docentes asignados para notificar.</p>
                `,
              }),
            });
          }
          return NextResponse.json({
            data: periodo,
            notificationSummary: {
              sent: 0,
              skipped: 0,
              failed: 0,
              target: docente_id ? 'single' : 'all',
            },
          }, { status: 201 });
        }
      } catch (emailError) {
        console.error('Error enviando notificaciones:', emailError);
        throw emailError; // Re-throw para que el frontend reciba el error
      }
    }

    return NextResponse.json({ data: periodo }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[disponibilidad-periodo POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: programacion_id } = await params;

  try {
    const body = await req.json();
    const { fecha_inicio, fecha_cierre, notificacion_enviada } = body;

    const periodo = await queryOne(`
      UPDATE disponibilidad_periodo 
      SET fecha_inicio = COALESCE($1, fecha_inicio),
          fecha_cierre = COALESCE($2, fecha_cierre),
          notificacion_enviada = COALESCE($3, notificacion_enviada),
          updated_at = NOW()
      WHERE programacion_id = $4
      RETURNING *
    `, [fecha_inicio, fecha_cierre, notificacion_enviada, programacion_id]);

    if (!periodo) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    await queryOne(`UPDATE programaciones SET updated_at = NOW() WHERE id = $1`, [programacion_id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'UPDATE',
      tabla_afectada: 'disponibilidad_periodo',
      registro_id: periodo.id,
      datos_nuevos: periodo,
      descripcion: `Período de disponibilidad actualizado para programación ${programacion_id}`,
    });

    return NextResponse.json({ data: periodo });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[disponibilidad-periodo PUT]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: programacion_id } = await params;

  try {
    const anterior = await queryOne(`
      SELECT * FROM disponibilidad_periodo 
      WHERE programacion_id = $1
    `, [programacion_id]);

    if (!anterior) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
    }

    await queryOne(`DELETE FROM disponibilidad_periodo WHERE programacion_id = $1`, [programacion_id]);

    await queryOne(`UPDATE programaciones SET updated_at = NOW() WHERE id = $1`, [programacion_id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'DELETE',
      tabla_afectada: 'disponibilidad_periodo',
      registro_id: anterior.id,
      datos_anteriores: anterior,
      descripcion: `Período de disponibilidad eliminado para programación ${programacion_id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno';
    console.error('[disponibilidad-periodo DELETE]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
