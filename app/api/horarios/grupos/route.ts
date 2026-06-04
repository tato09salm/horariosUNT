import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

// GET /api/horarios/grupos - Listar grupos con filtros
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const programacion_id = searchParams.get('programacion_id');
    const curso_id = searchParams.get('curso_id');
    const page = parseInt(searchParams.get('page') || '1');
    // Si se filtra por programacion_id, no aplicar límite para obtener todos los grupos
    const limit = programacion_id ? 1000 : parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        g.*, 
        c.nombre as curso_nombre, 
        c.codigo as curso_codigo, 
        c.horas_teoria, 
        c.horas_practica, 
        c.creditos,
        p.nombre as programacion_nombre,
        p.estado as programacion_estado,
        (SELECT COUNT(*) FROM asignaciones a WHERE a.grupo_id = g.id AND a.estado = 'activo') as total_asignaciones
      FROM grupos g
      JOIN cursos c ON c.id = g.curso_id
      JOIN programaciones p ON p.id = g.programacion_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let idx = 1;

    if (programacion_id) {
      sql += ` AND g.programacion_id = $${idx++}`;
      params.push(programacion_id);
    }
    if (curso_id) {
      sql += ` AND g.curso_id = $${idx++}`;
      params.push(curso_id);
    }

    sql += ` ORDER BY p.created_at DESC, c.nombre, g.numero_grupo`;
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const grupos = await query(sql, params);

    // Contar total para paginación
    let countSql = `
      SELECT COUNT(*) as total
      FROM grupos g
      JOIN cursos c ON c.id = g.curso_id
      JOIN programaciones p ON p.id = g.programacion_id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countIdx = 1;
    
    if (programacion_id) {
      countSql += ` AND g.programacion_id = $${countIdx++}`;
      countParams.push(programacion_id);
    }
    if (curso_id) {
      countSql += ` AND g.curso_id = $${countIdx++}`;
      countParams.push(curso_id);
    }
    
    const totalResult = await query(countSql, countParams);
    const total = parseInt(totalResult[0]?.total || '0');

    return NextResponse.json({ 
      data: grupos, 
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    console.error('Error GET grupos:', error);
    return NextResponse.json({ error: 'Error al cargar grupos' }, { status: 500 });
  }
}

// POST /api/horarios/grupos - Crear un nuevo grupo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { programacion_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos } = body;

    // ========== VALIDACIONES ==========

    // 1. Campos requeridos
    if (!programacion_id) {
      return NextResponse.json({ error: 'La programación es requerida' }, { status: 400 });
    }
    if (!curso_id) {
      return NextResponse.json({ error: 'El curso es requerido' }, { status: 400 });
    }
    if (!numero_grupo || numero_grupo < 1) {
      return NextResponse.json({ error: 'El número de grupo debe ser mayor a 0' }, { status: 400 });
    }
    if (!tipo_actividad || !['teoria', 'practica', 'laboratorio'].includes(tipo_actividad)) {
      return NextResponse.json({ error: 'El tipo de actividad es inválido o requerido' }, { status: 400 });
    }

    // 2. Verificar que la programación existe
    const programacion = await queryOne('SELECT id, nombre, estado FROM programaciones WHERE id = $1', [programacion_id]);
    if (!programacion) {
      return NextResponse.json({ error: 'La programación seleccionada no existe' }, { status: 400 });
    }

    // 4. Verificar que el curso existe
    const curso = await queryOne('SELECT id, codigo, nombre FROM cursos WHERE id = $1', [curso_id]);
    if (!curso) {
      return NextResponse.json({ error: 'El curso seleccionado no existe' }, { status: 400 });
    }

    // 5. Verificar que no exista un grupo con el mismo número y actividad
    const grupoExistente = await queryOne(
      `SELECT id, numero_grupo FROM grupos 
       WHERE programacion_id = $1 AND curso_id = $2 AND tipo_actividad = $3 AND numero_grupo = $4`,
      [programacion_id, curso_id, tipo_actividad, numero_grupo]
    );

    if (grupoExistente) {
      return NextResponse.json({ 
        error: `Ya existe el Grupo ${numero_grupo} de ${tipo_actividad} para el curso ${curso.codigo} en la programación ${programacion.nombre}` 
      }, { status: 400 });
    }

    // 6. Validar que max_alumnos sea positivo
    const maxAlumnosValido = max_alumnos && max_alumnos > 0 ? max_alumnos : 30;
    const numAlumnosValido = num_alumnos && num_alumnos >= 0 ? num_alumnos : 0;

    if (numAlumnosValido > maxAlumnosValido) {
      return NextResponse.json({ 
        error: `Los alumnos inscritos (${numAlumnosValido}) no pueden superar la capacidad máxima (${maxAlumnosValido})` 
      }, { status: 400 });
    }

    // ========== CREAR GRUPO ==========
    const grupo = await queryOne(
      `INSERT INTO grupos (programacion_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [programacion_id, curso_id, tipo_actividad, numero_grupo, maxAlumnosValido, numAlumnosValido]
    );

    return NextResponse.json({ 
      data: grupo,
      message: `✅ Grupo ${numero_grupo} creado exitosamente para ${curso.codigo}`
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error POST grupo:', error);
    
    // Error de clave duplicada (por si acaso)
    if (error.code === '23505') {
      return NextResponse.json({ 
        error: 'Ya existe un grupo con ese número para esta programación y curso' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Error al crear el grupo' }, { status: 500 });
  }
}
