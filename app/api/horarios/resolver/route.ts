import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generarHorarioCSP, obtenerPreValidacionCSP } from '@/lib/horarios-csp';
import { registrarAuditoria } from '@/lib/auditoria';
import { query, queryOne } from '@/lib/db';
import { filtrarDisponibilidadPorCargaAdicional } from '@/lib/horarios';

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
    const cicloAcademicoId = prog.ciclo_academico_id;
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
      return NextResponse.json({ success: true, advertencias, pre_validacion: preValidacion });
    }

    // ── MOTOR ORQUESTADO: SCP → GA → GA+SÁBADO ──────────────────────────────
    const { asignaciones, conflictos, stats } = await generarHorarioCSP(programacion_id);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'GENERATE_SCHEDULE',
      tabla_afectada: 'programaciones',
      registro_id: programacion_id,
      descripcion: `Motor ejecutado. Fase: ${stats.fase_usada || 'CSP'}. Asignados: ${asignaciones.length}/${stats.total_bloques}. Conflictos: ${conflictos.length}. Advertencias: ${advertencias.length}`,
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
