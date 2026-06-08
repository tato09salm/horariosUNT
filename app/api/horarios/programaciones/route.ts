import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/auditoria';
import db from '@/lib/sequelize';
import { Op } from 'sequelize';

// GET — Listar programaciones (filtro por ciclo_id)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ciclo_id = searchParams.get('ciclo_id');

  try {
    const where: any = {};
    if (ciclo_id) {
      where.ciclo_id = ciclo_id;
    }

    const programaciones = await db.Programaciones.findAll({
      where,
      include: [
        {
          model: db.Ciclos,
          as: 'ciclo',
          attributes: ['nombre', 'año', 'semestre']
        },
        {
          model: db.Usuarios,
          as: 'created_by_usuario',
          attributes: ['nombre', 'apellidos']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Mapear para mantener compatibilidad con el front y agregar conteos
    const data = await Promise.all(programaciones.map(async (p: any) => {
      const totalCursos = await db.ProgramacionCursos.count({
        where: { programacion_id: p.id },
        distinct: true,
        col: 'curso_id'
      });
      const totalDocentes = await db.ProgramacionCursos.count({
        where: {
          programacion_id: p.id,
          docente_id: { [Op.not]: null }
        },
        distinct: true,
        col: 'docente_id'
      });

      const json = p.toJSON();
      return {
        ...json,
        ciclo_nombre: json.ciclo?.nombre,
        año: json.ciclo?.año,
        semestre: json.ciclo?.semestre,
        creador_nombre: json.created_by_usuario ? `${json.created_by_usuario.nombre} ${json.created_by_usuario.apellidos}` : null,
        total_cursos: totalCursos,
        total_docentes: totalDocentes
      };
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error GET programaciones:', error);
    return NextResponse.json({ error: 'Error al cargar programaciones' }, { status: 500 });
  }
}

// POST — Crear nueva programación (auto-genera nombre)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { ciclo_id, config } = body;

    if (!ciclo_id) {
      return NextResponse.json({ error: 'ciclo_id es requerido' }, { status: 400 });
    }

    // Obtener datos del ciclo para auto-generar el nombre
    const ciclo = await db.Ciclos.findByPk(ciclo_id);
    if (!ciclo) {
      return NextResponse.json({ error: 'Ciclo no encontrado' }, { status: 404 });
    }

    // Verificar que no exista una programación activa para este ciclo
    const existente = await db.Programaciones.findOne({
      where: { 
        ciclo_id, 
        estado: { [Op.ne]: 'cancelado' }
      }
    });
    
    if (existente) {
      return NextResponse.json(
        { error: `Ya existe una programación activa para este ciclo: ${(existente as any).nombre}` },
        { status: 409 }
      );
    }

    // Snapshot de horarios restringidos actuales
    const configRow = await db.Configuracion.findOne({
      where: { clave: 'HORARIOS_RESTRINGIDOS' }
    });
    let horariosRestringidos = {};
    if (configRow && (configRow as any).valor) {
      try {
        horariosRestringidos = JSON.parse((configRow as any).valor);
      } catch (e) {
        console.error('Error al parsear HORARIOS_RESTRINGIDOS para snapshot:', e);
      }
    }

    // Auto-generar nombre: "HORARIO 2024-II"
    const nombre = `HORARIO ${(ciclo as any).año}-${(ciclo as any).semestre}`;

    const prog = await db.Programaciones.create({
      ciclo_id,
      nombre,
      fase: 1,
      estado: 'borrador',
      config: {
        ...(config || {}),
        horarios_restringidos: horariosRestringidos
      },
      created_by: session.id
    });

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'programaciones',
      registro_id: (prog as any).id,
      datos_nuevos: prog.toJSON(),
      descripcion: `Programación creada: ${nombre}`,
    });

    return NextResponse.json({ data: prog }, { status: 201 });
  } catch (error: any) {
    console.error('Error POST programaciones:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
