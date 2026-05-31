import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';
import { enviarCredencialesUsuario } from '@/lib/email';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const buscar = searchParams.get('buscar') || '';
    const rol = searchParams.get('rol') || '';
    const esReporte = searchParams.get('reporte') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    let whereConditions = '';
    const params: (string | number)[] = [];
    let idx = 1;

    if (buscar) {
      whereConditions += ` AND (nombre ILIKE $${idx} OR apellidos ILIKE $${idx} OR email ILIKE $${idx})`;
      params.push(`%${buscar}%`);
      idx++;
    }

    if (rol) {
      whereConditions += ` AND rol = $${idx}`;
      params.push(rol);
      idx++;
    }

    // Si es reporte, devolver TODOS los usuarios filtrados (sin paginación)
    if (esReporte) {
      const todos = await query(
        `SELECT id, nombre, apellidos, email, rol, activo, created_at
         FROM usuarios
         WHERE 1=1 ${whereConditions}
         ORDER BY nombre`,
        params
      );
      return NextResponse.json({ data: todos });
    }

    // Si NO es reporte, devolver paginado
    const usuarios = await query(
      `SELECT id, nombre, apellidos, email, rol, activo, created_at
       FROM usuarios
       WHERE 1=1 ${whereConditions}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*) as total FROM usuarios WHERE 1=1 ${whereConditions}`,
      params
    );
    const total = parseInt(totalResult[0]?.total || '0');

    const countsResult = await query(
      `SELECT rol, COUNT(*) as count FROM usuarios WHERE 1=1 ${whereConditions} GROUP BY rol`,
      params
    );
    const countsByRole: Record<string, number> = {};
    countsResult.forEach((r: { rol: string; count: string }) => {
      countsByRole[r.rol] = parseInt(r.count);
    });

    return NextResponse.json({
      data: usuarios,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      countsByRole
    });
  } catch (error: unknown) {
    console.error('Error GET usuarios:', error);
    const message = error instanceof Error ? error.message : 'Error al cargar usuarios';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const rawPassword = body.password || 'temporal123';
    const hash = await hashPassword(rawPassword);
    const usuario = await queryOne(
      `INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, nombre, apellidos, email, rol`,
      [body.nombre.toUpperCase(), body.apellidos.toUpperCase(), body.email, hash, body.rol]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'CREATE',
      tabla_afectada: 'usuarios',
      registro_id: usuario?.id,
      descripcion: `Usuario creado: ${body.email}`,
    });

    if (usuario?.email) {
      try {
        const nombre = `${usuario.nombre} ${usuario.apellidos}`.trim();
        await enviarCredencialesUsuario({
          nombre: nombre || 'Usuario',
          email: usuario.email,
          password: rawPassword,
          rol: usuario.rol,
        });
      } catch (emailErr) {
        console.error(`Error enviando email a ${usuario.email}:`, emailErr);
      }
    }

    return NextResponse.json({ data: usuario }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al crear usuario';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}