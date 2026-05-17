import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { registrarAuditoria } from '@/lib/auditoria';

/**
 * POST /api/horarios/programaciones/[id]/csv
 * Importa cursos a la programación desde un CSV.
 * 
 * Formato CSV esperado (sin encabezado o con encabezado ignorado):
 * curso_codigo,grupo_numero,docente_codigo,horas_teoria,horas_practica,horas_lab,horas_consejeria,seccion
 * IS-601,1,28282828,1,2,0,1,A
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const prog = await queryOne(`SELECT * FROM programaciones WHERE id = $1`, [id]);
  if (!prog) return NextResponse.json({ error: 'Programación no encontrada' }, { status: 404 });
  if (prog.fase !== 1) return NextResponse.json({ error: 'Solo se puede importar en Fase 1' }, { status: 400 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Detectar si la primera línea es encabezado
    const firstLine = lines[0].toLowerCase();
    const startIndex = firstLine.includes('codigo') || firstLine.includes('código') || firstLine.includes('curso') ? 1 : 0;

    const resultados = { importados: 0, errores: [] as string[] };

    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 2) continue;

      const [curso_codigo, grupo_numero_str, docente_codigo, ht, hp, hl, hc, seccion] = cols;

      // Buscar curso
      const curso = await queryOne(`SELECT * FROM cursos WHERE codigo = $1 AND activo = true`, [curso_codigo]);
      if (!curso) {
        resultados.errores.push(`Línea ${i + 1}: Curso "${curso_codigo}" no encontrado`);
        continue;
      }

      // Buscar grupo del ciclo de la programación
      const grupo_numero = parseInt(grupo_numero_str || '1');
      const grupo = await queryOne(`
        SELECT g.* FROM grupos g
        WHERE g.curso_id = $1 AND g.ciclo_id = $2 AND g.numero_grupo = $3
      `, [curso.id, prog.ciclo_id, grupo_numero]);
      if (!grupo) {
        resultados.errores.push(`Línea ${i + 1}: Grupo ${grupo_numero} de ${curso_codigo} no existe para este ciclo`);
        continue;
      }

      // Buscar docente (opcional)
      let docente_id = null;
      if (docente_codigo) {
        // En el nuevo esquema, el identificador único del docente es su DNI
        const docente = await queryOne(`SELECT id FROM docentes WHERE dni = $1`, [docente_codigo]);
        if (!docente) {
          resultados.errores.push(`Línea ${i + 1}: Docente con DNI "${docente_codigo}" no encontrado (se omitirá)`);
        } else {
          docente_id = docente.id;
        }
      }

      const parseHora = (val: string, fallback: number) => {
        const parsed = parseInt(val);
        return isNaN(parsed) ? fallback : parsed;
      };

      const horas_teoria = parseHora(ht, curso.horas_teoria);
      const horas_practica = parseHora(hp, curso.horas_practica);
      const horas_laboratorio = parseHora(hl, 0);
      const horas_consejeria = parseHora(hc, 1);

      try {
        await queryOne(`
          INSERT INTO programacion_cursos
            (programacion_id, curso_id, grupo_id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria, seccion)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (programacion_id, grupo_id) DO UPDATE SET
            docente_id = EXCLUDED.docente_id,
            horas_teoria = EXCLUDED.horas_teoria,
            horas_practica = EXCLUDED.horas_practica,
            horas_laboratorio = EXCLUDED.horas_laboratorio,
            horas_consejeria = EXCLUDED.horas_consejeria,
            seccion = EXCLUDED.seccion
        `, [id, curso.id, grupo.id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria, seccion || null]);
        resultados.importados++;
      } catch (e: any) {
        resultados.errores.push(`Línea ${i + 1}: ${e.message}`);
      }
    }

    await registrarAuditoria({
      usuario_id: session.id,
      usuario_nombre: `${session.nombre} ${session.apellidos}`,
      accion: 'CREATE',
      tabla_afectada: 'programacion_cursos',
      registro_id: id,
      descripcion: `Importación CSV: ${resultados.importados} cursos importados, ${resultados.errores.length} errores`,
    });

    return NextResponse.json({ success: true, ...resultados });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
