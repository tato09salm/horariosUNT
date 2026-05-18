import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { transaction } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: programacion_id } = await params;

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows)) throw new Error('Data no es un array');

    const result = await transaction(async (client) => {
      // Borrar disponibilidades previas de todos los docentes para esta programación
      await client.query('DELETE FROM disponibilidad_docente WHERE programacion_id = $1', [programacion_id]);

      // Mapeo de Docentes (DNI -> ID)
      const docentes = await client.query('SELECT id, dni FROM docentes');
      const mapDocentes: Record<string, string> = {};
      docentes.rows.forEach((d: any) => mapDocentes[d.dni] = d.id);

      // Mapeo de Slots (HORA -> ID)
      const slots = await client.query('SELECT id, hora_inicio FROM slots_tiempo');
      const mapSlots: Record<string, string> = {};
      slots.rows.forEach((s: any) => {
        const horaStr = s.hora_inicio.substring(0, 5); // '07:00'
        mapSlots[horaStr] = s.id;
      });

      let insertadas = 0;

      for (const r of rows) {
        // r = { DOCENTE, DIA, HORA_INICIO, PRIORIDAD }
        const dni = r['DOCENTE'];
        const dia = r['DIA']?.toLowerCase();
        const hora = r['HORA_INICIO'];
        const prioridad = parseInt(r['PRIORIDAD']);

        const docenteId = mapDocentes[dni];
        const slotId = mapSlots[hora];

        if (!docenteId || !slotId || isNaN(prioridad) || prioridad === 0) continue;

        await client.query(
          `INSERT INTO disponibilidad_docente (programacion_id, docente_id, slot_id, dia, disponible, prioridad, registrado_por, updated_at)
           VALUES ($1, $2, $3, $4, true, $5, $6, NOW())`,
          [programacion_id, docenteId, slotId, dia, prioridad, session.id]
        );
        insertadas++;
      }

      return insertadas;
    });

    return NextResponse.json({ success: true, message: `Importadas ${result} disponibilidades.` });
  } catch (error: any) {
    console.error('Error importar disponibilidad:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
