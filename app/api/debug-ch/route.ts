
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  try {
    console.log('🔍 Debugging carga_horaria table...');
    const allCargaHoraria = await query('SELECT * FROM carga_horaria');
    console.log('📊 All carga_horaria:', allCargaHoraria);
    
    const allCursos = await query('SELECT * FROM carga_horaria_cursos');
    console.log('📊 All carga_horaria_cursos:', allCursos);

    return NextResponse.json({
      cargaHoraria: allCargaHoraria,
      cursos: allCursos
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
