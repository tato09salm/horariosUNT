import { query, queryOne } from './db';
import { resolverScp } from './scp-model';
import { ejecutarAlgoritmoGenetico } from './horarios-ga';
import { DIAS_SEMANA } from './horario-utils';
import { filtrarDisponibilidadPorCargaAdicional } from './horarios';

export interface CspStats {
  total_bloques: number;
  asignados: number;
  conflictos: number;
  prioridad_alta: number;
  prioridad_baja: number;
  bloques_continuos: number;
  lab_coexistencias?: number;
  franjas_labs_paralelos?: number;
  por_docente: Array<{
    docente_id: string;
    docente_nombre: string;
    categoria: string;
    total: number;
    en_preferida: number;
    en_aceptable: number;
    pct_preferida: number;
  }>;
  log: string[];
  fase_usada?: 'SCP' | 'GA' | 'GA_SABADO';
}

export async function generarHorarioCSP(programacion_id: string): Promise<{
  asignaciones: any[];
  conflictos: string[];
  stats: CspStats;
}> {
  const inicio = Date.now();
  const debugLog: string[] = [];

  const progRow = await queryOne(`SELECT config, ciclo_academico_id FROM programaciones WHERE id = $1`, [programacion_id]);
  if (!progRow) {
    throw new Error('No se encontró la programación');
  }

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

  const disponibilidad = await filtrarDisponibilidadPorCargaAdicional(rawDisponibilidad, progRow.ciclo_academico_id);

  let dispAmbiente: { ambiente_id: string; slot_id: string; dia: string; estado: string }[] = [];
  try {
    dispAmbiente = await query(`SELECT ambiente_id, slot_id, dia, estado FROM disponibilidad_ambiente`);
  } catch { dispAmbiente = []; }

  const docentesProg = await query(`
    SELECT DISTINCT d.id, d.nombre, d.apellidos, d.categoria, d.fecha_ingreso,
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

  const ambientes = await query(`SELECT * FROM ambientes WHERE disponible = true ORDER BY codigo`);
  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

  // Load restrictedIds
  let restrictedIds: string[] | null = null;
  if (progRow && progRow.config) {
    try {
      const parsedConfig = typeof progRow.config === 'string' ? JSON.parse(progRow.config) : progRow.config;
      if (parsedConfig && parsedConfig.horarios_restringidos) {
        const hr = parsedConfig.horarios_restringidos;
        if (Array.isArray(hr)) restrictedIds = hr;
        else if (hr && typeof hr === 'object') restrictedIds = Object.keys(hr);
      }
    } catch { /* ignore */ }
  }


  if (restrictedIds === null) {
    const config = await queryOne(`SELECT valor FROM configuracion WHERE clave = 'HORARIOS_RESTRINGIDOS'`);
    if (config) {
      try {
        const parsed = JSON.parse(config.valor);
        restrictedIds = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? Object.keys(parsed) : null);
      } catch { /* ignore */ }
    }
  }

  if (restrictedIds === null) {
    const foodSlot = slots.find((s: any) => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
    restrictedIds = foodSlot ? [foodSlot.id] : [];
  }

  // Build docStats
  const docStatsInit = new Map<string, { nombre: string; categoria: string; total: number; alta: number; baja: number }>();
  for (const doc of docentesProg) {
    docStatsInit.set(doc.id, {
      nombre: `${doc.apellidos}, ${doc.nombre}`,
      categoria: doc.categoria,
      total: 0,
      alta: 0,
      baja: 0,
    });
  }

  // ── FASE 1: SCP ────────────────────────────────────────────────────────────────
  debugLog.push(`[CSP] Fase 1 — SCP (${cursos.length} cursos)`);
  const scpResult = await resolverScp(programacion_id, cursos, disponibilidad, ambientes, slots, docentesProg, { restrictedIds });
  debugLog.push(...scpResult.log);

  const totalBloques = scpResult.stats.total;
  let asignaciones = [...scpResult.asignaciones];
  let conflictos = [...scpResult.conflictos];
  let conflictosDetalle = [...scpResult.conflictosDetalle];

  let faseUsada: 'SCP' | 'GA' | 'GA_SABADO' = 'SCP';

  // ── FASE 2: GA (fallback si SCP dejó conflictos) ───────────────────────────────
  if (conflictos.length > 0) {
    debugLog.push(`[CSP] Fase 2 — GA fallback (${conflictos.length} conflictos)`);
    faseUsada = 'GA';

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

    const asignadasPorPC = new Map<string, number>();
    for (const a of asignaciones) {
      asignadasPorPC.set(a.pc_id || a.id, (asignadasPorPC.get(a.pc_id || a.id) || 0) + 1);
    }

    const bloquesFaltantes: any[] = [];
    for (const c of cursosFaltantes) {
      const totalHoras = c.horas_teoria + c.horas_practica + (c.horas_laboratorio || 0) * (c.cantidad_labs || 1);
      const asignadas = asignadasPorPC.get(c.id) || 0;
      const faltan = totalHoras - asignadas;
      for (let i = 0; i < faltan; i++) {
        let tipo: 'teoria' | 'practica' | 'laboratorio' = 'laboratorio';
        if (i < c.horas_teoria) tipo = 'teoria';
        else if (i < c.horas_teoria + c.horas_practica) tipo = 'practica';
        bloquesFaltantes.push({
          pc_id: c.id, curso_id: c.curso_id, curso_codigo: c.codigo, curso_nombre: c.curso_nombre,
          grupo_id: c.grupo_id, numero_grupo: c.numero_grupo, docente_id: c.docente_id,
          tipo_sesion: tipo, num_alumnos: c.num_alumnos || 25, ciclo_plan: c.ciclo_plan,
          condicion_orden: c.condicion_orden, categoria_orden: c.categoria_orden,
          fecha_ingreso: c.fecha_ingreso, cantidad_labs: c.cantidad_labs || 1,
        });
      }
    }

    if (bloquesFaltantes.length > 0) {
      const gaResult = await ejecutarAlgoritmoGenetico(bloquesFaltantes, programacion_id, asignaciones);
      debugLog.push(...gaResult.log);

      if (gaResult.asignaciones.length > 0) {
        asignaciones = [...asignaciones, ...gaResult.asignaciones];
        // Re-check for conflicts
        conflictos = gaResult.conflictos.length > 0 ? gaResult.conflictos : [];
      }

      // ── FASE 3: GA + SÁBADO (emergencia) ─────────────────────────────────────
      if (conflictos.length > 0) {
        debugLog.push(`[CSP] Fase 3 — GA + Sábado emergencia (${conflictos.length} conflictos restantes)`);
        faseUsada = 'GA_SABADO';

        // Recompute remaining blocks after GA
        const asignadasTrasGA = new Map<string, number>();
        for (const a of asignaciones) {
          asignadasTrasGA.set(a.pc_id || a.id, (asignadasTrasGA.get(a.pc_id || a.id) || 0) + 1);
        }
        const bloquesAunFaltantes: any[] = [];
        for (const c of cursosFaltantes) {
          const totalHoras = c.horas_teoria + c.horas_practica + (c.horas_laboratorio || 0) * (c.cantidad_labs || 1);
          const asignadas = asignadasTrasGA.get(c.id) || 0;
          const faltan = totalHoras - asignadas;
          for (let i = 0; i < faltan; i++) {
            let tipo: 'teoria' | 'practica' | 'laboratorio' = 'laboratorio';
            if (i < c.horas_teoria) tipo = 'teoria';
            else if (i < c.horas_teoria + c.horas_practica) tipo = 'practica';
            bloquesAunFaltantes.push({
              pc_id: c.id, curso_id: c.curso_id, curso_codigo: c.codigo, curso_nombre: c.curso_nombre,
              grupo_id: c.grupo_id, numero_grupo: c.numero_grupo, docente_id: c.docente_id,
              tipo_sesion: tipo, num_alumnos: c.num_alumnos || 25, ciclo_plan: c.ciclo_plan,
              condicion_orden: c.condicion_orden, categoria_orden: c.categoria_orden,
              fecha_ingreso: c.fecha_ingreso, cantidad_labs: c.cantidad_labs || 1,
            });
          }
        }

        if (bloquesAunFaltantes.length > 0) {
          const gaSabadoResult = await ejecutarAlgoritmoGenetico(bloquesAunFaltantes, programacion_id, asignaciones, true);
          debugLog.push(...gaSabadoResult.log);
          if (gaSabadoResult.asignaciones.length > 0) {
            asignaciones = [...asignaciones, ...gaSabadoResult.asignaciones];
            conflictos = gaSabadoResult.conflictos.length > 0 ? gaSabadoResult.conflictos : [];
          }
        }
      }
    }
  }

  // Rebuild conflictosDetalle from remaining conflicts if needed
  if (conflictos.length > 0) {
    for (const c of conflictos) {
      conflictosDetalle.push({ descripcion: c, datos: {}, sugerencia: 'Revisar disponibilidad docente o habilitar sábados' });
    }
  }

  // ── Build stats ──
  const porDocente: CspStats['por_docente'] = [];
  for (const [id, ds] of docStatsInit) {
    porDocente.push({
      docente_id: id,
      docente_nombre: ds.nombre,
      categoria: ds.categoria,
      total: ds.total || 0,
      en_preferida: ds.alta || 0,
      en_aceptable: ds.baja || 0,
      pct_preferida: (ds.total || 0) > 0 ? Math.round(((ds.alta || 0) / ds.total) * 100) : 0,
    });
  }

  const ocCount = asignaciones.filter(a => a.tipo === 'laboratorio').length;
  const distrib = { teoria: 0, practica: 0, laboratorio: 0, grupo_estudiante: 0 };
  for (const a of asignaciones) {
    if (a.tipo in distrib) (distrib as any)[a.tipo]++;
  }

  debugLog.push(`[CSP] Fase usada: ${faseUsada} | Asignados: ${asignaciones.length}/${totalBloques} | Tiempo: ${Date.now() - inicio}ms`);
  debugLog.push(`[CSP:DISTRIBUCIÓN] Teoría: ${distrib.teoria} | Práctica: ${distrib.practica} | Lab: ${distrib.laboratorio}`);
  if (distrib.teoria === 0) debugLog.push('[CSP:ALERTA] No se asignó NINGUNA sesión de teoría');
  if (distrib.practica === 0) debugLog.push('[CSP:ALERTA] No se asignó NINGUNA sesión de práctica');

  // Save to DB
  const prog = await queryOne(`SELECT config FROM programaciones WHERE id = $1`, [programacion_id]);
  const stats: CspStats = {
    total_bloques: totalBloques,
    asignados: asignaciones.length,
    conflictos: conflictos.length,
    prioridad_alta: scpResult.stats.prioridad_alta,
    prioridad_baja: scpResult.stats.prioridad_baja,
    bloques_continuos: scpResult.stats.bloques_continuos,
    lab_coexistencias: ocCount,
    franjas_labs_paralelos: ocCount,
    por_docente: porDocente,
    log: debugLog,
    fase_usada: faseUsada,
  };
  const newConfig = { ...(prog?.config || {}), asignaciones, csp_stats: stats };
  await queryOne(`UPDATE programaciones SET config = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newConfig), programacion_id]);

  await query(`DELETE FROM conflictos_horario WHERE programacion_id = $1`, [programacion_id]);
  for (const c of conflictosDetalle) {
    await query(`INSERT INTO conflictos_horario (programacion_id, tipo, severidad, descripcion, datos, sugerencia) VALUES ($1, 'UNASSIGNED', 'error', $2, $3::jsonb, $4)`, [programacion_id, c.descripcion, JSON.stringify(c.datos), c.sugerencia]);
  }

  return { asignaciones, conflictos, stats };
}

export async function obtenerPreValidacionCSP(programacion_id: string) {
  const rows = await query(`SELECT * FROM v_pre_validacion_csp WHERE programacion_id = $1 ORDER BY CASE estado WHEN 'ok' THEN 1 ELSE 0 END, docente_nombre`, [programacion_id]);
  const resumen = await queryOne(`SELECT COUNT(*) AS total_docentes, COUNT(*) FILTER (WHERE estado = 'ok') AS ok, COUNT(*) FILTER (WHERE estado <> 'ok') AS alertas FROM v_pre_validacion_csp WHERE programacion_id = $1`, [programacion_id]);
  return { resumen, docentes: rows };
}
