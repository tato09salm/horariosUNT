import ExcelJS from 'exceljs';
import { 
  PALETA_COLORES_UNT, 
  COLOR_HEADER_DOCENTES, 
  COLOR_TEXTO_ROJO,
  BORDE_FINO 
} from '../utils-excel-unt';

export interface DocenteFila {
  n: number;                  // Número de orden (1-13)
  nombre: string;             // "Robert Jerry Sánchez Ticona"
  curso: string;              // "Ingeniería de Requerimientos"
  t: number;                  // Horas teoría
  p: number;                  // Horas práctica
  l: number;                  // Horas laboratorio
  g: number;                  // Grupos
  total: number;              // Total de horas
  depto: string;              // "Ingeniería de Sistemas"
  docente_id: string;         // UUID
}

export function aplicarTablaDocentes(
  ws: ExcelJS.Worksheet,
  docentes: DocenteFila[]
) {
  const safeMerge = (range: string) => {
    try {
      ws.unMergeCells(range);
    } catch (e) {
      // Ignore when there is nothing to unmerge
    }
    try {
      ws.mergeCells(range);
    } catch (e) {
      // Ignore if still merged by another range
    }
  };

  // Hacer merges para todas las filas (1-14)
  for (let fila = 1; fila <= 14; fila++) {
    safeMerge(`G${fila}:H${fila}`);
    safeMerge(`I${fila}:J${fila}`);
    safeMerge(`P${fila}:Q${fila}`);
  }
  
  // ===== ENCABEZADO (Fila 1) =====
  const headers: Array<[string, string]> = [
    ['F1', 'N°'],
    ['G1', 'DOCENTE'],
    ['I1', 'EXPERIENCIA CURRICULAR'],
    ['K1', 'T'],
    ['L1', 'P'],
    ['M1', 'L'],
    ['N1', 'G'],
    ['O1', 'T. HORAS'],
    ['P1', 'DEPARTAMENTO'],
  ];
  
  headers.forEach(([coord, valor]) => {
    const cell = ws.getCell(coord);
    cell.value = valor;
    cell.font = { 
      name: 'Arial', size: 10, bold: true, 
      color: { argb: COLOR_TEXTO_ROJO } 
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLOR_HEADER_DOCENTES }
    };
    cell.border = BORDE_FINO;
  });
  
  // Aplicar fondo a todas las celdas del header (incluyendo las mergeadas)
  ['F','G','H','I','J','K','L','M','N','O','P','Q'].forEach(col => {
    ws.getCell(`${col}1`).border = BORDE_FINO;
    ws.getCell(`${col}1`).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: COLOR_HEADER_DOCENTES }
    };
  });
  
  // ===== FILAS DE DOCENTES (Filas 2-14) =====
  for (let i = 0; i < 13; i++) {
    const fila = i + 2;
    const color = PALETA_COLORES_UNT[i % PALETA_COLORES_UNT.length];
    
    if (i < docentes.length) {
      const d = docentes[i];
      ws.getCell(`F${fila}`).value = d.n;
      ws.getCell(`G${fila}`).value = d.nombre;
      ws.getCell(`I${fila}`).value = d.curso;
      ws.getCell(`K${fila}`).value = d.t;
      ws.getCell(`L${fila}`).value = d.p;
      ws.getCell(`M${fila}`).value = d.l;
      ws.getCell(`N${fila}`).value = d.g;
      ws.getCell(`O${fila}`).value = d.total;
      ws.getCell(`P${fila}`).value = d.depto;
    } else {
      // Filas vacías: solo el número
      ws.getCell(`F${fila}`).value = i + 1;
    }
    
    // Aplicar formato a TODAS las columnas de la fila
    const colorFila = i < docentes.length ? color : 'FFFFFFFF';
    ['F','G','H','I','J','K','L','M','N','O','P','Q'].forEach(col => {
      const cell = ws.getCell(`${col}${fila}`);
      cell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: colorFila }
      };
      cell.font = { name: 'Arial', size: 9 };
      cell.border = BORDE_FINO;
      
      if (col === 'F' || ['K','L','M','N','O'].includes(col)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      }
    });
  }
}
