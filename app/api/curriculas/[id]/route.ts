import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import db from '@/lib/sequelize';
import { Op } from 'sequelize';
import {
  CARRERA_CURRICULA_FIJA,
  CURRICULA_ESTADO_LABELS,
  normalizeEstadoCurricula,
  normalizeModalidadCurricula,
  type EstadoCurricula,
} from '@/lib/curriculas';

function parseEntero(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numero = Number(value);
  return Number.isInteger(numero) ? numero : null;
}

function buildError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !requireRole(session, ['admin', 'director_escuela', 'secretaria'])) {
    return buildError('Sin permisos', 403);
  }

  const { id } = await params;
  const curricula = await db.Curriculas.findByPk(id);

  if (!curricula) {
    return buildError('No encontrado', 404);
  }

  return NextResponse.json({ data: curricula });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !requireRole(session, ['admin', 'director_escuela'])) {
    return buildError('Sin permisos', 403);
  }

  const { id } = await params;

  try {
    const actual = await db.Curriculas.findByPk(id);
    if (!actual) {
      return buildError('No encontrado', 404);
    }

    const body = await req.json();
    const añoCurricula = parseEntero(body?.año_curricula ?? body?.anio_curricula ?? (actual as any).año_curricula);
    const modalidadEstudios = body?.modalidad_estudios !== undefined
      ? normalizeModalidadCurricula(body.modalidad_estudios)
      : normalizeModalidadCurricula((actual as any).modalidad_estudios);
    const creditosTotales = parseEntero(body?.creditos_totales ?? (actual as any).creditos_totales);
    const estado = normalizeEstadoCurricula(body?.estado ?? (actual as any).estado) || 'ACTIVA';

    if (!añoCurricula || añoCurricula < 1900) {
      return buildError('El año de currícula es obligatorio');
    }
    if (!modalidadEstudios) {
      return buildError('La modalidad de estudios no es válida');
    }
    if (!creditosTotales || creditosTotales <= 0) {
      return buildError('Los créditos totales deben ser mayores a cero');
    }

    if (!CURRICULA_ESTADO_LABELS[estado as EstadoCurricula]) {
      return buildError('El estado de la currícula no es válido');
    }

    const duplicada = await db.Curriculas.findOne({
      where: {
        año_curricula: añoCurricula,
        modalidad_estudios: modalidadEstudios,
        id: { [Op.ne]: id },
        estado: { [Op.ne]: 'ELIMINADA' }
      }
    });

    if (duplicada) {
      return buildError('Ya existe una currícula activa para ese año y modalidad', 409);
    }

    const t = await db.sequelize.transaction();

    try {
      if (estado === 'ACTIVA') {
        // Pasar la actual activa a EN_EXTINCION
        await db.Curriculas.update(
          { estado: 'EN_EXTINCION' },
          { 
            where: { 
              estado: 'ACTIVA',
              id: { [Op.ne]: id }
            },
            transaction: t 
          }
        );

        // Actualizar la malla curricular actual en la tabla configuracion
        const configRow = await db.Configuracion.findOne({
          where: { clave: 'ID_MALLA_CURRICULAR_ACTUAL' },
          transaction: t
        });
        if (configRow) {
          await configRow.update({ valor: id }, { transaction: t });
        } else {
          await db.Configuracion.create({
            clave: 'ID_MALLA_CURRICULAR_ACTUAL',
            valor: id
          }, { transaction: t });
        }
      }

      const datosAnteriores = actual.toJSON();

      await actual.update({
        nombre_carrera: CARRERA_CURRICULA_FIJA,
        año_curricula: añoCurricula,
        modalidad_estudios: modalidadEstudios,
        creditos_totales: creditosTotales,
        estado: estado
      }, { transaction: t });

      await registrarAuditoria({
        usuario_id: session.id,
        usuario_nombre: `${session.nombre} ${session.apellidos}`,
        usuario_email: session.email,
        accion: 'UPDATE',
        tabla_afectada: 'curriculas',
        registro_id: id,
        datos_anteriores: datosAnteriores,
        datos_nuevos: actual.toJSON(),
        descripcion: `Currícula actualizada: ${CARRERA_CURRICULA_FIJA} - ${añoCurricula} - ${modalidadEstudios} (${CURRICULA_ESTADO_LABELS[estado as EstadoCurricula]})`,
      });

      await t.commit();
      return NextResponse.json({ data: actual });
    } catch (err: any) {
      await t.rollback();
      throw err;
    }
  } catch (error: unknown) {
    console.error('Error PUT curriculas:', error);
    const message = error instanceof Error ? error.message : 'Error al actualizar currícula';
    return buildError(message);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !requireRole(session, ['admin', 'director_escuela'])) {
    return buildError('Sin permisos', 403);
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const confirmAll = searchParams.get('confirmAll') === 'true';

  const actual = await db.Curriculas.findByPk(id);
  if (!actual) {
    return buildError('No encontrado', 404);
  }

  // Verificar si hay horarios activos vinculados
  const activeSchedulesCount = await db.Asignaciones.count({
    where: { estado: 'activo' },
    include: [{
      model: db.Grupos,
      as: 'grupo',
      required: true,
      include: [{
        model: db.Cursos,
        as: 'curso',
        required: true,
        include: [{
          model: db.MallaCurricular,
          as: 'mallas',
          required: true,
          where: { curricula_id: id }
        }]
      }]
    }]
  });

  const checkOnly = searchParams.get('checkOnly') === 'true';
  if (checkOnly) {
    return NextResponse.json({
      hasSchedules: activeSchedulesCount > 0,
      count: activeSchedulesCount
    });
  }

  if (activeSchedulesCount > 0 && !confirmAll) {
    return NextResponse.json({
      error: 'REQUIRES_DOUBLE_CONFIRMATION',
      message: `La currícula tiene ${activeSchedulesCount} horarios vinculados. De eliminarla, también se eliminarán todos estos horarios.`,
      count: activeSchedulesCount
    }, { status: 409 });
  }

  const t = await db.sequelize.transaction();

  try {
    // 1. Obtener IDs de cursos vinculados
    const mallas = await db.MallaCurricular.findAll({
      where: { curricula_id: id },
      transaction: t
    });
    const cursoIds = mallas.map((m: any) => m.curso_id);

    let schedulesDeleted = 0;
    if (cursoIds.length > 0) {
      // 2. Obtener IDs de grupos de estos cursos
      const grupos = await db.Grupos.findAll({
        where: { curso_id: { [Op.in]: cursoIds } },
        transaction: t
      });
      const grupoIds = grupos.map((g: any) => g.id);

      if (grupoIds.length > 0) {
        // 3. Soft-delete de asignaciones vinculadas
        const [updatedCount] = await db.Asignaciones.update(
          { estado: 'eliminado' },
          {
            where: {
              grupo_id: { [Op.in]: grupoIds },
              estado: 'activo'
            },
            transaction: t
          }
        );
        schedulesDeleted = updatedCount;
      }

      // 4. Soft-delete/desactivación de cursos vinculados
      await db.Cursos.update(
        { activo: false },
        {
          where: { id: { [Op.in]: cursoIds } },
          transaction: t
        }
      );
    }

    // 5. Soft-delete de la currícula (estado = ELIMINADA)
    const datosAnteriores = actual.toJSON();
    await actual.update({
      estado: 'ELIMINADA'
    }, { transaction: t });

    // 6. Registrar Auditoría
    let descripcionAuditoria = `Currícula eliminada lógicamente: ${(actual as any).nombre_carrera} - ${(actual as any).año_curricula} - ${(actual as any).modalidad_estudios}.`;
    if (schedulesDeleted > 0) {
      descripcionAuditoria += ` Se eliminaron ${schedulesDeleted} asignaciones de horario vinculadas.`;
    }
    descripcionAuditoria += ` Se desactivaron ${cursoIds.length} cursos vinculados.`;

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      usuario_email: session.email,
      accion: 'DELETE',
      tabla_afectada: 'curriculas',
      registro_id: id,
      datos_anteriores: datosAnteriores,
      datos_nuevos: actual.toJSON(),
      descripcion: descripcionAuditoria,
    });

    await t.commit();
    return NextResponse.json({ data: actual, schedulesDeleted });
  } catch (err: any) {
    await t.rollback();
    console.error('Error DELETE curricula transaction:', err);
    return buildError(err.message || 'Error al eliminar currícula', 500);
  }
}
