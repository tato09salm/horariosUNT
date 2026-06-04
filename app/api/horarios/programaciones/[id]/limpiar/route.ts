import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: progId } = await params;

    console.log('ENTRÓ AL DELETE');
    console.log('progId:', progId);

    const session = await getSession();
    if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Verificar cuántos grupos existen antes de eliminar
    const verificarAntes = await query(
      'SELECT COUNT(*) FROM grupos WHERE programacion_id = $1',
      [progId]
    );
    console.log('Grupos antes de eliminar:', verificarAntes);

    // Verificar cuántas asignaciones existen antes de eliminar
    const verificarAsignacionesAntes = await query(
      'SELECT COUNT(*) FROM programacion_cursos WHERE programacion_id = $1',
      [progId]
    );
    console.log('Asignaciones antes de eliminar:', verificarAsignacionesAntes);

    // Primero eliminar asignaciones (programacion_cursos) para evitar problemas de claves foráneas
    const deleteAsignacionesResult = await query(
      'DELETE FROM programacion_cursos WHERE programacion_id = $1 RETURNING id',
      [progId]
    );

    console.log('Resultado DELETE asignaciones:', deleteAsignacionesResult);
    console.log('Asignaciones eliminadas:', deleteAsignacionesResult?.length || 0);

    // Luego eliminar grupos
    const deleteGruposResult = await query(
      'DELETE FROM grupos WHERE programacion_id = $1 RETURNING id',
      [progId]
    );

    console.log('Resultado DELETE grupos:', deleteGruposResult);
    console.log('Grupos eliminados:', deleteGruposResult?.length || 0);

    // Verificar cuántos grupos quedan después de eliminar
    const verificarDespues = await query(
      'SELECT COUNT(*) FROM grupos WHERE programacion_id = $1',
      [progId]
    );
    console.log('Grupos después de eliminar:', verificarDespues);

    // Verificar cuántas asignaciones quedan después de eliminar
    const verificarAsignacionesDespues = await query(
      'SELECT COUNT(*) FROM programacion_cursos WHERE programacion_id = $1',
      [progId]
    );
    console.log('Asignaciones después de eliminar:', verificarAsignacionesDespues);

    const asignacionesEliminadas = deleteAsignacionesResult?.length || 0;
    const gruposEliminados = deleteGruposResult?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Configuración eliminada: ${asignacionesEliminadas} asignaciones y ${gruposEliminados} grupos eliminados`,
      asignacionesEliminadas,
      gruposEliminados
    });
  } catch (error: any) {
    console.error('Error limpiando configuración:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
