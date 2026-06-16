import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { filtrarDisponibilidadPorCargaAdicional } from '@/lib/horarios';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !['admin', 'secretaria'].includes(session.rol)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  try {
    const { programacion_id, bloque, asignaciones } = await req.json();
    if (!programacion_id || !bloque || !asignaciones) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // 1. Obtener todos los slots
    const slots = await query('SELECT id, hora_inicio, hora_fin, orden FROM slots_tiempo ORDER BY orden');
    const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

    // 2. Obtener disponibilidad del docente
    let dispSet = new Set<string>();
    if (bloque.docente_id) {
      const progRow = await queryOne<{ ciclo_academico_id: string }>(
        `SELECT ciclo_academico_id FROM programaciones WHERE id = $1`,
        [programacion_id]
      );
      const disp = await query(
        `SELECT docente_id, dia, slot_id FROM disponibilidad_docente WHERE programacion_id = $1 AND docente_id = $2 AND disponible = true`,
        [programacion_id, bloque.docente_id]
      );
      const filteredDisp = await filtrarDisponibilidadPorCargaAdicional(disp, progRow?.ciclo_academico_id || '');
      filteredDisp.forEach(d => dispSet.add(`${d.dia}-${d.slot_id}`));
    } else {
      // Si no tiene docente (ej. bloque sin asignar), asumimos que cualquier dia/hora es válido por ahora
      dias.forEach(d => slots.forEach(s => dispSet.add(`${d}-${s.id}`)));
    }

    // 3. Obtener ambientes válidos para este bloque
    const tipoAmbiente = bloque.tipo_sesion === 'laboratorio' ? 'laboratorio' : 'aula';
    const ambientesValidos = await query(
      `SELECT id, codigo, nombre, capacidad FROM ambientes WHERE tipo = $1 AND disponible = true AND capacidad >= $2 ORDER BY capacidad ASC`,
      [tipoAmbiente, bloque.num_alumnos || 0]
    );

    // 4. Evaluar opciones
    const sugerencias = [];
    const duracion = bloque.duracion_horas || 1;

    for (const dia of dias) {
      for (let i = 0; i <= slots.length - duracion; i++) {
        const slotCandidates = slots.slice(i, i + duracion);
        
        // El docente debe tener disponibilidad en todos los slots del bloque continuo
        const docenteDisponible = slotCandidates.every(s => dispSet.has(`${dia}-${s.id}`));
        if (!docenteDisponible) continue;

        // Verificar conflicto de grupo
        const grupoOcupado = slotCandidates.some(s => 
          asignaciones.some((a: any) => a.id !== bloque.id && a.dia === dia && a.slot_id === s.id && a.grupo_id === bloque.grupo_id)
        );
        if (grupoOcupado) continue;

        // Verificar conflicto de docente (por si tiene otra clase asignada a pesar de estar disponible)
        const docenteOcupado = bloque.docente_id && slotCandidates.some(s =>
          asignaciones.some((a: any) => a.id !== bloque.id && a.dia === dia && a.slot_id === s.id && a.docente_id === bloque.docente_id)
        );
        if (docenteOcupado) continue;

        // Buscar ambiente disponible
        let ambienteElegido = null;
        for (const amb of ambientesValidos) {
          const ambOcupado = slotCandidates.some(s =>
            asignaciones.some((a: any) => a.id !== bloque.id && a.dia === dia && a.slot_id === s.id && a.ambiente_id === amb.id)
          );
          if (!ambOcupado) {
            ambienteElegido = amb;
            break;
          }
        }

        if (ambienteElegido) {
          sugerencias.push({
            dia,
            slot_id: slotCandidates[0].id,
            hora_inicio: slotCandidates[0].hora_inicio,
            hora_fin: slotCandidates[slotCandidates.length - 1].hora_fin,
            ambiente_id: ambienteElegido.id,
            ambiente_codigo: ambienteElegido.codigo,
            ambiente_nombre: ambienteElegido.nombre,
            score: ambienteElegido.capacidad - (bloque.num_alumnos || 0) // Menor score es mejor (ajuste más exacto)
          });
        }
      }
    }

    // Ordenar sugerencias (las de mejor ajuste de capacidad primero)
    sugerencias.sort((a, b) => a.score - b.score);

    // Etiquetar calidad
    const topSugerencias = sugerencias.slice(0, 3).map((s, i) => ({
      ...s,
      calidad: i === 0 ? 'Solución óptima' : i === 1 ? 'Solución aceptable' : 'Solución de emergencia'
    }));

    return NextResponse.json({ success: true, sugerencias: topSugerencias });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
