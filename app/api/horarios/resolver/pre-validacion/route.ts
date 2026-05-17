import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { obtenerPreValidacionCSP } from '@/lib/horarios-csp';
import { interpretarEstadoPreValidacion } from '@/lib/csp-diagnostico';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const programacion_id = req.nextUrl.searchParams.get('programacion_id');
  if (!programacion_id) {
    return NextResponse.json({ error: 'programacion_id requerido' }, { status: 400 });
  }

  try {
    const { resumen, docentes } = await obtenerPreValidacionCSP(programacion_id);
    const lista = docentes.map((d: any) => ({
      ...d,
      mensaje: interpretarEstadoPreValidacion(d.estado),
    }));

    return NextResponse.json({
      data: {
        resumen,
        docentes: lista,
        listo_para_csp: Number(resumen?.alertas || 0) === 0,
      },
    });
  } catch (e: any) {
    if (e.message?.includes('v_pre_validacion_csp')) {
      return NextResponse.json({
        error: 'Ejecuta npm run db:reset o db:seed para crear las vistas de pre-validación',
      }, { status: 503 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
