import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/sequelize';

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
