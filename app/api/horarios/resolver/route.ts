import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generarHorarioCSP, obtenerPreValidacionCSP } from '@/lib/horarios-csp';
import { ejecutarAlgoritmoGenetico } from '@/lib/horarios-ga';
import { registrarAuditoria } from '@/lib/auditoria';
import { query, queryOne } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id, dry_run } = await req.json();
    if (!programacion_id) return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });

    const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [programacion_id]);
    if (!prog || prog.fase !== 3) {
      return NextResponse.json({ error: 'La programación no está en Fase 3' }, { status: 400 });
    }

    // ── VALIDACIÓN PREVIA: disponibilidad mínima ─────────────────────────────
    const cursosAsignados = await query(`
      SELECT pc.docente_id, pc.horas_teoria, pc.horas_practica, pc.horas_laboratorio,
             pc.horas_consejeria,
             GREATEST(COALESCE(cu.cantidad_labs, 1), 1) AS cantidad_labs,
             d.nombre || ' ' || d.apellidos as docente_nombre
      FROM programacion_cursos pc
      JOIN cursos cu ON cu.id = pc.curso_id
      JOIN docentes d ON d.id = pc.docente_id
      WHERE pc.programacion_id = $1 AND pc.docente_id IS NOT NULL
    `, [programacion_id]);

    const horasPorDocente = new Map<string, { nombre: string; horas: number }>();
    for (const c of cursosAsignados) {
      const prev = horasPorDocente.get(c.docente_id) || { nombre: c.docente_nombre, horas: 0 };
      const horasLab = (c.horas_laboratorio || 0) * (c.cantidad_labs || 1);
      horasPorDocente.set(c.docente_id, {
        nombre: c.docente_nombre,
        horas: prev.horas + c.horas_teoria + c.horas_practica + horasLab + c.horas_consejeria,
      });
    }

    const docentesConDisp = await query(`
      SELECT DISTINCT docente_id FROM disponibilidad_docente
      WHERE programacion_id = $1 AND disponible = true
    `, [programacion_id]);
    for (const row of docentesConDisp) {
      if (!horasPorDocente.has(row.docente_id)) {
        const d = await queryOne(`SELECT nombre || ' ' || apellidos as nombre FROM docentes WHERE id = $1`, [row.docente_id]);
        horasPorDocente.set(row.docente_id, { nombre: d?.nombre || 'Docente', horas: 0 });
      }
    }

    const advertencias: string[] = [];
    for (const [docente_id, info] of horasPorDocente) {
      const horasRequeridas = info.horas + 1;
      const slotsDisponibles = await queryOne(`
        SELECT COUNT(*) as total FROM disponibilidad_docente
        WHERE programacion_id = $1 AND docente_id = $2 AND disponible = true
      `, [programacion_id, docente_id]);

      const totalSlots = parseInt(slotsDisponibles?.total || '0');
      if (totalSlots < horasRequeridas) {
        advertencias.push(
          `⚠️ Alerta: ${info.nombre} requiere ${horasRequeridas}h (${info.horas} cursos + 1 asesoría) pero solo tiene ${totalSlots}h disponibles. Faltan ${horasRequeridas - totalSlots}h.`
        );
      }
    }

    if (dry_run) {
      let preValidacion = null;
      try {
        preValidacion = await obtenerPreValidacionCSP(programacion_id);
      } catch {
        preValidacion = null;
      }
      return NextResponse.json({ success: true, advertencias, pre_validacion: preValidacion });
    }

    // ── FASE 1: MOTOR CSP ────────────────────────────────────────────────────
    const { asignaciones: asignacionesCSP, conflictos, stats } = await generarHorarioCSP(programacion_id);

    let asignacionesFinales = [...asignacionesCSP];
    let usóGA = false;

    // ── FASE 2: ALGORITMO GENÉTICO (si CSP dejó conflictos) ─────────────────
    if (conflictos.length > 0) {
      // Reconstruir bloques sin asignar desde los conflictos
      const cursosFaltantes = await query(`
        SELECT pc.*, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
               GREATEST(COALESCE(cu.cantidad_labs, 1), 1) AS cantidad_labs,
               g.numero_grupo, g.num_alumnos,
               CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
               CASE d.categoria 
                 WHEN 'principal' THEN 0 
                 WHEN 'asociado' THEN 1 
                 WHEN 'auxiliar' THEN 2 
                 WHEN 'jefe_practica' THEN 3 
                 ELSE 4
               END as categoria_orden,
               d.fecha_ingreso
        FROM programacion_cursos pc
        JOIN cursos cu ON cu.id = pc.curso_id
        LEFT JOIN grupos g ON g.id = pc.grupo_id
        LEFT JOIN docentes d ON d.id = pc.docente_id
        WHERE pc.programacion_id = $1
      `, [programacion_id]);

      // Detectar cuáles cursos aún tienen horas sin asignar
      const asignadasPorPC = new Map<string, number>();
      for (const a of asignacionesCSP) {
        asignadasPorPC.set(a.pc_id, (asignadasPorPC.get(a.pc_id) || 0) + 1);
      }

      const bloquesFaltantes: any[] = [];
      for (const c of cursosFaltantes) {
        const totalHoras =
          c.horas_teoria + c.horas_practica + (c.horas_laboratorio || 0) * (c.cantidad_labs || 1);
        const asignadas = asignadasPorPC.get(c.id) || 0;
        const faltan = totalHoras - asignadas;

        for (let i = 0; i < faltan; i++) {
          let tipo: 'teoria' | 'practica' | 'laboratorio' = 'laboratorio';
          if (i < c.horas_teoria) tipo = 'teoria';
          else if (i < c.horas_teoria + c.horas_practica) tipo = 'practica';
          bloquesFaltantes.push({
            pc_id: c.id,
            curso_id: c.curso_id,
            curso_codigo: c.codigo,
            curso_nombre: c.curso_nombre,
            grupo_id: c.grupo_id,
            numero_grupo: c.numero_grupo,
            docente_id: c.docente_id,
            tipo_sesion: tipo,
            num_alumnos: c.num_alumnos || 25,
            ciclo_plan: c.ciclo_plan,
            condicion_orden: c.condicion_orden,
            categoria_orden: c.categoria_orden,
            fecha_ingreso: c.fecha_ingreso,
            cantidad_labs: c.cantidad_labs || 1,
          });
        }
      }

      if (bloquesFaltantes.length > 0) {
        const asignacionesGA = await ejecutarAlgoritmoGenetico(
          bloquesFaltantes,
          programacion_id,
          asignacionesCSP
        );
        asignacionesFinales = [...asignacionesCSP, ...asignacionesGA];
        usóGA = asignacionesGA.length > 0;
      }
    }

    // ── GUARDAR RESULTADOS ────────────────────────────────────────────────────
    const prog2 = await queryOne(`SELECT config FROM programaciones WHERE id = $1`, [programacion_id]);
    const newConfig = { ...(prog2?.config || {}), asignaciones: asignacionesFinales };
    await queryOne(`UPDATE programaciones SET config = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newConfig), programacion_id]);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'GENERATE_SCHEDULE',
      tabla_afectada: 'programaciones',
      registro_id: programacion_id,
      descripcion: `Motor ejecutado. CSP: ${asignacionesCSP.length} bloques. GA fallback: ${usóGA ? 'sí' : 'no'}. Conflictos: ${conflictos.length}. Advertencias: ${advertencias.length}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        asignaciones: asignacionesFinales,
        conflictos,
        advertencias,
        csp_stats: stats,
        fuentes: {
          csp: asignacionesCSP.length,
          ga: usóGA ? asignacionesFinales.length - asignacionesCSP.length : 0,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
