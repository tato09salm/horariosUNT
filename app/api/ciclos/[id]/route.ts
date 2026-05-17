import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

// GET /api/ciclos/[id] - Obtener un ciclo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const ciclo = await queryOne('SELECT * FROM ciclos WHERE id = $1', [id]);
  
  if (!ciclo) {
    return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
  }
  
  return NextResponse.json({ data: ciclo });
}

// PUT /api/ciclos/[id] - Actualizar ciclo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { nombre, año, semestre, fecha_inicio, fecha_fin, activo } = body;

    // Si activo es true, desactivamos los demás ciclos
    if (activo === true) {
      await queryOne('UPDATE ciclos SET activo = false WHERE id != $1', [id]);
    }

    // IMPORTANTE: NO uses updated_at porque la tabla ciclos NO tiene esa columna
    const ciclo = await queryOne(
      `UPDATE ciclos 
       SET nombre = $1, año = $2, semestre = $3, 
           fecha_inicio = $4, fecha_fin = $5, activo = $6
       WHERE id = $7
       RETURNING *`,
      [nombre, año, semestre, fecha_inicio, fecha_fin, activo, id]
    );

    if (!ciclo) {
      return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: ciclo });
  } catch (error: any) {
    console.error('Error en PUT ciclo:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE /api/ciclos/[id] - Eliminar ciclo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const ciclo = await queryOne('DELETE FROM ciclos WHERE id = $1 RETURNING id', [id]);
    
    if (!ciclo) {
      return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Ciclo eliminado correctamente' });
  } catch (error: any) {
    console.error('Error en DELETE ciclo:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}