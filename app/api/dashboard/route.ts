import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  // Ciclo activo si no se especifica
  let ciclo: any = null;
  if (ciclo_id) {
    ciclo = await queryOne(`SELECT * FROM ciclos WHERE id = $1`, [ciclo_id]);
  } else {
    ciclo = await queryOne(`SELECT * FROM ciclos WHERE activo = true LIMIT 1`);
  }

  const cid = ciclo?.id;

  const [
    totalDocentes,
    totalCursos,
    totalAmbientes,
    totalAsignaciones,
    globalDoc,
    globalCur,
    globalAmb,
    horasPorCategoria,
    aulasPorTipo,
    ocupacionAmbientes,
    cargaDocentes,
    distribucionDias,
    ciclos,
    slots,
  ] = await Promise.all([
    cid ? queryOne<{count:string}>(`SELECT COUNT(DISTINCT docente_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(`SELECT COUNT(DISTINCT g.curso_id) as count FROM grupos g JOIN programaciones p ON p.id = g.programacion_id WHERE p.ciclo_id = $1`, [cid]) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(`SELECT COUNT(DISTINCT ambiente_id) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),
    cid ? queryOne<{count:string}>(`SELECT COUNT(*) as count FROM asignaciones WHERE ciclo_id = $1 AND estado = 'activo'`, [cid]) : Promise.resolve({count:'0'}),

    queryOne<{count:string}>(`SELECT COUNT(*) as count FROM docentes WHERE activo = true`),
    queryOne<{count:string}>(`SELECT COUNT(*) as count FROM cursos WHERE activo = true`),
    queryOne<{count:string}>(`SELECT COUNT(*) as count FROM ambientes WHERE disponible = true`),

    // Docentes por categoría y condición
    query(`
      SELECT d.categoria, d.condicion, COUNT(DISTINCT d.id) as docentes
      FROM docentes d
      WHERE d.activo = true
      GROUP BY d.categoria, d.condicion
      ORDER BY docentes DESC
    `),

    // Ambientes agrupados por tipo
    query(`
      SELECT a.tipo, COUNT(*)::int as ambientes
      FROM ambientes a
      WHERE a.disponible = true
      GROUP BY a.tipo
      ORDER BY a.tipo
    `),

    // Ocupación de ambientes (% de slots usados)
    cid ? query(`
      SELECT 
        amb.nombre, amb.tipo, amb.codigo,
        COUNT(a.id) as horas_usadas,
        (5 * 14) as total_slots,
        ROUND(COUNT(a.id) * 100.0 / (5 * 14), 1) as porcentaje
      FROM ambientes amb
      LEFT JOIN asignaciones a ON a.ambiente_id = amb.id AND a.ciclo_id = $1 AND a.estado = 'activo'
      WHERE amb.disponible = true
      GROUP BY amb.id, amb.nombre, amb.tipo, amb.codigo
      ORDER BY porcentaje DESC
      LIMIT 12
    `, [cid]) : Promise.resolve([]),

    // Carga horaria por docente (incorporando CHL, CHNL, CHLA)
    cid ? (async () => {
      const [rawCargaDocentes, cargaHorariaList] = await Promise.all([
        query(`
          SELECT 
            d.id,
            d.apellidos || ', ' || d.nombre as nombre,
            d.categoria, d.condicion, d.modalidad, d.horas_max_semana
          FROM docentes d
          WHERE d.activo = true
          ORDER BY d.apellidos ASC, d.nombre ASC
        `),
        query(`SELECT * FROM carga_horaria WHERE ciclo_academico_id = $1`, [cid])
      ]);

      return rawCargaDocentes.map((doc: any) => {
        const chList = cargaHorariaList.filter((ch: any) => ch.docente_id === doc.id);
        const primeraCarga = chList[0];

        let adicional: any = null;
        if (primeraCarga?.adicional) {
          try {
            adicional = typeof primeraCarga.adicional === 'string'
              ? JSON.parse(primeraCarga.adicional)
              : primeraCarga.adicional;
          } catch (e) {}
        }

        const modStr = (adicional?.regimen_dedicacion || doc.modalidad || primeraCarga?.modalidad || '').toString().toUpperCase();
        let horasModalidad = 40;
        const match = modStr.match(/(\d+)\s*H/i);
        if (match) {
          horasModalidad = parseInt(match[1], 10);
        } else if (modStr.includes('DE') || modStr.includes('DEDICACION EXCLUSIVA') || modStr.includes('TC') || modStr.includes('TIEMPO COMPLETO')) {
          horasModalidad = 40;
        } else if (modStr.includes('TP') || modStr.includes('TIEMPO PARCIAL')) {
          horasModalidad = 20;
        } else if (doc.horas_max_semana && doc.horas_max_semana > 0) {
          horasModalidad = doc.horas_max_semana;
        }

        let chl = 0;
        chList.forEach((ch: any) => {
          if (ch.cursos && Array.isArray(ch.cursos)) {
            ch.cursos.forEach((c: any) => {
              const hrsTeo = c.hrs_teo || 0;
              const gTeo = c.teoria_grupos ?? 1;
              const hrsPra = c.hrs_pra || 0;
              const gPra = c.practica_grupos ?? 1;
              const hrsLab = c.hrs_lab || 0;
              const gLab = c.laboratorio_grupos ?? 1;
              chl += (hrsTeo * gTeo) + (hrsPra * gPra) + (hrsLab * gLab);
            });
          }
        });

        let chnl = 0;
        const secKeys = ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'];
        chList.forEach((ch: any) => {
          for (const key of secKeys) {
            const secVal = ch[key];
            if (secVal) {
              if (typeof secVal === 'object' && secVal !== null && 'horas' in secVal) {
                chnl += parseFloat(secVal.horas || '0');
              } else if (Array.isArray(secVal)) {
                secVal.forEach((item: any) => {
                  if (item && item.horas) chnl += parseFloat(item.horas || '0');
                });
              }
            }
          }
        });

        let chla = 0;
        if (adicional) {
          if (adicional.total_horas_adicional) {
            const val = parseFloat(adicional.total_horas_adicional || '0');
            if (val > 0) chla = val;
          } else if (Array.isArray(adicional.cursos)) {
            chla = adicional.cursos.reduce((sum: number, c: any) => sum + parseFloat(c.total_horas || '0'), 0);
          }
        }

        const horasColocadas = chl + chnl;
        const porcentajeCarga = horasModalidad > 0 ? Math.round((horasColocadas * 100) / horasModalidad) : 0;

        return {
          id: doc.id,
          nombre: doc.nombre,
          categoria: doc.categoria,
          condicion: doc.condicion,
          modalidad: modStr,
          chl,
          chnl,
          chla,
          horas_colocadas: horasColocadas,
          horas_asignadas: horasColocadas,
          horas_max_semana: horasModalidad,
          horas_modalidad: horasModalidad,
          porcentaje_carga: porcentajeCarga,
        };
      }).sort((a: any, b: any) => (b.porcentaje_carga || 0) - (a.porcentaje_carga || 0));
    })() : Promise.resolve([]),

    // Distribución por día
    cid ? query(`
      SELECT dia, COUNT(*) as cantidad
      FROM asignaciones
      WHERE ciclo_id = $1 AND estado = 'activo'
      GROUP BY dia
      ORDER BY CASE dia WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3 WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6 END
    `, [cid]) : Promise.resolve([]),

    query(`SELECT * FROM ciclos ORDER BY año DESC, semestre`),
    query(`SELECT * FROM slots_tiempo ORDER BY orden`),
  ]);

  return NextResponse.json({
    ciclo,
    ciclos,
    slots,
    stats: {
      totalDocentes: parseInt(totalDocentes?.count || '0'),
      totalCursos: parseInt(totalCursos?.count || '0'),
      totalAmbientes: parseInt(totalAmbientes?.count || '0'),
      totalAsignaciones: parseInt((totalAsignaciones as any)?.count || '0'),
      globalDocentes: parseInt((globalDoc as any)?.count || '0'),
      globalCursos: parseInt((globalCur as any)?.count || '0'),
      globalAmbientes: parseInt((globalAmb as any)?.count || '0'),
    },
    docentesPorCategoria: horasPorCategoria,
    aulasPorTipo,
    ocupacionAmbientes,
    cargaDocentes,
    distribucionDias,
  });
}
