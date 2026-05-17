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

  const rows = asignaciones.map((a: any) => ({
    dia: a.dia,
    slot_inicio: a.slot_id,
    curso_codigo: a.curso_codigo,
    curso_nombre: a.curso_nombre,
    grupo: `G${a.numero_grupo}`,
    tipo: a.tipo,
    docente: a.docente_id ? (docenteMap.get(a.docente_id) || a.docente_nombre || '') : 'Sin asignar',
    aula: a.ambiente_codigo,
    aula_nombre: a.ambiente_nombre,
    fuente: a.fuente || 'CSP',
  }));

  if (formato === 'csv') {
    const encabezado = 'Día,Curso,Nombre Curso,Grupo,Tipo,Docente,Aula\n';
    const csvContent = rows.map((r: any) =>
      `${r.dia},${r.curso_codigo},"${r.curso_nombre}",${r.grupo},${r.tipo},"${r.docente}",${r.aula}`
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
