
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function testAuth() {
  const email = 'rsanchez@unt.edu.pe';
  const password = '29292929'; // DNI de Robert Jerry Sánchez Ticona

  console.log(`Probando autenticación para: ${email}`);

  try {
    const res = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    const user = res.rows[0];

    if (!user) {
      console.error('ERROR: Usuario no encontrado en la base de datos.');
      return;
    }

    console.log('Usuario encontrado:', { id: user.id, email: user.email, rol: user.rol });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (valid) {
      console.log('SUCCESS: La contraseña (DNI) coincide con el hash almacenado.');
    } else {
      console.error('ERROR: La contraseña no coincide.');
    }
  } catch (err) {
    console.error('Error durante la prueba:', err);
  } finally {
    await pool.end();
  }
}

testAuth();
