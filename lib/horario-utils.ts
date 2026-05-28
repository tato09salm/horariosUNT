export const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'] as const;
export const DIAS_LABEL: Record<string, string> = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie',
};

export const TIPO_SESION_LABEL: Record<string, string> = {
  teoria: 'Teoría',
  practica: 'Práctica',
  laboratorio: 'Laboratorio',
  asesoria: 'Asesoría',
};

export const TIPO_SESION_ICON: Record<string, string> = {
  teoria: '📘',
  practica: '📝',
  laboratorio: '🔬',
  asesoria: '💬',
};

/** Colores de borde por ciclo del plan de estudios */
export function colorCiclo(cicloPlan: number | null | undefined): string {
  const palette = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5'];
  const c = cicloPlan || 0;
  return palette[c % palette.length];
}

export function colorCurso(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const hex = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '000000'.substring(0, 6 - hex.length) + hex;
}

export function formatDocente(nombre: string | undefined): string {
  if (!nombre) return 'Sin docente';
  return nombre.replace(/,\s*/g, ', ').trim();
}

export function tipoAmbienteLabel(tipo: string, codigo?: string): string {
  if (tipo === 'asesoria') return 'Virtual / Cubículo';
  if (tipo === 'laboratorio') return codigo ? `Lab ${codigo}` : 'Laboratorio';
  return codigo ? `Aula ${codigo}` : 'Aula';
}
