import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import db from '@/lib/sequelize';
import { Op } from 'sequelize';
import {
  CARRERA_CURRICULA_FIJA,
  normalizeModalidadCurricula,
} from '@/lib/curriculas';

function parseEntero(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numero = Number(value);
  return Number.isInteger(numero) ? numero : null;
}

function buildError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return buildError('No autenticado', 401);
  }

  const { searchParams } = new URL(req.url);
  const manage = searchParams.get('manage') === 'true';

  if (manage && !requireRole(session, ['admin', 'director_escuela', 'secretaria'])) {
    return buildError('Sin permisos', 403);
  }

  try {
    const where: any = {};
    if (!manage) {
      // Para crear horarios, permitimos ACTIVA, BORRADOR y EN_EXTINCION
      where.estado = { [Op.in]: ['ACTIVA', 'BORRADOR', 'EN_EXTINCION'] };
    } else {
      where.estado = { [Op.ne]: 'ELIMINADA' };
    }

    const curriculas = await db.Curriculas.findAll({
      where,
      order: [
        [db.sequelize.literal(`
          CASE "estado"
            WHEN 'ACTIVA' THEN 1
            WHEN 'BORRADOR' THEN 2
            WHEN 'EN_EXTINCION' THEN 3
            WHEN 'TERMINADA' THEN 4
            WHEN 'INACTIVO' THEN 5
            ELSE 6
          END
        `), 'ASC'],
        ['año_curricula', 'DESC'],
        ['modalidad_estudios', 'ASC'],
        ['nombre_carrera', 'ASC']
      ]
    });

    return NextResponse.json({ data: curriculas });
  } catch (error: unknown) {
    console.error('Error GET curriculas:', error);
    return buildError('Error al cargar curriculas', 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !requireRole(session, ['admin', 'director_escuela'])) {
    return buildError('Sin permisos', 403);
  }

  try {
    const body = await req.json();
    const añoCurricula = parseEntero(body?.año_curricula ?? body?.anio_curricula ?? body?.anio);
    const modalidadEstudios = normalizeModalidadCurricula(body?.modalidad_estudios);
    const creditosTotales = parseEntero(body?.creditos_totales ?? body?.creditos);
    const estado = 'BORRADOR';

    if (!añoCurricula || añoCurricula < 1900) {
      return buildError('El año de currícula es obligatorio');
    }
    if (!modalidadEstudios) {
      return buildError('La modalidad de estudios no es válida');
    }
    if (!creditosTotales || creditosTotales <= 0) {
      return buildError('Los créditos totales deben ser mayores a cero');
    }

    const duplicada = await db.Curriculas.findOne({
      where: {
        año_curricula: añoCurricula,
        modalidad_estudios: modalidadEstudios,
        estado: { [Op.ne]: 'ELIMINADA' }
      }
    });

    if (duplicada) {
      return buildError('Ya existe una currícula para ese año y modalidad', 409);
    }

    const curricula = await db.Curriculas.create({
      nombre_carrera: CARRERA_CURRICULA_FIJA,
      año_curricula: añoCurricula,
      modalidad_estudios: modalidadEstudios,
      creditos_totales: creditosTotales,
      estado: estado
    });

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      usuario_email: session.email,
      accion: 'CREATE',
      tabla_afectada: 'curriculas',
      registro_id: (curricula as any).id,
      datos_nuevos: curricula.toJSON(),
      descripcion: `Currícula creada: ${CARRERA_CURRICULA_FIJA} - ${añoCurricula} - ${modalidadEstudios} (Borrador)`,
    });

    return NextResponse.json({ data: curricula }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error POST curriculas:', error);
    const message = error instanceof Error ? error.message : 'Error al crear currícula';
    return buildError(message);
  }
}
