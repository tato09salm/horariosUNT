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

function hashTexto(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];

  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = light - c / 2;
  const toHex = (value: number) => {
    const n = Math.round((value + m) * 255);
    return n.toString(16).padStart(2, '0');
  };

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`.toUpperCase();
}

function colorCursoDesdeTexto(texto: string, indice: number): ColorCurso {
  const hash = hashTexto(texto);
  const hue = (hash + indice * 37) % 360;
  return {
    bg: hslToHex(hue, 74, 87),
    border: hslToHex(hue, 82, 42),
    name: texto
  };
}

function colorDeReserva(cursoCodigo: string, ciclo?: number | string | null): ColorCurso {
  const semilla = `${ciclo || 'x'}-${cursoCodigo || 'curso'}`;
  return colorCursoDesdeTexto(semilla, 0);
}

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
      const color = colorCursoDesdeTexto(`${ciclo}-${cursoCodigo}`, index);
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

  if (tipoSesion === 'carga_adicional') {
    return {
      bg: '#FCE7F3',      // Rosado claro
      border: '#DB2777',   // Rosado oscuro
      name: 'carga_adicional'
    };
  }

  const c = ciclo || 0;
  if (!c || !cursoCodigo) {
    return colorDeReserva(cursoCodigo || 'sin-codigo', ciclo);
  }
  const key = `${c}-${cursoCodigo}`;
  const exacta = mapaColores.get(key);
  if (exacta) return exacta;

  const porCurso = Array.from(mapaColores.entries()).find(([k]) => k.endsWith(`-${cursoCodigo}`));
  if (porCurso) return porCurso[1];

  return colorDeReserva(cursoCodigo, ciclo);
}
