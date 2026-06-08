import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import db from '@/lib/sequelize';
import { Op } from 'sequelize';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buscar = searchParams.get('buscar');
  const ciclo = searchParams.get('ciclo');
  const activo = searchParams.get('activo');
  const reporte = searchParams.get('reporte') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  const curricula_id = searchParams.get('curricula_id');

  const where: any = {};
  if (buscar) {
    where[Op.or] = [
      { nombre: { [Op.iLike]: `%${buscar}%` } },
      { codigo: { [Op.iLike]: `%${buscar}%` } }
    ];
  }
  if (ciclo) {
    where.ciclo_plan = parseInt(ciclo);
  }
  if (activo !== null && activo !== undefined && activo !== '') {
    where.activo = activo === 'true';
  }

  try {
    const include: any[] = [{
      model: db.Escuelas,
      as: 'escuela'
    }];

    if (curricula_id) {
      include.push({
        model: db.MallaCurricular,
        as: 'mallas',
        where: { curricula_id },
        required: true
      });
    }

    const { count, rows: cursos } = await db.Cursos.findAndCountAll({
      where,
      include,
      order: [['ciclo_plan', 'ASC'], ['nombre', 'ASC']],
      limit: reporte ? undefined : limit,
      offset: reporte ? undefined : offset
    });

    // Mapear para mantener compatibilidad con el front (escuela_nombre)
    const data = cursos.map((c: any) => ({
      ...c.toJSON(),
      escuela_nombre: c.escuela?.nombre
    }));

    // Stats simplificados usando los datos filtrados (si no es mucha data) o una query aparte
    const stats = {
      total_cursos: count,
      total_creditos: data.reduce((acc: number, curr: any) => acc + (curr.creditos || 0), 0),
      total_teoria: data.reduce((acc: number, curr: any) => acc + (curr.horas_teoria || 0), 0),
      total_practica: data.reduce((acc: number, curr: any) => acc + (curr.horas_practica || 0), 0)
    };

    return NextResponse.json({ 
      data, 
      total: count, 
      stats, 
      page: reporte ? 1 : page, 
      limit: reporte ? count : limit 
    });
  } catch (error: any) {
    console.error('Error GET cursos:', error);
    return NextResponse.json({ error: 'Error al cargar cursos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria', 'director_escuela'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { curricula_id } = body;
    const codigoUpper = body.codigo?.toUpperCase() || '';
    const nombreUpper = body.nombre?.toUpperCase() || '';

    const t = await db.sequelize.transaction();

    try {
      const curso = await db.Cursos.create({
        escuela_id: body.escuela_id,
        codigo: codigoUpper,
        nombre: nombreUpper,
        creditos: body.creditos,
        horas_teoria: body.horas_teoria,
        horas_practica: body.horas_practica,
        horas_laboratorio: body.horas_laboratorio || 0,
        ciclo_plan: body.ciclo_plan
      }, { transaction: t });

      if (curricula_id) {
        await db.MallaCurricular.create({
          curricula_id,
          curso_id: (curso as any).id
        }, { transaction: t });
      }

      await registrarAuditoria({
        usuario_id: session.id,
        accion: 'CREATE', 
        tabla_afectada: 'cursos', 
        registro_id: (curso as any).id,
        datos_nuevos: (curso as any).toJSON(), 
        descripcion: `Curso creado y vinculado a currícula: ${nombreUpper}`,
      });

      await t.commit();
      return NextResponse.json({ data: curso }, { status: 201 });
    } catch (err: any) {
      await t.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('Error POST cursos:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
