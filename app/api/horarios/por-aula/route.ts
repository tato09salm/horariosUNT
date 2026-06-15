import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');
  const docente_id = searchParams.get('docente_id');
  if (!ciclo_id) return NextResponse.json({ error: 'ciclo_id requerido' }, { status: 400 });

  try {
    const desdeTablaParams = docente_id ? [ciclo_id, docente_id] : [ciclo_id];

    // 1. Intentar desde tabla asignaciones (publicado)
    const desdeTabla = await query(`
      SELECT a.*, st.hora_inicio, st.hora_fin, st.nombre as slot_nombre,
             c.nombre as curso_nombre, c.codigo as curso_codigo,
             d.nombre || ' ' || d.apellidos as docente_nombre,
             amb.nombre as ambiente_nombre, amb.codigo as ambiente_codigo, amb.tipo as ambiente_tipo,
             g.numero_grupo
      FROM asignaciones a
      JOIN slots_tiempo st ON st.id = a.slot_id
      LEFT JOIN grupos g ON g.id = a.grupo_id
      LEFT JOIN cursos c ON c.id = g.curso_id
      LEFT JOIN docentes d ON d.id = a.docente_id
      LEFT JOIN ambientes amb ON amb.id = a.ambiente_id
      WHERE a.ciclo_id = $1 AND a.estado = 'activo'
      ${docente_id ? `AND a.docente_id = $2` : ''}
      ORDER BY amb.codigo, a.dia, st.orden
    `, desdeTablaParams);
    if (desdeTabla.length > 0) {
      return NextResponse.json({ data: desdeTabla });
    }

    // 2. Fallback: leer desde programaciones.config.asignaciones
    const prog = await queryOne(`
      SELECT config FROM programaciones WHERE ciclo_id = $1 AND estado IN ('borrador', 'publicado') ORDER BY created_at DESC LIMIT 1
    `, [ciclo_id]);

    if (!prog?.config?.asignaciones?.length) {
      return NextResponse.json({ data: [] });
    }

    // Cargar slots, ambientes, cursos, docentes para enriquecer
    const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
    const slotsMap = new Map(slots.map((s: any) => [s.id, s]));
    const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true`);
    const ambMap = new Map(ambientes.map((a: any) => [a.id, a]));

    const enriched = [];
    const asignacionesFiltradas = docente_id
      ? prog.config.asignaciones.filter((a: any) => a.docente_id === docente_id)
      : prog.config.asignaciones;
    for (const a of asignacionesFiltradas) {
      const slot = slotsMap.get(a.slot_id);
      const amb = ambMap.get(a.ambiente_id);

      let cursoNombre = a.curso_nombre || '';
      let cursoCodigo = a.curso_codigo || '';
      let docenteNombre = a.docente_nombre || '';

      enriched.push({
        ...a,
        hora_inicio: slot?.hora_inicio || '',
        hora_fin: slot?.hora_fin || '',
        ambiente_nombre: a.ambiente_nombre || amb?.nombre || '',
        ambiente_codigo: a.ambiente_codigo || amb?.codigo || '',
        ambiente_tipo: a.ambiente_tipo || amb?.tipo || 'aula',
        curso_nombre: cursoNombre,
        curso_codigo: cursoCodigo,
        docente_nombre: docenteNombre,
      });
    }

    return NextResponse.json({ data: enriched });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
