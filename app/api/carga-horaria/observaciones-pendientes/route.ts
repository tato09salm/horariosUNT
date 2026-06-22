import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  if (!ciclo_id) return NextResponse.json({ data: [] });

  try {
    // Ensure columns exist
    try {
      await query(`ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS observaciones TEXT`);
      await query(`ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS estado_observaciones VARCHAR(20) DEFAULT 'pendiente'`);
    } catch (_) {}

    const rows = await query(`
      SELECT
        chc.id,
        chc.observaciones,
        chc.estado_observaciones,
        chc.created_at,
        chc.updated_at,
        d.nombre || ' ' || d.apellidos as docente_nombre,
        c.codigo as curso_codigo,
        c.nombre as curso_nombre
      FROM carga_horaria_cursos chc
      JOIN carga_horaria ch ON ch.id = chc.carga_horaria_id
      JOIN docentes d ON d.id = ch.docente_id
      JOIN cursos c ON c.id = chc.curso_id
      WHERE chc.observaciones IS NOT NULL AND chc.observaciones != ''
        AND (chc.estado_observaciones IS NULL OR chc.estado_observaciones = 'pendiente')
        AND ch.ciclo_academico_id = $1
      ORDER BY chc.updated_at DESC
    `, [ciclo_id]);

    return NextResponse.json({ data: rows });
  } catch (error: any) {
    return NextResponse.json({ data: [] });
  }
}
