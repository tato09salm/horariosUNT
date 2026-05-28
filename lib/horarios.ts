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

// Obtener horario completo de un docente
export async function getHorarioDocente(docente_id: string, ciclo_id: string) {
  return query(`
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
