import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { id } = await params;

    // Verificar que el grupo existe
    const grupo = await queryOne('SELECT id FROM grupos WHERE id = $1', [id]);
    if (!grupo) {
      return NextResponse.json({ error: 'El grupo no existe' }, { status: 404 });
    }

    // Usar transacción para borrar el grupo y todas sus asignaciones docentes en cascada
    await query('BEGIN');
    
    // Eliminar asignaciones (programacion_cursos) asociadas a este grupo
    await query('DELETE FROM programacion_cursos WHERE grupo_id = $1', [id]);
    
    // Eliminar el grupo
    await query('DELETE FROM grupos WHERE id = $1', [id]);
    
    await query('COMMIT');

    return NextResponse.json({ message: 'Grupo eliminado correctamente' });
  } catch (error: any) {
    await query('ROLLBACK');
    console.error('Error DELETE grupo:', error);
    return NextResponse.json({ error: 'Error al eliminar el grupo' }, { status: 500 });
  }
}