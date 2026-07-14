import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { generarHorarioAutomatico } from '@/lib/horarios';
import { validarSolucionFinal } from '@/lib/horarios-resolver-v2';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const resultado = await generarHorarioAutomatico({
      ...body,
      created_by: session.id,
    });
    
    // Validate solution before saving
    const slots = await query('SELECT * FROM slots_tiempo ORDER BY orden');
    const cursos = await query('SELECT * FROM cursos WHERE programacion_id = $1', [body.programacion_id]);
    const validacion = validarSolucionFinal(resultado.asignaciones, cursos, slots);
    
    // Check for structural errors (conflicts, excess hours, etc.)
    const tieneErroresEstructurales = validacion.resumen.conflictosDocente > 0 ||
                                       validacion.resumen.conflictosGrupo > 0 ||
                                       validacion.resumen.conflictosAmbiente > 0 ||
                                       validacion.resumen.horasExcedentes > 0 ||
                                       validacion.resumen.bloquesDuplicados > 0;
    
    if (tieneErroresEstructurales) {
      return NextResponse.json({ 
        error: 'Solución inválida generada',
        detalles: validacion.resumen,
        errores: validacion.errores_estructurados
      }, { status: 400 });
    }
    
    return NextResponse.json(resultado);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
