import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generarHorarioCSP } from '@/lib/horarios-csp';
import { registrarAuditoria } from '@/lib/auditoria';
import { queryOne } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id } = await req.json();

    if (!programacion_id) {
      return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });
    }

    const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [programacion_id]);
    if (!prog || prog.fase !== 3) {
      return NextResponse.json({ error: 'La programación no está en Fase 3' }, { status: 400 });
    }

    // Ejecutar Motor CSP
    const { asignaciones, conflictos } = await generarHorarioCSP(programacion_id);

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'GENERATE_SCHEDULE',
      tabla_afectada: 'programaciones',
      registro_id: programacion_id,
      descripcion: `Motor CSP ejecutado. Asignaciones generadas: ${asignaciones.length}. Conflictos: ${conflictos.length}`,
    });

    return NextResponse.json({ success: true, data: { asignaciones, conflictos } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
