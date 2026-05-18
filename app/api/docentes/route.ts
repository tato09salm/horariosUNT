import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { query, queryOne, transaction } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar');
  const categoria = searchParams.get('categoria');
  const condicion = searchParams.get('condicion');
  const activo = searchParams.get('activo');
  const reporte = searchParams.get('reporte') === 'true';
  const verificarUsuarios = searchParams.get('verificarUsuarios') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  // Lógica de verificación y creación automática de usuarios para docentes existentes
  if (verificarUsuarios && (session.rol === 'admin' || session.rol === 'secretaria')) {
    try {
      const docentesSinUsuario = await query(`
        SELECT d.* FROM docentes d
        LEFT JOIN usuarios u ON u.id = d.usuario_id
        WHERE (d.usuario_id IS NULL OR u.id IS NULL) AND d.email IS NOT NULL AND d.email != ''
      `);

      let creados = 0;
      for (const doc of docentesSinUsuario) {
        await transaction(async (client) => {
          // Verificar si el email ya existe en usuarios (aunque no esté vinculado a este docente)
          const userExists = await client.query('SELECT id FROM usuarios WHERE email = $1', [doc.email]);
          
          let usuarioId;
          if (userExists.rows.length === 0) {
            const passwordHash = await hashPassword(doc.dni);
            const userRes = await client.query(
              `INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol)
               VALUES ($1, $2, $3, $4, 'docente') RETURNING id`,
              [doc.nombre, doc.apellidos, doc.email, passwordHash]
            );
            usuarioId = userRes.rows[0].id;
            creados++;
          } else {
            usuarioId = userExists.rows[0].id;
          }

          await client.query('UPDATE docentes SET usuario_id = $1 WHERE id = $2', [usuarioId, doc.id]);
        });
      }

      if (creados > 0) {
        await registrarAuditoria({
          usuario_id: session.id,
          usuario_nombre: `${session.nombre} ${session.apellidos}`,
          accion: 'UPDATE',
          tabla_afectada: 'usuarios/docentes',
          descripcion: `Se crearon ${creados} usuarios automáticos para docentes existentes`,
        });
      }
    } catch (err) {
      console.error('Error verificando usuarios:', err);
    }
  }

  let sql = `
    SELECT d.*, 
      u.email as usuario_email, u.rol as usuario_rol,
      CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
      CASE d.categoria 
        WHEN 'principal' THEN 0 WHEN 'asociado' THEN 1 
        WHEN 'auxiliar' THEN 2 WHEN 'jefe_practica' THEN 3 
      END as categoria_orden
    FROM docentes d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    WHERE 1=1
  `;
  const params: any[] = [];
  let idx = 1;

  if (buscar) {
    sql += ` AND (d.nombre ILIKE $${idx} OR d.apellidos ILIKE $${idx} OR d.dni ILIKE $${idx})`;
    params.push(`%${buscar}%`);
    idx++;
  }
  if (categoria) { sql += ` AND d.categoria = $${idx++}`; params.push(categoria); }
  if (condicion) { sql += ` AND d.condicion = $${idx++}`; params.push(condicion); }
  if (activo !== null && activo !== undefined && activo !== '') {
    sql += ` AND d.activo = $${idx++}`; params.push(activo === 'true');
  }

  // Count total for pagination
  const countSql = `SELECT COUNT(*) FROM (${sql}) as total`;
  const totalRes = await queryOne(countSql, params);
  const total = parseInt(totalRes?.count || '0');

  sql += ` ORDER BY condicion_orden, categoria_orden, d.fecha_ingreso ASC`;
  
  if (!reporte) {
    sql += ` LIMIT $${idx++ } OFFSET $${idx++}`;
    params.push(limit, offset);
  }

  const docentes = await query(sql, params);
  return NextResponse.json({ data: docentes, total, page: reporte ? 1 : page, limit: reporte ? total : limit });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, apellidos, dni, email, telefono, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana } = body;

    const result = await transaction(async (client) => {
      // 1. Crear el docente
      const docenteRes = await client.query(
        `INSERT INTO docentes (nombre, apellidos, dni, email, telefono, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [nombre, apellidos, dni, email, telefono, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana || 20]
      );
      const docente = docenteRes.rows[0];

      // 2. Crear usuario automático si tiene email
      if (email) {
        // Verificar si ya existe un usuario con ese email
        const userExists = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        
        let usuarioId;
        if (userExists.rows.length === 0) {
          const passwordHash = await hashPassword(dni); // DNI como password
          const userRes = await client.query(
            `INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol)
             VALUES ($1, $2, $3, $4, 'docente') RETURNING id`,
            [nombre, apellidos, email, passwordHash]
          );
          usuarioId = userRes.rows[0].id;
        } else {
          usuarioId = userExists.rows[0].id;
        }

        // 3. Vincular docente con usuario
        await client.query('UPDATE docentes SET usuario_id = $1 WHERE id = $2', [usuarioId, docente.id]);
        docente.usuario_id = usuarioId;
      }

      return docente;
    });

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'docentes',
      registro_id: result?.id,
      datos_nuevos: result,
      descripcion: `Docente creado con usuario automático: ${nombre} ${apellidos}`,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
