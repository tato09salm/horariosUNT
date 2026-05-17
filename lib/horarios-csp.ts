import { query, queryOne } from './db';

/**
 * Motor de asignación de horarios utilizando restricciones (CSP simplificado)
 * Fase 3: Toma los cursos, la disponibilidad docente y genera una asignación tentativa.
 * El resultado se guarda en el campo `config` de la tabla `programaciones` en formato JSON,
 * para no alterar las asignaciones oficiales (tabla asignaciones) hasta la Fase 4.
 */
export async function generarHorarioCSP(programacion_id: string) {
  // 1. Obtener datos con jerarquía de docentes
  const cursos = await query(`
    SELECT pc.*, g.num_alumnos, g.numero_grupo, cu.codigo, cu.nombre as curso_nombre, cu.ciclo_plan,
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
  `, [programacion_id]);

  const disponibilidad = await query(`
    SELECT * FROM disponibilidad_docente 
    WHERE programacion_id = $1 AND disponible = true
  `, [programacion_id]);

  const ambientes = await query(`SELECT * FROM ambientes`);
  const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
  
  // Transformar disponibilidad en un mapa O(1)
  const docAvail = new Map<string, Set<string>>(); // docente_id -> Set("dia-slot_id")
  for (const d of disponibilidad) {
    if (!docAvail.has(d.docente_id)) docAvail.set(d.docente_id, new Set());
    docAvail.get(d.docente_id)!.add(`${d.dia}-${d.slot_id}`);
  }

  // 2. Expandir bloques a asignar (1 bloque = 1 hora)
  const blocksToAssign: any[] = [];
  for (const c of cursos) {
    const docName = c.docente_id ? `${c.docente_a}, ${c.docente_n}` : 'Sin asignar';
    for (let i=0; i<c.horas_teoria; i++) blocksToAssign.push({ ...c, tipo_sesion: 'teoria', docente_nombre_real: docName });
    for (let i=0; i<c.horas_practica; i++) blocksToAssign.push({ ...c, tipo_sesion: 'practica', docente_nombre_real: docName });
    for (let i=0; i<c.horas_laboratorio; i++) blocksToAssign.push({ ...c, tipo_sesion: 'laboratorio', docente_nombre_real: docName });
  }

  const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const asignaciones: any[] = [];
  const conflictos: string[] = [];

  // Trackers de estado para evitar colisiones
  const docenteOcupado = new Set<string>(); // "docente_id-dia-slot_id"
  const ambienteOcupado = new Set<string>(); // "ambiente_id-dia-slot_id"
  const grupoOcupado = new Set<string>(); // "grupo_id-dia-slot_id"
  const cicloOcupado = new Set<string>(); // "ciclo_plan-dia-slot_id"

  // 3. CSP Algoritmo Greedy Backtracking Simplificado
  // ORDEN DE ASIGNACIÓN: 
  // 1. Laboratorios primero (más restrictivos de ambiente)
  // 2. Por jerarquía docente (nombrados > contratados, principal > asociado > auxiliar, antigüedad)
  blocksToAssign.sort((a, b) => {
    // 1. Priorizar laboratorios
    if (a.tipo_sesion === 'laboratorio' && b.tipo_sesion !== 'laboratorio') return -1;
    if (a.tipo_sesion !== 'laboratorio' && b.tipo_sesion === 'laboratorio') return 1;
    
    // Si no tienen docente asignado, mandarlos al final de su respectivo tipo de sesión
    if (!a.docente_id && b.docente_id) return 1;
    if (a.docente_id && !b.docente_id) return -1;
    if (!a.docente_id && !b.docente_id) return 0;

    // 2. Condición (nombrado antes que contratado)
    if (a.condicion_orden !== b.condicion_orden) {
      return a.condicion_orden - b.condicion_orden;
    }
    
    // 3. Categoría (principal > asociado > auxiliar > jefe_practica)
    if (a.categoria_orden !== b.categoria_orden) {
      return a.categoria_orden - b.categoria_orden;
    }
    
    // 4. Antigüedad (fecha de ingreso más antigua = mayor prioridad)
    if (a.fecha_ingreso && b.fecha_ingreso) {
      return new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime();
    }
    
    return 0;
  });

  for (const block of blocksToAssign) {
    let assigned = false;
    
    // Filtros de ambiente válidos
    const validAmbientes = ambientes.filter(a => {
      if ((block.num_alumnos || 0) > a.capacidad) return false;
      if (block.tipo_sesion === 'laboratorio' && a.tipo !== 'laboratorio') return false;
      if (block.tipo_sesion === 'teoria' && a.tipo === 'laboratorio') return false; // Teoría no va en lab
      return true;
    });

    outer: for (const dia of DIAS) {
      for (const slot of slots) {
        // HORA LIBRE PARA COMER: De 13:00 a 14:00
        if (slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00') continue;

        const timeKey = `${dia}-${slot.id}`;
        
        // Hard constraint: ¿El ciclo ya tiene clase?
        if (cicloOcupado.has(`${block.ciclo_plan}-${timeKey}`)) continue;

        // Hard constraint: ¿El docente está disponible y no ocupado?
        if (block.docente_id) {
          if (!docAvail.get(block.docente_id)?.has(timeKey)) continue;
          if (docenteOcupado.has(`${block.docente_id}-${timeKey}`)) continue;
        }
        
        // Hard constraint: ¿El grupo ya tiene clase?
        if (block.grupo_id && grupoOcupado.has(`${block.grupo_id}-${timeKey}`)) continue;

        // Hard constraint: ¿Hay ambiente libre?
        for (const amb of validAmbientes) {
          if (!ambienteOcupado.has(`${amb.id}-${timeKey}`)) {
            // ¡Asignación válida encontrada!
            asignaciones.push({
              id: require('crypto').randomUUID(), // ID temporal
              pc_id: block.id,
              curso_id: block.curso_id,
              grupo_id: block.grupo_id,
              docente_id: block.docente_id,
              ambiente_id: amb.id,
              slot_id: slot.id,
              dia: dia,
              tipo: block.tipo_sesion,
              
              // Metadata para UI
              curso_codigo: block.codigo,
              curso_nombre: block.curso_nombre,
              numero_grupo: block.numero_grupo,
              ambiente_codigo: amb.codigo,
              ambiente_nombre: amb.nombre,
              docente_nombre: block.docente_nombre_real,
              ciclo_plan: block.ciclo_plan,
              condicion_orden: block.condicion_orden,
              categoria_orden: block.categoria_orden,
              fecha_ingreso: block.fecha_ingreso
            });

            if (block.docente_id) docenteOcupado.add(`${block.docente_id}-${timeKey}`);
            if (block.grupo_id) grupoOcupado.add(`${block.grupo_id}-${timeKey}`);
            if (block.ciclo_plan) cicloOcupado.add(`${block.ciclo_plan}-${timeKey}`);
            ambienteOcupado.add(`${amb.id}-${timeKey}`);
            
            assigned = true;
            break outer;
          }
        }
      }
    }

    if (!assigned) {
      conflictos.push(`No se pudo asignar 1h de ${block.tipo_sesion} para ${block.codigo} (G${block.numero_grupo}). Revisa disponibilidad del docente o capacidad de ambientes.`);
    }
  }

  // 4. Guardar resultados en la DB
  const prog = await queryOne(`SELECT config FROM programaciones WHERE id = $1`, [programacion_id]);
  const newConfig = { ...(prog?.config || {}), asignaciones };
  await queryOne(`UPDATE programaciones SET config = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(newConfig), programacion_id]);

  // Guardar conflictos
  await query(`DELETE FROM conflictos_horario WHERE programacion_id = $1`, [programacion_id]);
  for (const c of conflictos) {
    await query(`
      INSERT INTO conflictos_horario (programacion_id, tipo, severidad, descripcion)
      VALUES ($1, 'UNASSIGNED', 'error', $2)
    `, [programacion_id, c]);
  }

  return { asignaciones, conflictos };
}
