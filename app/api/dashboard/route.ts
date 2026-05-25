import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  // Ciclo activo si no se especifica
  let ciclo: any = null;
  if (ciclo_id) {
    ciclo = await queryOne(`SELECT * FROM ciclos WHERE id = $1`, [ciclo_id]);
  } else {
    ciclo = await queryOne(`SELECT * FROM ciclos WHERE activo = true LIMIT 1`);
  }

  const cid = ciclo?.id;

  const gruposHasProgramacionId = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'grupos' AND column_name = 'programacion_id'
    ) as exists`
  );
  const gruposHasCicloId = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'grupos' AND column_name = 'ciclo_id'
    ) as exists`
  );

  const usaProgramacion = Boolean(gruposHasProgramacionId?.exists);
  const usaCiclo = Boolean(gruposHasCicloId?.exists);

  const [
    totalDocentes,
    totalCursos,
    totalAmbientes,
    totalAsignaciones,
    globalDoc,
    globalCur,
    globalAmb,
    horasPorCategoria,
    docentesPorCategoria,
    aulasPorTipo,
    ocupacionAmbientes,
    cargaDocentes,
    distribucionDias,
    ciclos,
    slots,
    totalGrupos,
    gruposConHorario,
    asignacionesPorSlot,
    asignacionesPorTipo,
    docentesSobrecarga,
    capacidadExcedida,
    conflictosPendientes,
  ] = await Promise.all([
    cid ? queryOne<{count:string}>(`SELECT COUNT(DISTINCT docente_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(
      usaProgramacion
        ? `SELECT COUNT(DISTINCT g.curso_id) as count FROM grupos g JOIN programaciones p ON p.id = g.programacion_id WHERE p.ciclo_id = $1`
        : `SELECT COUNT(DISTINCT g.curso_id) as count FROM grupos g WHERE g.ciclo_id = $1`,
      [cid]
    ) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(`SELECT COUNT(DISTINCT ambiente_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(`SELECT COUNT(*) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),

    queryOne<{count:string}>(`SELECT COUNT(*) as count FROM docentes WHERE activo = true`),
    queryOne<{count:string}>(`SELECT COUNT(*) as count FROM cursos WHERE activo = true`),
    queryOne<{count:string}>(`SELECT COUNT(*) as count FROM ambientes WHERE disponible = true`),

    // Horas asignadas por categoría de docente
    cid ? query(`
      SELECT d.categoria, d.condicion, COUNT(a.id) as horas
      FROM asignaciones a
      JOIN docentes d ON d.id = a.docente_id
      WHERE a.ciclo_id = $1 AND a.estado = 'activo'
      GROUP BY d.categoria, d.condicion
      ORDER BY d.categoria
    `, [cid]) : Promise.resolve([]),

    // Docentes por categoría y condición
    query(`
      SELECT d.categoria, d.condicion, COUNT(DISTINCT d.id) as docentes
      FROM docentes d
      WHERE d.activo = true
      GROUP BY d.categoria, d.condicion
      ORDER BY docentes DESC
    `),

    // Aulas por tipo
    query(`
      SELECT tipo, COUNT(DISTINCT id) as ambientes
      FROM ambientes
      WHERE disponible = true
      GROUP BY tipo
      ORDER BY ambientes DESC
    `),

    // Ocupación de ambientes (% de slots usados)
    cid ? query(`
      SELECT 
        amb.nombre, amb.tipo, amb.codigo,
        COUNT(a.id) as horas_usadas,
        (5 * 14) as total_slots,
        ROUND(COUNT(a.id) * 100.0 / (5 * 14), 1) as porcentaje
      FROM ambientes amb
      LEFT JOIN asignaciones a ON a.ambiente_id = amb.id AND a.ciclo_id = $1 AND a.estado = 'activo'
      WHERE amb.disponible = true
      GROUP BY amb.id, amb.nombre, amb.tipo, amb.codigo
      ORDER BY porcentaje DESC
      LIMIT 12
    `, [cid]) : Promise.resolve([]),

    // Carga horaria por docente
    cid ? query(`
      SELECT 
        d.nombre || ' ' || d.apellidos as nombre,
        d.categoria, d.condicion, d.horas_max_semana,
        COUNT(a.id) as horas_asignadas,
        ROUND(COUNT(a.id) * 100.0 / d.horas_max_semana, 1) as porcentaje_carga
      FROM docentes d
      LEFT JOIN asignaciones a ON a.docente_id = d.id AND a.ciclo_id = $1 AND a.estado = 'activo'
      WHERE d.activo = true
      GROUP BY d.id, d.nombre, d.apellidos, d.categoria, d.condicion, d.horas_max_semana
      ORDER BY porcentaje_carga DESC
    `, [cid]) : Promise.resolve([]),

    // Distribución por día
    cid ? query(`
      SELECT dia, COUNT(*) as cantidad
      FROM asignaciones
      WHERE ciclo_id = $1 AND estado = 'activo'
      GROUP BY dia
      ORDER BY CASE dia WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6 END
    `, [cid]) : Promise.resolve([]),

    query(`SELECT * FROM ciclos ORDER BY año DESC, semestre`),
    query(`SELECT * FROM slots_tiempo ORDER BY orden`),

    cid ? queryOne<{count:string}>(
      usaProgramacion
        ? `SELECT COUNT(*) as count FROM grupos g JOIN programaciones p ON p.id = g.programacion_id WHERE p.ciclo_id = $1`
        : `SELECT COUNT(*) as count FROM grupos WHERE ciclo_id = $1`,
      [cid]
    ) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(`SELECT COUNT(DISTINCT grupo_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),

    cid ? query(`
      SELECT st.id, st.hora_inicio, st.hora_fin, st.orden, COUNT(a.id) as cantidad
      FROM slots_tiempo st
      LEFT JOIN asignaciones a ON a.slot_id = st.id AND a.ciclo_id = $1 AND a.estado = 'activo'
      GROUP BY st.id, st.hora_inicio, st.hora_fin, st.orden
      ORDER BY st.orden
    `, [cid]) : Promise.resolve([]),

    cid ? query(`
      SELECT tipo, COUNT(*) as cantidad
      FROM asignaciones
      WHERE ciclo_id = $1 AND estado = 'activo'
      GROUP BY tipo
      ORDER BY tipo
    `, [cid]) : Promise.resolve([]),

    cid ? query(`
      SELECT 
        d.id, d.nombre || ' ' || d.apellidos as nombre,
        d.horas_max_semana, COUNT(a.id) as horas_asignadas,
        ROUND(COUNT(a.id) * 100.0 / d.horas_max_semana, 1) as porcentaje_carga
      FROM docentes d
      LEFT JOIN asignaciones a ON a.docente_id = d.id AND a.ciclo_id = $1 AND a.estado = 'activo'
      WHERE d.activo = true
      GROUP BY d.id, d.nombre, d.apellidos, d.horas_max_semana
      HAVING COUNT(a.id) > d.horas_max_semana
      ORDER BY porcentaje_carga DESC
      LIMIT 8
    `, [cid]) : Promise.resolve([]),

    cid ? query(`
      SELECT 
        a.id,
        amb.codigo as ambiente_codigo,
        amb.capacidad,
        g.num_alumnos,
        c.nombre as curso,
        g.numero_grupo
      FROM asignaciones a
      JOIN grupos g ON g.id = a.grupo_id
      JOIN cursos c ON c.id = g.curso_id
      JOIN ambientes amb ON amb.id = a.ambiente_id
      WHERE a.ciclo_id = $1 AND a.estado = 'activo' AND g.num_alumnos > amb.capacidad
      ORDER BY (g.num_alumnos - amb.capacidad) DESC
      LIMIT 10
    `, [cid]) : Promise.resolve([]),

    cid ? queryOne<{count:string}>(`
      SELECT COUNT(*) as count
      FROM conflictos_horario ch
      JOIN programaciones p ON p.id = ch.programacion_id
      WHERE p.ciclo_id = $1 AND ch.resuelto = false
    `, [cid]) : Promise.resolve({count:'0'}),
  ]);

  return NextResponse.json({
    ciclo,
    ciclos,
    slots,
    stats: {
      totalDocentes: parseInt(totalDocentes?.count || '0'),
      totalCursos: parseInt(totalCursos?.count || '0'),
      totalAmbientes: parseInt(totalAmbientes?.count || '0'),
      totalAsignaciones: parseInt((totalAsignaciones as any)?.count || '0'),    
      globalDocentes: parseInt((globalDoc as any)?.count || '0'),
      globalCursos: parseInt((globalCur as any)?.count || '0'),
      globalAmbientes: parseInt((globalAmb as any)?.count || '0'),
      totalGrupos: parseInt((totalGrupos as any)?.count || '0'),
      gruposConHorario: parseInt((gruposConHorario as any)?.count || '0'),
      gruposSinHorario: Math.max(0, parseInt((totalGrupos as any)?.count || '0') - parseInt((gruposConHorario as any)?.count || '0')),
    },
    horasPorCategoria,
    docentesPorCategoria,
    aulasPorTipo,
    ocupacionAmbientes,
    cargaDocentes,
    distribucionDias,
    asignacionesPorSlot,
    asignacionesPorTipo,
    docentesSobrecarga,
    capacidadExcedida,
    conflictosPendientes: parseInt((conflictosPendientes as any)?.count || '0'),
  });
}
