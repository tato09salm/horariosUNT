import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getHorarioDocente } from '@/lib/horarios';
import { query, queryOne } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  if (!ciclo_id) return NextResponse.json({ error: 'ciclo_id requerido' }, { status: 400 });

  // 1. Intentar desde tabla asignaciones (publicado)
  let horario = await getHorarioDocente(id, ciclo_id);

  // 2. Fallback: leer desde programaciones.config.asignaciones
  if (horario.length === 0) {
    const prog = await queryOne(`
      SELECT config FROM programaciones WHERE ciclo_id = $1 AND estado IN ('borrador', 'publicado') ORDER BY created_at DESC LIMIT 1
    `, [ciclo_id]);

    if (prog?.config?.asignaciones?.length) {
      const slots = await query(`SELECT * FROM slots_tiempo ORDER BY orden`);
      const slotsMap = new Map(slots.map((s: any) => [s.id, s]));
      horario = prog.config.asignaciones
        .filter((a: any) => a.docente_id === id)
        .map((a: any) => {
          const slot = slotsMap.get(a.slot_id);
          return {
            ...a,
            hora_inicio: slot?.hora_inicio || '',
            hora_fin: slot?.hora_fin || '',
            ciclo_nombre: '',
          };
        });
    }
  }

  return NextResponse.json({ data: horario });
}
