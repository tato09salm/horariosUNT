import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { getCargaAdicionalDocente } from '@/lib/horarios';

async function getCargaHorariaBlocks(docenteId: string, cicloId: string): Promise<any[]> {
  try {
    const rows = await query(`
      SELECT chc.horario_slots, c.codigo AS curso_codigo, c.nombre AS curso_nombre
      FROM carga_horaria_cursos chc
      JOIN carga_horaria ch ON ch.id = chc.carga_horaria_id
      JOIN cursos c ON c.id = chc.curso_id
      WHERE ch.docente_id = $1 AND ch.ciclo_academico_id = $2 AND ch.activo = true
        AND chc.horario_slots IS NOT NULL
    `, [docenteId, cicloId]);

    const blocks: any[] = [];
    for (const row of rows) {
      let slots: any[];
      try {
        slots = typeof row.horario_slots === 'string' ? JSON.parse(row.horario_slots) : row.horario_slots;
      } catch { continue; }
      if (!Array.isArray(slots)) continue;
      for (const slot of slots) {
        if (slot.dia && (slot.hora !== undefined || slot.hora_inicio)) {
          const horaNum = typeof slot.hora === 'number' ? slot.hora : parseInt(String(slot.hora || slot.hora_inicio).split(':')[0], 10);
          if (Number.isNaN(horaNum)) continue;
          blocks.push({
            dia: slot.dia,
            hora_inicio: `${String(horaNum).padStart(2, '0')}:00`,
            hora_fin: `${String(horaNum + 1).padStart(2, '0')}:00`,
            tipo: 'carga_lectiva',
            curso_codigo: row.curso_codigo,
            curso_nombre: row.curso_nombre,
          });
        }
      }
    }
    return blocks;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  if (!ciclo_id) return NextResponse.json({ error: 'ciclo_id requerido' }, { status: 400 });

  try {
    // Get programaciones for this ciclo
    const progs = await query(`
      SELECT * FROM programaciones WHERE ciclo_id = $1 AND estado IN ('publicado', 'borrador') ORDER BY created_at DESC LIMIT 1
    `, [ciclo_id]);
    if (progs.length > 0) {
      const prog = progs[0];

      // Parse config in case it's stored as string (JSONB edge case)
      let config: any = prog.config;
      if (typeof config === 'string') {
        try { config = JSON.parse(config); } catch { config = {}; }
      }

      // First try: use asignaciones table
      let asignaciones = await query(`
        SELECT 
          a.*,
          g.numero_grupo,
          g.curso_id,
          c.nombre AS curso_nombre,
          c.codigo AS curso_codigo,
          amb.nombre AS ambiente_nombre,
          amb.codigo AS ambiente_codigo,
          amb.tipo AS ambiente_tipo,
          s.hora_inicio,
          s.hora_fin
        FROM asignaciones a
        LEFT JOIN grupos g ON g.id = a.grupo_id
        LEFT JOIN cursos c ON c.id = g.curso_id
        LEFT JOIN ambientes amb ON amb.id = a.ambiente_id
        LEFT JOIN slots_tiempo s ON s.id = a.slot_id
        WHERE a.ciclo_id = $1 AND a.docente_id = $2 AND a.estado = 'activo'
      `, [ciclo_id, id]);

      const adicionales = await getCargaAdicionalDocente(id, ciclo_id);

      // Also load blocks from carga_horaria_cursos (teaching load)
      const cargaHorariaBlocks = await getCargaHorariaBlocks(id, ciclo_id);

      if (asignaciones.length > 0) {
        return NextResponse.json({ data: [...asignaciones, ...adicionales, ...cargaHorariaBlocks] });
      }

      // Second try: use programacion.config.asignaciones
      if (config && config.asignaciones) {
        const configAsignaciones = config.asignaciones.filter((a: any) => a.docente_id === id);
        // Get slots to map times
        const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
        const slotsMap = new Map(slots.map((s: any) => [s.id, s]));
        const slotsTimeMap = new Map(
          (slots || []).map((s: any) => [
            `${(s.hora_inicio || '').substring(0, 5)}-${(s.hora_fin || '').substring(0, 5)}`,
            s
          ])
        );
        const mappedAsignaciones = configAsignaciones.map((a: any) => {
          let slot = slotsMap.get(a.slot_id);
          if (!slot && a.hora_inicio && a.hora_fin) {
            const timeKey = `${(a.hora_inicio || '').substring(0, 5)}-${(a.hora_fin || '').substring(0, 5)}`;
            slot = slotsTimeMap.get(timeKey);
          }
          return {
            ...a,
            hora_inicio: slot?.hora_inicio || a.hora_inicio || '',
            hora_fin: slot?.hora_fin || a.hora_fin || '',
            ciclo_nombre: '',
          };
        });
        return NextResponse.json({ data: [...mappedAsignaciones, ...adicionales, ...cargaHorariaBlocks] });
      }
    }

    const adicionales = await getCargaAdicionalDocente(id, ciclo_id);
    const cargaHorariaBlocks = await getCargaHorariaBlocks(id, ciclo_id);
    return NextResponse.json({ data: [...adicionales, ...cargaHorariaBlocks] });
  } catch (err) {
    console.error('Error in /api/docentes/:id/horario:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
