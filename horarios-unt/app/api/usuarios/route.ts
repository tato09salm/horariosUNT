import { NextRequest, NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  const usuarios = await query(`SELECT id, nombre, apellidos, email, rol, activo, created_at FROM usuarios ORDER BY nombre`);
  return NextResponse.json({ data: usuarios });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });

  try {
    const body = await req.json();
    const hash = await hashPassword(body.password || 'temporal123');
    const usuario = await queryOne(
      `INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, apellidos, email, rol`,
      [body.nombre, body.apellidos, body.email, hash, body.rol]
    );

    await registrarAuditoria({
      usuario_id: session.id, accion: 'CREATE', tabla_afectada: 'usuarios',
      registro_id: usuario?.id, descripcion: `Usuario creado: ${body.email}`,
    });
    return NextResponse.json({ data: usuario }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
