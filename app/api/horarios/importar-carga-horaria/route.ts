import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { transaction } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id, ciclo_academico_id, ciclo_plans } = await req.json();
    if (!programacion_id) {
      return NextResponse.json({ error: 'Se requiere programacion_id' }, { status: 400 });
    }
    if (!ciclo_academico_id) {
      return NextResponse.json({ error: 'Se requiere ciclo_academico_id (período origen)' }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      // Get programacion info
      const prog = await client.query(
        'SELECT id, nombre FROM programaciones WHERE id = $1',
        [programacion_id]
      );
      if (!prog.rows.length) throw new Error('Programación no encontrada');

      // Find carga_horaria records for this ciclo, optionally filtered by ciclo_plan
      let cargaQuery = `
        SELECT ch.id, ch.docente_id, ch.ciclo_plan,
               d.nombre as docente_nombre, d.apellidos as docente_apellidos
        FROM carga_horaria ch
        JOIN docentes d ON ch.docente_id = d.id
        WHERE ch.ciclo_academico_id = $1 AND ch.activo = true
      `;
      const cargaParams: any[] = [ciclo_academico_id];
      if (ciclo_plans && Array.isArray(ciclo_plans) && ciclo_plans.length > 0) {
        cargaQuery += ` AND ch.ciclo_plan = ANY($2)`;
        cargaParams.push(ciclo_plans);
      }
      cargaQuery += ` ORDER BY ch.ciclo_plan, d.apellidos, d.nombre`;

      const cargaHorariaList = await client.query(cargaQuery, cargaParams);

      // Prevent duplicate inserts for same (programacion_id, grupo_id, docente_id)
      const insertCache = new Set<string>();

      // Track max group number per (curso_id, tipo_actividad) so we can assign sequential groups across docentes
      const maxGrupoPorActividad: Record<string, number> = {};
      function getNumEnSecuencia(cursoId: string, tipo: string, base: number): number {
        const key = `${cursoId}-${tipo}`;
        if (!maxGrupoPorActividad[key]) maxGrupoPorActividad[key] = base;
        else maxGrupoPorActividad[key]++;
        return maxGrupoPorActividad[key];
      }

      const cacheGrupos: Record<string, string> = {};
      let gruposCreados = 0;
      let cursosAsignados = 0;
      const docentesSet = new Set<string>();

      for (const ch of cargaHorariaList.rows) {
        docentesSet.add(ch.docente_id);

        const cursos = await client.query(`
          SELECT chc.*, c.nombre as curso_nombre, c.codigo as curso_codigo,
                 c.horas_teoria as curso_hrs_teoria, c.horas_practica as curso_hrs_practica,
                 c.horas_laboratorio as curso_hrs_laboratorio
          FROM carga_horaria_cursos chc
          JOIN cursos c ON chc.curso_id = c.id
          WHERE chc.carga_horaria_id = $1
        `, [ch.id]);

        for (const curso of cursos.rows) {
          const hrs_teo_raw = parseInt(curso.hrs_teo);
          const hrs_pra_raw = parseInt(curso.hrs_pra);
          const hrs_lab_raw = parseInt(curso.hrs_lab);
          const hrs_teo = !isNaN(hrs_teo_raw) ? hrs_teo_raw : (parseInt(curso.curso_hrs_teoria) || 0);
          const hrs_pra = !isNaN(hrs_pra_raw) ? hrs_pra_raw : (parseInt(curso.curso_hrs_practica) || 0);
          const hrs_lab = !isNaN(hrs_lab_raw) ? hrs_lab_raw : (parseInt(curso.curso_hrs_laboratorio) || 0);
          const seccion = curso.seccion || 'A';
          const matchNum = seccion.match(/^(\d+)/);
          const baseGrupo = matchNum ? parseInt(matchNum[1]) : 1;
          const numAlumnos = curso.num_alumnos || 40;

          const tG_raw = parseInt(curso.teoria_grupos);
          const pG_raw = parseInt(curso.practica_grupos);
          const lG_raw = parseInt(curso.laboratorio_grupos);
          const tG = !isNaN(tG_raw) ? tG_raw : (hrs_teo > 0 ? 1 : 0);
          const pG = !isNaN(pG_raw) ? pG_raw : (hrs_pra > 0 ? 1 : 0);
          const lG = !isNaN(lG_raw) ? lG_raw : (hrs_lab > 0 ? 1 : 0);

          // Usar la referencia del curso (cursos.horas_teoria/practica/laboratorio) como valor por grupo.
          // En este sistema, cursos.horas_* ya son valores semanales por grupo,
          // validados por programacion_cursos (ver crear/page.tsx:566).
          const perTeo = parseInt(curso.curso_hrs_teoria) || 0;
          const perPra = parseInt(curso.curso_hrs_practica) || 0;
          const perLab = parseInt(curso.curso_hrs_laboratorio) || 0;

          // ── DEBUG: mostrar valores ──
          const cargaTeo = parseInt(curso.hrs_teo) || 0;
          const cargaPra = parseInt(curso.hrs_pra) || 0;
          const cargaLab = parseInt(curso.hrs_lab) || 0;
          console.log(`\n━━━ ${ch.docente_nombre} ${ch.docente_apellidos} | ${curso.curso_codigo} - ${curso.curso_nombre} ━━━`);
          console.log(`  SECCIÓN: ${seccion} (baseGrupo=${baseGrupo})`);
          console.log(`  Carga horas → T=${cargaTeo}h  P=${cargaPra}h  L=${cargaLab}h`);
          console.log(`  Curso ref   → T=${perTeo}h  P=${perPra}h  L=${perLab}h`);
          console.log(`  Grupos      → tG=${tG}  pG=${pG}  lG=${lG}`);
          if (cargaTeo !== perTeo) console.log(`  ⚠️ hrs_teo difiere de curso.horas_teoria (${cargaTeo} vs ${perTeo}) — se usó la referencia del curso`);

          // --- TEORIA ---
          for (let g = 0; g < tG; g++) {
            const ng = getNumEnSecuencia(curso.curso_id, 'teoria', baseGrupo + g);
            const keyGrupo = `${curso.curso_id}-teoria-${ng}`;
            let grupoId = cacheGrupos[keyGrupo];

            if (!grupoId) {
              const existing = await client.query(
                `SELECT id FROM grupos WHERE programacion_id=$1 AND curso_id=$2 AND tipo_actividad=$3 AND numero_grupo=$4`,
                [programacion_id, curso.curso_id, 'teoria', ng]
              );
              grupoId = existing.rows[0]?.id;
            }
            if (!grupoId) {
              const inserted = await client.query(
                `INSERT INTO grupos (programacion_id,curso_id,tipo_actividad,numero_grupo,max_alumnos,num_alumnos)
                 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
                [programacion_id, curso.curso_id, 'teoria', ng, numAlumnos, numAlumnos]
              );
              grupoId = inserted.rows[0]?.id;
            }
            if (!grupoId) {
              const retry = await client.query(
                `SELECT id FROM grupos WHERE programacion_id=$1 AND curso_id=$2 AND tipo_actividad=$3 AND numero_grupo=$4`,
                [programacion_id, curso.curso_id, 'teoria', ng]
              );
              grupoId = retry.rows[0]?.id;
            }
            if (!grupoId) continue;
            cacheGrupos[keyGrupo] = grupoId;
            gruposCreados++;

            const existingPc = await client.query(
              `SELECT id FROM programacion_cursos WHERE programacion_id=$1 AND grupo_id=$2 AND docente_id=$3`,
              [programacion_id, grupoId, ch.docente_id]
            );
            if (!existingPc.rows.length) {
              await client.query(
                `INSERT INTO programacion_cursos (programacion_id,curso_id,grupo_id,docente_id,horas_teoria,horas_practica,horas_laboratorio,horas_consejeria,seccion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
                [programacion_id, curso.curso_id, grupoId, ch.docente_id, perTeo, 0, 0, 0, seccion]
              );
            }
            cursosAsignados++;
          }

          // --- PRACTICA ---
          for (let g = 0; g < pG; g++) {
            const ng = getNumEnSecuencia(curso.curso_id, 'practica', 1 + g);
            const keyGrupo = `${curso.curso_id}-practica-${ng}`;
            let grupoId = cacheGrupos[keyGrupo];

            if (!grupoId) {
              const existing = await client.query(
                `SELECT id FROM grupos WHERE programacion_id=$1 AND curso_id=$2 AND tipo_actividad=$3 AND numero_grupo=$4`,
                [programacion_id, curso.curso_id, 'practica', ng]
              );
              grupoId = existing.rows[0]?.id;
            }
            if (!grupoId) {
              const inserted = await client.query(
                `INSERT INTO grupos (programacion_id,curso_id,tipo_actividad,numero_grupo,max_alumnos,num_alumnos)
                 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
                [programacion_id, curso.curso_id, 'practica', ng, numAlumnos, numAlumnos]
              );
              grupoId = inserted.rows[0]?.id;
            }
            if (!grupoId) {
              const retry = await client.query(
                `SELECT id FROM grupos WHERE programacion_id=$1 AND curso_id=$2 AND tipo_actividad=$3 AND numero_grupo=$4`,
                [programacion_id, curso.curso_id, 'practica', ng]
              );
              grupoId = retry.rows[0]?.id;
            }
            if (!grupoId) continue;
            cacheGrupos[keyGrupo] = grupoId;
            gruposCreados++;

            const existingPc = await client.query(
              `SELECT id FROM programacion_cursos WHERE programacion_id=$1 AND grupo_id=$2 AND docente_id=$3`,
              [programacion_id, grupoId, ch.docente_id]
            );
            if (!existingPc.rows.length) {
              await client.query(
                `INSERT INTO programacion_cursos (programacion_id,curso_id,grupo_id,docente_id,horas_teoria,horas_practica,horas_laboratorio,horas_consejeria,seccion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
                [programacion_id, curso.curso_id, grupoId, ch.docente_id, 0, perPra, 0, 0, seccion]
              );
            }
            cursosAsignados++;
          }

          // --- LABORATORIO ---
          for (let g = 0; g < lG; g++) {
            const ng = getNumEnSecuencia(curso.curso_id, 'laboratorio', 1 + g);
            const keyGrupo = `${curso.curso_id}-laboratorio-${ng}`;
            let grupoId = cacheGrupos[keyGrupo];

            if (!grupoId) {
              const existing = await client.query(
                `SELECT id FROM grupos WHERE programacion_id=$1 AND curso_id=$2 AND tipo_actividad=$3 AND numero_grupo=$4`,
                [programacion_id, curso.curso_id, 'laboratorio', ng]
              );
              grupoId = existing.rows[0]?.id;
            }
            if (!grupoId) {
              const inserted = await client.query(
                `INSERT INTO grupos (programacion_id,curso_id,tipo_actividad,numero_grupo,max_alumnos,num_alumnos)
                 VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
                [programacion_id, curso.curso_id, 'laboratorio', ng, numAlumnos, numAlumnos]
              );
              grupoId = inserted.rows[0]?.id;
            }
            if (!grupoId) {
              const retry = await client.query(
                `SELECT id FROM grupos WHERE programacion_id=$1 AND curso_id=$2 AND tipo_actividad=$3 AND numero_grupo=$4`,
                [programacion_id, curso.curso_id, 'laboratorio', ng]
              );
              grupoId = retry.rows[0]?.id;
            }
            if (!grupoId) continue;
            cacheGrupos[keyGrupo] = grupoId;
            gruposCreados++;

            const existingPc = await client.query(
              `SELECT id FROM programacion_cursos WHERE programacion_id=$1 AND grupo_id=$2 AND docente_id=$3`,
              [programacion_id, grupoId, ch.docente_id]
            );
            if (!existingPc.rows.length) {
              await client.query(
                `INSERT INTO programacion_cursos (programacion_id,curso_id,grupo_id,docente_id,horas_teoria,horas_practica,horas_laboratorio,horas_consejeria,seccion)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
                [programacion_id, curso.curso_id, grupoId, ch.docente_id, 0, 0, perLab, 0, seccion]
              );
            }
            cursosAsignados++;
          }
        }
      }

      return { gruposCreados, cursosAsignados, docentesImportados: docentesSet.size };
    });

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'GENERATE_SCHEDULE',
      tabla_afectada: 'programaciones',
      registro_id: programacion_id,
      descripcion: `Importación desde Carga Horaria a programación ${programacion_id}: ${result.gruposCreados} grupos, ${result.cursosAsignados} cursos, ${result.docentesImportados} docentes`,
    });

    return NextResponse.json({
      success: true,
      message: `Importación completada: ${result.gruposCreados} grupos creados, ${result.cursosAsignados} cursos asignados, ${result.docentesImportados} docentes.`,
      data: result
    });
  } catch (error: any) {
    console.error('Error al importar carga horaria:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
