import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import db from '@/lib/sequelize';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    const curricula = await db.Curriculas.findByPk(id, {
      include: [{
        model: db.Cursos,
        as: 'cursos',
        include: [{
          model: db.Escuelas,
          as: 'escuela'
        }],
        through: { attributes: [] }
      }]
    });

    if (!curricula) {
      return NextResponse.json({ error: 'Currícula no encontrada' }, { status: 404 });
    }

    // Mapear para incluir escuela_nombre como antes para no romper el front
    const cursosRaw = (curricula as any).cursos || [];
    
    // Ordenar manualmente si Sequelize tiene problemas con order en m:n con alias
    const cursos = cursosRaw
      .map((c: any) => ({
        ...c.toJSON(),
        escuela_nombre: c.escuela?.nombre
      }))
      .sort((a: any, b: any) => {
        if (a.ciclo_plan !== b.ciclo_plan) return a.ciclo_plan - b.ciclo_plan;
        return a.codigo.localeCompare(b.codigo);
      });

    return NextResponse.json({ data: cursos });
  } catch (error: any) {
    console.error('Error GET curriculas/cursos:', error);
    return NextResponse.json({ error: 'Error al cargar cursos de la curricula' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: curricula_id } = await params;
  const body = await req.json();

  const t = await db.sequelize.transaction();

  try {
    let curso_id = body.curso_id;

    if (!curso_id) {
      // Crear nuevo curso
      const {
        codigo,
        nombre,
        ciclo_plan,
        escuela_id,
        creditos,
        horas_teoria,
        horas_practica,
        horas_laboratorio,
      } = body;

      const codigoUpper = codigo.toUpperCase();
      const nombreUpper = nombre.toUpperCase();

      // Verificar si el código ya existe
      const existente = await db.Cursos.findOne({ where: { codigo: codigoUpper }, transaction: t });
      if (existente) {
        throw new Error(`Ya existe un curso con el código ${codigoUpper}`);
      }

      const nuevoCurso = await db.Cursos.create({
        codigo: codigoUpper,
        nombre: nombreUpper,
        ciclo_plan,
        escuela_id,
        creditos,
        horas_teoria,
        horas_practica,
        horas_laboratorio
      }, { transaction: t });
      
      curso_id = (nuevoCurso as any).id;

      await registrarAuditoria({
        usuario_id: session.id,
        accion: 'CREATE',
        tabla_afectada: 'cursos',
        registro_id: curso_id,
        datos_nuevos: nuevoCurso.toJSON(),
        descripcion: `Curso creado desde configuración de currícula: ${nombreUpper}`,
      });
    }

    // Verificar si ya está en la malla
    const enMalla = await db.MallaCurricular.findOne({
      where: { curricula_id, curso_id },
      transaction: t
    });

    if (enMalla) {
      throw new Error('El curso ya está registrado en esta currícula');
    }

    // Agregar a la malla
    await db.MallaCurricular.create({
      curricula_id,
      curso_id
    }, { transaction: t });

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'CREATE',
      tabla_afectada: 'malla_curricular',
      registro_id: curricula_id,
      datos_nuevos: { curricula_id, curso_id },
      descripcion: `Curso agregado a currícula ${curricula_id}`,
    });

    await t.commit();
    return NextResponse.json({ success: true, curso_id });
  } catch (error: any) {
    await t.rollback();
    console.error('Error POST curriculas/cursos:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: curricula_id } = await params;
  const { searchParams } = new URL(req.url);
  const curso_id = searchParams.get('curso_id');

  if (!curso_id) {
    return NextResponse.json({ error: 'curso_id es requerido' }, { status: 400 });
  }

  try {
    await db.MallaCurricular.destroy({
      where: { curricula_id, curso_id }
    });

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'DELETE',
      tabla_afectada: 'malla_curricular',
      registro_id: curricula_id,
      datos_anteriores: { curricula_id, curso_id },
      descripcion: `Curso eliminado de currícula ${curricula_id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error DELETE curriculas/cursos:', error);
    return NextResponse.json({ error: 'Error al eliminar curso de la currícula' }, { status: 500 });
  }
}
