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
    const { programacion_id } = await req.json();
    if (!programacion_id) {
      return NextResponse.json({ error: 'Se requiere programacion_id' }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      // Get programacion info
      const prog = await client.query(
        'SELECT id, ciclo_id, nombre FROM programaciones WHERE id = $1',
        [programacion_id]
      );
      if (!prog.rows.length) throw new Error('Programación no encontrada');
      const { ciclo_id } = prog.rows[0];

      // Find all carga_horaria records for this ciclo
      const cargaHorariaList = await client.query(`
        SELECT ch.id, ch.docente_id, ch.ciclo_plan,
               d.nombre as docente_nombre, d.apellidos as docente_apellidos
        FROM carga_horaria ch
        JOIN docentes d ON ch.docente_id = d.id
        WHERE ch.ciclo_academico_id = $1 AND ch.activo = true
        ORDER BY ch.ciclo_plan, d.apellidos, d.nombre
      `, [ciclo_id]);

      console.log('\n========== DEBUG IMPORTACIÓN CARGA HORARIA ==========');
      console.log(`Programación: ${prog.rows[0].nombre} (${programacion_id})`);
      console.log(`Ciclo ID: ${ciclo_id}`);
      console.log(`Docentes encontrados: ${cargaHorariaList.rows.length}`);
      console.log('=====================================================\n');

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

          // ── DEBUG: mostrar valores crudos vs. corregidos ──
          const hrs_teo_per = tG > 0 ? hrs_teo / tG : hrs_teo;
          const hrs_pra_per = pG > 0 ? hrs_pra / pG : hrs_pra;
          const hrs_lab_per = lG > 0 ? hrs_lab / lG : hrs_lab;

          console.log(`\n━━━ ${ch.docente_nombre} ${ch.docente_apellidos} | ${curso.curso_codigo} - ${curso.curso_nombre} ━━━`);
          console.log(`  SECCIÓN: ${seccion} (baseGrupo=${baseGrupo})`);
          console.log(`  DB raw → T=${curso.hrs_teo}(${hrs_teo})  P=${curso.hrs_pra}(${hrs_pra})  L=${curso.hrs_lab}(${hrs_lab})`);
          console.log(`  Grupos → tG=${tG}  pG=${pG}  lG=${lG}`);
          console.log(`  Per-group correct → T=${hrs_teo_per}  P=${hrs_pra_per}  L=${hrs_lab_per}`);
          if (tG > 0 && !isNaN(tG_raw)) console.log(`  → Teoria: ${tG} grupo(s) × ${(hrs_teo/tG).toFixed(1)}h = ${hrs_teo}h total`);
          if (lG > 0 && !isNaN(lG_raw)) console.log(`  → Lab: ${lG} grupo(s) × ${(hrs_lab/lG).toFixed(1)}h = ${hrs_lab}h total`);

          // Usar valores PER-GRUPO (divididos por cantidad de grupos)
          const perTeo = tG > 0 ? Math.round(hrs_teo / tG) : hrs_teo;
          const perPra = pG > 0 ? Math.round(hrs_pra / pG) : hrs_pra;
          const perLab = lG > 0 ? Math.round(hrs_lab / lG) : hrs_lab;

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

      console.log('\n========== FIN DEBUG ==========');
      console.log(`Grupos creados: ${gruposCreados}, Cursos asignados: ${cursosAsignados}, Docentes: ${docentesSet.size}`);
      console.log('================================\n');

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
