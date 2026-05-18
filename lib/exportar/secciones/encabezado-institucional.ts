import ExcelJS from 'exceljs';
import { COLOR_TEXTO_AZUL } from '../utils-excel-unt';

interface DatosEncabezado {
  ciclo: string;        // "VI"
  seccion: string;      // "A"
  año: string;          // "2025"
  semestre: string;     // "II"
  inicio: string;       // "01 de setiembre de 2025"
  termino: string;      // "20 de diciembre de 2025"
}

export function aplicarEncabezadoInstitucional(
  ws: ExcelJS.Worksheet,
  datos: DatosEncabezado
) {
  // Universidad (A1:E1)
  ws.mergeCells('A1:E1');
  ws.getCell('A1').value = 'UNIVERSIDAD NACIONAL DE TRUJILLO';
  ws.getCell('A1').font = { name: 'Arial', size: 11, bold: true };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Facultad (A2:E2)
  ws.mergeCells('A2:E2');
  ws.getCell('A2').value = 'FACULTAD DE INGENIERIA';
  ws.getCell('A2').font = { name: 'Arial', size: 11, bold: true };
  ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Escuela (fila 4)
  ws.getCell('A4').value = 'ESCUELA:';
  ws.getCell('A4').font = { name: 'Arial', size: 10, bold: true };
  ws.mergeCells('B4:E4');
  ws.getCell('B4').value = 'INGENIERIA DE SISTEMAS';
  ws.getCell('B4').font = { 
    name: 'Arial', size: 10, bold: true, 
    color: { argb: COLOR_TEXTO_AZUL } 
  };
  
  // Ciclo y Sección (fila 6)
  ws.getCell('A6').value = 'CICLO:';
  ws.getCell('A6').font = { name: 'Arial', size: 10, bold: true };
  ws.getCell('B6').value = datos.ciclo;
  ws.getCell('B6').font = { 
    name: 'Arial', size: 10, bold: true,
    color: { argb: COLOR_TEXTO_AZUL }
  };
  ws.getCell('B6').alignment = { horizontal: 'center' };
  
  ws.getCell('C6').value = 'SECCION:';
  ws.getCell('C6').font = { name: 'Arial', size: 10, bold: true };
  ws.mergeCells('D6:E6');
  ws.getCell('D6').value = datos.seccion;
  ws.getCell('D6').font = { name: 'Arial', size: 10, bold: true };
  ws.getCell('D6').alignment = { horizontal: 'center' };
  
  // Sede (fila 8)
  ws.getCell('A8').value = 'SEDE:';
  ws.getCell('A8').font = { name: 'Arial', size: 10, bold: true };
  ws.mergeCells('B8:E8');
  ws.getCell('B8').value = 'TRUJILLO';
  ws.getCell('B8').font = { name: 'Arial', size: 10, bold: true };
  
  // Año académico (fila 10)
  ws.getCell('A10').value = 'AÑO ACADEMICO:';
  ws.getCell('A10').font = { name: 'Arial', size: 10, bold: true };
  ws.getCell('B10').value = datos.año;
  ws.getCell('B10').font = { name: 'Arial', size: 10, bold: true };
  
  ws.getCell('C10').value = 'SEMESTRE:';
  ws.getCell('C10').font = { name: 'Arial', size: 10, bold: true };
  ws.mergeCells('D10:E10');
  ws.getCell('D10').value = datos.semestre;
  ws.getCell('D10').font = { name: 'Arial', size: 10, bold: true };
  
  // Fechas (filas 12-13)
  ws.mergeCells('A12:E12');
  ws.getCell('A12').value = `Inicio del ciclo:  ${datos.inicio}`;
  ws.getCell('A12').font = { name: 'Arial', size: 9, italic: true };
  
  ws.mergeCells('A13:E13');
  ws.getCell('A13').value = `Termino del ciclo: ${datos.termino}`;
  ws.getCell('A13').font = { name: 'Arial', size: 9, italic: true };
}
