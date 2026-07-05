
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function runVerification() {
  console.log('Iniciando verificación manual de usuarios para docentes...');

  try {
    const resDocentes = await pool.query(`
      SELECT d.* FROM docentes d
      LEFT JOIN usuarios u ON u.id = d.usuario_id
      WHERE (d.usuario_id IS NULL OR u.id IS NULL) AND d.email IS NOT NULL AND d.email != ''
    `);

    console.log(`Docentes sin usuario: ${resDocentes.rows.length}`);

    let creados = 0;
    for (const doc of resDocentes.rows) {
      const userExists = await pool.query('SELECT id FROM usuarios WHERE email = $1', [doc.email]);
      
      let usuarioId;
      if (userExists.rows.length === 0) {
        const passwordHash = await bcrypt.hash(doc.dni, 10);
        const userRes = await pool.query(
          `INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol)
           VALUES ($1, $2, $3, $4, 'docente') RETURNING id`,
          [doc.nombre, doc.apellidos, doc.email, passwordHash]
        );
        usuarioId = userRes.rows[0].id;
        creados++;
        console.log(`Creado usuario para: ${doc.nombre} ${doc.apellidos} (${doc.email})`);
      } else {
        usuarioId = userExists.rows[0].id;
        console.log(`Usuario ya existía para: ${doc.email}, vinculando...`);
      }

      await pool.query('UPDATE docentes SET usuario_id = $1 WHERE id = $2', [usuarioId, doc.id]);
    }

    console.log(`Proceso terminado. Usuarios creados: ${creados}`);

    // Probar ahora la autenticación de Robert Jerry Sánchez Ticona
    const emailTest = 'rsanchez@unt.edu.pe';
    const passTest = '29292929';
    const resTest = await pool.query('SELECT * FROM usuarios WHERE email = $1', [emailTest]);
    const userTest = resTest.rows[0];

    if (userTest) {
      const valid = await bcrypt.compare(passTest, userTest.password_hash);
      console.log(`Prueba final Robert Jerry Sánchez Ticona: ${valid ? 'EXITOSA' : 'FALLIDA'}`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

runVerification();
