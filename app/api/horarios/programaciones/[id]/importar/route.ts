import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne, transaction } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id: programacion_id } = await params;

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows)) throw new Error('Data no es un array');

    const result = await transaction(async (client) => {
      // Opcional: Eliminar programacion_cursos y grupos actuales para esta programación
      await client.query('DELETE FROM programacion_cursos WHERE programacion_id = $1', [programacion_id]);
      await client.query('DELETE FROM grupos WHERE programacion_id = $1', [programacion_id]);

      // Preparar catálogos para mapeos
      const cursos = await client.query('SELECT id, codigo, cantidad_labs FROM cursos');
      const mapCursos: Record<string, any> = {};
      cursos.rows.forEach((c: any) => mapCursos[c.codigo] = c);

      const docentes = await client.query('SELECT id, dni, usuario_id, nombre, apellidos FROM docentes');
      const mapDocentes: Record<string, any> = {};
      docentes.rows.forEach((d: any) => mapDocentes[d.dni] = d);

      // Cargar CSV
      let gruposInsertados = 0;
      let asigInsertadas = 0;

      // Un diccionario local para agrupar las filas por curso_id y tipo_actividad 
      // de modo que asignemos el mismo grupo_id
      const cacheGrupos: Record<string, string> = {}; 

      for (const r of rows) {
        // r = { CICLO, CODIGO, CURSO, GRUPO, DOCENTE, T, P, L, C }
        const codigoCurso = r['CODIGO'] || r['CÓDIGO'];
        const grupoDato = r['GRUPO'];
        const docenteDni = r['DOCENTE'];
        const horasT = parseInt(r['T']) || 0;
        const horasP = parseInt(r['P']) || 0;
        const horasL = parseInt(r['L']) || 0;
        const horasC = parseInt(r['C']) || 0;

        if (codigoCurso === '-') {
          // Consejería aislada, no hay grupo de curso, solo es asignación libre?
          // El esquema exige grupo_id para asignaciones. En el original tal vez se maneja distinto.
          continue; 
        }

        const curso = mapCursos[codigoCurso];
        if (!curso) continue; // Si el curso no existe en la BD, lo saltamos

        const docente = mapDocentes[docenteDni];
        if (!docente) continue; // Si el docente no existe, lo saltamos

        // Extraer tipo de actividad y número
        // Ej: "G1 (Teoría)", "G2 (Laboratorio)", "GA", "GB", "GC"
        let tipo_actividad = 'teoria';
        let num_grupo = 1;

        if (grupoDato.toLowerCase().includes('practica') || grupoDato.toLowerCase().includes('práctica')) tipo_actividad = 'practica';
        else if (grupoDato.toLowerCase().includes('laboratorio')) tipo_actividad = 'laboratorio';

        const matchNum = grupoDato.match(/G(\d+)/i);
        if (matchNum) {
          num_grupo = parseInt(matchNum[1]);
        } else {
          const matchLetter = grupoDato.match(/G([A-Za-z])/i);
          if (matchLetter) {
            // Convertir letra a número: A=1, B=2, C=3, etc.
            num_grupo = matchLetter[1].toUpperCase().charCodeAt(0) - 64;
          }
        }

        // Asegurar que el grupo existe
        const keyGrupo = `${curso.id}-${tipo_actividad}-${num_grupo}`;
        let grupo_id = cacheGrupos[keyGrupo];

        if (!grupo_id) {
          const resGrupo = await client.query(
            `INSERT INTO grupos (programacion_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos)
             VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
            [programacion_id, curso.id, tipo_actividad, num_grupo, 40]
          );
          grupo_id = resGrupo.rows[0].id;
          cacheGrupos[keyGrupo] = grupo_id;
          gruposInsertados++;
        }

        // Crear registro en programacion_cursos
        try {
          await client.query(
            `INSERT INTO programacion_cursos 
              (programacion_id, curso_id, grupo_id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria)
             VALUES 
              ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT ON CONSTRAINT programacion_cursos_programacion_id_grupo_id_docente_id_uk 
             DO UPDATE SET
               curso_id = EXCLUDED.curso_id,
               docente_id = EXCLUDED.docente_id,
               horas_teoria = EXCLUDED.horas_teoria,
               horas_practica = EXCLUDED.horas_practica,
               horas_laboratorio = EXCLUDED.horas_laboratorio,
               horas_consejeria = EXCLUDED.horas_consejeria`,
            [programacion_id, curso.id, grupo_id, docente.id, horasT, horasP, horasL, horasC]
          );
        } catch (conflictError: any) {
          // Si la constraint correcta no existe aún, usar DO NOTHING
          await client.query(
            `INSERT INTO programacion_cursos 
              (programacion_id, curso_id, grupo_id, docente_id, horas_teoria, horas_practica, horas_laboratorio, horas_consejeria)
             VALUES 
              ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT DO NOTHING`,
            [programacion_id, curso.id, grupo_id, docente.id, horasT, horasP, horasL, horasC]
          );
        }
        asigInsertadas++;
      }

      return { grupos: gruposInsertados, asignaciones: asigInsertadas };
    });

    return NextResponse.json({ success: true, message: `Importados ${result.grupos} grupos y ${result.asignaciones} asignaciones.` });
  } catch (error: any) {
    console.error('Error importar CSV:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
