import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { getHorarioAmbiente } from '@/lib/horarios';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo');
  const ciclo_id = searchParams.get('ciclo_id');
  const dia = searchParams.get('dia');
  const slot_id = searchParams.get('slot_id');

  let sql = `SELECT * FROM ambientes WHERE disponible = true`;
  const params: any[] = [];
  let idx = 1;

  if (tipo) { sql += ` AND tipo = $${idx++}`; params.push(tipo); }

  // Si se consulta disponibilidad en un slot específico
  if (ciclo_id && dia && slot_id) {
    sql += ` AND id NOT IN (
      SELECT ambiente_id FROM asignaciones 
      WHERE ciclo_id = $${idx++} AND dia = $${idx++} AND slot_id = $${idx++} AND estado = 'activo'
    )`;
    params.push(ciclo_id, dia, slot_id);
  }

  sql += ` ORDER BY tipo, codigo`;

  const ambientes = await query(sql, params);
  return NextResponse.json({ data: ambientes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const ambiente = await queryOne(
      `INSERT INTO ambientes (codigo, nombre, tipo, capacidad, piso, edificio, equipamiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [body.codigo, body.nombre, body.tipo, body.capacidad, body.piso, body.edificio, body.equipamiento || []]
    );

    await registrarAuditoria({
      usuario_id: session.id, accion: 'CREATE', tabla_afectada: 'ambientes',
      registro_id: ambiente?.id, datos_nuevos: ambiente, descripcion: `Ambiente creado: ${body.nombre}`,
    });

    return NextResponse.json({ data: ambiente }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
