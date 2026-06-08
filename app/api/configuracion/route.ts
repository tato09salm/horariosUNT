import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/sequelize';
import { registrarAuditoria } from '@/lib/auditoria';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clave = searchParams.get('clave');
    
    if (!clave) {
        return NextResponse.json({ error: 'Clave requerida' }, { status: 400 });
    }

    const config = await db.Configuracion.findOne({
      where: { clave }
    });
    
    return NextResponse.json({ data: config });
  } catch (error: any) {
    console.error('Error GET configuracion:', error);
    return NextResponse.json({ error: 'Error al cargar configuracion' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { clave, valor } = await req.json();
    if (!clave) {
      return NextResponse.json({ error: 'Clave requerida' }, { status: 400 });
    }

    let config = await db.Configuracion.findOne({
      where: { clave }
    });

    if (config) {
      await (config as any).update({ valor });
    } else {
      config = await db.Configuracion.create({
        clave,
        valor
      });
    }

    // Registrar acción en auditoría
    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'UPDATE',
      tabla_afectada: 'configuracion',
      registro_id: (config as any).id,
      descripcion: `Configuración actualizada: ${clave} = ${valor}`,
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    console.error('Error POST configuracion:', error);
    return NextResponse.json({ error: 'Error al guardar configuracion' }, { status: 500 });
  }
}

