
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    const targetCicloId = '92d41cbb-4404-495b-8eb3-85ba649b2b9e';
    
    console.log('🔍 Getting all data...');
    
    const allCiclos = await query('SELECT id, nombre FROM ciclos');
    console.log('All ciclos:', allCiclos);
    
    const allDocentes = await query('SELECT id, nombre, apellidos FROM docentes WHERE activo = true');
    console.log('All docentes:', allDocentes);
    
    const allCH = await query('SELECT * FROM carga_horaria');
    console.log('All carga_horaria:', allCH);
    
    const chForTargetCiclo = await query(
      'SELECT ch.*, d.nombre as docente_nombre, d.apellidos as docente_apellidos, ca.nombre as ciclo_academico_nombre ' +
      'FROM carga_horaria ch ' +
      'JOIN docentes d ON ch.docente_id = d.id ' +
      'JOIN ciclos ca ON ch.ciclo_academico_id = ca.id ' +
      'WHERE ch.ciclo_academico_id = $1', 
      [targetCicloId]
    );
    
    console.log('CH for target ciclo:', chForTargetCiclo);
    
    return NextResponse.json({
      targetCicloId,
      allCiclos,
      allDocentes,
      allCH,
      chForTargetCiclo
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
