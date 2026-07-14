import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: programacion_id } = await params;

  try {
    // Leer el archivo CSV desde el directorio csvs
    const csvPath = join(process.cwd(), 'csvs', 'cursos2026I-REAL.csv');
    const csvContent = await readFile(csvPath, 'utf-8');
    
    const rows = csvContent.split('\n').filter(r => r.trim());
    const header = rows[0].split(',').map(c => c.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
    const data = rows.slice(1).map(row => {
      const values = row.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      header.forEach((h, i) => obj[h] = values[i] || '');
      return obj;
    });

    const result = await transaction(async (client) => {
      // Obtener el ciclo_id y config de la programación
      const progResult = await client.query('SELECT ciclo_id, config FROM programaciones WHERE id = $1', [programacion_id]);
      if (progResult.rows.length === 0) {
        throw new Error('Programación no encontrada');
      }
      const ciclo_id = progResult.rows[0].ciclo_id;
      // 🗑️ Eliminar datos previos para importar fresco
      const existingConfig = {};
      await client.query('DELETE FROM asignaciones WHERE ciclo_id = $1', [ciclo_id]);
      await client.query('DELETE FROM programacion_cursos WHERE programacion_id = $1', [programacion_id]);
      await client.query('DELETE FROM grupos WHERE programacion_id = $1', [programacion_id]);

      // Mapeo de Docentes (DNI -> ID y nombre completo)
      const docentes = await client.query('SELECT id, dni, nombre, apellidos FROM docentes');
      const mapDocentes: Record<string, { id: string; nombre: string; apellidos: string }> = {};
      docentes.rows.forEach((d: any) => mapDocentes[d.dni] = { id: d.id, nombre: d.nombre, apellidos: d.apellidos });

      // Mapeo de Cursos (CODIGO -> ID, nombre, ciclo_plan)
      const cursos = await client.query('SELECT id, codigo, nombre, ciclo_plan FROM cursos');
      const mapCursos: Record<string, { id: string; nombre: string; ciclo_plan: number }> = {};
      cursos.rows.forEach((c: any) => mapCursos[c.codigo] = { id: c.id, nombre: c.nombre, ciclo_plan: c.ciclo_plan });

      // Mapeo de Slots (HORA -> ID)
      const slots = await client.query('SELECT id, hora_inicio FROM slots_tiempo');
      const mapSlots: Record<string, string> = {};
      slots.rows.forEach((s: any) => {
        const horaStr = s.hora_inicio.substring(0, 5); // '07:00'
        mapSlots[horaStr] = s.id;
      });

      // Obtener todos los ambientes agrupados por tipo
      const ambientesResult = await client.query('SELECT id, codigo, nombre, tipo FROM ambientes');
      console.log(`[IMPORT] Ambientes encontrados: ${ambientesResult.rows.length}`);
      const ambientesByType: Record<string, any[]> = { aula: [], laboratorio: [], auditorio: [] };
      ambientesResult.rows.forEach((a: any) => {
        const t = a.tipo || 'aula';
        if (!ambientesByType[t]) ambientesByType[t] = [];
        ambientesByType[t].push(a);
      });
      console.log(`[IMPORT] Ambientes por tipo: aula=${ambientesByType['aula']?.length || 0}, lab=${ambientesByType['laboratorio']?.length || 0}`);

      let insertadas = 0;
      let gruposCreados = 0;
      let debugAsignaciones = 0;
      let debugSinAmbiente = 0;
      const nuevasAsignaciones: any[] = [];

      for (const r of data) {
        // r = { CICLO, CODIGO, CURSO, GRUPO, DOCENTE, T, P, L, C, DIA, HORA_INICIO }
        const codigo = r['CODIGO'];
        const grupoStr = r['GRUPO'];
        const dni = r['DOCENTE'];
        const horasTeoria = parseInt(r['T']) || 0;
        const horasPractica = parseInt(r['P']) || 0;
        const horasLaboratorio = parseInt(r['L']) || 0;
        const horasConsejeria = parseInt(r['C']) || 0;
        const dia = r['DIA']?.toLowerCase();
        const horaInicio = r['HORA_INICIO'];

        const cursoId = mapCursos[codigo]?.id;
        const docenteData = mapDocentes[dni];
        const docenteId = docenteData?.id;

        if (!cursoId) {
          console.warn(`Curso no encontrado: ${codigo}`);
          continue;
        }
        if (!docenteId) {
          console.warn(`Docente no encontrado con DNI: ${dni} para curso ${codigo}`);
          continue;
        }

        // Extraer número de grupo y tipo
        // Formato: "G1 (Teoria)", "G1 (Practica)", "G1 (Laboratorio)", "G2 (Teoria)", "G1 (Teoria y Practica)", etc.
        const grupoMatch = grupoStr.match(/G(\d+)\s*\((.+)\)/i);
        if (!grupoMatch) {
          console.warn(`Formato de grupo inválido: ${grupoStr}`);
          continue;
        }

        const numeroGrupo = parseInt(grupoMatch[1]);
        const tipoSesionRaw = grupoMatch[2].toLowerCase(); // 'teoria', 'practica', 'laboratorio', 'teoria y practica'

        // Determinar tipo de sesión para la base de datos y horas totales
        let tipoSesionDb: 'teoria' | 'practica' | 'laboratorio' = 'teoria';
        let horasTotales = 0;
        let esBloqueCombinado = false;

        if (tipoSesionRaw.includes('teoria') && tipoSesionRaw.includes('practica')) {
          // Caso especial: "Teoria y Practica" - bloque combinado
          esBloqueCombinado = true;
          tipoSesionDb = 'teoria'; // Usamos teoria como tipo principal
          horasTotales = horasTeoria + horasPractica; // Suma de ambas
        } else if (tipoSesionRaw.includes('teoria')) {
          tipoSesionDb = 'teoria';
          horasTotales = horasTeoria;
        } else if (tipoSesionRaw.includes('practica')) {
          tipoSesionDb = 'practica';
          horasTotales = horasPractica;
        } else if (tipoSesionRaw.includes('laboratorio')) {
          tipoSesionDb = 'laboratorio';
          horasTotales = horasLaboratorio;
        }

        // Buscar o crear el grupo
        let grupoId: string;
        const existingGrupo = await client.query(
          'SELECT id FROM grupos WHERE programacion_id = $1 AND curso_id = $2 AND numero_grupo = $3',
          [programacion_id, cursoId, numeroGrupo]
        );

        if (existingGrupo.rows.length > 0) {
          grupoId = existingGrupo.rows[0].id;
        } else {
          const newGrupo = await client.query(
            `INSERT INTO grupos (programacion_id, curso_id, numero_grupo, max_alumnos, num_alumnos)
             VALUES ($1, $2, $3, 40, 0)
             RETURNING id`,
            [programacion_id, cursoId, numeroGrupo]
          );
          grupoId = newGrupo.rows[0].id;
          gruposCreados++;
        }

        // Verificar si ya existe programacion_curso para este grupo, docente y tipo
        const existingPc = await client.query(
          `SELECT id FROM programacion_cursos 
           WHERE programacion_id = $1 AND grupo_id = $2 AND docente_id = $3`,
          [programacion_id, grupoId, docenteId]
        );

        if (existingPc.rows.length > 0) {
          // Actualizar existente
          await client.query(
            `UPDATE programacion_cursos 
             SET horas_teoria = horas_teoria + $1,
                 horas_practica = horas_practica + $2,
                 horas_laboratorio = COALESCE(horas_laboratorio, 0) + $3,
                 horas_consejeria = COALESCE(horas_consejeria, 0) + $4
             WHERE id = $5`,
            [horasTeoria, horasPractica, horasLaboratorio, horasConsejeria, existingPc.rows[0].id]
          );
        } else {
          // Insertar nuevo
          await client.query(
            `INSERT INTO programacion_cursos 
              (programacion_id, curso_id, grupo_id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [programacion_id, cursoId, grupoId, docenteId, horasTeoria, horasPractica, horasLaboratorio, horasConsejeria]
          );
        }
        insertadas++;

        // Si hay día y hora, crear asignaciones según las horas
        if (dia && horaInicio) {
          const slotId = mapSlots[horaInicio];
          if (!slotId) {
            console.warn(`Slot no encontrado para hora: ${horaInicio}`);
            continue;
          }

          // Validar día
          const diasValidos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
          if (!diasValidos.includes(dia)) {
            console.warn(`Día inválido: ${dia}`);
            continue;
          }

          if (horasTotales > 0) {
            // Determinar tipo de ambiente según sesión
            let tipoAmbienteNeeded = 'aula';
            if (tipoSesionDb === 'laboratorio') {
              tipoAmbienteNeeded = 'laboratorio';
            }

            const ambientesDisponibles = ambientesByType[tipoAmbienteNeeded] || ambientesByType['aula'] || [];
            if (ambientesDisponibles.length === 0) {
              console.warn(`[IMPORT] No hay ambientes de tipo ${tipoAmbienteNeeded} para ${codigo} ${grupoStr} (${dia} ${horaInicio})`);
              debugSinAmbiente++;
              continue;
            }

            // Calcular slots consecutivos
            const slotIndex = slots.rows.findIndex((s: any) => s.id === slotId);
            if (slotIndex === -1) {
              console.warn(`Slot index no encontrado para: ${slotId}`);
              continue;
            }

            const targetSlotIds: string[] = [];
            for (let i = 0; i < horasTotales; i++) {
              const idx = slotIndex + i;
              if (idx >= slots.rows.length) {
                console.warn(`Slot index ${idx} fuera de rango para ${horasTotales} horas`);
                break;
              }
              targetSlotIds.push(slots.rows[idx].id);
            }

            if (targetSlotIds.length === 0) continue;

            // Buscar un ambiente libre para TODOS los slots consecutivos
            let selectedAmbiente: any = null;
            for (const amb of ambientesDisponibles) {
              const conflictCheck = await client.query(
                `SELECT COUNT(*) as cnt FROM asignaciones
                 WHERE ambiente_id = $1 AND dia = $2 AND slot_id = ANY($3) AND ciclo_id = $4 AND estado = 'activo'`,
                [amb.id, dia, targetSlotIds, ciclo_id]
              );
              if (parseInt(conflictCheck.rows[0].cnt) === 0) {
                selectedAmbiente = amb;
                break;
              }
            }

            if (!selectedAmbiente) {
              console.warn(`[IMPORT] No hay ambiente libre para ${codigo} ${grupoStr} en ${dia} ${horaInicio} (${horasTotales}h). Ambientes disponibles: ${ambientesDisponibles.length}`);
              continue;
            }

            // Crear asignaciones para cada hora consecutiva
            for (const targetSlotId of targetSlotIds) {
              // Verificar las 3 restricciones de unicidad por separado
              const conflictCheck = await client.query(
                `SELECT COUNT(*) as cnt FROM asignaciones 
                 WHERE dia = $1 AND slot_id = $2 AND ciclo_id = $3 AND estado = 'activo'
                 AND (docente_id = $4 OR grupo_id = $5 OR ambiente_id = $6)`,
                [dia, targetSlotId, ciclo_id, docenteId, grupoId, selectedAmbiente.id]
              );

              if (parseInt(conflictCheck.rows[0].cnt) > 0) {
                debugAsignaciones++;
                continue;
              }

              const insertResult = await client.query(
                `INSERT INTO asignaciones 
                  (ciclo_id, grupo_id, docente_id, ambiente_id, slot_id, dia, tipo, estado, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo', $8)
                 RETURNING id`,
                [ciclo_id, grupoId, docenteId, selectedAmbiente.id, targetSlotId, dia, tipoSesionDb, session.id]
              );

              nuevasAsignaciones.push({
                id: insertResult.rows[0].id,
                ciclo_id,
                grupo_id: grupoId,
                docente_id: docenteId,
                ambiente_id: selectedAmbiente.id,
                ambiente_codigo: selectedAmbiente.codigo,
                ambiente_nombre: selectedAmbiente.nombre,
                ambiente_tipo: selectedAmbiente.tipo || tipoAmbienteNeeded,
                slot_id: targetSlotId,
                dia,
                tipo: tipoSesionDb,
                estado: 'activo',
                curso_id: cursoId,
                curso_codigo: codigo,
                curso_nombre: r['CURSO'],
                numero_grupo: numeroGrupo,
                docente_nombre: `${docenteData.nombre} ${docenteData.apellidos}`,
                ciclo_plan: mapCursos[codigo]?.ciclo_plan || 1,
              });
            }
          }
        }
      }

      // Actualizar config de la programación con las nuevas asignaciones
      const updatedConfig = {
        ...existingConfig,
        asignaciones: nuevasAsignaciones
      };

      await client.query(
        'UPDATE programaciones SET config = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updatedConfig), programacion_id]
      );

      console.log(`[IMPORT] Resumen: ${insertadas} cursos, ${gruposCreados} grupos, ${nuevasAsignaciones.length} asignaciones. Debug: sinAmbiente=${debugSinAmbiente}, conflictos=${debugAsignaciones}`);
      return { insertadas, gruposCreados, asignacionesCreadas: nuevasAsignaciones.length, debug: { sinAmbiente: debugSinAmbiente, conflictos: debugAsignaciones } };
    });

    return NextResponse.json({ 
      success: true, 
      message: `Importados ${result.insertadas} registros de cursos. Grupos creados: ${result.gruposCreados}. Asignaciones creadas: ${result.asignacionesCreadas}.` 
    });
  } catch (error: any) {
    console.error('Error importar cursos 2026-I:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
