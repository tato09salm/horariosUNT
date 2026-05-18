import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const programacionId = id;

    // 1. Información de la programación
    const prog = await queryOne(`
      SELECT p.*, c.nombre as ciclo_nombre, c.año, c.semestre
      FROM programaciones p 
      JOIN ciclos c ON c.id = p.ciclo_id
      WHERE p.id = $1
    `, [programacionId]);

    if (!prog) {
      return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });
    }

    // 2. Cargar asignaciones crudas (borrador en config, o activas en tabla real)
    let rawAsignaciones = prog.config?.asignaciones || [];
    if (rawAsignaciones.length === 0) {
      rawAsignaciones = await query(`
        SELECT a.id, a.dia, a.slot_id, a.grupo_id, a.docente_id, a.ambiente_id, a.tipo
        FROM asignaciones a
        WHERE a.ciclo_id = $1 AND a.estado = 'activo'
      `, [prog.ciclo_id]);
    }

    // 3. Cargar catálogos en memoria para enriquecimiento ultra rápido
    const cursos = await query(`
      SELECT id, codigo, nombre, ciclo_plan FROM cursos
    `);
    const cursosMap = new Map(cursos.map((c: any) => [c.id, c]));

    const grupos = await query(`
      SELECT id, numero_grupo, curso_id FROM grupos
    `);
    const gruposMap = new Map(grupos.map((g: any) => [g.id, g]));

    const docentes = await query(`
      SELECT id, nombre, apellidos, categoria, condicion, horas_max_semana FROM docentes WHERE activo = true
    `);
    const docentesMap = new Map(docentes.map((d: any) => [d.id, d]));

    const ambientes = await query(`
      SELECT id, codigo, nombre, tipo, capacidad FROM ambientes
    `);
    const ambientesMap = new Map(ambientes.map((a: any) => [a.id, a]));

    const slots = await query(`
      SELECT id, hora_inicio, hora_fin, nombre FROM slots_tiempo
    `);
    const slotsMap = new Map(slots.map((s: any) => [s.id, s]));

    // 4. Enriquecer asignaciones
    const asignacionesEnriquecidas = rawAsignaciones.map((a: any) => {
      const slot = slotsMap.get(a.slot_id);
      const grupo = gruposMap.get(a.grupo_id);
      const curso = grupo ? cursosMap.get(grupo.curso_id) : (a.curso_id ? cursosMap.get(a.curso_id) : null);
      const docente = docentesMap.get(a.docente_id);
      const ambiente = ambientesMap.get(a.ambiente_id);

      return {
        id: a.id,
        dia: a.dia,
        hora_inicio: slot?.hora_inicio || '',
        hora_fin: slot?.hora_fin || '',
        tipo_sesion: a.tipo_sesion || a.tipo || 'teoria',
        curso_codigo: curso?.codigo || a.curso_codigo || '',
        curso_nombre: curso?.nombre || a.curso_nombre || '',
        ciclo: Number(curso?.ciclo_plan || a.ciclo || 0),
        grupo: grupo ? `G${grupo.numero_grupo}` : (a.grupo || ''),
        aula: ambiente?.codigo || a.ambiente_codigo || '',
        aula_id: ambiente?.id || a.ambiente_id || null,
        aula_tipo: ambiente?.tipo || '',
        docente_id: docente?.id || a.docente_id || null,
        docente_nombre: docente ? `${docente.nombre} ${docente.apellidos}` : (a.docente_nombre || a.docente || ''),
        docente_categoria: docente?.categoria || '',
        docente_condicion: docente?.condicion || ''
      };
    });

    // 5. Filtrar docentes activos
    const docenteIdsActivos = new Set(asignacionesEnriquecidas.map((a: any) => a.docente_id).filter(Boolean));
    const docentesActivos = docentes
      .filter((d: any) => docenteIdsActivos.has(d.id))
      .map((d: any) => ({
        id: d.id,
        nombre: `${d.nombre} ${d.apellidos}`,
        categoria: d.categoria,
        tipo_contrato: d.condicion,
        horas_max_semana: d.horas_max_semana
      }));

    // 6. Filtrar ambientes/aulas usadas
    const aulaIdsActivas = new Set(asignacionesEnriquecidas.map((a: any) => a.aula_id).filter(Boolean));
    const aulasUsadas = ambientes
      .filter((a: any) => aulaIdsActivas.has(a.id))
      .map((a: any) => ({
        id: a.id,
        codigo: a.codigo,
        nombre: a.nombre,
        tipo: a.tipo,
        capacidad: a.capacidad
      }));

    // 7. Ciclos con asignaciones
    const ciclosActivos = (Array.from(new Set(asignacionesEnriquecidas.map((a: any) => a.ciclo))) as any[])
      .map((c: any) => Number(c))
      .filter((c: number) => !isNaN(c) && c >= 1 && c <= 10)
      .sort((a: number, b: number) => a - b);

    // 8. Métricas del CSP
    const statsCSP = prog.config?.csp_stats || {
      asignados: asignacionesEnriquecidas.length,
      total: asignacionesEnriquecidas.length,
      p1: docentesActivos.filter((d: any) => d.categoria === 'principal' || d.categoria === 'asociado').length,
      p2: docentesActivos.filter((d: any) => d.categoria === 'auxiliar' || d.categoria === 'jefe_practica').length,
      bloques_continuos: 0,
      labs_paralelos: 0,
      conflictos_resueltos: 0
    };

    return NextResponse.json({
      programacion: {
        id: prog.id,
        codigo: prog.nombre || prog.codigo,
        periodo: prog.ciclo_nombre,
        estado: prog.estado
      },
      asignaciones: asignacionesEnriquecidas,
      docentes: docentesActivos,
      aulas: aulasUsadas,
      ciclos: ciclosActivos,
      metricas: statsCSP
    });

  } catch (error: any) {
    console.error('Error al exportar horario para Excel:', error);
    return NextResponse.json(
      { error: 'Error al obtener datos para la exportación' },
      { status: 500 }
    );
  }
}
