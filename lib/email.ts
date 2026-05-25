import nodemailer from 'nodemailer';

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
}

export async function enviarEmail({ to, subject, text, html }: EmailOptions) {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
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

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563eb;">Bienvenido a SI Horarios UNT</h2>
      <p>Estimado <strong>${nombre}</strong>,</p>
      <p>Sus credenciales de acceso al sistema son:</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Correo:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Contraseña:</strong> ${dni}</p>
      </div>
      <p style="color: #ef4444; font-size: 0.9em;"><em>Recuerde no compartirlas.</em></p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 0.8em; color: #6b7280;">Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  `;

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

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2563eb;">Bienvenido a SI Horarios UNT</h2>
      <p>Estimado <strong>${nombre}</strong>,</p>
      <p>Sus credenciales de acceso al sistema son:</p>
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Correo:</strong> ${email}</p>
        <p style="margin: 5px 0;"><strong>Contraseña:</strong> ${password}</p>
        <p style="margin: 5px 0;"><strong>Rol:</strong> ${rol}</p>
      </div>
      <p style="color: #ef4444; font-size: 0.9em;"><em>Recuerde no compartirlas.</em></p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 0.8em; color: #6b7280;">Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  `;

  return enviarEmail({ to: email, subject, text, html });
}
