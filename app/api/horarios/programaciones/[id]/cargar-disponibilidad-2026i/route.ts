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
    const csvPath = join(process.cwd(), 'csvs', 'disponibilidad2026I-REAL.csv');
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

      for (const r of data) {
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

    return NextResponse.json({ success: true, message: `Cargadas ${result} disponibilidades desde CSV 2026-I.` });
  } catch (error: any) {
    console.error('Error cargar disponibilidad 2026-I:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
