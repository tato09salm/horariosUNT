
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    console.log('🔍 Getting docentes and all ciclos...');
    const docentes = await query('SELECT id, nombre, apellidos, facultad, dpto_academico FROM docentes WHERE activo = true LIMIT 1');
    const allCiclos = await query("SELECT id, nombre FROM ciclos WHERE activo = true");
    console.log('All ciclos found:', allCiclos);
    
    if (docentes.length === 0) {
      return NextResponse.json({ error: 'No docentes activos', allCiclos }, { status: 400 });
    }
    
    if (allCiclos.length === 0) {
      return NextResponse.json({ error: 'No hay ciclos activos', allCiclos }, { status: 400 });
    }

    const docente = docentes[0];
    const ciclo = allCiclos[0];
    console.log('Using docente:', docente);
    console.log('Using ciclo:', ciclo);
    
    // Insert test carga horaria for ciclo_plan 1
    const insertResult = await queryOne(`
      INSERT INTO carga_horaria (
        docente_id, ciclo_academico_id, ciclo_plan, horas_asignadas,
        facultad, dpto_academico, modalidad, activo, created_at, updated_at
      ) VALUES ($1, $2, 1, 15, $3, $4, 'Tiempo Completo', true, NOW(), NOW())
      RETURNING *
    `, [docente.id, ciclo.id, docente.facultad || 'Facultad de Ciencias', docente.dpto_academico || 'Dpto. de Informática']);

    console.log('✅ Insert result:', insertResult);

    return NextResponse.json({
      success: true,
      inserted: insertResult,
      docente,
      ciclo,
      allCiclos,
      info: `Ahora selecciona el ciclo '${ciclo.nombre}' en /carga-horaria y expande Ciclo I para ver la carga!`
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
