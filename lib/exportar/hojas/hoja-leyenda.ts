import ExcelJS from 'exceljs';
import { hexToArgb, bordeCompleto, romanizar } from '../utils-excel';

export async function generarHojaLeyenda(
  workbook: ExcelJS.Workbook,
  datos: any
) {
  const sheet = workbook.addWorksheet('Leyenda', {
    properties: { tabColor: { argb: 'FF6B7280' } }
  });
  
  sheet.columns = [
    { header: 'Curso / Elemento', width: 42 },
    { header: 'Código', width: 14 },
    { header: 'Ciclo', width: 12 },
    { header: 'Muestra Visual', width: 22 }
  ];
  
  // Título
  sheet.mergeCells('A1:D1');
  const titulo = sheet.getCell('A1');
  titulo.value = 'LEYENDA DE COLORES Y ABREVIATURAS DEL HORARIO';
  titulo.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titulo.alignment = { horizontal: 'center', vertical: 'middle' };
  titulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF475569' }
  };
  sheet.getRow(1).height = 28;
  
  let row = 3;
  
  // 1. Tipos de Sesiones
  sheet.getCell(`A${row}`).value = 'TIPOS DE SESIÓN Y ABREVIATURAS';
  sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  sheet.mergeCells(`A${row}:D${row}`);
  sheet.getRow(row).height = 22;
  row++;
  
  const tiposSesion = [
    ['Teoría [T]', 'Clases lectivas teóricas dictadas en aula.', 'Celeste claro', 'FFE0E7FF'],
    ['Práctica [P]', 'Clases prácticas orientadas a ejercicios o problemas.', 'Verde claro', 'D1FAE5'],
    ['Laboratorio [L]', 'Sesiones experimentales en salas de cómputo/labs.', 'Ámbar claro', 'FEF3C7'],
    ['Asesoría / Consejería [C]', 'Horas obligatorias de tutoría y consejería docente.', 'Gris neutro', 'FFE5E7EB']
  ];
  
  tiposSesion.forEach(([tipo, desc, colorName, rgbHex]) => {
    sheet.getCell(`A${row}`).value = tipo;
    sheet.getCell(`A${row}`).font = { bold: true, size: 9 };
    sheet.getCell(`B${row}`).value = desc;
    sheet.mergeCells(`B${row}:C${row}`);
    
    const celdaMuestra = sheet.getCell(`D${row}`);
    celdaMuestra.value = colorName;
    celdaMuestra.font = { size: 8, bold: true, color: { argb: 'FF1E293B' } };
    celdaMuestra.alignment = { horizontal: 'center', vertical: 'middle' };
    celdaMuestra.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: rgbHex }
    };
    celdaMuestra.border = bordeCompleto('FFCBD5E1');
    
    sheet.getRow(row).height = 20;
    row++;
  });
  
  row += 2;
  
  // 2. Colores por Curso
  sheet.getCell(`A${row}`).value = 'CATÁLOGO DE CURSOS Y COLORES ASIGNADOS';
  sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  sheet.mergeCells(`A${row}:D${row}`);
  sheet.getRow(row).height = 22;
  row++;
  
  // Header de la tabla de cursos
  sheet.getCell(`A${row}`).value = 'Curso Académico';
  sheet.getCell(`B${row}`).value = 'Código';
  sheet.getCell(`C${row}`).value = 'Ciclo';
  sheet.getCell(`D${row}`).value = 'Color de Celda';
  sheet.getRow(row).height = 22;
  sheet.getRow(row).eachCell((cell, colIdx) => {
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: colIdx === 4 ? 'center' : 'left', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' }
    };
    cell.border = bordeCompleto('FFFFFFFF');
  });
  row++;
  
  // Obtener cursos únicos con sus datos y color
  const cursosUnicos = Array.from(
    new Map(
      datos.asignaciones
        .filter((a: any) => a.curso_codigo && a.tipo_sesion !== 'asesoria')
        .map((a: any) => [`${a.ciclo}-${a.curso_codigo}`, a])
    ).values()
  ).sort((a: any, b: any) => {
    if (a.ciclo !== b.ciclo) return a.ciclo - b.ciclo;
    return a.curso_nombre.localeCompare(b.curso_nombre);
  });
  
  cursosUnicos.forEach((curso: any) => {
    sheet.getCell(`A${row}`).value = curso.curso_nombre;
    sheet.getCell(`A${row}`).font = { size: 9 };
    sheet.getCell(`A${row}`).border = bordeCompleto('FFE2E8F0');
    
    sheet.getCell(`B${row}`).value = curso.curso_codigo;
    sheet.getCell(`B${row}`).font = { size: 9 };
    sheet.getCell(`B${row}`).border = bordeCompleto('FFE2E8F0');
    
    sheet.getCell(`C${row}`).value = `Ciclo ${romanizar(curso.ciclo)}`;
    sheet.getCell(`C${row}`).font = { size: 9 };
    sheet.getCell(`C${row}`).border = bordeCompleto('FFE2E8F0');
    
    const celdaColor = sheet.getCell(`D${row}`);
    celdaColor.value = 'Muestra';
    celdaColor.font = { size: 8, bold: true, color: { argb: 'FF1E293B' } };
    celdaColor.alignment = { horizontal: 'center', vertical: 'middle' };
    
    const color = datos.mapaColores.get(`${curso.ciclo}-${curso.curso_codigo}`);
    if (color) {
      celdaColor.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(color.bg) }
      };
      celdaColor.border = {
        left: { style: 'thick', color: { argb: hexToArgb(color.border) } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    } else {
      celdaColor.border = bordeCompleto('FFE2E8F0');
    }
    
    sheet.getRow(row).height = 20;
    row++;
  });
}
