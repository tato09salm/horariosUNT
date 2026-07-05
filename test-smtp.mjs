
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function testConnection() {
  console.log('Probando conexión SMTP...');
  try {
    await transporter.verify();
    console.log('SUCCESS: Conexión SMTP verificada correctamente.');
  } catch (error) {
    console.error('ERROR: No se pudo conectar al servidor SMTP:', error);
  }
}

testConnection();
