import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

type CountRow = { count: string };
type CicloRow = { id?: string | null };

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  // Ciclo activo si no se especifica
  let ciclo: CicloRow | null = null;
  if (ciclo_id) {
    ciclo = await queryOne(`SELECT * FROM ciclos WHERE id = $1`, [ciclo_id]);
  } else {
    ciclo = await queryOne(`SELECT * FROM ciclos WHERE activo = true LIMIT 1`);
  }

  const cid = ciclo?.id;

  try {
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
    ] = await Promise.all([
      cid ? queryOne<CountRow>(`SELECT COUNT(DISTINCT docente_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),
      cid ? queryOne<CountRow>(`SELECT COUNT(DISTINCT g.curso_id) as count FROM grupos g JOIN programaciones p ON p.id = g.programacion_id WHERE p.ciclo_id = $1`, [cid]) : Promise.resolve({count:'0'}),
      cid ? queryOne<CountRow>(`SELECT COUNT(DISTINCT ambiente_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),
      cid ? queryOne<CountRow>(`SELECT COUNT(*) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),

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
    ]);

    const totalAsignacionesCount = parseInt(totalAsignaciones?.count || '0');

    return NextResponse.json({
      ciclo,
      ciclos,
      slots,
      stats: {
        totalDocentes: parseInt(totalDocentes?.count || '0'),
        totalCursos: parseInt(totalCursos?.count || '0'),
        totalAmbientes: parseInt(totalAmbientes?.count || '0'),
        totalAsignaciones: totalAsignacionesCount,
        globalDocentes: parseInt(globalDoc?.count || '0'),
        globalCursos: parseInt(globalCur?.count || '0'),
        globalAmbientes: parseInt(globalAmb?.count || '0'),
      },
      horasPorCategoria,
      docentesPorCategoria,
      aulasPorTipo,
      ocupacionAmbientes,
      cargaDocentes,
      distribucionDias,
    });
  } catch (err: any) {
    console.error('Error in /api/dashboard:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
