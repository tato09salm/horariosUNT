/** URL de cursos asignados a una programación. */
export function programacionCursosApiUrl(programacionId: string): string {
  return `/api/horarios/programaciones/${programacionId}/cursos`;
}

export async function fetchProgramacionCursos(programacionId: string) {
  const res = await fetch(programacionCursosApiUrl(programacionId));
  if (res.ok) return res.json();

  const progRes = await fetch(`/api/horarios/programaciones/${programacionId}`);
  if (progRes.ok) {
    const prog = await progRes.json();
    return {
      data: prog.data?.cursos ?? [],
      cargaDocentes: prog.data?.cargaDocentes ?? [],
    };
  }

  return { data: [], cargaDocentes: [] };
}
