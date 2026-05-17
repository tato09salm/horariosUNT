import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

// GET — Listar programaciones (filtro por ciclo_id)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  let sql = `
    SELECT 
      p.*,
      c.nombre as ciclo_nombre, c.año, c.semestre,
      u.nombre || ' ' || u.apellidos as creador_nombre,
      (SELECT COUNT(*) FROM programacion_cursos pc WHERE pc.programacion_id = p.id) as total_cursos,
      (SELECT COUNT(DISTINCT pc.docente_id) FROM programacion_cursos pc WHERE pc.programacion_id = p.id AND pc.docente_id IS NOT NULL) as total_docentes
    FROM programaciones p
    JOIN ciclos c ON c.id = p.ciclo_id
    LEFT JOIN usuarios u ON u.id = p.created_by
  `;
  const params: any[] = [];

  if (ciclo_id) {
    sql += ` WHERE p.ciclo_id = $1`;
    params.push(ciclo_id);
  }

  sql += ` ORDER BY p.created_at DESC`;

  const data = await query(sql, params);
  return NextResponse.json({ data });
}

// POST — Crear nueva programación (auto-genera nombre)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { ciclo_id, config } = body;

    if (!ciclo_id) {
      return NextResponse.json({ error: 'ciclo_id es requerido' }, { status: 400 });
    }

    // Obtener datos del ciclo para auto-generar el nombre
    const ciclo = await queryOne(`SELECT * FROM ciclos WHERE id = $1`, [ciclo_id]);
    if (!ciclo) {
      return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
    }

    // Verificar que no exista una programación activa para este ciclo
    const existente = await queryOne(
      `SELECT id, nombre FROM programaciones WHERE ciclo_id = $1 AND estado != 'cancelado'`,
      [ciclo_id]
    );
    if (existente) {
      return NextResponse.json(
        { error: `Ya existe una programación activa para este ciclo: ${existente.nombre}` },
        { status: 409 }
      );
    }

    // Auto-generar nombre: "HORARIO 2024-II"
    const nombre = `HORARIO ${ciclo.año}-${ciclo.semestre}`;

    const prog = await queryOne(
      `INSERT INTO programaciones (ciclo_id, nombre, fase, estado, config, created_by)
       VALUES ($1, $2, 1, 'borrador', $3, $4)
       RETURNING *`,
      [ciclo_id, nombre, JSON.stringify(config || {}), session.id]
    );

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'programaciones',
      registro_id: prog.id,
      datos_nuevos: prog,
      descripcion: `Programación creada: ${nombre}`,
    });

    return NextResponse.json({ data: prog }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
