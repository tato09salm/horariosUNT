import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/sequelize';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const escuelas = await db.Escuelas.findAll({
      order: [['nombre', 'ASC']]
    });
    return NextResponse.json({ data: escuelas });
  } catch (error: any) {
    console.error('Error GET escuelas:', error);
    return NextResponse.json({ error: 'Error al cargar escuelas' }, { status: 500 });
  }
}
