import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import nodemailer from 'nodemailer';

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
    const { fecha_inicio, fecha_cierre, enviar_notificacion } = body;

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

        // Obtener docentes con asignación en esta programación
        const docentesAsignados = await query(`
          SELECT DISTINCT d.id, d.nombre, d.apellidos, d.email
          FROM docentes d
          INNER JOIN programacion_cursos pc ON pc.docente_id = d.id
          WHERE pc.programacion_id = $1
          ORDER BY d.apellidos, d.nombre
        `, [programacion_id]);

        console.log('Docentes asignados encontrados:', docentesAsignados.length);

        if (docentesAsignados.length > 0) {
          // Agregar correo de testeo
          const emails = docentesAsignados
            .map((d: any) => d.email)
            .filter((e: string) => e);
          emails.push('dalucanoni@unitru.edu.pe'); // Correo de testeo

          console.log('Lista de correos a enviar:', emails);

          // Verificar configuración SMTP
          console.log('SMTP_HOST:', process.env.SMTP_HOST);
          console.log('SMTP_USER:', process.env.SMTP_USER);
          console.log('SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL);
          console.log('SMTP_FROM_NAME:', process.env.SMTP_FROM_NAME);

          if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.error('ERROR: SMTP_USER o SMTP_PASS no están configurados en .env');
            throw new Error('Configuración SMTP incompleta');
          }

          // Configurar transporter de nodemailer
          const smtpPort = parseInt(process.env.SMTP_PORT || '587');
          const isSecure = smtpPort === 465; // 465 usa SSL, 587 usa TLS

          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: smtpPort,
            secure: isSecure,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          // Verificar conexión SMTP
          try {
            await transporter.verify();
            console.log('Conexión SMTP verificada correctamente');
          } catch (verifyError) {
            console.error('Error verificando conexión SMTP:', verifyError);
            throw new Error('No se pudo conectar al servidor SMTP');
          }

          // Enviar correos
          const fechaInicioStr = new Date(fecha_inicio).toLocaleString('es-PE', { timeZone: 'America/Lima' });
          const fechaCierreStr = new Date(fecha_cierre).toLocaleString('es-PE', { timeZone: 'America/Lima' });

          let successCount = 0;
          for (const email of emails) {
            try {
              await transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'SI Horarios UNT'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
                to: email,
                subject: `Registro de Disponibilidad - ${prog.nombre}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1e40af;">Registro de Disponibilidad Docente</h2>
                    <p>Estimado docente,</p>
                    <p>Se ha configurado el período para el registro de disponibilidad docente para la programación <strong>${prog.nombre}</strong>.</p>
                    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                      <p style="margin: 8px 0;"><strong>Fecha de inicio:</strong> ${fechaInicioStr}</p>
                      <p style="margin: 8px 0;"><strong>Fecha de cierre:</strong> ${fechaCierreStr}</p>
                    </div>
                    <p>Por favor, ingrese al sistema para registrar su disponibilidad dentro del período indicado.</p>
                    <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Este es un mensaje automático, por favor no responda.</p>
                  </div>
                `,
              });
              console.log(`✓ Correo enviado a ${email}`);
              successCount++;
            } catch (err) {
              console.error(`✗ Error enviando correo a ${email}:`, err);
            }
          }

          console.log(`=== RESUMEN: ${successCount}/${emails.length} correos enviados exitosamente ===`);

          // Marcar como notificación enviada (pero permitir múltiples envíos)
          await queryOne(`
            UPDATE disponibilidad_periodo 
            SET notificacion_enviada = true
            WHERE programacion_id = $1
          `, [programacion_id]);
        } else {
          console.log('No se encontraron docentes asignados para notificar');
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
