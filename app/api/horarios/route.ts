import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';
import { crearAsignacion, verificarConflicto } from '@/lib/horarios';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');
  const docente_id = searchParams.get('docente_id');
  const ambiente_id = searchParams.get('ambiente_id');
  const curso_id = searchParams.get('curso_id');

  let sql = `
    SELECT 
      a.*,
      c.nombre as curso_nombre, c.codigo as curso_codigo, c.ciclo_plan,
      c.horas_teoria, c.horas_practica,
      d.nombre || ' ' || d.apellidos as docente_nombre,
      d.categoria as docente_categoria, d.condicion as docente_condicion,
      amb.nombre as ambiente_nombre, amb.codigo as ambiente_codigo, amb.tipo as ambiente_tipo,
      st.hora_inicio, st.hora_fin, st.nombre as slot_nombre, st.orden as slot_orden,
      g.numero_grupo,
      ci.nombre as ciclo_nombre
    FROM asignaciones a
    JOIN grupos g ON g.id = a.grupo_id
    JOIN cursos c ON c.id = g.curso_id
    JOIN docentes d ON d.id = a.docente_id
    JOIN ambientes amb ON amb.id = a.ambiente_id
    JOIN slots_tiempo st ON st.id = a.slot_id
    JOIN ciclos ci ON ci.id = a.ciclo_id
    WHERE a.estado = 'activo'
  `;
  const params: any[] = [];
  let idx = 1;

  if (ciclo_id) { sql += ` AND a.ciclo_id = $${idx++}`; params.push(ciclo_id); }
  if (docente_id) { sql += ` AND a.docente_id = $${idx++}`; params.push(docente_id); }
  if (ambiente_id) { sql += ` AND a.ambiente_id = $${idx++}`; params.push(ambiente_id); }
  if (curso_id) { sql += ` AND c.id = $${idx++}`; params.push(curso_id); }

  sql += ` ORDER BY CASE a.dia WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6 END, st.orden`;

  const asignaciones = await query(sql, params);
  return NextResponse.json({ data: asignaciones });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const asignacion = await crearAsignacion({ ...body, created_by: session.id });
    return NextResponse.json({ data: asignacion }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
