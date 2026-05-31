import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { getHorarioAmbiente } from '@/lib/horarios';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar');
  const tipo = searchParams.get('tipo');
  const piso = searchParams.get('piso');
  const ciclo_id = searchParams.get('ciclo_id');
  const dia = searchParams.get('dia');
  const slot_id = searchParams.get('slot_id');
  const disponible = searchParams.get('disponible');
  const reporte = searchParams.get('reporte') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  let sql = `SELECT * FROM ambientes WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (buscar) {
    sql += ` AND (nombre ILIKE $${idx} OR edificio ILIKE $${idx} OR codigo ILIKE $${idx})`;
    params.push(`%${buscar}%`);
    idx++;
  }
  if (tipo) { sql += ` AND tipo = $${idx++}`; params.push(tipo); }
  if (piso) { sql += ` AND piso = $${idx++}`; params.push(parseInt(piso)); }
  if (disponible !== null && disponible !== undefined && disponible !== '') {
    sql += ` AND disponible = $${idx++}`; params.push(disponible === 'true');
  } else if (!searchParams.has('all')) {
    // Por defecto solo disponibles a menos que se pida todo
    // Para la gestión de aulas usualmente queremos ver todas
  }

  // Si se consulta disponibilidad en un slot específico
  if (ciclo_id && dia && slot_id) {
    sql += ` AND id NOT IN (
      SELECT ambiente_id FROM asignaciones 
      WHERE ciclo_id = $${idx++} AND dia = $${idx++} AND slot_id = $${idx++} AND estado = 'activo'
    )`;
    params.push(ciclo_id, dia, slot_id);
  }

  // Count total for pagination
  const countSql = `SELECT COUNT(*) FROM (${sql}) as total`;
  const totalRes = await queryOne(countSql, params);
  const total = parseInt(totalRes?.count || '0');

  // Counts by type for KPIs (ignoring pagination)
  const countsSql = `
    SELECT 
      COUNT(*) FILTER (WHERE tipo = 'aula') as aulas,
      COUNT(*) FILTER (WHERE tipo = 'laboratorio') as laboratorios,
      COUNT(*) FILTER (WHERE tipo NOT IN ('aula', 'laboratorio')) as otros
    FROM (${sql}) as filtered
  `;
  const countsRes = await queryOne(countsSql, params);
  const stats = {
    aulas: parseInt(countsRes?.aulas || '0'),
    laboratorios: parseInt(countsRes?.laboratorios || '0'),
    otros: parseInt(countsRes?.otros || '0')
  };

  sql += ` ORDER BY tipo, codigo`;
  
  if (!reporte) {
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
  }

  const ambientes = await query(sql, params);
  return NextResponse.json({ data: ambientes, total, stats, page: reporte ? 1 : page, limit: reporte ? total : limit });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const codigoUpper = body.codigo?.toUpperCase() || '';
    const nombreUpper = body.nombre?.toUpperCase() || '';
    const edificioUpper = body.edificio?.toUpperCase() || '';
    const ambiente = await queryOne(
      `INSERT INTO ambientes (codigo, nombre, tipo, capacidad, piso, edificio, equipamiento)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [codigoUpper, nombreUpper, body.tipo, body.capacidad, body.piso, edificioUpper, body.equipamiento || []]
    );

    await registrarAuditoria({
      usuario_id: session.id, accion: 'CREATE', tabla_afectada: 'ambientes',
      registro_id: ambiente?.id, datos_nuevos: ambiente, descripcion: `Ambiente creado: ${nombreUpper}`,
    });

    return NextResponse.json({ data: ambiente }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
