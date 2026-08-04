import nodemailer from 'nodemailer';

// URL pública del sistema (para logo y enlaces dentro de los correos)
const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://sihorarios.robertoqr.dev/').replace(/\/+$/, '');
// Logo institucional que se muestra en el encabezado de los correos
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${SITE_URL}/logo-unt.png`;

/**
 * Plantilla HTML compartida para los correos del sistema: encabezado con el
 * logo de la UNT, título, contenido, botón de acceso al sistema y pie de página.
 */
export function plantillaCorreo(opts: { titulo: string; contenido: string }) {
  const { titulo, contenido } = opts;
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 16px; text-align: center;">
        <img src="${LOGO_URL}" alt="SI Horarios UNT" width="180" style="max-width: 220px; height: auto; border-radius: 6px;" />
        <div style="margin-top: 6px; font-size: 14px; font-weight: 700; color: #1a3a5c; letter-spacing: 0.02em;">SI Horarios UNT</div>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #1e40af; margin: 0 0 16px; font-size: 18px;">${titulo}</h2>
        ${contenido}
        <div style="margin: 24px 0 0; padding: 14px; background: #f3f4f6; border-radius: 8px; text-align: center;">
          <a href="${SITE_URL}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 700; text-decoration: none; padding: 10px 22px; border-radius: 8px;">Acceder al sistema</a>
        </div>
      </div>
      <div style="background: #f9fafb; padding: 14px 24px; font-size: 11px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb;">
        Universidad Nacional de Trujillo &middot; Este es un mensaje automático, por favor no responda a este correo.
      </div>
    </div>
  `;
}

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const missing: string[] = [];
  if (!process.env.SMTP_HOST) missing.push('SMTP_HOST');
  if (!process.env.SMTP_PORT) missing.push('SMTP_PORT');
  if (!process.env.SMTP_USER) missing.push('SMTP_USER');
  if (!process.env.SMTP_PASS) missing.push('SMTP_PASS');
  if (!process.env.SMTP_FROM_NAME) missing.push('SMTP_FROM_NAME');
  if (!process.env.SMTP_FROM_EMAIL) missing.push('SMTP_FROM_EMAIL');

  if (missing.length > 0) {
    throw new Error(`Faltan variables SMTP: ${missing.join(', ')}`);
  }

  const port = parseInt(process.env.SMTP_PORT || '465');

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string | string[];
}

export async function enviarEmail({ to, subject, text, html, cc }: EmailOptions) {
  try {
    if (process.env.EMAILS_DISABLED === 'true') {
      console.log('Emails deshabilitados por EMAILS_DISABLED=true. Omitiendo envio a %s.', to);
      return null;
    }
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      cc,
      subject,
      text,
      html,
    });
    console.log('Email enviado: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error enviando email:', error);
    throw error;
  }
}

export async function enviarCredencialesDocente(nombre: string, email: string, dni: string) {
  const subject = 'Credenciales de acceso - SI Horarios UNT';
  const text = `
Estimado ${nombre},

Sus credenciales de acceso al sistema SI Horarios UNT son:

Correo: ${email}
Contraseña: ${dni}

Recuerde no compartirlas.

Atentamente,
El equipo de SI Horarios UNT
  `;

  const html = plantillaCorreo({
    titulo: 'Bienvenido a SI Horarios UNT',
    contenido: `
      <p>Estimado <strong>${nombre}</strong>,</p>
      <p>Sus credenciales de acceso al sistema son:</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Correo:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Contraseña:</strong> ${dni}</p>
      </div>
      <p style="color: #ef4444; font-size: 0.9em;"><em>Recuerde no compartirlas.</em></p>
    `,
  });

  return enviarEmail({ to: email, subject, text, html });
}

export async function enviarCredencialesUsuario(params: {
  nombre: string;
  email: string;
  password: string;
  rol: string;
}) {
  const { nombre, email, password, rol } = params;
  const subject = 'Credenciales de acceso - SI Horarios UNT';
  const text = `
Estimado ${nombre},

Sus credenciales de acceso al sistema SI Horarios UNT son:

Correo: ${email}
Contraseña: ${password}
Rol: ${rol}

Recuerde no compartirlas.

Atentamente,
El equipo de SI Horarios UNT
  `;

  const html = plantillaCorreo({
    titulo: 'Bienvenido a SI Horarios UNT',
    contenido: `
      <p>Estimado <strong>${nombre}</strong>,</p>
      <p>Sus credenciales de acceso al sistema son:</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Correo:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Contraseña:</strong> ${password}</p>
        <p style="margin: 5px 0;"><strong>Rol:</strong> ${rol}</p>
      </div>
      <p style="color: #ef4444; font-size: 0.9em;"><em>Recuerde no compartirlas.</em></p>
    `,
  });

  return enviarEmail({ to: email, subject, text, html });
}
