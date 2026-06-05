import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

/**
 * GET /api/horarios/exportar?programacion_id=XXX&formato=csv|json
 * Exporta el horario publicado. El PDF se genera en el cliente con jsPDF.
 * Este endpoint devuelve los datos estructurados para el cliente.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const programacion_id = searchParams.get('programacion_id');
  const formato = searchParams.get('formato') || 'json';

  if (!programacion_id) return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });

  const prog = await queryOne(`
    SELECT p.*, c.nombre as ciclo_nombre
    FROM programaciones p JOIN ciclos c ON c.id = p.ciclo_id
    WHERE p.id = $1
  `, [programacion_id]);

  if (!prog) return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });

  const asignaciones = prog.config?.asignaciones || [];

  if (asignaciones.length === 0) {
    return NextResponse.json({ error: 'No hay asignaciones generadas' }, { status: 404 });
  }

  // Enriquecer con datos de docente (nombre completo)
  const docenteIds = [...new Set(asignaciones.map((a: any) => a.docente_id).filter(Boolean))];
  const docentesData = docenteIds.length > 0
    ? await query(`SELECT id, nombre || ' ' || apellidos as nombre_completo FROM docentes WHERE id = ANY($1)`, [docenteIds])
    : [];
  const docenteMap = new Map(docentesData.map((d: any) => [d.id, d.nombre_completo]));

  const cursoCodigos = [...new Set(asignaciones.map((a: any) => a.curso_codigo).filter(Boolean))];
  const cursosData = cursoCodigos.length > 0
    ? await query(`SELECT codigo, ciclo_plan FROM cursos WHERE codigo = ANY($1)`, [cursoCodigos])
    : [];
  const cursoMap = new Map(cursosData.map((c: any) => [c.codigo, c.ciclo_plan]));

  // Obtener slots_tiempo
  const slotsData = await query('SELECT id, hora_inicio, hora_fin FROM slots_tiempo');
  const slotMap = new Map(slotsData.map((s: any) => [s.id, { inicio: s.hora_inicio, fin: s.hora_fin }]));

  const rows = asignaciones.map((a: any) => {
    const slot = slotMap.get(a.slot_id) || { inicio: '', fin: '' };
    return {
      dia: a.dia,
      slot_id: a.slot_id,
      hora_inicio: slot.inicio,
      hora_fin: slot.fin,
      curso_codigo: a.curso_codigo,
      curso_nombre: a.curso_nombre,
      ciclo_plan: Number(a.ciclo_plan || cursoMap.get(a.curso_codigo) || a.ciclo || 0) || null,
      grupo: `G${a.numero_grupo}`,
      tipo: a.tipo,
      docente_id: a.docente_id || null,
      docente_nombre: a.docente_id ? (docenteMap.get(a.docente_id) || a.docente_nombre || '') : '',
      docente: a.docente_id ? (docenteMap.get(a.docente_id) || a.docente_nombre || '') : 'Sin asignar',
      aula: a.ambiente_codigo,
      aula_nombre: a.ambiente_nombre,
      ambiente_codigo: a.ambiente_codigo,
      ambiente_nombre: a.ambiente_nombre,
      ambiente_id: a.ambiente_id || null,
      fuente: a.fuente || 'CSP',
    };
  });

  if (formato === 'csv') {
    const encabezado = 'Día,Hora Inicio,Hora Fin,Curso,Nombre Curso,Grupo,Tipo,Docente,Aula\n';
    const csvContent = rows.map((r: any) =>
      `${r.dia},${r.hora_inicio},${r.hora_fin},${r.curso_codigo},"${r.curso_nombre}",${r.grupo},${r.tipo},"${r.docente}",${r.aula}`
    ).join('\n');

    return new NextResponse(encabezado + csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="horario-${prog.nombre.replace(/\s+/g, '-')}.csv"`,
      },
    });
  }

  return NextResponse.json({
    programacion: {
      nombre: prog.nombre,
      ciclo: prog.ciclo_nombre,
      publicado_at: prog.publicado_at,
    },
    asignaciones: rows,
    total: rows.length,
  });
}
