import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const body = await req.json();
    const { carga_horaria_id, docente_id, ...sections } = body;

    if (!carga_horaria_id) {
      return NextResponse.json({ error: 'carga_horaria_id es requerido' }, { status: 400 });
    }

    // Verificar que la carga horaria existe y pertenece al docente correcto
    const ch = await queryOne(`SELECT * FROM carga_horaria WHERE id = $1 AND activo = true`, [carga_horaria_id]);
    if (!ch) {
      return NextResponse.json({ error: 'Carga horaria no encontrada' }, { status: 404 });
    }

    // Si es docente, verificar que sea su propia carga horaria
    if (session.rol === 'docente') {
      const docente = await queryOne(`SELECT id FROM docentes WHERE email = $1`, [session.email]);
      if (!docente || docente.id !== ch.docente_id) {
        return NextResponse.json({ error: 'No puedes modificar la carga horaria de otro docente' }, { status: 403 });
      }
    } else if (!['admin', 'director_escuela', 'secretaria'].includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const ensureNonNegative = (val: any) => {
      const num = Number(val);
      return isNaN(num) ? 0 : Math.max(num, 0);
    };

    const getDescField = (tableName: string) => {
      if (tableName === 'carga_horaria_preparacion') return 'descripcion';
      if (tableName === 'carga_horaria_investigacion') return 'proyecto';
      if (tableName === 'carga_horaria_rsu') return 'plan';
      return 'detalles';
    };

    const sectionsConfig: { key: string; table: string }[] = [
      { key: 'preparacion', table: 'carga_horaria_preparacion' },
      { key: 'consejeria', table: 'carga_horaria_consejeria' },
      { key: 'investigacion', table: 'carga_horaria_investigacion' },
      { key: 'capacitacion', table: 'carga_horaria_capacitacion' },
      { key: 'gobierno', table: 'carga_horaria_gobierno' },
      { key: 'administracion', table: 'carga_horaria_administracion' },
      { key: 'asesoria', table: 'carga_horaria_asesoria' },
      { key: 'rsu', table: 'carga_horaria_rsu' },
      { key: 'comites', table: 'carga_horaria_comites' },
    ];

    for (const { key, table } of sectionsConfig) {
      const data = sections[key];
      if (data === undefined) continue;
      const horas = ensureNonNegative(data.horas);
      const descripcion = data.items?.[0]?.descripcion || data.descripcion || data.detalles || data.proyecto || data.plan || '';
      const descField = getDescField(table);

      // Delete + insert
      await query(`DELETE FROM ${table} WHERE carga_horaria_id = $1`, [carga_horaria_id]);
      if (horas > 0) {
        await query(
          `INSERT INTO ${table} (carga_horaria_id, horas, ${descField}) VALUES ($1, $2, $3)`,
          [carga_horaria_id, horas, descripcion]
        );
      }
    }

    await registrarAuditoria({
      usuario_id: session.id,
      accion: 'UPDATE',
      tabla_afectada: 'carga_horaria',
      registro_id: carga_horaria_id,
      datos_nuevos: sections,
      descripcion: `Actualización de horas no lectivas: carga_horaria_id=${carga_horaria_id}`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in PUT /api/carga-horaria/no-lectiva:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
