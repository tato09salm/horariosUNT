import { query, queryOne, transaction } from './db';
import { registrarAuditoria } from './auditoria';

type Dia = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado';

interface AsignacionInput {
  ciclo_id: string;
  grupo_id: string;
  docente_id: string;
  ambiente_id: string;
  slot_id: string;
  dia: Dia;
  tipo: 'teoria' | 'practica' | 'laboratorio';
  created_by: string;
}

// Verificar conflicto de horario
export async function verificarConflicto(input: Omit<AsignacionInput, 'created_by'>, excluir_id?: string): Promise<{
  conflicto: boolean;
  tipo?: string;
  detalle?: string;
}> {
  const base = `AND ciclo_id = $1 AND dia = $2 AND slot_id = $3 AND estado = 'activo'`;
  const exclude = excluir_id ? `AND id != '${excluir_id}'` : '';

  // Conflicto de docente
  const conflictoDocente = await queryOne(
    `SELECT a.id, d.nombre || ' ' || d.apellidos as nombre
     FROM asignaciones a
     JOIN docentes d ON d.id = a.docente_id
     WHERE docente_id = $4 ${base} ${exclude}`,
    [input.ciclo_id, input.dia, input.slot_id, input.docente_id]
  );
  if (conflictoDocente) {
    return { conflicto: true, tipo: 'docente', detalle: `El docente ya tiene clase en este horario` };
  }

  // Conflicto de ambiente
  const conflictoAmbiente = await queryOne(
    `SELECT a.id, amb.nombre as nombre
     FROM asignaciones a
     JOIN ambientes amb ON amb.id = a.ambiente_id
     WHERE ambiente_id = $4 ${base} ${exclude}`,
    [input.ciclo_id, input.dia, input.slot_id, input.ambiente_id]
  );
  if (conflictoAmbiente) {
    return { conflicto: true, tipo: 'ambiente', detalle: `El ambiente ya está ocupado en este horario` };
  }

  // Conflicto de grupo
  const conflictoGrupo = await queryOne(
    `SELECT a.id FROM asignaciones a
     WHERE grupo_id = $4 ${base} ${exclude}`,
    [input.ciclo_id, input.dia, input.slot_id, input.grupo_id]
  );
  if (conflictoGrupo) {
    return { conflicto: true, tipo: 'grupo', detalle: `El grupo ya tiene clase en este horario` };
  }

  return { conflicto: false };
}

// Crear asignación
export async function crearAsignacion(input: AsignacionInput): Promise<any> {
  if (input.dia === 'sabado') {
    throw new Error('No se permiten clases los sabados');
  }

  const conflicto = await verificarConflicto(input);
  if (conflicto.conflicto) {
    throw new Error(`Conflicto de horario (${conflicto.tipo}): ${conflicto.detalle}`);
  }

  const result = await queryOne(
    `INSERT INTO asignaciones 
     (ciclo_id, grupo_id, docente_id, ambiente_id, slot_id, dia, tipo, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [input.ciclo_id, input.grupo_id, input.docente_id, input.ambiente_id,
     input.slot_id, input.dia, input.tipo, input.created_by]
  );

  await registrarAuditoria({
    usuario_id: input.created_by,
    accion: 'ASSIGN',
    tabla_afectada: 'asignaciones',
    registro_id: result.id,
    datos_nuevos: input,
    descripcion: `Nueva asignación de horario: ${input.dia} - ${input.tipo}`,
  });

  return result;
}

// Motor de asignación automática por jerarquía
export async function generarHorarioAutomatico(params: {
  ciclo_id: string;
  grupo_id: string;
  horas_teoria: number;
  horas_practica: number;
  tipo_ambiente_teoria: string;
  tipo_ambiente_lab: string;
  created_by: string;
}): Promise<{ exitoso: boolean; asignaciones: any[]; errores: string[] }> {
  
  const errores: string[] = [];
  const asignaciones: any[] = [];

  // Obtener docentes por jerarquía: nombrados primero, luego contratados
  // Dentro de cada condición: principal > asociado > auxiliar > jefe_práctica
  // Ordenados por fecha_ingreso (más antiguo primero)
  const docentes = await query(`
    SELECT d.*, 
      CASE d.condicion 
        WHEN 'nombrado' THEN 0 
        ELSE 1 
      END as condicion_orden,
      CASE d.categoria 
        WHEN 'principal' THEN 0 
        WHEN 'asociado' THEN 1 
        WHEN 'auxiliar' THEN 2 
        WHEN 'jefe_practica' THEN 3 
      END as categoria_orden
    FROM docentes d
    WHERE d.activo = true
    ORDER BY condicion_orden ASC, categoria_orden ASC, d.fecha_ingreso ASC
  `);

  if (docentes.length === 0) {
    return { exitoso: false, asignaciones: [], errores: ['No hay docentes disponibles'] };
  }

  // Obtener slots y días disponibles
  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
  const dias: Dia[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  // Obtener ambientes por tipo
  const ambientesTeoria = await query(
    `SELECT * FROM ambientes WHERE tipo = $1 AND disponible = true ORDER BY capacidad DESC`,
    [params.tipo_ambiente_teoria]
  );
  const ambientesLab = await query(
    `SELECT * FROM ambientes WHERE tipo = 'laboratorio' AND disponible = true ORDER BY capacidad DESC`,
    []
  );

  const horasPendientesTeoria = params.horas_teoria;
  const horasPendientesPractica = params.horas_practica;
  let horasAsignadasTeoria = 0;
  let horasAsignadasPractica = 0;

  // Buscar docente con disponibilidad suficiente (siguiendo jerarquía)
  let docenteSeleccionado: any = null;
  
  for (const docente of docentes) {
    // Verificar horas actuales del docente en este ciclo
    const horasActuales = await queryOne<{ total: string }>(
      `SELECT COUNT(*) as total FROM asignaciones 
       WHERE docente_id = $1 AND ciclo_id = $2 AND estado = 'activo'`,
      [docente.id, params.ciclo_id]
    );
    const horasUsadas = parseInt(horasActuales?.total || '0');
    const horasDisponibles = docente.horas_max_semana - horasUsadas;
    
    if (horasDisponibles >= (horasPendientesTeoria + horasPendientesPractica)) {
      docenteSeleccionado = docente;
      break;
    }
  }

  if (!docenteSeleccionado) {
    errores.push('No se encontró docente con disponibilidad suficiente según jerarquía');
    return { exitoso: false, asignaciones, errores };
  }

  // Asignar horas de teoría
  for (const dia of dias) {
    if (horasAsignadasTeoria >= horasPendientesTeoria) break;
    
    for (const slot of slots) {
      if (horasAsignadasTeoria >= horasPendientesTeoria) break;
      
      for (const ambiente of ambientesTeoria) {
        const conflicto = await verificarConflicto({
          ciclo_id: params.ciclo_id,
          grupo_id: params.grupo_id,
          docente_id: docenteSeleccionado.id,
          ambiente_id: ambiente.id,
          slot_id: slot.id,
          dia,
          tipo: 'teoria',
        });

        if (!conflicto.conflicto) {
          try {
            const asig = await crearAsignacion({
              ciclo_id: params.ciclo_id,
              grupo_id: params.grupo_id,
              docente_id: docenteSeleccionado.id,
              ambiente_id: ambiente.id,
              slot_id: slot.id,
              dia,
              tipo: 'teoria',
              created_by: params.created_by,
            });
            asignaciones.push(asig);
            horasAsignadasTeoria++;
            break;
          } catch (e: any) {
            errores.push(e.message);
          }
        }
      }
    }
  }

  // Asignar horas de práctica/laboratorio
  if (horasPendientesPractica > 0) {
    for (const dia of dias) {
      if (horasAsignadasPractica >= horasPendientesPractica) break;
      
      for (const slot of slots) {
        if (horasAsignadasPractica >= horasPendientesPractica) break;
        
        for (const ambiente of ambientesLab) {
          const conflicto = await verificarConflicto({
            ciclo_id: params.ciclo_id,
            grupo_id: params.grupo_id,
            docente_id: docenteSeleccionado.id,
            ambiente_id: ambiente.id,
            slot_id: slot.id,
            dia,
            tipo: 'laboratorio',
          });

          if (!conflicto.conflicto) {
            try {
              const asig = await crearAsignacion({
                ciclo_id: params.ciclo_id,
                grupo_id: params.grupo_id,
                docente_id: docenteSeleccionado.id,
                ambiente_id: ambiente.id,
                slot_id: slot.id,
                dia,
                tipo: 'laboratorio',
                created_by: params.created_by,
              });
              asignaciones.push(asig);
              horasAsignadasPractica++;
              break;
            } catch (e: any) {
              errores.push(e.message);
            }
          }
        }
      }
    }
  }

  await registrarAuditoria({
    usuario_id: params.created_by,
    accion: 'GENERATE_SCHEDULE',
    tabla_afectada: 'asignaciones',
    datos_nuevos: { grupo_id: params.grupo_id, ciclo_id: params.ciclo_id, docente: docenteSeleccionado.id },
    descripcion: `Generación automática: ${asignaciones.length} asignaciones creadas`,
  });

  return {
    exitoso: asignaciones.length > 0,
    asignaciones,
    errores,
  };
}

// Obtener todas las actividades no lectivas programadas para un docente
export async function getHorarioNoLectivaDocente(docente_id: string, ciclo_id: string) {
  const chRow = await queryOne(`
    SELECT id, ciclo_plan FROM carga_horaria 
    WHERE docente_id = $1 AND ciclo_academico_id = $2 AND activo = true
  `, [docente_id, ciclo_id]);

  if (!chRow) return [];

  const carga_horaria_id = chRow.id;
  const ciclo_plan = chRow.ciclo_plan;

  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

  const noLectivaRows = await query(`
    SELECT 'preparacion' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, descripcion as detalles FROM carga_horaria_preparacion WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'consejeria' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_consejeria WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'investigacion' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, proyecto FROM carga_horaria_investigacion WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'capacitacion' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_capacitacion WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'gobierno' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_gobierno WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'administracion' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_administracion WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'asesoria' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_asesoria WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'rsu' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, plan FROM carga_horaria_rsu WHERE carga_horaria_id = $1 AND dia IS NOT NULL
    UNION ALL
    SELECT 'comites' as seccion_key, id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_comites WHERE carga_horaria_id = $1 AND dia IS NOT NULL
  `, [carga_horaria_id]);

  const titles: Record<string, string> = {
    preparacion: 'Preparación y Evaluación',
    consejeria: 'Consejería y Tutoría',
    investigacion: 'Investigación',
    capacitacion: 'Capacitación',
    gobierno: 'Gobierno',
    administracion: 'Administración',
    asesoria: 'Asesoría de Tesis',
    rsu: 'Responsabilidad Social',
    comites: 'Comités Técnicos'
  };

  const virtualAsignaciones: any[] = [];

  for (const row of noLectivaRows) {
    const startHourStr = row.hora_inicio;
    const endHourStr = row.hora_fin;
    if (!startHourStr || !endHourStr) continue;

    const matchedSlots = slots.filter((s: any) => {
      return s.hora_inicio >= startHourStr && s.hora_inicio < endHourStr;
    });

    for (const slot of matchedSlots) {
      virtualAsignaciones.push({
        id: `nl_${row.seccion_key}_${row.id}_${slot.id}`,
        dia: row.dia,
        slot_id: slot.id,
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
        curso_nombre: titles[row.seccion_key] || 'No Lectiva',
        curso_codigo: 'NO LECTIVA',
        ambiente_nombre: 'CUBÍCULO',
        ambiente_codigo: 'CUBICULO',
        ambiente_tipo: 'aula',
        docente_id: docente_id,
        numero_grupo: 1,
        tipo: 'no_lectiva',
        seccion_key: row.seccion_key,
        ciclo_plan: ciclo_plan
      });
    }
  }

  return virtualAsignaciones;
}

// Obtener todas las actividades no lectivas programadas para todo el ciclo
export async function getHorarioNoLectivaCiclo(ciclo_id: string) {
  const chRows = await query(`
    SELECT ch.id, ch.docente_id, ch.ciclo_plan,
           d.nombre || ' ' || d.apellidos as docente_nombre
    FROM carga_horaria ch
    JOIN docentes d ON ch.docente_id = d.id
    WHERE ch.ciclo_academico_id = $1 AND ch.activo = true
  `, [ciclo_id]);

  if (chRows.length === 0) return [];

  const chMap = new Map(chRows.map((ch: any) => [ch.id, ch]));
  const chIds = chRows.map((ch: any) => ch.id);

  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);

  const placeholders = chIds.map((_, i) => `$${i + 1}`).join(',');
  const noLectivaRows = await query(`
    SELECT 'preparacion' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, descripcion as detalles FROM carga_horaria_preparacion WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'consejeria' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_consejeria WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'investigacion' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, proyecto FROM carga_horaria_investigacion WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'capacitacion' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_capacitacion WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'gobierno' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_gobierno WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'administracion' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_administracion WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'asesoria' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_asesoria WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'rsu' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, plan FROM carga_horaria_rsu WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
    UNION ALL
    SELECT 'comites' as seccion_key, id, carga_horaria_id, dia, hora_inicio::text, hora_fin::text, detalles FROM carga_horaria_comites WHERE carga_horaria_id IN (${placeholders}) AND dia IS NOT NULL
  `, chIds);

  const titles: Record<string, string> = {
    preparacion: 'Preparación y Evaluación',
    consejeria: 'Consejería y Tutoría',
    investigacion: 'Investigación',
    capacitacion: 'Capacitación',
    gobierno: 'Gobierno',
    administracion: 'Administración',
    asesoria: 'Asesoría de Tesis',
    rsu: 'Responsabilidad Social',
    comites: 'Comités Técnicos'
  };

  const virtualAsignaciones: any[] = [];

  for (const row of noLectivaRows) {
    const chInfo = chMap.get(row.carga_horaria_id);
    if (!chInfo) continue;

    const startHourStr = row.hora_inicio;
    const endHourStr = row.hora_fin;
    if (!startHourStr || !endHourStr) continue;

    const matchedSlots = slots.filter((s: any) => {
      return s.hora_inicio >= startHourStr && s.hora_inicio < endHourStr;
    });

    for (const slot of matchedSlots) {
      virtualAsignaciones.push({
        id: `nl_${row.seccion_key}_${row.id}_${slot.id}`,
        dia: row.dia,
        slot_id: slot.id,
        hora_inicio: slot.hora_inicio,
        hora_fin: slot.hora_fin,
        curso_nombre: titles[row.seccion_key] || 'No Lectiva',
        curso_codigo: 'NO LECTIVA',
        ambiente_nombre: 'CUBÍCULO',
        ambiente_codigo: 'CUBICULO',
        ambiente_tipo: 'aula',
        docente_nombre: chInfo.docente_nombre,
        docente_id: chInfo.docente_id,
        numero_grupo: 1,
        tipo: 'no_lectiva',
        seccion_key: row.seccion_key,
        ciclo_plan: chInfo.ciclo_plan
      });
    }
  }

  return virtualAsignaciones;
}

// Obtener horario completo de un docente
export async function getHorarioDocente(docente_id: string, ciclo_id: string) {
  const lectivas = await query(`
    SELECT 
      a.*,
      c.nombre as curso_nombre, c.codigo as curso_codigo,
      amb.nombre as ambiente_nombre, amb.codigo as ambiente_codigo, amb.tipo as ambiente_tipo,
      st.hora_inicio, st.hora_fin, st.nombre as slot_nombre,
      g.numero_grupo,
      ci.nombre as ciclo_nombre
    FROM asignaciones a
    JOIN grupos g ON g.id = a.grupo_id
    JOIN cursos c ON c.id = g.curso_id
    JOIN ambientes amb ON amb.id = a.ambiente_id
    JOIN slots_tiempo st ON st.id = a.slot_id
    JOIN ciclos ci ON ci.id = a.ciclo_id
    WHERE a.docente_id = $1 AND a.ciclo_id = $2 AND a.estado = 'activo'
    ORDER BY 
      CASE a.dia WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3 
                 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6 END,
      st.orden
  `, [docente_id, ciclo_id]);

  const noLectivas = await getHorarioNoLectivaDocente(docente_id, ciclo_id);

  return [...lectivas, ...noLectivas];
}

// Obtener horario de aula/ambiente
export async function getHorarioAmbiente(ambiente_id: string, ciclo_id: string) {
  return query(`
    SELECT 
      a.*,
      c.nombre as curso_nombre,
      d.nombre || ' ' || d.apellidos as docente_nombre,
      st.hora_inicio, st.hora_fin, st.nombre as slot_nombre,
      g.numero_grupo
    FROM asignaciones a
    JOIN grupos g ON g.id = a.grupo_id
    JOIN cursos c ON c.id = g.curso_id
    JOIN docentes d ON d.id = a.docente_id
    JOIN slots_tiempo st ON st.id = a.slot_id
    WHERE a.ambiente_id = $1 AND a.ciclo_id = $2 AND a.estado = 'activo'
    ORDER BY 
      CASE a.dia WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3 
                 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6 END,
      st.orden
  `, [ambiente_id, ciclo_id]);
}
