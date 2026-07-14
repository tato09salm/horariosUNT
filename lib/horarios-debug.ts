import { query, queryOne } from './db';
import {
  type SlotRow, type BlockGroup, type BlockUnit, type AmbAvailMap, type Occupancy,
  puedeSlot, ambienteDisponible, ambienteSlotOk, ambientesValidosPara, puedeUsarFranja,
} from './csp-asignacion';
import { DIAS_SEMANA } from './horario-utils';

const DIAS: string[] = [...DIAS_SEMANA];
const DIAS_EXT: string[] = [...DIAS_SEMANA, 'sabado'];

// ─── 1. Carga programable desde Fase 1 (programacion_cursos, sin consejería/asesoría) ─────

export interface CursoProgramable {
  pc_id: string;
  curso_id: string;
  grupo_id: string;
  codigo: string;
  horas_teoria: number;
  horas_practica: number;
  horas_laboratorio: number;
  cantidad_labs: number;
  total_horas: number;
}

export interface CargaProgramableDocente {
  docente_id: string;
  total_horas_programables: number;
  cursos: CursoProgramable[];
}

export async function obtenerCargaProgramableDocente(
  programacionId: string,
  docenteId: string
): Promise<CargaProgramableDocente> {
  const rows = await query(`
    SELECT pc.id as pc_id, pc.curso_id, pc.grupo_id,
           cu.codigo, pc.horas_teoria, pc.horas_practica, pc.horas_laboratorio,
           1 as cantidad_labs
    FROM programacion_cursos pc
    JOIN cursos cu ON cu.id = pc.curso_id
    WHERE pc.programacion_id = $1 AND pc.docente_id = $2
  `, [programacionId, docenteId]);

  const cursos: CursoProgramable[] = rows.map(r => {
    const ht = Number(r.horas_teoria) || 0;
    const hp = Number(r.horas_practica) || 0;
    const hl = Number(r.horas_laboratorio) || 0;
    const turnosLab = hl > 0 ? Math.max(1, Number(r.cantidad_labs) || 1) : 0;
    const total = ht + hp + (hl * turnosLab);
    return {
      pc_id: r.pc_id, curso_id: r.curso_id, grupo_id: r.grupo_id,
      codigo: r.codigo, horas_teoria: ht, horas_practica: hp,
      horas_laboratorio: hl, cantidad_labs: turnosLab, total_horas: total,
    };
  });

  const total_horas_programables = cursos.reduce((s, c) => s + c.total_horas, 0);
  return { docente_id: docenteId, total_horas_programables, cursos };
}

// ─── 2. Auditoría de disponibilidad desde Fase 2 ────────────────────────────────────────

export interface BloqueContiguoAudit {
  slot_inicio: string;
  slot_fin: string;
  duracion: number;
}

export interface DiaDisponibilidadAudit {
  dia: string;
  slots: string[];
  ordenes: number[];
  bloques_contiguos: BloqueContiguoAudit[];
  maximo_contiguo: number;
}

export interface AuditoriaDisponibilidad {
  docente_id: string;
  total_registros: number;
  slots_disponibles: number;
  slots_invalidos: number;
  slots_duplicados: number;
  dias: DiaDisponibilidadAudit[];
  advertencias: string[];
  errores: string[];
}

export async function auditarDisponibilidadDocente(
  programacionId: string,
  docenteId: string,
  slots: SlotRow[]
): Promise<AuditoriaDisponibilidad> {
  const advertencias: string[] = [];
  const errores: string[] = [];

  const registros = await query(`
    SELECT dd.*, st.orden, st.hora_inicio
    FROM disponibilidad_docente dd
    LEFT JOIN slots_tiempo st ON st.id = dd.slot_id
    WHERE dd.programacion_id = $1 AND dd.docente_id = $2
    ORDER BY dd.dia, st.orden
  `, [programacionId, docenteId]);

  const total_registros = registros.length;
  const disponibles = registros.filter((r: any) => r.disponible === true);
  const slots_disponibles = disponibles.length;

  // Slots inválidos (sin match en slots_tiempo)
  const slots_invalidos = registros.filter((r: any) => !r.orden).length;
  if (slots_invalidos > 0) advertencias.push(`${slots_invalidos} registro(s) sin correspondencia en slots_tiempo`);

  // Slots duplicados (mismo docente, dia, slot_id repetido)
  const vistos = new Set<string>();
  let slots_duplicados = 0;
  for (const r of registros) {
    const k = `${r.dia}-${r.slot_id}`;
    if (vistos.has(k)) slots_duplicados++;
    vistos.add(k);
  }
  if (slots_duplicados > 0) errores.push(`${slots_duplicados} slot(s) duplicado(s) para el mismo día`);

  // Slots marcados simultáneamente disponibles y no disponibles
  const porDiaSlot = new Map<string, Set<boolean>>();
  for (const r of registros) {
    const k = `${r.dia}-${r.slot_id}`;
    if (!porDiaSlot.has(k)) porDiaSlot.set(k, new Set());
    porDiaSlot.get(k)!.add(r.disponible);
  }
  let duales = 0;
  for (const [k, vals] of porDiaSlot) {
    if (vals.size > 1) duales++;
  }
  if (duales > 0) errores.push(`${duales} slot(s) marcados simultáneamente como disponible y no disponible`);

  // Registros con programacion_id incorrecto
  const progCheck = await query(
    `SELECT id FROM programaciones WHERE id = $1`,
    [programacionId]
  );
  if (progCheck.length === 0) errores.push(`programacion_id ${programacionId} no existe`);

  // Slots nulos
  const nulos = registros.filter((r: any) => !r.slot_id).length;
  if (nulos > 0) errores.push(`${nulos} registro(s) con slot_id nulo`);

  // Docente_id nulo
  const docNulos = registros.filter((r: any) => !r.docente_id).length;
  if (docNulos > 0) errores.push(`${docNulos} registro(s) con docente_id nulo`);

  // Agrupar por día
  const slotMap = new Map(slots.map(s => [s.id, s]));
  const porDia = new Map<string, { slots: string[]; ordenes: number[] }>();
  for (const r of disponibles) {
    if (!r.slot_id || !r.dia) continue;
    if (!porDia.has(r.dia)) porDia.set(r.dia, { slots: [], ordenes: [] });
    const entry = porDia.get(r.dia)!;
    const s = slotMap.get(r.slot_id);
    if (s) {
      entry.slots.push(s.hora_inicio);
      entry.ordenes.push(s.orden);
    }
  }

  const dias: DiaDisponibilidadAudit[] = [];
  for (const [dia, data] of porDia) {
    const ordenesOrdenados = [...data.ordenes].sort((a, b) => a - b);
    const bloques_contiguos: BloqueContiguoAudit[] = [];
    let currentStart = ordenesOrdenados[0];
    let currentLen = 1;
    let maximo_contiguo = 1;

    for (let i = 1; i < ordenesOrdenados.length; i++) {
      if (ordenesOrdenados[i] === ordenesOrdenados[i - 1] + 1) {
        currentLen++;
      } else {
        bloques_contiguos.push({
          slot_inicio: slotMap.get(disponibles.find((r: any) => r.dia === dia && r.orden === currentStart)?.slot_id)?.hora_inicio || `${currentStart}`,
          slot_fin: slotMap.get(disponibles.find((r: any) => r.dia === dia && r.orden === ordenesOrdenados[i - 1])?.slot_id)?.hora_inicio || `${ordenesOrdenados[i - 1]}`,
          duracion: currentLen,
        });
        if (currentLen > maximo_contiguo) maximo_contiguo = currentLen;
        currentStart = ordenesOrdenados[i];
        currentLen = 1;
      }
    }
    bloques_contiguos.push({
      slot_inicio: slotMap.get(disponibles.find((r: any) => r.dia === dia && r.orden === currentStart)?.slot_id)?.hora_inicio || `${currentStart}`,
      slot_fin: slotMap.get(disponibles.find((r: any) => r.dia === dia && r.orden === ordenesOrdenados[ordenesOrdenados.length - 1])?.slot_id)?.hora_inicio || `${ordenesOrdenados[ordenesOrdenados.length - 1]}`,
      duracion: currentLen,
    });
    if (currentLen > maximo_contiguo) maximo_contiguo = currentLen;

    dias.push({
      dia,
      slots: data.slots,
      ordenes: ordenesOrdenados,
      bloques_contiguos,
      maximo_contiguo,
    });
  }

  return {
    docente_id: docenteId,
    total_registros,
    slots_disponibles,
    slots_invalidos,
    slots_duplicados,
    dias,
    advertencias,
    errores,
  };
}

// ─── 3. Validación compartida de candidato (mismas reglas que asignarGrupoContinuo) ──────

export type CodigoRechazo =
  | 'DOCENTE_SIN_DISPONIBILIDAD'
  | 'DOCENTE_DISPONIBILIDAD_LIMITADA'
  | 'DOCENTE_OCUPADO'
  | 'BLOQUE_CONTIGUO_NO_ENCONTRADO'
  | 'LABORATORIO_NO_EXISTE'
  | 'LABORATORIO_SIN_VENTANA_CONTINUA'
  | 'LABORATORIO_NO_DISPONIBLE'
  | 'LABORATORIO_OCUPADO'
  | 'AMBIENTE_NO_DISPONIBLE'
  | 'TIPO_AMBIENTE_INVALIDO'
  | 'GRUPO_OCUPADO'
  | 'CICLO_OCUPADO'
  | 'SLOT_RESTRINGIDO'
  | 'SABADO_NO_PERMITIDO'
  | 'CARGA_ADICIONAL'
  | 'CRUCE_DOCENTE'
  | 'CRUCE_GRUPO'
  | 'CRUCE_CICLO'
  | 'OTRO';

export interface ResultadoValidacionCandidato {
  valido: boolean;
  slots: SlotRow[];
  ambiente?: any;
  motivos: CodigoRechazo[];
  detalle_motivos: string[];
}

export interface ContextoAsignacion {
  docAvail: Map<string, Map<string, number>>;
  occ: Occupancy;
  ambAvail: AmbAvailMap;
  priorityPass: number;
  opts: { practicaEnAula?: boolean; restrictedIds?: string[]; incluirSabado?: boolean };
}

export function validarCandidatoBloque(
  block: Record<string, any>,
  dia: string,
  ventana: SlotRow[],
  ambiente: any | null,
  ctx: ContextoAsignacion
): ResultadoValidacionCandidato {
  const motivos: CodigoRechazo[] = [];
  const detalle: string[] = [];

  // ── Pre-checks: slots restringidos, sábado ──
  for (const slot of ventana) {
    if (ctx.opts.restrictedIds?.includes(slot.id)) {
      motivos.push('SLOT_RESTRINGIDO');
      detalle.push(`Slot ${slot.hora_inicio} (${slot.id}) está restringido`);
      return { valido: false, slots: ventana, ambiente, motivos, detalle_motivos: detalle };
    }
  }

  if (dia === 'sabado' && !ctx.opts.incluirSabado) {
    motivos.push('SABADO_NO_PERMITIDO');
    detalle.push('Sábado no está permitido en esta iteración');
    return { valido: false, slots: ventana, ambiente, motivos, detalle_motivos: detalle };
  }

  // ── Validación usando misma función `puedeSlot` del CSP (NO duplicar reglas) ──
  for (const slot of ventana) {
    if (!puedeSlot(block, dia, slot, ctx.priorityPass, ctx.docAvail, ctx.occ)) {
      // Falló — diagnosticar causa específica
      const tk = `${dia}-${slot.id}`;
      if (block.docente_id) {
        const docMap = ctx.docAvail.get(block.docente_id);
        if (!docMap?.has(tk)) {
          motivos.push('DOCENTE_SIN_DISPONIBILIDAD');
          detalle.push(`Docente sin disponibilidad en ${dia} slot ${slot.hora_inicio} (orden ${slot.orden})`);
        } else if (ctx.priorityPass === 1 && (docMap.get(tk)!) !== 1) {
          motivos.push('DOCENTE_DISPONIBILIDAD_LIMITADA');
          detalle.push(`Docente tiene prioridad ${docMap.get(tk)} (se requiere 1) en ${dia} ${slot.hora_inicio}`);
        } else if (ctx.occ.docenteOcupado.has(`${block.docente_id}-${tk}`)) {
          motivos.push('DOCENTE_OCUPADO');
          detalle.push(`Docente ya ocupado en ${dia} ${slot.hora_inicio}`);
        } else if (ctx.occ.docenteCursoClase.has(`${block.docente_id}-${block.curso_id}-${tk}`)) {
          motivos.push('CRUCE_DOCENTE');
          detalle.push(`Docente ya tiene clase del mismo curso en ${dia} ${slot.hora_inicio}`);
        }
      }
      if (block.grupo_id && ctx.occ.grupoOcupado.has(`${block.grupo_id}-${tk}`)) {
        if (!motivos.includes('GRUPO_OCUPADO')) { motivos.push('GRUPO_OCUPADO'); detalle.push(`Grupo ocupado en ${dia} ${slot.hora_inicio}`); }
      }
      if (block.ciclo_plan && block.tipo_sesion !== 'laboratorio') {
        const sec = block.seccion || 'A';
        if (ctx.occ.cicloOcupado.has(`${block.ciclo_plan}-${sec}-${tk}`)) {
          if (!motivos.includes('CICLO_OCUPADO')) { motivos.push('CICLO_OCUPADO'); detalle.push(`Ciclo ${block.ciclo_plan}-${sec} ocupado en ${dia} ${slot.hora_inicio}`); }
        }
      }
      if (motivos.length === 0) {
        const fk = puedeUsarFranja(block, dia, slot.id, ctx.occ);
        if (!fk.ok) { motivos.push('CARGA_ADICIONAL'); detalle.push(`Franja inválida: ${fk.razon}`); }
      }
      return { valido: false, slots: ventana, ambiente, motivos, detalle_motivos: detalle };
    }
  }

  // ── Validar ambiente usando mismas funciones CSP ──
  if (ambiente) {
    // Validar tipo mediante ambientesValidosPara
    const validos = ambientesValidosPara(block, [ambiente], ctx.opts);
    if (validos.length === 0) {
      motivos.push('TIPO_AMBIENTE_INVALIDO');
      detalle.push(`Ambiente ${ambiente.codigo} (${ambiente.tipo}) no es válido para ${block.tipo_sesion}`);
    }

    for (const slot of ventana) {
      if (!ambienteDisponible(block, ambiente.id, dia, slot.id, ctx.occ)) {
        motivos.push('AMBIENTE_NO_DISPONIBLE');
        detalle.push(`Ambiente ${ambiente.codigo} no disponible en ${dia} ${slot.hora_inicio}`);
        break;
      }
      if (!ambienteSlotOk(ambiente.id, dia, slot.id, ctx.ambAvail, block.tipo_sesion === 'laboratorio')) {
        motivos.push('LABORATORIO_NO_DISPONIBLE');
        detalle.push(`Laboratorio ${ambiente.codigo} no disponible según configuración en ${dia} ${slot.hora_inicio}`);
        break;
      }
    }
  }

  return {
    valido: motivos.length === 0,
    slots: ventana,
    ambiente,
    motivos,
    detalle_motivos: detalle,
  };
}

// ─── 4. Diagnóstico completo de bloque no asignado ──────────────────────────────────────

export interface CandidatoRechazado {
  dia: string;
  slot_inicio: string;
  slot_ids: string[];
  ambiente_id?: string;
  motivos: string[];
}

export interface DiagnosticoBloqueNoAsignado {
  clave_bloque: string;
  pc_id: string;
  docente_id: string;
  docente_nombre: string;
  curso_id: string;
  curso_codigo: string;
  grupo_id: string;
  tipo_sesion: string;
  lab_turno?: number;
  duracion: number;

  carga_requerida: number;
  carga_asignada_docente: number;
  carga_pendiente_docente: number;

  disponibilidad: {
    total_slots: number;
    maximo_bloque_contiguo: number;
    bloques_contiguos_suficientes: number;
  };

  candidatos: {
    total_combinaciones: number;
    docente_disponible: number;
    slots_contiguos: number;
    ambiente_tipo_valido: number;
    ambiente_disponible: number;
    sin_cruce_docente: number;
    sin_cruce_grupo: number;
    sin_cruce_ciclo: number;
    candidatos_finales: number;
  };

  causas_rechazo: Record<string, number>;

  mejores_candidatos_rechazados: CandidatoRechazado[];

  razon_principal: string;
  sugerencia: string;

  diagnostico_lab?: {
    laboratorios_compatibles: number;
    ventanas_docente: number;
    ventanas_ambiente: number;
    ventanas_conjuntas: number;
    bloques_que_ocupan_ventanas: string[];
  };
}

export function diagnosticarBloqueNoAsignado(
  bloque: BlockGroup,
  slots: SlotRow[],
  ambientes: any[],
  ctx: ContextoAsignacion,
  cargaRequerida: number,
  cargaAsignadaDocente: number,
  docenteNombre: string,
): DiagnosticoBloqueNoAsignado {
  const meta = bloque.units[0]?.meta || {};
  const ck = (() => {
    const pc_id = meta.pc_id || meta.id || '';
    return [pc_id, meta.docente_id ?? '', meta.curso_id ?? '', meta.grupo_id ?? '', meta.tipo_sesion ?? '', meta.lab_turno ?? 0].join('|');
  })();
  const duracion = bloque.units.length;
  const docsDisponibles = new Set<string>();
  const ambSet = new Set(ambientes.map(a => a.id));

  // Track pipeline stages for precise diagnosis
  let slotsDocenteDisponibles = 0;
  let ventanasContiguas = 0;
  let ventanasConAmbientes = 0;
  let ventanasSinConflictos = 0;
  let candidatosFinales = 0;
  
  const mejoresRechazados: CandidatoRechazado[] = [];

  const diasEvaluar = ctx.opts.incluirSabado ? DIAS_EXT : DIAS;

  // For 1h blocks, individual slots are always valid - don't require contiguity
  const requiereContiguidad = duracion > 1;

  for (const dia of diasEvaluar) {
    for (let si = 0; si <= slots.length - duracion; si++) {
      const ventana = slots.slice(si, si + duracion);
      const consecutivo = !requiereContiguidad || ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
      if (!consecutivo) continue;

      ventanasContiguas++;
      
      // Stage 1: Check docente availability
      let docenteOk = true;
      for (const s of ventana) {
        const tk = `${dia}-${s.id}`;
        if (!ctx.docAvail.get(meta.docente_id || '')?.has(tk)) {
          docenteOk = false;
          break;
        }
        if (ctx.occ.docenteOcupado.has(`${meta.docente_id}-${tk}`)) {
          docenteOk = false;
          break;
        }
      }
      if (docenteOk) {
        slotsDocenteDisponibles++;
      } else {
        continue; // Skip to next window if docente not available
      }

      // Stage 2: Check environment compatibility
      let tieneAmbienteValido = false;
      for (const amb of ambientes) {
        const validos = ambientesValidosPara(meta, [amb], ctx.opts);
        if (validos.length > 0) {
          tieneAmbienteValido = true;
          break;
        }
      }
      if (!tieneAmbienteValido) {
        continue; // Skip if no compatible environment
      }
      ventanasConAmbientes++;

      // Stage 3: Check for conflicts and full availability
      for (const amb of ambientes) {
        const validos = ambientesValidosPara(meta, [amb], ctx.opts);
        if (validos.length === 0) continue;
        
        let ambienteOk = true;
        for (const s of ventana) {
          const tk = `${dia}-${s.id}`;
          if (!ambienteDisponible(meta, amb.id, dia, s.id, ctx.occ)) {
            ambienteOk = false;
            break;
          }
          if (!ambienteSlotOk(amb.id, dia, s.id, ctx.ambAvail, meta.tipo_sesion === 'laboratorio')) {
            ambienteOk = false;
            break;
          }
        }
        if (!ambienteOk) continue;
        
        // Check for conflicts
        let tieneConflictos = false;
        const motivos: string[] = [];
        for (const s of ventana) {
          const tk = `${dia}-${s.id}`;
          if (meta.grupo_id && ctx.occ.grupoOcupado.has(`${meta.grupo_id}-${tk}`)) {
            tieneConflictos = true;
            motivos.push('GRUPO_OCUPADO');
          }
          if (meta.ciclo_plan && meta.tipo_sesion !== 'laboratorio') {
            const sec = meta.seccion || 'A';
            if (ctx.occ.cicloOcupado.has(`${meta.ciclo_plan}-${sec}-${tk}`)) {
              tieneConflictos = true;
              motivos.push('CICLO_OCUPADO');
            }
          }
        }
        
        if (!tieneConflictos) {
          candidatosFinales++;
          ventanasSinConflictos++;
        } else if (mejoresRechazados.length < 5) {
          mejoresRechazados.push({
            dia,
            slot_inicio: ventana[0]?.hora_inicio || '',
            slot_ids: ventana.map(s => s.id),
            ambiente_id: amb?.id,
            motivos,
          });
        }
      }
    }
  }

  // Determine primary cause based on pipeline stage
  let causaPrincipal: string;
  if (slotsDocenteDisponibles === 0) {
    causaPrincipal = 'DOCENTE_SIN_DISPONIBILIDAD';
  } else if (ventanasContiguas === 0 && requiereContiguidad) {
    causaPrincipal = 'BLOQUE_CONTIGUO_NO_ENCONTRADO';
  } else if (ventanasConAmbientes === 0) {
    causaPrincipal = 'TIPO_AMBIENTE_INVALIDO';
  } else if (ventanasSinConflictos === 0) {
    causaPrincipal = 'CRUCE_CONFLICTO';
  } else {
    causaPrincipal = 'AMBIENTE_NO_DISPONIBLE';
  }

  const causas: Record<string, number> = { [causaPrincipal]: 1 };

  const mapRazon: Record<string, string> = {
    'DOCENTE_SIN_DISPONIBILIDAD': 'El docente no marcó disponibilidad en ninguna ventana donde el bloque quepa de forma contigua',
    'DOCENTE_DISPONIBILIDAD_LIMITADA': 'El docente solo tiene disponibilidad de baja prioridad, insuficiente para bloques prioritarios',
    'DOCENTE_OCUPADO': 'El docente ya tiene asignaciones que ocupan todas las ventanas disponibles',
    'BLOQUE_CONTIGUO_NO_ENCONTRADO': 'No existe ventana contigua de la duración requerida en ningún día de la semana',
    'LABORATORIO_NO_EXISTE': 'No existe laboratorio con capacidad suficiente en el sistema',
    'LABORATORIO_SIN_VENTANA_CONTINUA': 'Existen laboratorios pero ninguno tiene disponibilidad continua para toda la duración del bloque',
    'LABORATORIO_NO_DISPONIBLE': 'Los laboratorios disponibles no están configurados como accesibles en los slots requeridos',
    'LABORATORIO_OCUPADO': 'Los laboratorios están ocupados por otras asignaciones en todas las ventanas',
    'AMBIENTE_NO_DISPONIBLE': 'Todas las aulas/laboratorios están ocupados en las ventanas disponibles del docente',
    'TIPO_AMBIENTE_INVALIDO': 'El tipo de ambiente requerido no coincide con los ambientes disponibles',
    'GRUPO_OCUPADO': 'El grupo ya tiene otra clase en todas las ventanas disponibles',
    'CICLO_OCUPADO': 'El ciclo ya tiene otra sección ocupando el horario en todas las ventanas',
    'SLOT_RESTRINGIDO': 'Los slots necesarios están restringidos (horario de comida u otra restricción)',
    'SABADO_NO_PERMITIDO': 'Solo hay ventanas en sábado pero no está permitido en esta iteración',
    'CARGA_ADICIONAL': 'La franja horaria está bloqueada por carga adicional del docente',
    'CRUCE_CONFLICTO': 'Las ventanas válidas están ocupadas por conflictos con grupo, ciclo u otras asignaciones',
  };
  const razon_principal = mapRazon[causaPrincipal] || `Causa principal: ${causaPrincipal}`;
  const sugerencia = generarSugerencia(causaPrincipal, duracion, bloque.tipo_sesion);

  // Diagnóstico especial para laboratorios y prácticas
  let diagnosticoLab: DiagnosticoBloqueNoAsignado['diagnostico_lab'] = undefined;
  if (bloque.tipo_sesion === 'laboratorio' || bloque.tipo_sesion === 'practica') {
    const tipoReq = bloque.tipo_sesion === 'laboratorio' ? 'laboratorio' : 'laboratorio';
    const labsCompatibles = ambientes.filter(a => a.tipo === tipoReq || (bloque.tipo_sesion === 'practica' && a.tipo === 'aula'));
    const laboratorios_compatibles = labsCompatibles.length;
    let ventanas_docente = 0;
    let ventanas_ambiente = 0;
    let ventanas_conjuntas = 0;
    const bloquesOcupantes: string[] = [];
    const razonesRechazo: string[] = [];

    console.log(`[DIAGNOSTICO] ${meta.codigo || meta.curso_codigo} ${bloque.tipo_sesion} ${duracion}h`);
    console.log(`[DIAGNOSTICO] Ambientes compatibles totales: ${laboratorios_compatibles}`);
    console.log(`[DIAGNOSTICO] Ambientes probados: ${ambientes.length}`);

    for (const dia of diasEvaluar) {
      for (let si = 0; si <= slots.length - duracion; si++) {
        const ventana = slots.slice(si, si + duracion);
        const consecutivo = !requiereContiguidad || ventana.every((s, idx) => idx === 0 || s.orden === ventana[idx - 1].orden + 1);
        if (!consecutivo) continue;

        let docOk = true;
        for (const s of ventana) {
          const tk = `${dia}-${s.id}`;
          if (!ctx.docAvail.get(meta.docente_id || '')?.has(tk)) {
            docOk = false;
            razonesRechazo.push(`Docente sin disponibilidad en ${dia} ${s.hora_inicio}`);
            break;
          }
          if (ctx.occ.docenteOcupado.has(`${meta.docente_id}-${tk}`)) {
            docOk = false;
            razonesRechazo.push(`Docente ocupado en ${dia} ${s.hora_inicio}`);
            break;
          }
        }
        if (docOk) ventanas_docente++;

        let ambOk = false;
        for (const lab of labsCompatibles) {
          let labAllOk = true;
          for (const s of ventana) {
            if (ctx.occ.ambienteOcupado.has(`${lab.id}-${dia}-${s.id}`)) {
              labAllOk = false;
              razonesRechazo.push(`Ambiente ${lab.codigo} ocupado en ${dia} ${s.hora_inicio}`);
              break;
            }
          }
          if (labAllOk) { ambOk = true; break; }
        }
        if (ambOk) ventanas_ambiente++;

        if (docOk && ambOk) {
          ventanas_conjuntas++;
          // Find what occupies this slot
          for (const s of ventana) {
            const tk = `${dia}-${s.id}`;
            for (const a of labsCompatibles) {
              const ambOcup = `${a.id}-${dia}-${s.id}`;
              if (ctx.occ.ambienteOcupado.has(ambOcup)) {
                bloquesOcupantes.push(`Lab ${a.codigo} ocupado en ${dia} ${s.hora_inicio}`);
              }
            }
          }
        }
      }
    }

    console.log(`[DIAGNOSTICO] Ventanas probadas: ${ventanasContiguas}`);
    console.log(`[DIAGNOSTICO] Ventanas docente: ${ventanas_docente}`);
    console.log(`[DIAGNOSTICO] Ventanas ambiente: ${ventanas_ambiente}`);
    console.log(`[DIAGNOSTICO] Ventanas conjuntas: ${ventanas_conjuntas}`);
    if (razonesRechazo.length > 0) {
      console.log(`[DIAGNOSTICO] Razones de rechazo (primeras 5): ${razonesRechazo.slice(0, 5).join(', ')}`);
    }

    diagnosticoLab = {
      laboratorios_compatibles,
      ventanas_docente,
      ventanas_ambiente,
      ventanas_conjuntas,
      bloques_que_ocupan_ventanas: [...new Set(bloquesOcupantes)].slice(0, 10),
    };
  }

  // Calcular disponibilidad
  const docId = meta.docente_id || '';
  let maxBloqueContiguo = 0;
  let bloquesContiguosSuficientes = 0;
  for (const dia of DIAS_EXT) {
    let currentSeq = 0;
    for (const s of slots) {
      const tk = `${dia}-${s.id}`;
      if (ctx.docAvail.get(docId)?.has(tk) && !ctx.occ.docenteOcupado.has(`${docId}-${tk}`)) {
        currentSeq++;
        if (currentSeq > maxBloqueContiguo) maxBloqueContiguo = currentSeq;
      } else {
        if (currentSeq >= duracion) bloquesContiguosSuficientes++;
        currentSeq = 0;
      }
    }
    if (currentSeq >= duracion) bloquesContiguosSuficientes++;
  }

  return {
    clave_bloque: ck,
    pc_id: meta.id || meta.pc_id || '',
    docente_id: docId,
    docente_nombre: docenteNombre,
    curso_id: meta.curso_id || '',
    curso_codigo: meta.codigo || meta.curso_codigo || '',
    grupo_id: meta.grupo_id || '',
    tipo_sesion: bloque.tipo_sesion,
    lab_turno: meta.lab_turno || undefined,
    duracion,
    carga_requerida: cargaRequerida,
    carga_asignada_docente: cargaAsignadaDocente,
    carga_pendiente_docente: Math.max(0, cargaRequerida - cargaAsignadaDocente),
    disponibilidad: {
      total_slots: ctx.docAvail.get(docId)?.size || 0,
      maximo_bloque_contiguo: maxBloqueContiguo,
      bloques_contiguos_suficientes: bloquesContiguosSuficientes,
    },
    candidatos: {
      total_combinaciones: ventanasContiguas * ambientes.length,
      docente_disponible: slotsDocenteDisponibles,
      slots_contiguos: ventanasContiguas,
      ambiente_tipo_valido: ventanasConAmbientes,
      ambiente_disponible: ventanasSinConflictos,
      sin_cruce_docente: ventanasSinConflictos,
      sin_cruce_grupo: ventanasSinConflictos,
      sin_cruce_ciclo: ventanasSinConflictos,
      candidatos_finales: candidatosFinales,
    },
    causas_rechazo: causas,
    mejores_candidatos_rechazados: mejoresRechazados,
    razon_principal,
    sugerencia,
    diagnostico_lab: diagnosticoLab,
  };
}

function generarSugerencia(causa: string, duracion: number, tipo: string): string {
  const mapa: Record<string, string> = {
    'DOCENTE_SIN_DISPONIBILIDAD': `Revisar que el docente haya registrado disponibilidad en Fase 2. Necesita al menos ${duracion}h contiguas.`,
    'DOCENTE_DISPONIBILIDAD_LIMITADA': 'Considerar ejecutar con prioridad 2 para usar slots de disponibilidad extendida.',
    'DOCENTE_OCUPADO': `Hay ${duracion}h de este bloque pendientes porque el docente ya cubrió su carga en otras ventanas. Mover asignaciones flexibles a otros horarios.`,
    'AMBIENTE_NO_DISPONIBLE': 'Liberar ambientes moviendo asignaciones flexibles a otros horarios o usar ambientes alternativos.',
    'LABORATORIO_NO_EXISTE': 'Crear laboratorios en el módulo de Ambientes con capacidad suficiente.',
    'LABORATORIO_SIN_VENTANA_CONTINUA': 'Verificar disponibilidad de laboratorios. Puede necesitarse bloque contiguo más largo.',
    'LABORATORIO_OCUPADO': `Mover laboratorios existentes a otros horarios para liberar ventanas de ${duracion}h continuas.`,
    'GRUPO_OCUPADO': 'Verificar que el grupo no tenga clases duplicadas en el mismo horario.',
    'CICLO_OCUPADO': 'Cambiar la sección del curso o mover asignaciones de otras secciones del mismo ciclo.',
    'BLOQUE_CONTIGUO_NO_ENCONTRADO': `No hay ventana de ${duracion}h contiguas. Si es teoría de 2h, considerar dividir en 1h+1h como último recurso.`,
    'TIPO_AMBIENTE_INVALIDO': `El tipo ${tipo} requiere ambiente específico. Verificar configuración.`,
    'SLOT_RESTRINGIDO': 'Revisar configuración de horarios restringidos en la programación.',
    'SABADO_NO_PERMITIDO': 'Si es necesario, permitir sábado en la configuración del resolvedor.',
    'CARGA_ADICIONAL': 'Verificar carga adicional del docente (preparación, consejería, etc.) que bloquea las franjas.',
  };
  return mapa[causa] || 'Verificar datos de entrada del docente, curso y disponibilidad.';
}

// ─── 5. Validación de consistencia entre Fase 1 y Fase 2 ────────────────────────────────

export type ClasificacionConsistencia =
  | 'OK'
  | 'DISPONIBILIDAD_INSUFICIENTE'
  | 'DISPONIBILIDAD_MAL_IMPORTADA'
  | 'BLOQUES_CONTIGUOS_INSUFICIENTES'
  | 'ALGORITMO_NO_ENCONTRO_SOLUCION';

export interface ReporteConsistencia {
  docente_id: string;
  docente_nombre: string;
  horas_carga_fase_1: number;
  slots_disponibles_fase_2: number;
  maximo_bloque_contiguo: number;
  horas_asignadas: number;
  horas_pendientes: number;
  clasificacion: ClasificacionConsistencia;
  detalles: string[];
}

export async function validarConsistenciaFase1Fase2(
  programacionId: string,
  docenteId: string,
  slots: SlotRow[],
  asignaciones: any[],
): Promise<ReporteConsistencia> {
  const detalles: string[] = [];

  const docRow = await queryOne(
    `SELECT nombre || ' ' || apellidos as nombre FROM docentes WHERE id = $1`,
    [docenteId]
  );
  const docente_nombre = docRow?.nombre || docenteId;

  const carga = await obtenerCargaProgramableDocente(programacionId, docenteId);
  const horas_carga_fase_1 = carga.total_horas_programables;

  const disp = await auditarDisponibilidadDocente(programacionId, docenteId, slots);
  const slots_disponibles_fase_2 = disp.slots_disponibles;

  const asigDoc = asignaciones.filter(a => a.docente_id === docenteId);
  const horas_asignadas = asigDoc.length;
  const horas_pendientes = Math.max(0, horas_carga_fase_1 - horas_asignadas);

  let maximo_bloque_contiguo = 0;
  for (const d of disp.dias) {
    if (d.maximo_contiguo > maximo_bloque_contiguo) maximo_bloque_contiguo = d.maximo_contiguo;
  }

  let clasificacion: ClasificacionConsistencia = 'OK';

  if (slots_disponibles_fase_2 < horas_carga_fase_1) {
    clasificacion = 'DISPONIBILIDAD_INSUFICIENTE';
    detalles.push(`Disponibilidad (${slots_disponibles_fase_2}h) < Carga (${horas_carga_fase_1}h). Faltan ${horas_carga_fase_1 - slots_disponibles_fase_2} slots.`);
  }

  if (disp.slots_duplicados > 0 || disp.slots_invalidos > 0) {
    clasificacion = 'DISPONIBILIDAD_MAL_IMPORTADA';
    detalles.push(`${disp.slots_duplicados} duplicados, ${disp.slots_invalidos} inválidos. Revisar importación de Fase 2.`);
  }

  if (slots_disponibles_fase_2 >= horas_carga_fase_1 && horas_pendientes > 0) {
    const necesitaContiguo = true; // simplifying: check if any course requires > max contiguo
    if (maximo_bloque_contiguo < horas_carga_fase_1) {
      clasificacion = 'BLOQUES_CONTIGUOS_INSUFICIENTES';
      detalles.push(`Máximo bloque contiguo: ${maximo_bloque_contiguo}h. Se necesitan al menos bloques de varias horas.`);
    }
  }

  if (horas_pendientes > 0 && slots_disponibles_fase_2 >= horas_carga_fase_1 && disp.slots_duplicados === 0) {
    const hayVentanasValidas = await hayVentanasValidasIniciales(
      programacionId, docenteId, slots, carga
    );
    if (hayVentanasValidas) {
      clasificacion = 'ALGORITMO_NO_ENCONTRO_SOLUCION';
      detalles.push('Existen ventanas válidas iniciales pero el algoritmo no pudo asignar. Es un problema de orden/ocupación secuencial.');
    }
  }

  if (horas_pendientes === 0) clasificacion = 'OK';

  return {
    docente_id: docenteId, docente_nombre,
    horas_carga_fase_1, slots_disponibles_fase_2,
    maximo_bloque_contiguo, horas_asignadas, horas_pendientes,
    clasificacion, detalles,
  };
}

async function hayVentanasValidasIniciales(
  programacionId: string, docenteId: string, slots: SlotRow[], carga: CargaProgramableDocente
): Promise<boolean> {
  // Simplificación: si hay al menos un curso con duración <= slots disponibles, hay ventanas
  for (const c of carga.cursos) {
    if (c.total_horas <= 0) continue;
    const maxHrsCurso = Math.max(c.horas_teoria, c.horas_practica, c.horas_laboratorio > 0 ? c.horas_laboratorio : 0);
    if (maxHrsCurso <= 0) continue;
    if (slots.length >= maxHrsCurso) return true;
  }
  return false;
}

// Imports from db.ts
// ─── 6. Iteraciones por docente (debug) ─────────────────────────────────────────────────

export interface DebugIteracionDocente {
  iteracion: number;
  carga_total: number;
  carga_asignada: number;
  carga_pendiente: number;
  cursos_completos: number;
  bloques_pendientes: string[];
  mejora: number;
  estrategia: string;
}
