'use client';

export interface ColorCurso {
  bg: string;
  border: string;
  name: string;
  patron?: string;
}

const PALETA_COLORES: ColorCurso[] = [
  { bg: '#FECACA', border: '#DC2626', name: 'rojo' },
  { bg: '#FED7AA', border: '#EA580C', name: 'naranja' },
  { bg: '#FEF08A', border: '#CA8A04', name: 'amarillo' },
  { bg: '#BBF7D0', border: '#16A34A', name: 'verde' },
  { bg: '#A7F3D0', border: '#0D9488', name: 'verdeAzul' },
  { bg: '#BAE6FD', border: '#0284C7', name: 'celeste' },
  { bg: '#C7D2FE', border: '#4F46E5', name: 'lavanda' },
  { bg: '#DDD6FE', border: '#7C3AED', name: 'violeta' },
  { bg: '#F5D0FE', border: '#C026D3', name: 'rosaClaro' },
  { bg: '#FBCFE8', border: '#DB2777', name: 'rosa' }
];

/**
 * Asigna colores únicos a cursos dentro de cada ciclo.
 * Mismo curso = mismo color (incluso si es T, P o L).
 * Cursos distintos del mismo ciclo = colores distintos.
 */
export function generarMapaColores(asignaciones: any[]): Map<string, ColorCurso> {
  const cursosPorCiclo = new Map<number, Set<string>>();
  
  asignaciones.forEach(a => {
    const ciclo = a.ciclo_plan || a.ciclo || 0;
    if (!ciclo) return;
    if (!cursosPorCiclo.has(ciclo)) {
      cursosPorCiclo.set(ciclo, new Set());
    }
    if (a.curso_codigo) {
      cursosPorCiclo.get(ciclo)!.add(a.curso_codigo);
    }
  });
  
  const mapaColores = new Map<string, ColorCurso>();
  
  cursosPorCiclo.forEach((cursos, ciclo) => {
    const cursosOrdenados = Array.from(cursos).sort();
    
    cursosOrdenados.forEach((cursoCodigo, index) => {
      let color: ColorCurso;
      if (index < PALETA_COLORES.length) {
        color = { ...PALETA_COLORES[index] };
      } else {
        const hue = (index * 137.5) % 360;
        color = {
          bg: `hsl(${hue}, 80%, 92%)`,
          border: `hsl(${hue}, 80%, 45%)`,
          name: `procedural-${index}`,
          patron: 'rayado'
        };
      }
      const key = `${ciclo}-${cursoCodigo}`;
      mapaColores.set(key, color);
    });
  });
  
  return mapaColores;
}

/**
 * Obtiene el color asignado a un curso específico en un ciclo.
 */
export function obtenerColorCurso(
  mapaColores: Map<string, ColorCurso>,
  ciclo: number | null | undefined,
  cursoCodigo: string | undefined,
  tipoSesion?: string
): ColorCurso {
  if (tipoSesion === 'asesoria') {
    return {
      bg: '#E5E7EB',      // Gris claro
      border: '#6B7280',   // Gris oscuro
      name: 'asesoria'
    };
  }

  const c = ciclo || 0;
  if (!c || !cursoCodigo) {
    return PALETA_COLORES[0];
  }
  const key = `${c}-${cursoCodigo}`;
  return mapaColores.get(key) || PALETA_COLORES[0];
}
