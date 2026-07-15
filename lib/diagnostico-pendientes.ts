/**
 * Diagnóstico detallado de bloques pendientes del resolvedor V2
 * 
 * Para cada bloque pendiente, muestra:
 *   - Ventanas candidatas (día + slots)
 *   - Por qué falla cada ventana (docente/ambiente/grupo ocupado)
 *   - Qué asignaciones ocupan cada ventana
 *   - Si esas asignaciones pueden moverse a otra ubicación
 */

import { SlotRow } from './csp-asignacion';
import { claveBloqueAcademico } from './horarios-resolver-v2';

interface BloqueOcupante {
  asignacion: any;
  puedeMoverse: boolean;
  ventanasAlternativas: { dia: string; slots: number[]; ok: boolean }[];
  razonNoMovible?: string;
}

interface VentanaAnalisis {
  dia: string;
  slots: number[];
  ordenInicio: number;
  ordenFin: number;
  docenteOk: boolean;
  docenteOcupantes: BloqueOcupante[];
  ambienteOk: boolean;
  ambienteOcupantes: BloqueOcupante[];
  grupoOk: boolean;
  grupoOcupantes: BloqueOcupante[];
  bloqueantes: string[];
  resumen: string;
}

interface DiagnosticoDetallado {
  clave_bloque: string;
  curso_codigo: string;
  curso_nombre: string;
  docente_id: string;
  docente_nombre: string;
  grupo: string;
  tipo: string;
  duracion: number;
  total_ventanas: number;
  ventanas: VentanaAnalisis[];
  mejor_ventana: VentanaAnalisis | null;
  mejor_cadena: {
    movimientos: { bloque: string; desde: string; hacia: string }[];
    longitud: number;
    factible: boolean;
  };
}

export async function diagnosticarPendientes(
  pendientes: any[],
  todasLasAsignaciones: any[],
  todosLosBloques: any[],
  slots: SlotRow[],
  ambientes: any[],
  occ: any,
  docAvail: Map<string, Map<string, number>>,
  cursos: any[],
  cspOpts: any,
  DIAS_EXT: string[],
): Promise<DiagnosticoDetallado[]> {
  const diagnosticos: DiagnosticoDetallado[] = [];

  // Index asignaciones by clave_bloque for quick lookup
  const asigPorClave = new Map<string, any>();
  const asigPorDocDiaSlot = new Map<string, any[]>();
  const asigPorAmbDiaSlot = new Map<string, any[]>();
  const asigPorGrupoDiaSlot = new Map<string, any[]>();

  for (const a of todasLasAsignaciones) {
    const ck = a.clave_bloque;
    if (ck) asigPorClave.set(ck, a);
    const keyDoc = `${a.docente_id}-${a.dia}-${a.slot_id}`;
    const keyAmb = `${a.ambiente_id}-${a.dia}-${a.slot_id}`;
    const keyGru = `${a.grupo_id}-${a.dia}-${a.slot_id}`;
    if (!asigPorDocDiaSlot.has(keyDoc)) asigPorDocDiaSlot.set(keyDoc, []);
    asigPorDocDiaSlot.get(keyDoc)!.push(a);
    if (!asigPorAmbDiaSlot.has(keyAmb)) asigPorAmbDiaSlot.set(keyAmb, []);
    asigPorAmbDiaSlot.get(keyAmb)!.push(a);
    if (!asigPorGrupoDiaSlot.has(keyGru)) asigPorGrupoDiaSlot.set(keyGru, []);
    asigPorGrupoDiaSlot.get(keyGru)!.push(a);
  }

  // Docente names
  const docNombres = new Map<string, string>();
  for (const c of cursos) {
    if (c.docente_id && !docNombres.has(c.docente_id)) {
      docNombres.set(c.docente_id, `${c.docente_nombre || ''} ${c.docente_apellidos || ''}`.trim() || c.docente_id);
    }
  }

  // Course names
  const cursoNombres = new Map<string, string>();
  for (const c of cursos) {
    if (c.curso_id && !cursoNombres.has(c.curso_id)) {
      const codigo = c.codigo || '';
      const nombre = (c.nombre || c.curso_nombre || '').substring(0, 40);
      cursoNombres.set(c.curso_id, `${codigo} - ${nombre}`);
    }
  }

  for (const bloque of pendientes) {
    const meta = bloque.units[0]?.meta || {};
    const docenteId = meta.docente_id || '';
    const duracion = bloque.units.length;
    const ck = meta.clave_bloque || claveBloqueAcademico({ ...meta, pc_id: meta.pc_id ?? meta.id });
    const nombreDocente = docNombres.get(docenteId) || docenteId;
    const nombreCurso = cursoNombres.get(meta.curso_id) || meta.codigo || '';

    const ventanas: VentanaAnalisis[] = [];

    for (const dia of DIAS_EXT) {
      for (let si = 0; si <= slots.length - duracion; si++) {
        const slotGroup = slots.slice(si, si + duracion);
        const ordenes = slotGroup.map(s => s.orden);

        const docOcupantes: BloqueOcupante[] = [];
        const ambOcupantes: BloqueOcupante[] = [];
        const grupoOcupantes: BloqueOcupante[] = [];
        const bloqueantes: string[] = [];

        let docenteOk = true;
        for (const s of slotGroup) {
          // Check 1: docente disponibilidad
          const dispDoc = docAvail.get(docenteId);
          const dispKey = `${dia}-${s.id}`;
          const dispVal = dispDoc?.get(dispKey);
          if (!dispDoc || dispVal === undefined || dispVal === null || dispVal === 0) {
            docenteOk = false;
          }
          // Check 2: no other assignment occupies this docente+dia+slot
          const dd = asigPorDocDiaSlot.get(`${docenteId}-${dia}-${s.id}`);
          if (dd?.length) {
            docenteOk = false;
            for (const a of dd) {
              if (!docOcupantes.find(o => o.asignacion.clave_bloque === a.clave_bloque)) {
                docOcupantes.push({
                  asignacion: a,
                  puedeMoverse: false,
                  ventanasAlternativas: [],
                });
              }
            }
          }
        }

        let ambienteOk = true;
        const ambValidos = ambientes.filter(amb => {
          if (meta.tipo_sesion === 'laboratorio') return amb.tipo === 'laboratorio';
          if (meta.tipo_sesion === 'practica') return true;
          return true;
        });
        let alMenosUnAmbiente = false;
        for (const amb of ambValidos) {
          let ambAllOk = true;
          for (const s of slotGroup) {
            const aa = asigPorAmbDiaSlot.get(`${amb.id}-${dia}-${s.id}`);
            if (aa?.length) { ambAllOk = false; break; }
          }
          if (ambAllOk) {
            alMenosUnAmbiente = true;
            break;
          }
        }
        if (!alMenosUnAmbiente) {
          ambienteOk = false;
          for (const amb of ambValidos) {
            for (const s of slotGroup) {
              const aa = asigPorAmbDiaSlot.get(`${amb.id}-${dia}-${s.id}`);
              if (aa?.length) {
                for (const a of aa) {
                  if (!ambOcupantes.find(o => o.asignacion.clave_bloque === a.clave_bloque)) {
                    ambOcupantes.push({
                      asignacion: a,
                      puedeMoverse: false,
                      ventanasAlternativas: [],
                    });
                  }
                }
              }
            }
          }
        }

        let grupoOk = true;
        if (meta.grupo_id) {
          for (const s of slotGroup) {
            const gg = asigPorGrupoDiaSlot.get(`${meta.grupo_id}-${dia}-${s.id}`);
            if (gg?.length) {
              grupoOk = false;
              for (const a of gg) {
                if (!grupoOcupantes.find(o => o.asignacion.clave_bloque === a.clave_bloque)) {
                  grupoOcupantes.push({
                    asignacion: a,
                    puedeMoverse: false,
                    ventanasAlternativas: [],
                  });
                }
              }
            }
          }
        }

        if (!docenteOk) bloqueantes.push('docente');
        if (!ambienteOk) bloqueantes.push('ambiente');
        if (!grupoOk) bloqueantes.push('grupo');

        ventanas.push({
          dia,
          slots: slotGroup.map(s => s.orden),
          ordenInicio: slotGroup[0].orden,
          ordenFin: slotGroup[slotGroup.length - 1].orden,
          docenteOk,
          docenteOcupantes: docOcupantes,
          ambienteOk,
          ambienteOcupantes: ambOcupantes,
          grupoOk,
          grupoOcupantes: grupoOcupantes,
          bloqueantes: [...new Set(bloqueantes)],
          resumen: `${dia} slots[${slotGroup[0].orden}-${slotGroup[slotGroup.length - 1].orden}] (${slotGroup[0].hora_inicio?.substring(0, 5) || '?'}) → ${!docenteOk ? '✗ docente' : ''}${!ambienteOk ? ' ✗ ambiente' : ''}${!grupoOk ? ' ✗ grupo' : ''}${docenteOk && ambienteOk && grupoOk ? '✓ LIBRE' : ''}`,
        });
      }
    }

    // Find best window (first that is completely free)
    const mejorVentana = ventanas.find(v => v.docenteOk && v.ambienteOk && v.grupoOk) || null;

    // Build replacement chain analysis
    let mejorCadena = { movimientos: [], longitud: 0, factible: false } as any;

    if (!mejorVentana && ventanas.length > 0) {
      // Evaluate the window with fewest blockers
      const ventanasOrdenadas = [...ventanas].sort((a, b) => a.bloqueantes.length - b.bloqueantes.length);
      const candidata = ventanasOrdenadas[0];

      // Check if blockers can move
      type Movimiento = { bloque: string; desde: string; hacia: string };
      const movimientos: Movimiento[] = [];
      let factible = true;

      // Analyze docente blocking blocks
      const ocupantesUnicos = new Map<string, BloqueOcupante>();
      for (const o of [...candidata.docenteOcupantes, ...candidata.ambienteOcupantes, ...candidata.grupoOcupantes]) {
        const ck = o.asignacion.clave_bloque;
        if (ck && !ocupantesUnicos.has(ck)) {
          ocupantesUnicos.set(ck, o);
        }
      }

      for (const [ck, ocupante] of ocupantesUnicos) {
        const a = ocupante.asignacion;
        const blockDuracion = a.bloque_total || 1;

        // Check if this block can find another valid window
        let tieneAlternativa = false;
        let mejorAlt = '';

        for (const d of DIAS_EXT) {
          for (let si = 0; si <= slots.length - blockDuracion; si++) {
            const sg = slots.slice(si, si + blockDuracion);
            let altOk = true;
            for (const s of sg) {
              // Check it's not the same window
              if (d === candidata.dia && sg[0].orden >= candidata.ordenInicio && sg[sg.length - 1].orden <= candidata.ordenFin) {
                altOk = false;
                break;
              }
              // Check docente availability
              const dd = asigPorDocDiaSlot.get(`${a.docente_id}-${d}-${s.id}`);
              if (dd?.some((x: any) => x.clave_bloque !== ck)) { altOk = false; break; }
              // Check ambiente
              const aa = asigPorAmbDiaSlot.get(`${a.ambiente_id}-${d}-${s.id}`);
              if (aa?.some((x: any) => x.clave_bloque !== ck)) { altOk = false; break; }
              // Check grupo
              if (a.grupo_id) {
                const gg = asigPorGrupoDiaSlot.get(`${a.grupo_id}-${d}-${s.id}`);
                if (gg?.some((x: any) => x.clave_bloque !== ck)) { altOk = false; break; }
              }
            }
            if (altOk) {
              tieneAlternativa = true;
              mejorAlt = `${d} slots[${sg[0].orden}-${sg[sg.length - 1].orden}]`;
              break;
            }
          }
          if (tieneAlternativa) break;
        }

        if (tieneAlternativa) {
          // This creates a chain: move the blocking block to alt window
          const desde = `${a.dia} slots[${a.slot_orden || '?'}]`;
          movimientos.push({ bloque: `${a.clave_bloque || ck} (${a.curso_codigo || a.curso_id} / ${a.docente_nombre || a.docente_id})`, desde, hacia: mejorAlt });
        } else {
          factible = false;
          ocupante.puedeMoverse = false;
          ocupante.razonNoMovible = 'No tiene ventana alternativa disponible';
        }
      }

      mejorCadena = { movimientos, longitud: movimientos.length, factible };
    }

    diagnosticos.push({
      clave_bloque: ck,
      curso_codigo: meta.codigo || meta.curso_id || '',
      curso_nombre: nombreCurso,
      docente_id: docenteId,
      docente_nombre: nombreDocente,
      grupo: meta.grupo_id || `grupo ${meta.numero_grupo || '?'}`,
      tipo: bloque.tipo_sesion,
      duracion,
      total_ventanas: ventanas.length,
      ventanas,
      mejor_ventana: mejorVentana,
      mejor_cadena: mejorCadena,
    });
  }

  return diagnosticos;
}

export function imprimirDiagnostico(diag: DiagnosticoDetallado, verbose = false): string[] {
  const lines: string[] = [];
  lines.push(`╔══ ${diag.curso_codigo} ${diag.tipo} (${diag.duracion}h) ── ${diag.docente_nombre}`);
  lines.push(`║   Clave: ${diag.clave_bloque}`);
  lines.push(`║   Ventanas totales: ${diag.total_ventanas}`);

  if (diag.mejor_ventana) {
    lines.push(`║   ✓ VENTANA LIBRE: ${diag.mejor_ventana.dia} slots[${diag.mejor_ventana.ordenInicio}-${diag.mejor_ventana.ordenFin}]`);
  } else {
    // Show top 5 windows
    const peores = diag.ventanas.filter(v => v.bloqueantes.length > 0).slice(0, 5);
    for (const v of peores) {
      lines.push(`║   ✗ ${v.dia} [${v.ordenInicio}-${v.ordenFin}]: ${v.bloqueantes.join(', ')}`);
      if (verbose && v.docenteOcupantes.length > 0) {
        for (const o of v.docenteOcupantes) {
          lines.push(`║      Docente ocupado por: ${o.asignacion.clave_bloque || '?'} (${o.asignacion.curso_codigo || o.asignacion.curso_id})`);
        }
      }
    }

    // Chain analysis
    if (diag.mejor_cadena) {
      if (diag.mejor_cadena.factible) {
        lines.push(`║   🔗 Cadena factible (${diag.mejor_cadena.longitud} movimientos):`);
        for (const m of diag.mejor_cadena.movimientos) {
          lines.push(`║      Mover ${m.bloque}`);
          lines.push(`║        ${m.desde} → ${m.hacia}`);
        }
      } else {
        const blockers = diag.ventanas.filter(v => v.bloqueantes.length > 0);
        if (blockers.length > 0) {
          const first = blockers[0];
          const noMovibles = [...first.docenteOcupantes, ...first.ambienteOcupantes, ...first.grupoOcupantes]
            .filter(o => !o.puedeMoverse).slice(0, 3);
          for (const o of noMovibles) {
            lines.push(`║   ✗ Bloqueante no movible: ${o.asignacion.clave_bloque} - ${o.razonNoMovible || 'sin alternativa'}`);
          }
        }
        lines.push(`║   ✗ No hay cadena de reemplazo completa`);
      }
    }
  }

  lines.push(`╚${'═'.repeat(60)}`);
  return lines;
}
