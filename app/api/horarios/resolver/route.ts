import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generarHorarioCSP, obtenerPreValidacionCSP } from '@/lib/horarios-csp';
import { generarHorarioV2, validarSolucionFinal } from '@/lib/horarios-resolver-v2';
import { registrarAuditoria } from '@/lib/auditoria';
import { query, queryOne } from '@/lib/db';
import { filtrarDisponibilidadPorCargaAdicional } from '@/lib/horarios';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id, dry_run, algoritmo } = await req.json();
    if (!programacion_id) return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });

    const usarV2 = algoritmo === 'v2' || !algoritmo;

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
      const factorLab = (c.horas_laboratorio || 0) > 0 ? Math.max(1, Number(c.cantidad_labs) || 1) : 0;
      const horasLab = (c.horas_laboratorio || 0) * factorLab;
      horasPorDocente.set(c.docente_id, {
        nombre: c.docente_nombre,
        horas: prev.horas + (c.horas_teoria || 0) + (c.horas_practica || 0) + horasLab + (c.horas_consejeria || 0),
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
    const cicloAcademicoId = prog.ciclo_id;
    for (const [docente_id, info] of horasPorDocente) {
      const horasRequeridas = info.horas;
      const rawSlots = await query(`
        SELECT * FROM disponibilidad_docente
        WHERE programacion_id = $1 AND docente_id = $2 AND disponible = true
      `, [programacion_id, docente_id]);

      const filteredSlots = await filtrarDisponibilidadPorCargaAdicional(rawSlots, cicloAcademicoId);
      const totalSlots = filteredSlots.length;
      if (totalSlots < horasRequeridas) {
        advertencias.push(
          `⚠️ Alerta: ${info.nombre} requiere ${horasRequeridas}h (${info.horas} cursos) pero solo tiene ${totalSlots}h disponibles. Faltan ${horasRequeridas - totalSlots}h.`
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
      return NextResponse.json({ success: true, advertencias, pre_validacion: preValidacion, algoritmo: usarV2 ? 'v2' : 'v1' });
    }

    if (usarV2) {
      // ── V2: Docente-priority CSP + GA híbrido ────────────────────────────────
      const cursos = await query(`
        SELECT pc.*, g.num_alumnos, g.numero_grupo, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
               COALESCE(cu.bloque_indivisible, true) as bloque_indivisible,
               COALESCE(cu.cantidad_labs, 1) as cantidad_labs,
               COALESCE(cu.horas_laboratorio, cu.horas_practica, 0) as horas_laboratorio_catalogo,
               d.condicion, d.categoria, d.fecha_ingreso, d.nombre as docente_n, d.apellidos as docente_a,
               CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
               CASE d.categoria 
                 WHEN 'principal' THEN 0 
                 WHEN 'asociado' THEN 1 
                 WHEN 'auxiliar' THEN 2 
                 WHEN 'jefe_practica' THEN 3 
                 ELSE 4
               END as categoria_orden
         FROM programacion_cursos pc
         LEFT JOIN grupos g ON g.id = pc.grupo_id
         JOIN cursos cu ON cu.id = pc.curso_id
         LEFT JOIN docentes d ON d.id = pc.docente_id
         WHERE pc.programacion_id = $1
         ORDER BY cu.codigo, g.numero_grupo, g.tipo_actividad
      `, [programacion_id]);

      const rawDisponibilidad = await query(`
        SELECT * FROM disponibilidad_docente 
        WHERE programacion_id = $1 AND disponible = true AND prioridad IN (1, 2)
        ORDER BY docente_id, dia, slot_id
      `, [programacion_id]);
      const disponibilidad = await filtrarDisponibilidadPorCargaAdicional(rawDisponibilidad, cicloAcademicoId);

      const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true ORDER BY codigo`);
      const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

      const docentesProg = await query(`
        SELECT DISTINCT d.id, d.nombre, d.apellidos, d.categoria, d.fecha_ingreso, d.condicion,
               CASE d.condicion WHEN 'nombrado' THEN 0 ELSE 1 END as condicion_orden,
               CASE d.categoria 
                 WHEN 'principal' THEN 0 
                 WHEN 'asociado' THEN 1 
                 WHEN 'auxiliar' THEN 2 
                 WHEN 'jefe_practica' THEN 3 
                 ELSE 4
               END as categoria_orden
        FROM docentes d
        WHERE d.activo = true
          AND (EXISTS (SELECT 1 FROM programacion_cursos pc WHERE pc.docente_id = d.id AND pc.programacion_id = $1)
            OR EXISTS (SELECT 1 FROM disponibilidad_docente dd WHERE dd.docente_id = d.id AND dd.programacion_id = $1))
      `, [programacion_id]);

      let restrictedIds: string[] | null = null;
      if (prog.config) {
        try {
          const parsedConfig = typeof prog.config === 'string' ? JSON.parse(prog.config) : prog.config;
          if (parsedConfig?.horarios_restringidos) {
            const hr = parsedConfig.horarios_restringidos;
            restrictedIds = Array.isArray(hr) ? hr : (hr && typeof hr === 'object' ? Object.keys(hr) : null);
          }
        } catch { /* ignore */ }
      }
      if (restrictedIds === null) {
        const foodSlot = (slots as Array<{ id: string; hora_inicio: string }>).find(s => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
        restrictedIds = foodSlot ? [foodSlot.id] : [];
      }

      const v2Result = await generarHorarioV2(
        programacion_id, cursos, disponibilidad, ambientes, slots, docentesProg,
        { restrictedIds: restrictedIds || [] }
      );

      // ── Validación post-hoc ──────────────────────────────────────────────
      const validacion = validarSolucionFinal(
        v2Result.asignaciones,
        cursos,
        slots
      );

      // ── Determinar estado: errores estructurales → INVALIDA, solo faltantes → PARCIAL ──
      const configBase = typeof prog.config === 'string' ? JSON.parse(prog.config) : (prog.config || {});
      const pctCompleto = v2Result.stats.pct_completado;

      const erroresEstructurales = validacion.errores_estructurados.filter(e =>
        (e as any).codigo === 'BLOQUE_DUPLICADO' ||
        (e as any).codigo === 'HORAS_EXCEDIDAS' ||
        (e as any).codigo === 'LABORATORIO_DIVIDIDO' ||
        (e as any).codigo === 'CONFLICTO_DOCENTE' ||
        (e as any).codigo === 'CONFLICTO_GRUPO' ||
        (e as any).codigo === 'CONFLICTO_AMBIENTE' ||
        (e as any).codigo === 'CLAVE_BLOQUE_AUSENTE'
      );
      const soloFaltantes = !validacion.valida && erroresEstructurales.length === 0;

      let estadoResolucion: string;
      if (erroresEstructurales.length > 0) {
        estadoResolucion = 'INVALIDA';
      } else if (pctCompleto >= 100) {
        estadoResolucion = 'COMPLETA';
      } else {
        estadoResolucion = 'PARCIAL';
      }

      const configV2 = {
        ...configBase,
        asignaciones: v2Result.asignaciones,
        resolucion_v2: {
          stats: v2Result.stats,
          por_docente: v2Result.por_docente,
          log: v2Result.log,
          puntaje_global: v2Result.stats.puntaje_global || null,
          iteraciones_detalle: v2Result.stats.iteraciones_detalle || null,
          mejoras: v2Result.mejoras || [],
          razones_mixtos: v2Result.razones_mixtos || [],
          ejecutado_en: new Date().toISOString(),
          algoritmo: 'v2',
          validacion,
          estado_resolucion: estadoResolucion,
        },
      };

      if (estadoResolucion !== 'INVALIDA') {
        await queryOne(
          `UPDATE programaciones SET config = $1, estado_resolucion = $2, updated_at = NOW() WHERE id = $3`,
          [JSON.stringify(configV2), estadoResolucion, programacion_id]
        );
      }

      await query(`DELETE FROM conflictos_horario WHERE programacion_id = $1`, [programacion_id]);
      for (const c of v2Result.conflictosDetalle || []) {
        await query(
          `INSERT INTO conflictos_horario (programacion_id, tipo, severidad, descripcion, datos, sugerencia)
           VALUES ($1, 'UNASSIGNED', 'error', $2, $3::jsonb, $4)`,
          [programacion_id, c.descripcion, JSON.stringify(c.datos), c.sugerencia]
        );
      }

      await registrarAuditoria({
        usuario_id: session.id,
        usuario_nombre: `${session.nombre} ${session.apellidos}`,
        accion: 'GENERATE_SCHEDULE',
        tabla_afectada: 'programaciones',
        registro_id: programacion_id,
        descripcion: `V2 ejecutado (${estadoResolucion}). Asignados: ${v2Result.stats.asignadas}/${v2Result.stats.total_horas} (${v2Result.stats.pct_completado}%). Fase: ${v2Result.stats.phase}. Mixtos: ${v2Result.stats.bloques_mixtos}. Tiempo: ${v2Result.stats.tiempo_ms}ms`,
      });

      const p1Count = v2Result.asignaciones.filter((a: Record<string, unknown>) => a.prioridad_usada === 1).length;
      const p2Count = v2Result.asignaciones.filter((a: Record<string, unknown>) => a.prioridad_usada === 2).length;

      const porDocenteResumen = v2Result.por_docente.map(d => ({
        nombre: d.nombre,
        condicion: d.condicion,
        categoria: d.categoria,
        completado: `${d.asignadas}/${d.total_horas} (${d.pct_completado}%)`,
        bloques_mixtos: d.bloques_mixtos,
      }));

      const cspStatsV2 = {
        total_bloques: v2Result.stats.total_horas,
        asignados: v2Result.stats.asignadas,
        conflictos: v2Result.conflictos.length,
        prioridad_alta: p1Count,
        prioridad_baja: p2Count,
        bloques_continuos: v2Result.asignaciones.filter((a: Record<string, unknown>) => a.bloque_continuo_id).length > 0
          ? new Set(v2Result.asignaciones.map((a: Record<string, unknown>) => a.bloque_continuo_id).filter(Boolean)).size
          : 0,
        lab_coexistencias: 0,
        franjas_labs_paralelos: 0,
        por_docente: v2Result.por_docente.map(d => ({
          docente_id: d.docente_id,
          docente_nombre: d.nombre,
          categoria: d.categoria,
          total: d.total_horas,
          en_preferida: v2Result.asignaciones.filter((a: Record<string, unknown>) => a.docente_id === d.docente_id && a.prioridad_usada === 1).length,
          en_aceptable: v2Result.asignaciones.filter((a: Record<string, unknown>) => a.docente_id === d.docente_id && a.prioridad_usada === 2).length,
          pct_preferida: d.total_horas > 0 ? Math.round(v2Result.asignaciones.filter((a: Record<string, unknown>) => a.docente_id === d.docente_id && a.prioridad_usada === 1).length / d.total_horas * 100) : 0,
        })),
        log: v2Result.log,
        fase_usada: v2Result.stats.phase === 'COMPLETA' ? 'SCP' : 'GA_SABADO',
      };

      // ── Build response ───────────────────────────────────────────────────
      const responsePayload = {
        success: estadoResolucion !== 'INVALIDA',
        data: {
          asignaciones: v2Result.asignaciones,
          conflictos: v2Result.conflictos,
          advertencias,
          csp_stats: cspStatsV2,
          stats_v2: v2Result.stats,
          por_docente: v2Result.por_docente,
          log: v2Result.log,
          fuentes: {
            v2: v2Result.asignaciones.length,
          },
          puntaje_global: v2Result.stats.puntaje_global || null,
          iteraciones_detalle: v2Result.stats.iteraciones_detalle || null,
          mejoras: v2Result.mejoras || [],
          razones_mixtos: v2Result.razones_mixtos || [],
          validacion: {
            valida: validacion.valida,
            errores: validacion.errores,
            advertencias_validacion: validacion.advertencias,
            resumen: validacion.resumen,
          },
          estado_resolucion: estadoResolucion,
        },
        resumen: {
          completado: `${v2Result.stats.asignadas}/${v2Result.stats.total_horas} horas (${v2Result.stats.pct_completado}%)`,
          fase: v2Result.stats.phase,
          docentes: porDocenteResumen,
          pendientes: v2Result.stats.pendientes,
          bloques_mixtos_usados: v2Result.stats.bloques_mixtos,
          tiempo_ms: v2Result.stats.tiempo_ms,
          estado_resolucion: estadoResolucion,
        },
      };

      if (estadoResolucion === 'INVALIDA') {
        return NextResponse.json({
          success: false,
          error: 'La solución generada es inválida',
          estado_resolucion: 'INVALIDA',
          validacion,
          bloques_problematicos: validacion.errores_estructurados.slice(0, 50),
          stats: v2Result.stats,
          debug: process.env.NODE_ENV === 'development' ? v2Result.asignaciones : undefined,
        }, { status: 422 });
      }
      return NextResponse.json(responsePayload);
    } else {
      // ── V1: Original CSP (SCP → GA → GA+Sábado) ──────────────────────────
      const { asignaciones, conflictos, stats } = await generarHorarioCSP(programacion_id);

      await registrarAuditoria({
        usuario_id: session.id,
        usuario_nombre: `${session.nombre} ${session.apellidos}`,
        accion: 'GENERATE_SCHEDULE',
        tabla_afectada: 'programaciones',
        registro_id: programacion_id,
        descripcion: `V1 ejecutado. Fase: ${stats.fase_usada || 'CSP'}. Asignados: ${asignaciones.length}/${stats.total_bloques}. Conflictos: ${conflictos.length}. Advertencias: ${advertencias.length}`,
      });

      return NextResponse.json({
        success: true,
        data: {
          asignaciones,
          conflictos,
          advertencias,
          csp_stats: stats,
          fuentes: {
            csp: stats.fase_usada === 'SCP' ? asignaciones.length : stats.asignados,
            ga: stats.fase_usada === 'GA' ? asignaciones.length : 0,
            ga_sabado: stats.fase_usada === 'GA_SABADO' ? asignaciones.length : 0,
          },
        },
      });
    }
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
