import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/sequelize';
import { Op } from 'sequelize';

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
    const limit = programacion_id ? 1000 : parseInt(searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;

    const where: any = {};
    if (programacion_id) where.programacion_id = programacion_id;
    if (curso_id) where.curso_id = curso_id;

    const { count, rows: grupos } = await db.Grupos.findAndCountAll({
      where,
      include: [
        {
          model: db.Cursos,
          as: 'curso',
          attributes: ['nombre', 'codigo', 'horas_teoria', 'horas_practica', 'creditos']
        },
        {
          model: db.Programaciones,
          as: 'programacion',
          attributes: ['nombre', 'estado']
        }
      ],
      order: [
        [{ model: db.Programaciones, as: 'programacion' }, 'created_at', 'DESC'],
        [{ model: db.Cursos, as: 'curso' }, 'nombre', 'ASC'],
        ['numero_grupo', 'ASC']
      ],
      limit,
      offset
    });

    // Mapear para mantener compatibilidad con el front
    const data = await Promise.all(grupos.map(async (g: any) => {
      const totalAsignaciones = await db.Asignaciones.count({
        where: { 
          grupo_id: g.id,
          estado: 'activo'
        }
      });

      const json = g.toJSON();
      return {
        ...json,
        curso_nombre: json.curso?.nombre,
        curso_codigo: json.curso?.codigo,
        horas_teoria: json.curso?.horas_teoria,
        horas_practica: json.curso?.horas_practica,
        creditos: json.curso?.creditos,
        programacion_nombre: json.programacion?.nombre,
        programacion_estado: json.programacion?.estado,
        total_asignaciones: totalAsignaciones
      };
    }));

    return NextResponse.json({ 
      data, 
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
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
    const { programacion_id, curso_id, tipo_actividad, numero_grupo, max_alumnos } = body;

    if (!programacion_id || !curso_id || !numero_grupo) {
        return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
    }

    const validActividades = ['teoria', 'practica', 'laboratorio'];
    const act = tipo_actividad?.toLowerCase();
    if (act && !validActividades.includes(act)) {
        return NextResponse.json({ error: 'Tipo de actividad no es válido' }, { status: 400 });
    }

    const grupo = await db.Grupos.create({
      programacion_id,
      curso_id,
      tipo_actividad: act || 'teoria',
      numero_grupo,
      max_alumnos: max_alumnos || 40,
      num_alumnos: 0
    });

    return NextResponse.json({ data: grupo }, { status: 201 });
  } catch (error: any) {
    console.error('Error POST grupos:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
