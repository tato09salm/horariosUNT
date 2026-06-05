import ExcelJS from 'exceljs';

// Paleta de colores por docente (ARGB sin el '#')
export const PALETA_COLORES_UNT = [
  'FF90EE90',  // 1. Verde claro
  'FFADD8E6',  // 2. Celeste
  'FFFFB6E1',  // 3. Rosa lila
  'FFFFA500',  // 4. Naranja
  'FFE5E5E5',  // 5. Gris claro
  'FFFF66CC',  // 6. Rosa fucsia
  'FF98FB98',  // 7. Verde menta
  'FFFFCC99',  // 8. Durazno
  'FFCCFFCC',  // 9. Verde muy claro
  'FFFFFF99',  // 10. Amarillo claro
  'FFCCCCFF',  // 11. Lavanda
  'FFFFCCCC',  // 12. Rosa muy claro
  'FFCCFFFF',  // 13. Aguamarina
];

export const COLOR_ALMUERZO = 'FFFF0000';
export const COLOR_HEADER_DOCENTES = 'FFFFCCFF';
export const COLOR_TEXTO_AZUL = 'FF0070C0';
export const COLOR_TEXTO_ROJO = 'FFFF0000';

// Anchos de columna estándar
export const ANCHOS_COLUMNA: Record<string, number> = {
  'A': 11, 'B': 13, 'C': 13, 'D': 13, 'E': 13,
  'F': 4, 'G': 16, 'H': 14,
  'I': 14, 'J': 14,
  'K': 14, 'L': 14, 'M': 14, 'N': 14,
  'O': 8, 'P': 9, 'Q': 11
};

// Mapeo de día → columnas
export const COLUMNAS_DIA: Record<string, { inicio: string; fin: string }> = {
  'lunes':     { inicio: 'B', fin: 'C' },
  'martes':    { inicio: 'D', fin: 'E' },
  'miercoles': { inicio: 'F', fin: 'H' },
  'jueves':    { inicio: 'I', fin: 'J' },
  'viernes':   { inicio: 'K', fin: 'N' },
  'sabado':    { inicio: 'O', fin: 'P' },
};

// Mapeo hora → fila
export const HORAS_GRILLA = [
  { rango: '7-8',   fila: 17, inicio: '07:00' },
  { rango: '8-9',   fila: 18, inicio: '08:00' },
  { rango: '9-10',  fila: 19, inicio: '09:00' },
  { rango: '10-11', fila: 20, inicio: '10:00' },
  { rango: '11-12', fila: 21, inicio: '11:00' },
  { rango: '12-1',  fila: 22, inicio: '12:00' },
  { rango: '1-2',   fila: 23, inicio: '13:00', esAlmuerzo: true },
  { rango: '2-3',   fila: 24, inicio: '14:00' },
  { rango: '3-4',   fila: 25, inicio: '15:00' },
  { rango: '4-5',   fila: 26, inicio: '16:00' },
  { rango: '5-6',   fila: 27, inicio: '17:00' },
  { rango: '6-7',   fila: 28, inicio: '18:00' },
  { rango: '7-8',   fila: 29, inicio: '19:00' },
  { rango: '8-9',   fila: 30, inicio: '20:00' },
];

// Borde estándar
export const BORDE_FINO: Partial<ExcelJS.Borders> = {
  top:    { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  left:   { style: 'thin', color: { argb: 'FF000000' } },
  right:  { style: 'thin', color: { argb: 'FF000000' } },
};

// Convertir tipo de sesión a etiqueta visible
export function etiquetaTipoSesion(tipo: string): string {
  const map: Record<string, string> = {
    'teoria': 'Teoria',
    'practica': 'Practica',
    'laboratorio': '',  // Solo se muestra el nombre del lab o del curso en la asignación
    'teoria_practica': 'Teoria y Practica',
  };
  return map[tipo] || tipo;
}

// Convertir hora "07:00" → fila correspondiente
export function horaAFila(horaInicio: string): number | null {
  const h = HORAS_GRILLA.find(x => x.inicio === horaInicio || x.inicio === horaInicio.slice(0, 5));
  return h ? h.fila : null;
}
