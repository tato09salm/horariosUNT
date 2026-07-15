import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import {
  obtenerCargaProgramableDocente,
  auditarDisponibilidadDocente,
  validarConsistenciaFase1Fase2,
} from '@/lib/horarios-debug';
import { validarSolucionFinal, contarHorasAsignadasPorBloque } from '@/lib/horarios-resolver-v2';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const programacion_id = searchParams.get('programacion_id');

    if (!programacion_id) {
      return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });
    }

    const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [programacion_id]);
    if (!prog) {
      return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });
    }

    // ── 1. Resumen global ──
    let horas_carga_fase_1 = 0;
    let horas_disponibilidad_fase_2 = 0;
    let horas_asignadas = 0;
    let docentes_completos = 0;
    let docentes_incompletos = 0;

    const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

    // Get resolved assignments from config
    const configData = typeof prog.config === 'string' ? JSON.parse(prog.config) : (prog.config || {});
    const asignacionesExistentes: any[] = configData.asignaciones || [];

    const docentes = await query(`
      SELECT DISTINCT d.id, d.nombre, d.apellidos, d.categoria, d.condicion
      FROM docentes d
      WHERE EXISTS (SELECT 1 FROM programacion_cursos pc WHERE pc.docente_id = d.id AND pc.programacion_id = $1)
      ORDER BY d.apellidos, d.nombre
    `, [programacion_id]);

    const por_docente: any[] = [];
    let totalDiagnosticos: any[] = [];

    for (const d of docentes) {
      const carga = await obtenerCargaProgramableDocente(programacion_id, d.id);
      const auditoria = await auditarDisponibilidadDocente(programacion_id, d.id, slots);
      const consistencia = await validarConsistenciaFase1Fase2(programacion_id, d.id, slots, asignacionesExistentes);

      horas_carga_fase_1 += carga.total_horas_programables;
      horas_disponibilidad_fase_2 += auditoria.slots_disponibles;

      const asigDoc = asignacionesExistentes.filter((a: any) => a.docente_id === d.id);
      horas_asignadas += asigDoc.length;

      if (consistencia.horas_pendientes === 0) docentes_completos++;
      else docentes_incompletos++;

      // ── Diagnosticar bloques no asignados ──
      const bloquesDoc = await query(`
        SELECT pc.id as pc_id, pc.curso_id, pc.grupo_id, cu.codigo,
               pc.horas_teoria, pc.horas_practica, pc.horas_laboratorio,
               1 as cantidad_labs
        FROM programacion_cursos pc
        JOIN cursos cu ON cu.id = pc.curso_id
        WHERE pc.programacion_id = $1 AND pc.docente_id = $2
      `, [programacion_id, d.id]);

      const diagnosticos: any[] = [];
      for (const bc of bloquesDoc) {
        const tipos = [
          { tipo: 'teoria', horas: Number(bc.horas_teoria) || 0 },
          { tipo: 'practica', horas: Number(bc.horas_practica) || 0 },
        ];
        const hl = Number(bc.horas_laboratorio) || 0;
        const turnos = hl > 0 ? Math.max(1, Number(bc.cantidad_labs) || 1) : 0;
        for (let t = 1; t <= turnos; t++) {
          tipos.push({ tipo: 'laboratorio', horas: hl, lab_turno: t } as any);
        }

        for (const tp of tipos) {
          if (tp.horas <= 0) continue;
          const ck = `${bc.pc_id}|${d.id}|${bc.curso_id}|${bc.grupo_id || ''}|${tp.tipo}|${(tp as any).lab_turno || 0}`;
          const asignadas = contarHorasAsignadasPorBloque(asignacionesExistentes).get(ck) || 0;
          if (asignadas >= tp.horas) continue;
          diagnosticos.push({
            clave_bloque: ck,
            curso_codigo: bc.codigo,
            tipo_sesion: tp.tipo,
            lab_turno: (tp as any).lab_turno,
            duracion_requerida: tp.horas,
            duracion_asignada: asignadas,
            pendiente: tp.horas - asignadas,
            razon_principal: consistencia.clasificacion === 'ALGORITMO_NO_ENCONTRO_SOLUCION'
              ? 'ALGORITMO_NO_ENCONTRO_SOLUCION'
              : consistencia.clasificacion === 'DISPONIBILIDAD_INSUFICIENTE'
                ? 'DISPONIBILIDAD_INSUFICIENTE'
                : consistencia.clasificacion === 'DISPONIBILIDAD_MAL_IMPORTADA'
                  ? 'DISPONIBILIDAD_MAL_IMPORTADA'
                  : consistencia.clasificacion === 'BLOQUES_CONTIGUOS_INSUFICIENTES'
                    ? 'BLOQUES_CONTIGUOS_INSUFICIENTES'
                    : 'SIN_CAUSA_IDENTIFICADA',
          });
        }
      }

      totalDiagnosticos = [...totalDiagnosticos, ...diagnosticos];

      por_docente.push({
        docente_id: d.id,
        docente_nombre: `${d.nombre} ${d.apellidos}`,
        carga_total: carga.total_horas_programables,
        carga_asignada: asigDoc.length,
        carga_pendiente: consistencia.horas_pendientes,
        auditoria_disponibilidad: auditoria,
        consistencia,
        bloques_no_asignados: diagnosticos,
      });
    }

    return NextResponse.json({
      resumen: {
        horas_carga_fase_1,
        horas_disponibilidad_fase_2,
        horas_asignadas,
        horas_pendientes: horas_carga_fase_1 - horas_asignadas,
        docentes_completos,
        docentes_incompletos,
      },
      por_docente,
      config: {
        estado_resolucion: prog.estado_resolucion,
        fase: prog.fase,
        config_resolucion: configData.resolucion_v2 || null,
      },
      validacion: asignacionesExistentes.length > 0
        ? validarSolucionFinal(asignacionesExistentes, await query(`
            SELECT pc.*, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan
            FROM programacion_cursos pc
            JOIN cursos cu ON cu.id = pc.curso_id
            WHERE pc.programacion_id = $1
          `, [programacion_id]), slots)
        : null,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error desconocido' }, { status: 500 });
  }
}
