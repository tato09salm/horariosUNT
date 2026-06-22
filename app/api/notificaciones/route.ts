import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('user_id') || session.id;
  const soloNoLeidas = searchParams.get('solo_no_leidas') !== 'false';

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        titulo TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'info',
        leida BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const where = soloNoLeidas ? 'AND (n.leida = false OR n.leida IS NULL)' : '';
    const rows = await query(`
      SELECT n.*, u.nombre as usuario_nombre, u.email as usuario_email
      FROM notificaciones n
      JOIN usuarios u ON u.id = n.usuario_id
      WHERE n.usuario_id = $1 ${where}
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId]);

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const { usuario_id, titulo, mensaje, tipo } = await req.json();

    if (!usuario_id || !titulo || !mensaje) {
      return NextResponse.json({ error: 'usuario_id, titulo y mensaje son requeridos' }, { status: 400 });
    }

    await query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        titulo TEXT NOT NULL,
        mensaje TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'info',
        leida BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const notif = await queryOne(`
      INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [usuario_id, titulo, mensaje, tipo || 'info']);

    return NextResponse.json({ data: notif }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
