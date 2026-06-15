import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const programacion_id = req.nextUrl.searchParams.get('programacion_id');
  if (!programacion_id) {
    return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });
  }

  try {
    // ── 1. Datos base por docente desde la vista ──────────────────────────────
    let filas: any[] = [];
    try {
      filas = await query(`
        SELECT
          v.programacion_id,
          v.docente_id,
          v.docente_nombre,
          v.horas_cursos,
          v.horas_requeridas,
          GREATEST(v.horas_requeridas - 1, 0) AS horas_requeridas_sin_asesoria,
          v.horas_disponibles,
          GREATEST(v.horas_requeridas - v.horas_disponibles, 0)::int AS horas_faltantes,
          v.max_bloque_continuo,
          v.dias_disponibles,
          v.max_bloque_curso,
          v.estado,
          v.mensaje,
          d.categoria,
          d.condicion,
          d.horas_max_semana
        FROM v_pre_validacion_csp v
        JOIN docentes d ON d.id = v.docente_id
        WHERE v.programacion_id = $1
        ORDER BY
          CASE v.estado
            WHEN 'horas_insuficientes' THEN 0
            WHEN 'sin_bloque_continuo' THEN 1
            WHEN 'pocos_dias' THEN 2
            ELSE 3
          END,
          v.horas_faltantes DESC,
          v.docente_nombre
      `, [programacion_id]);
    } catch {
      // Vista no existe aún — fallback usando la lógica del resolver
      const cursosAsignados = await query(`
        SELECT
          pc.docente_id,
          d.nombre || ' ' || d.apellidos AS docente_nombre,
          d.categoria, d.condicion, d.horas_max_semana,
          SUM(pc.horas_teoria + pc.horas_practica
              + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs,1),1)) AS horas_cursos,
          SUM(pc.horas_teoria + pc.horas_practica
              + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs,1),1)) AS horas_requeridas
        FROM programacion_cursos pc
        JOIN docentes d ON d.id = pc.docente_id
        JOIN cursos cu ON cu.id = pc.curso_id
        WHERE pc.programacion_id = $1 AND pc.docente_id IS NOT NULL
        GROUP BY pc.docente_id, d.nombre, d.apellidos, d.categoria, d.condicion, d.horas_max_semana
      `, [programacion_id]);

      for (const c of cursosAsignados) {
        const disp = await queryOne(`
          SELECT COUNT(*) AS total FROM disponibilidad_docente
          WHERE programacion_id = $1 AND docente_id = $2 AND disponible = true
        `, [programacion_id, c.docente_id]);
        const horas_disponibles = parseInt(disp?.total || '0');
        const horas_faltantes = Math.max(Number(c.horas_requeridas) - horas_disponibles, 0);
        filas.push({
          ...c,
          horas_disponibles,
          horas_faltantes,
          max_bloque_continuo: null,
          dias_disponibles: null,
          max_bloque_curso: null,
          estado: horas_faltantes > 0 ? 'horas_insuficientes' : 'ok',
          mensaje: horas_faltantes > 0 ? 'Ampliar disponibilidad docente' : null,
        });
      }
    }

    // ── 2. Detalle de cursos por docente ──────────────────────────────────────
    const cursosPorDocente = await query(`
      SELECT
        pc.docente_id,
        cu.codigo,
        cu.nombre AS curso_nombre,
        cu.ciclo_plan,
        pc.horas_teoria,
        pc.horas_practica,
        pc.horas_laboratorio,
        GREATEST(COALESCE(cu.cantidad_labs, 1), 1) AS cantidad_labs,
        (pc.horas_teoria + pc.horas_practica
         + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs,1),1)) AS total_horas,
        pc.horas_consejeria,
        g.numero_grupo
      FROM programacion_cursos pc
      JOIN cursos cu ON cu.id = pc.curso_id
      LEFT JOIN grupos g ON g.id = pc.grupo_id
      WHERE pc.programacion_id = $1 AND pc.docente_id IS NOT NULL
      ORDER BY cu.ciclo_plan, cu.codigo
    `, [programacion_id]);

    const cursosMap = new Map<string, any[]>();
    for (const c of cursosPorDocente) {
      const list = cursosMap.get(c.docente_id) || [];
      list.push(c);
      cursosMap.set(c.docente_id, list);
    }

    // ── 3. Días disponibles por docente ───────────────────────────────────────
    const diasPorDocente = await query(`
      SELECT docente_id,
             COUNT(DISTINCT dia) AS dias_marcados,
             COUNT(*) FILTER (WHERE prioridad = 1) AS slots_p1,
             COUNT(*) FILTER (WHERE prioridad = 2) AS slots_p2
      FROM disponibilidad_docente
      WHERE programacion_id = $1 AND disponible = true
      GROUP BY docente_id
    `, [programacion_id]);

    const diasMap = new Map<string, any>();
    for (const d of diasPorDocente) diasMap.set(d.docente_id, d);

    // ── 4. Ensamblar respuesta ────────────────────────────────────────────────
    const docentes = filas.map(f => {
      const dias = diasMap.get(f.docente_id) || {};
      return {
        docente_id:          f.docente_id,
        docente_nombre:      f.docente_nombre,
        categoria:           f.categoria,
        condicion:           f.condicion,
        horas_max_semana:    f.horas_max_semana,
        horas_cursos:        Number(f.horas_cursos),
        horas_requeridas:    Number(f.horas_requeridas_sin_asesoria ?? f.horas_requeridas),
        horas_disponibles:   Number(f.horas_disponibles),
        horas_faltantes:     Math.max(Number(f.horas_requeridas_sin_asesoria ?? f.horas_requeridas) - Number(f.horas_disponibles), 0),
        max_bloque_continuo: f.max_bloque_continuo != null ? Number(f.max_bloque_continuo) : null,
        dias_disponibles:    f.dias_disponibles != null ? Number(f.dias_disponibles) : Number(dias.dias_marcados ?? 0),
        dias_marcados:       Number(dias.dias_marcados ?? 0),
        slots_p1:            Number(dias.slots_p1 ?? 0),
        slots_p2:            Number(dias.slots_p2 ?? 0),
        max_bloque_curso:    f.max_bloque_curso != null ? Number(f.max_bloque_curso) : null,
        estado:              f.estado as string,
        mensaje:             f.mensaje as string | null,
        cursos:              cursosMap.get(f.docente_id) || [],
      };
    });

    const resumen = await queryOne(`
      SELECT
        COUNT(*)                                        AS total_docentes,
        COUNT(*) FILTER (WHERE estado = 'ok')           AS ok,
        COUNT(*) FILTER (WHERE estado <> 'ok')          AS alertas,
        SUM(GREATEST(horas_requeridas - horas_disponibles, 0))::int AS total_horas_faltantes
      FROM v_pre_validacion_csp
      WHERE programacion_id = $1
    `, [programacion_id]).catch(() => null);

    const resumenFallback = {
      total_docentes: docentes.length,
      ok: docentes.filter(d => d.estado === 'ok').length,
      alertas: docentes.filter(d => d.estado !== 'ok').length,
      total_horas_faltantes: docentes.reduce((s, d) => s + d.horas_faltantes, 0),
    };

    return NextResponse.json({
      data: {
        resumen: resumen ? {
          total_docentes: Number(resumen.total_docentes),
          ok: Number(resumen.ok),
          alertas: Number(resumen.alertas),
          total_horas_faltantes: Number(resumen.total_horas_faltantes ?? 0),
        } : resumenFallback,
        docentes,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
