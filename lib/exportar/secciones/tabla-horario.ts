import ExcelJS from 'exceljs';
import { 
  HORAS_GRILLA, 
  COLOR_ALMUERZO, 
  BORDE_FINO 
} from '../utils-excel-unt';

export function aplicarTablaHorario(ws: ExcelJS.Worksheet) {
  // ===== ENCABEZADO (Fila 16) =====
  ws.mergeCells('B16:C16');
  ws.mergeCells('D16:E16');
  ws.mergeCells('F16:H16');
  ws.mergeCells('I16:J16');
  ws.mergeCells('K16:N16');
  ws.mergeCells('O16:P16');
  
  const headers: Array<[string, string]> = [
    ['A16', 'HORA'],
    ['B16', 'LUNES'],
    ['D16', 'MARTES'],
    ['F16', 'MIERCOLES'],
    ['I16', 'JUEVES'],
    ['K16', 'VIERNES'],
    ['O16', 'SABADO'],
    ['Q16', 'HORA'],
  ];
  
  headers.forEach(([coord, valor]) => {
    const cell = ws.getCell(coord);
    cell.value = valor;
    cell.font = { name: 'Arial', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDE_FINO;
  });
  
  // Aplicar formato a todas las columnas del header
  ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q'].forEach(col => {
    ws.getCell(`${col}16`).border = BORDE_FINO;
  });
  
  ws.getRow(16).height = 25;
  
  // ===== FILAS DE HORARIO (17-30) =====
  HORAS_GRILLA.forEach(h => {
    ws.getRow(h.fila).height = 35;
    
    // Merges por día
    ws.mergeCells(`B${h.fila}:C${h.fila}`);
    ws.mergeCells(`D${h.fila}:E${h.fila}`);
    ws.mergeCells(`F${h.fila}:H${h.fila}`);
    ws.mergeCells(`I${h.fila}:J${h.fila}`);
    ws.mergeCells(`K${h.fila}:N${h.fila}`);
    ws.mergeCells(`O${h.fila}:P${h.fila}`);
    
    // Columnas HORA (A y Q)
    ['A', 'Q'].forEach(col => {
      const cell = ws.getCell(`${col}${h.fila}`);
      cell.value = h.rango;
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = BORDE_FINO;
    });
    
    // FILA DE ALMUERZO EN ROJO
    if (h.esAlmuerzo) {
      ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q']
        .forEach(col => {
          const cell = ws.getCell(`${col}${h.fila}`);
          cell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: COLOR_ALMUERZO }
          };
          cell.border = BORDE_FINO;
          
          if (col === 'B') {
            cell.value = 'HORA DE ALMUERZO';
            cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
    } else {
      // Bordes para celdas de día
      ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'].forEach(col => {
        ws.getCell(`${col}${h.fila}`).border = BORDE_FINO;
      });
    }
  });
}
