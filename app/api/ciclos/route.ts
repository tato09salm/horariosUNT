import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar') || '';
  const anio = searchParams.get('anio') || '';
  const semestre = searchParams.get('semestre') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const reporte = searchParams.get('reporte') === 'true';

  let querySql = `SELECT * FROM ciclos WHERE 1=1`;
  const params: any[] = [];
  let paramIndex = 1;

  if (buscar) {
    querySql += ` AND nombre ILIKE $${paramIndex}`;
    params.push(`%${buscar}%`);
    paramIndex++;
  }

  if (anio) {
    querySql += ` AND año = $${paramIndex}`;
    params.push(anio);
    paramIndex++;
  }

  if (semestre) {
    querySql += ` AND semestre = $${paramIndex}`;
    params.push(semestre);
    paramIndex++;
  }

  querySql += ` ORDER BY año DESC, semestre`;

  if (reporte) {
    const ciclos = await query(querySql, params);
    const mappedCiclos = ciclos.map((c: any) => ({
      ...c,
      estado: c.activo ? 'activo' : 'inactivo'
    }));
    return NextResponse.json({ data: mappedCiclos });
  }

  const offset = (page - 1) * limit;
  querySql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const ciclos = await query(querySql, params);
  const mappedCiclos = ciclos.map((c: any) => ({
    ...c,
    estado: c.activo ? 'activo' : 'inactivo'
  }));

  const totalResult = await query(`SELECT COUNT(*) as total FROM ciclos WHERE 1=1` +
    (buscar ? ` AND nombre ILIKE $1` : '') +
    (anio ? ` AND año = $${(buscar ? 2 : 1)}` : '') +
    (semestre ? ` AND semestre = $${(buscar ? (anio ? 3 : 2) : (anio ? 2 : 1))}` : ''),
    params.slice(0, paramIndex - 1)
  );
  const total = totalResult[0]?.total || 0;

  return NextResponse.json({ data: mappedCiclos, total });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  try {
    const body = await req.json();
    const ciclo = await queryOne(
      `INSERT INTO ciclos (nombre, año, semestre, tipo, fecha_inicio, fecha_fin, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        body.nombre, 
        body.año, 
        body.semestre, 
        body.tipo || 'regular', 
        body.fecha_inicio || null, 
        body.fecha_fin || null, 
        body.activo || false
      ]
    );

    const mappedCiclo = ciclo ? { ...ciclo, estado: ciclo.activo ? 'activo' : 'pendiente' } : null;

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'CREATE',
      tabla_afectada: 'ciclos',
      registro_id: ciclo?.id,
      datos_nuevos: mappedCiclo,
      descripcion: `Ciclo creado: ${ciclo?.nombre}`,
    });

    return NextResponse.json({ data: mappedCiclo }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
