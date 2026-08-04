import { query, queryOne } from '@/lib/db';

export async function getProgramacionCursosData(programacionId: string) {
  const prog = await queryOne(`SELECT id FROM programaciones WHERE id = $1`, [programacionId]);
  if (!prog) return null;

  const cursos = await query(`
    SELECT 
      pc.*,
      cu.codigo as curso_codigo, cu.nombre as curso_nombre, cu.creditos, cu.ciclo_plan,
      cu.horas_teoria as horas_teoria_catalogo, cu.horas_practica as horas_practica_catalogo,
      COALESCE(cu.horas_laboratorio, 0) as horas_laboratorio_catalogo,
      g.numero_grupo, g.max_alumnos, g.num_alumnos,
      d.nombre || ' ' || d.apellidos as docente_nombre, d.dni as docente_dni, d.usuario_id as docente_codigo,
      d.categoria as docente_categoria, d.condicion as docente_condicion,
      d.horas_max_semana as docente_horas_max
    FROM programacion_cursos pc
    JOIN cursos cu ON cu.id = pc.curso_id
    LEFT JOIN grupos g ON g.id = pc.grupo_id
    LEFT JOIN docentes d ON d.id = pc.docente_id
    WHERE pc.programacion_id = $1
    ORDER BY cu.ciclo_plan, cu.codigo
  `, [programacionId]);

  const cargaDocentes = await query(`
    SELECT 
      d.id, d.nombre || ' ' || d.apellidos as nombre, d.horas_max_semana,
      d.categoria, d.condicion, d.fecha_ingreso,
      CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
      CASE d.categoria
        WHEN 'principal' THEN 0
        WHEN 'asociado' THEN 1
        WHEN 'auxiliar' THEN 2
        WHEN 'jefe_practica' THEN 3
        ELSE 99
      END as categoria_orden,
      EXISTS(
        SELECT 1
        FROM disponibilidad_docente dd
        WHERE dd.programacion_id = $1 AND dd.docente_id = d.id
      ) as disponibilidad_registrada,
      COALESCE(SUM(
        pc.horas_teoria + pc.horas_practica + COALESCE(pc.horas_laboratorio, 0) + COALESCE(pc.horas_consejeria, 0)
      ), 0)::int as horas_asignadas
    FROM docentes d
    JOIN programacion_cursos pc ON pc.docente_id = d.id
    WHERE pc.programacion_id = $1
    GROUP BY d.id, d.nombre, d.apellidos, d.horas_max_semana, d.categoria, d.condicion, d.fecha_ingreso
    ORDER BY condicion_orden ASC, categoria_orden ASC, d.fecha_ingreso ASC NULLS LAST, d.apellidos ASC, d.nombre ASC
  `, [programacionId]);

  return { cursos, cargaDocentes };
}
