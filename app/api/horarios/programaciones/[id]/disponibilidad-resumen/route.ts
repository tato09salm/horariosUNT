import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id: programacion_id } = await params;
    if (!programacion_id) return NextResponse.json({ error: 'id de programación requerido' }, { status: 400 });

    // 1. Docentes que tienen al menos un curso asignado en esta programación
    //    (estos son los que están obligados a marcar su disponibilidad).
    //    d.nombre y d.apellidos existen como columnas separadas en el esquema real.
    const docentesConCarga = await query(`
      SELECT DISTINCT
        pc.docente_id,
        TRIM(CONCAT(d.nombre, ' ', d.apellidos)) AS nombre,
        d.categoria,
        d.condicion
      FROM programacion_cursos pc
      JOIN docentes d ON d.id = pc.docente_id
      WHERE pc.programacion_id = $1 AND pc.docente_id IS NOT NULL
    `, [programacion_id]);

    // 2. Docentes que ya registraron al menos un slot de disponibilidad
    //    (basta con que hayan guardado algo, igual que el botón "Guardar").
    const docentesConDisponibilidad = await query(`
      SELECT DISTINCT docente_id
      FROM disponibilidad_docente
      WHERE programacion_id = $1
    `, [programacion_id]);

    const setCompletos = new Set(docentesConDisponibilidad.map((r: any) => r.docente_id));

    const pendientes = docentesConCarga
      .filter((d: any) => !setCompletos.has(d.docente_id))
      .map((d: any) => ({
        docente_id: d.docente_id,
        nombre: d.nombre || '(sin nombre)',
        categoria: d.categoria,
        condicion: d.condicion,
      }));

    const totalDocentes = docentesConCarga.length;
    const docentesCompletos = totalDocentes - pendientes.length;

    return NextResponse.json({
      data: {
        totalDocentes,
        docentesCompletos,
        pendientes,
        listo: pendientes.length === 0,
      },
    });
  } catch (error: any) {
    console.error('Error en /disponibilidad-resumen:', error);
    return NextResponse.json({ error: error.message || 'Error interno al calcular el resumen' }, { status: 500 });
  }
}