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
    const ciclo_id = searchParams.get('ciclo_id');
    const curso_id = searchParams.get('curso_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        g.*, 
        c.nombre as curso_nombre, 
        c.codigo as curso_codigo, 
        c.horas_teoria, 
        c.horas_practica, 
        c.creditos,
        ci.nombre as ciclo_nombre,
        ci.activo as ciclo_activo,
        (SELECT COUNT(*) FROM asignaciones a WHERE a.grupo_id = g.id AND a.estado = 'activo') as total_asignaciones
      FROM grupos g
      JOIN cursos c ON c.id = g.curso_id
      JOIN ciclos ci ON ci.id = g.ciclo_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let idx = 1;

    if (ciclo_id) {
      sql += ` AND g.ciclo_id = $${idx++}`;
      params.push(ciclo_id);
    }
    if (curso_id) {
      sql += ` AND g.curso_id = $${idx++}`;
      params.push(curso_id);
    }

    sql += ` ORDER BY ci.activo DESC, ci.año DESC, ci.semestre DESC, c.nombre, g.numero_grupo`;
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const grupos = await query(sql, params);

    // Contar total para paginación
    let countSql = `
      SELECT COUNT(*) as total
      FROM grupos g
      JOIN cursos c ON c.id = g.curso_id
      JOIN ciclos ci ON ci.id = g.ciclo_id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countIdx = 1;
    
    if (ciclo_id) {
      countSql += ` AND g.ciclo_id = $${countIdx++}`;
      countParams.push(ciclo_id);
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
    const { ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos } = body;

    // ========== VALIDACIONES ==========

    // 1. Campos requeridos
    if (!ciclo_id) {
      return NextResponse.json({ error: 'El ciclo es requerido' }, { status: 400 });
    }
    if (!curso_id) {
      return NextResponse.json({ error: 'El curso es requerido' }, { status: 400 });
    }
    if (!numero_grupo || numero_grupo < 1) {
      return NextResponse.json({ error: 'El número de grupo debe ser mayor a 0' }, { status: 400 });
    }

    // 2. Verificar que el ciclo existe
    const ciclo = await queryOne('SELECT id, activo, nombre FROM ciclos WHERE id = $1', [ciclo_id]);
    if (!ciclo) {
      return NextResponse.json({ error: 'El ciclo seleccionado no existe' }, { status: 400 });
    }

    // 3. ⚠️ VALIDACIÓN CLAVE: No permitir grupos en ciclos INACTIVOS
    if (ciclo.activo !== true) {
      return NextResponse.json({ 
        error: `No se pueden crear grupos en el ciclo "${ciclo.nombre}" porque está INACTIVO. Solo se permiten grupos en ciclos activos.` 
      }, { status: 400 });
    }

    // 4. Verificar que el curso existe
    const curso = await queryOne('SELECT id, codigo, nombre FROM cursos WHERE id = $1', [curso_id]);
    if (!curso) {
      return NextResponse.json({ error: 'El curso seleccionado no existe' }, { status: 400 });
    }

    // 5. Verificar que no exista un grupo con el mismo número en el mismo ciclo y curso
    const grupoExistente = await queryOne(
      `SELECT id, numero_grupo FROM grupos 
       WHERE ciclo_id = $1 AND curso_id = $2 AND numero_grupo = $3`,
      [ciclo_id, curso_id, numero_grupo]
    );

    if (grupoExistente) {
      return NextResponse.json({ 
        error: `Ya existe el Grupo ${numero_grupo} para el curso ${curso.codigo} en el ciclo ${ciclo.nombre}` 
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
      `INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [ciclo_id, curso_id, numero_grupo, maxAlumnosValido, numAlumnosValido]
    );

    return NextResponse.json({ 
      data: grupo,
      message: `✅ Grupo ${numero_grupo} creado exitosamente para ${curso.codigo} en ${ciclo.nombre}`
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error POST grupo:', error);
    
    // Error de clave duplicada (por si acaso)
    if (error.code === '23505') {
      return NextResponse.json({ 
        error: 'Ya existe un grupo con ese número para este ciclo y curso' 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Error al crear el grupo' }, { status: 500 });
  }
}