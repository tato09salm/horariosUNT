import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonNoStore(body: any, init?: { status?: number }) {
  const res = NextResponse.json(body, init);
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

function esUUIDValido(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

function numeroAcicloRomano(n: number): string {
  const romanos: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X'
  };
  return romanos[n] || n.toString();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return jsonNoStore({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const programacionId = id;

    if (!esUUIDValido(programacionId)) {
      return jsonNoStore(
        { error: 'UUID inválido' },
        { status: 400 }
      );
    }

    console.log("DEBUG [exportar-unt]: programacionId =", programacionId);
    // 1. Programación
    const prog = await queryOne(`
      SELECT p.*, c.nombre as ciclo_nombre, c.año, c.semestre
      FROM programaciones p 
      JOIN ciclos c ON c.id = p.ciclo_id
      WHERE p.id = $1
    `, [programacionId]);

    console.log("DEBUG [exportar-unt]: prog =", prog);

    if (!prog) {
      console.log("DEBUG [exportar-unt]: Programming not found, returning 404");
      return jsonNoStore({ error: 'Programación no encontrada' }, { status: 404 });
    }

    if (prog.fase !== 4 && prog.estado !== 'publicado') {
      return jsonNoStore(
        { error: 'El formato UNT solo se habilita cuando la programación está en Fase 4' },
        { status: 400 }
      );
    }

    // 2. Cargar asignaciones crudas (borrador en config, o activas en tabla real)
    let rawAsignaciones = prog.config?.asignaciones || [];
    if (rawAsignaciones.length === 0) {
      rawAsignaciones = await query(`
        SELECT a.id, a.dia, a.slot_id, a.grupo_id, a.docente_id, a.ambiente_id, a.tipo
        FROM asignaciones a
        WHERE a.ciclo_id = $1 AND a.estado = 'activo'
      `, [prog.ciclo_id]);
    }

    // 3. Cargar catálogos en memoria para enriquecimiento rápido
    const cursos = await query(`
      SELECT id, codigo, nombre, ciclo_plan, horas_teoria, horas_practica, horas_laboratorio FROM cursos
    `);
    const cursosMap = new Map(cursos.map((c: any) => [c.id, c]));

    const grupos = await query(`
      SELECT id, numero_grupo, curso_id FROM grupos
    `);
    const gruposMap = new Map(grupos.map((g: any) => [g.id, g]));

    const docentes = await query(`
      SELECT id, nombre, apellidos, categoria, condicion FROM docentes
    `);
    const docentesMap = new Map(docentes.map((d: any) => [d.id, d]));

    const ambientes = await query(`
      SELECT id, codigo, nombre, tipo, capacidad FROM ambientes
    `);
    const ambientesMap = new Map(ambientes.map((a: any) => [a.id, a]));

    const slots = await query(`
      SELECT id, hora_inicio, hora_fin, nombre FROM slots_tiempo
    `);
    const slotsMap = new Map(slots.map((s: any) => [s.id, s]));

    // 4. Enriquecer asignaciones
    const asignacionesEnriquecidas = rawAsignaciones.map((a: any) => {
      const slot = slotsMap.get(a.slot_id);
      const grupo = gruposMap.get(a.grupo_id);
      const curso = grupo ? cursosMap.get(grupo.curso_id) : (a.curso_id ? cursosMap.get(a.curso_id) : null);
      const docente = docentesMap.get(a.docente_id);
      const ambiente = ambientesMap.get(a.ambiente_id);

      // Calcular duración
      let duracion = 1;
      if (slot?.hora_inicio && slot?.hora_fin) {
        const hIni = parseInt(slot.hora_inicio.split(':')[0]);
        const hFin = parseInt(slot.hora_fin.split(':')[0]);
        duracion = hFin - hIni;
      }

      return {
        id: a.id,
        dia: a.dia,
        hora_inicio: slot?.hora_inicio ? slot.hora_inicio.slice(0, 5) : '',
        hora_fin: slot?.hora_fin ? slot.hora_fin.slice(0, 5) : '',
        duracion_horas: duracion,
        tipo_sesion: a.tipo_sesion || a.tipo || 'teoria',
        curso_codigo: curso?.codigo || a.curso_codigo || '',
        curso_nombre: curso?.nombre || a.curso_nombre || '',
        ciclo: Number(curso?.ciclo_plan || a.ciclo || 0),
        grupo: grupo ? `G${grupo.numero_grupo}` : (a.grupo || ''),
        aula: ambiente?.codigo || a.ambiente_codigo || '',
        aula_id: ambiente?.id || a.ambiente_id || null,
        docente_id: docente?.id || a.docente_id || null,
        docente_nombre: docente ? `${docente.nombre} ${docente.apellidos}` : (a.docente_nombre || a.docente || ''),
        docente_departamento: 'Ingeniería de Sistemas'
      };
    });

    // 5. Filtrar ciclos válidos
    const ciclosActivos = (Array.from(new Set(asignacionesEnriquecidas.map((a: any) => a.ciclo))) as number[])
      .filter((c: number) => !isNaN(c) && c >= 1 && c <= 10)
      .sort((a: number, b: number) => a - b);

    const ciclos = [];

    for (const cicloNum of ciclosActivos) {
      const asignacionesCiclo = asignacionesEnriquecidas.filter((a: any) => a.ciclo === cicloNum);
      
      // Docentes del ciclo
      const docenteIds = Array.from(new Set(asignacionesCiclo.map((a: any) => a.docente_id).filter(Boolean)));
      
      // Construir tabla de docentes para este ciclo
      const docentesFila = docenteIds.map((docId, index) => {
        const docente = docentesMap.get(docId as string);
        const asigsDocente = asignacionesCiclo.filter((a: any) => a.docente_id === docId);
        
        // Cursos que dicta el docente en este ciclo
        const cursosNombres = Array.from(new Set(asigsDocente.map((a: any) => a.curso_nombre)));
        const totalHoras = asigsDocente.reduce((sum: number, a: any) => sum + a.duracion_horas, 0);
        
        const teoriaHoras = asigsDocente
          .filter((a: any) => a.tipo_sesion === 'teoria')
          .reduce((sum: number, a: any) => sum + a.duracion_horas, 0);

        const practicaHoras = asigsDocente
          .filter((a: any) => a.tipo_sesion === 'practica')
          .reduce((sum: number, a: any) => sum + a.duracion_horas, 0);

        const labHoras = asigsDocente
          .filter((a: any) => a.tipo_sesion === 'laboratorio')
          .reduce((sum: number, a: any) => sum + a.duracion_horas, 0);

        const uniqueGrupos = new Set(asigsDocente.map((a: any) => a.grupo)).size;

        return {
          n: index + 1,
          nombre: docente ? `${docente.nombre} ${docente.apellidos}` : 'Docente Desconocido',
          curso: cursosNombres.join(', '),
          t: teoriaHoras,
          p: practicaHoras,
          l: labHoras,
          g: uniqueGrupos,
          total: totalHoras,
          depto: 'Ingeniería de Sistemas',
          docente_id: docId as string
        };
      }).sort((a, b) => a.nombre.localeCompare(b.nombre));

      // Re-indexar 'n' después de ordenar
      docentesFila.forEach((d, idx) => {
        d.n = idx + 1;
      });

      const mapaDocenteN = new Map(docentesFila.map(d => [d.docente_id, d.n]));

      // Asignaciones mapeadas con docente_n
      const asignacionesMapeadas = asignacionesCiclo.map((a: any) => ({
        docente_n: mapaDocenteN.get(a.docente_id) || 1,
        docente_id: a.docente_id,
        curso_codigo: a.curso_codigo,
        curso_nombre: a.curso_nombre,
        grupo: a.grupo,
        aula: a.aula,
        tipo_sesion: a.tipo_sesion,
        dia: a.dia,
        hora_inicio: a.hora_inicio,
        hora_fin: a.hora_fin,
        duracion_horas: a.duracion_horas
      }));

      ciclos.push({
        ciclo: numeroAcicloRomano(cicloNum),
        seccion: 'A',
        docentes: docentesFila,
        asignaciones: asignacionesMapeadas
      });
    }

    return jsonNoStore({
      programacion: {
        año: prog.año?.toString() ?? '2025',
        semestre: prog.semestre ?? 'II',
        inicio: '01 de setiembre de 2025',
        termino: '20 de diciembre de 2025'
      },
      ciclos
    });

  } catch (error) {
    console.error('❌ Error al exportar horario para Excel (Formato UNT):', error);
    return jsonNoStore(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}
