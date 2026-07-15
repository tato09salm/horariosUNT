import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

const SECTION_TABLES = [
  'carga_horaria_preparacion',
  'carga_horaria_consejeria',
  'carga_horaria_investigacion',
  'carga_horaria_capacitacion',
  'carga_horaria_gobierno',
  'carga_horaria_administracion',
  'carga_horaria_asesoria',
  'carga_horaria_rsu',
  'carga_horaria_comites',
] as const;

function normalizeDia(dia: string | null | undefined): string {
  if (!dia) return '';
  const map: Record<string, string> = {
    lunes: 'lunes', lun: 'lunes',
    martes: 'martes', mar: 'martes',
    miercoles: 'miercoles', miércoles: 'miercoles', mie: 'miercoles',
    jueves: 'jueves', jue: 'jueves',
    viernes: 'viernes', vie: 'viernes',
    sabado: 'sabado', sábado: 'sabado', sab: 'sabado',
  };
  return map[dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')] || dia.toLowerCase();
}

function parseHorarioSlots(raw: unknown): any[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function slotToOcupacion(
  slot: any,
  meta: {
    docente_id: string;
    docente_nombre?: string;
    curso_codigo?: string;
    curso_nombre?: string;
    origen: string;
  }
) {
  const ambienteId = slot?.ambienteId || slot?.ambiente_id || null;

  const dia = normalizeDia(slot?.dia);
  const horaRaw = slot?.hora ?? slot?.hora_inicio;
  const hora = typeof horaRaw === 'number'
    ? horaRaw
    : parseInt(String(horaRaw || '').split(':')[0], 10);

  if (!dia || Number.isNaN(hora)) return null;

  return {
    dia,
    hora_inicio: `${String(hora).padStart(2, '0')}:00`,
    hora_fin: `${String(hora + 1).padStart(2, '0')}:00`,
    ambiente_id: ambienteId,
    ambiente_codigo: slot?.ambienteCodigo || slot?.ambiente_codigo || null,
    ambiente_nombre: slot?.ambienteNombre || slot?.ambiente_nombre || null,
    docente_id: meta.docente_id,
    docente_nombre: meta.docente_nombre || null,
    curso_codigo: meta.curso_codigo || null,
    curso_nombre: meta.curso_nombre || null,
    origen: meta.origen,
  };
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cicloAcademicoId = searchParams.get('ciclo_academico_id');
  const excludeDocenteId = searchParams.get('exclude_docente_id');

  if (!cicloAcademicoId) {
    return NextResponse.json({ error: 'ciclo_academico_id es requerido' }, { status: 400 });
  }

  try {
    // Ensure horario_slots column exists on all carga_horaria tables
    const ensureCols = async (tables: string[], columns: [string, string][]) => {
      for (const tbl of tables) {
        for (const [col, colType] of columns) {
          try {
            await query(`
              DO $$ BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM information_schema.columns
                  WHERE table_name = '${tbl}'
                  AND column_name = '${col}'
                ) THEN
                  EXECUTE 'ALTER TABLE ${tbl} ADD COLUMN ${col} ${colType}';
                END IF;
              END $$;
            `);
          } catch (_) {}
        }
      }
    };
    const allSectionTables = [
      'carga_horaria_preparacion', 'carga_horaria_consejeria',
      'carga_horaria_investigacion', 'carga_horaria_capacitacion',
      'carga_horaria_gobierno', 'carga_horaria_administracion',
      'carga_horaria_asesoria', 'carga_horaria_rsu',
      'carga_horaria_comites'
    ];
    await ensureCols(['carga_horaria_cursos'], [['horario_slots', 'JSONB']]);
    await ensureCols(allSectionTables, [['horario_slots', 'JSONB']]);

    const ocupaciones: any[] = [];
    const docenteFilter = excludeDocenteId ? ' AND ch.docente_id != $2' : '';
    const baseParams: any[] = excludeDocenteId
      ? [cicloAcademicoId, excludeDocenteId]
      : [cicloAcademicoId];

    try {
      const cursosRows = await query(
        `SELECT ch.docente_id,
                d.nombre || ' ' || d.apellidos AS docente_nombre,
                c.codigo AS curso_codigo,
                c.nombre AS curso_nombre,
                chc.horario_slots
         FROM carga_horaria_cursos chc
         JOIN carga_horaria ch ON ch.id = chc.carga_horaria_id
         JOIN docentes d ON d.id = ch.docente_id
         JOIN cursos c ON c.id = chc.curso_id
         WHERE ch.ciclo_academico_id = $1
           AND ch.activo = true
           AND chc.horario_slots IS NOT NULL
           ${docenteFilter}`,
        baseParams
      );

      for (const row of cursosRows) {
        for (const slot of parseHorarioSlots(row.horario_slots)) {
          const item = slotToOcupacion(slot, {
            docente_id: row.docente_id,
            docente_nombre: row.docente_nombre,
            curso_codigo: row.curso_codigo,
            curso_nombre: row.curso_nombre,
            origen: 'carga_horaria_curso',
          });
          if (item) ocupaciones.push(item);
        }
      }
    } catch (err) {
      // carga_horaria_cursos may not have horario_slots column yet; skip gracefully
    }

    for (const table of SECTION_TABLES) {
      try {
        const sectionRows = await query(
          `SELECT ch.docente_id,
                  d.nombre || ' ' || d.apellidos AS docente_nombre,
                  s.horario_slots
           FROM ${table} s
           JOIN carga_horaria ch ON ch.id = s.carga_horaria_id
           JOIN docentes d ON d.id = ch.docente_id
           WHERE ch.ciclo_academico_id = $1
             AND ch.activo = true
             AND s.horario_slots IS NOT NULL
             ${docenteFilter}`,
          baseParams
        );

        for (const row of sectionRows) {
          for (const slot of parseHorarioSlots(row.horario_slots)) {
            const item = slotToOcupacion(slot, {
              docente_id: row.docente_id,
              docente_nombre: row.docente_nombre,
              origen: 'carga_horaria_no_lectiva',
            });
            if (item) ocupaciones.push(item);
          }
        }
      } catch (err) {
        // Table may not have horario_slots column yet; skip gracefully
      }
    }

    return NextResponse.json({ data: ocupaciones });
  } catch (error: any) {
    console.error('Error in GET /api/carga-horaria/ocupacion-ambientes:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
