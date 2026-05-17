import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

// GET /api/horarios/grupos/[id] - Obtener un grupo
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
  }

  try {
    const grupo = await queryOne(
      `SELECT 
        g.*, 
        c.id as curso_id, 
        c.codigo as curso_codigo, 
        c.nombre as curso_nombre,
        ci.id as ciclo_id,
        ci.nombre as ciclo_nombre,
        ci.año as ciclo_año,
        ci.semestre as ciclo_semestre
       FROM grupos g
       INNER JOIN cursos c ON c.id = g.curso_id
       INNER JOIN ciclos ci ON ci.id = g.ciclo_id
       WHERE g.id = $1`,
      [id]
    );

    if (!grupo) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ data: grupo });
  } catch (error: any) {
    console.error('Error en GET grupo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// PUT /api/horarios/grupos/[id] - Actualizar grupo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos } = body;

    // Validaciones
    if (!ciclo_id) {
      return NextResponse.json({ error: 'El ciclo es requerido' }, { status: 400 });
    }
    if (!curso_id) {
      return NextResponse.json({ error: 'El curso es requerido' }, { status: 400 });
    }
    if (!numero_grupo || numero_grupo < 1) {
      return NextResponse.json({ error: 'El número de grupo debe ser mayor a 0' }, { status: 400 });
    }

    // Verificar que el grupo existe
    const existeGrupo = await queryOne('SELECT id FROM grupos WHERE id = $1', [id]);
    if (!existeGrupo) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    // Verificar que el ciclo existe
    const existeCiclo = await queryOne('SELECT id FROM ciclos WHERE id = $1', [ciclo_id]);
    if (!existeCiclo) {
      return NextResponse.json({ error: 'El ciclo seleccionado no existe' }, { status: 400 });
    }

    // Verificar que el curso existe
    const existeCurso = await queryOne('SELECT id FROM cursos WHERE id = $1', [curso_id]);
    if (!existeCurso) {
      return NextResponse.json({ error: 'El curso seleccionado no existe' }, { status: 400 });
    }

    // Verificar que no exista otro grupo con el mismo número en el mismo ciclo y curso
    const grupoDuplicado = await queryOne(
      `SELECT id FROM grupos 
       WHERE ciclo_id = $1 AND curso_id = $2 AND numero_grupo = $3 AND id != $4`,
      [ciclo_id, curso_id, numero_grupo, id]
    );

    if (grupoDuplicado) {
      return NextResponse.json(
        { error: 'Ya existe un grupo con ese número para este ciclo y curso' },
        { status: 400 }
      );
    }

    const grupo = await queryOne(
      `UPDATE grupos 
       SET ciclo_id = $1, 
           curso_id = $2, 
           numero_grupo = $3, 
           max_alumnos = $4, 
           num_alumnos = $5
       WHERE id = $6
       RETURNING *`,
      [ciclo_id, curso_id, numero_grupo, max_alumnos || 30, num_alumnos || 0, id]
    );

    return NextResponse.json({ 
      data: grupo,
      message: 'Grupo actualizado correctamente'
    });
  } catch (error: any) {
    console.error('Error en PUT grupo:', error);
    
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ya existe un grupo con ese número para este ciclo y curso' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ error: 'Error al actualizar grupo' }, { status: 500 });
  }
}

// DELETE /api/horarios/grupos/[id] - Eliminar grupo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
  }

  try {
    // Verificar si el grupo existe
    const existeGrupo = await queryOne('SELECT id FROM grupos WHERE id = $1', [id]);
    if (!existeGrupo) {
      return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 });
    }

    // Verificar si el grupo tiene asignaciones (no permitir eliminar si tiene)
    const tieneAsignaciones = await queryOne(
      'SELECT id FROM asignaciones WHERE grupo_id = $1 LIMIT 1',
      [id]
    );

    if (tieneAsignaciones) {
      return NextResponse.json(
        { error: 'No se puede eliminar el grupo porque tiene asignaciones de horario' },
        { status: 400 }
      );
    }

    await queryOne('DELETE FROM grupos WHERE id = $1', [id]);

    return NextResponse.json({ 
      message: 'Grupo eliminado correctamente',
      success: true 
    });
  } catch (error: any) {
    console.error('Error en DELETE grupo:', error);
    return NextResponse.json({ error: 'Error al eliminar grupo' }, { status: 500 });
  }
}