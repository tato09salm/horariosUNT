import ExcelJS from 'exceljs';
import { romanizar } from '../utils-excel';

export async function generarHojaResumen(
  workbook: ExcelJS.Workbook,
  datos: any
) {
  const sheet = workbook.addWorksheet('Resumen', {
    properties: { tabColor: { argb: 'FF1E40AF' } }
  });
  
  // Ancho de columnas para perfecta legibilidad
  sheet.columns = [
    { header: '', width: 28 },
    { header: '', width: 44 }
  ];
  
  // Título Institucional
  sheet.mergeCells('A1:B1');
  const titulo = sheet.getCell('A1');
  titulo.value = 'SISTEMA DE GESTIÓN DE HORARIOS ACADÉMICOS';
  titulo.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titulo.alignment = { horizontal: 'center', vertical: 'middle' };
  titulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }
  };
  sheet.getRow(1).height = 34;
  
  // Subtítulo
  sheet.mergeCells('A2:B2');
  const sub = sheet.getCell('A2');
  sub.value = 'Universidad Nacional de Trujillo — Ingeniería de Sistemas';
  sub.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 20;

  // Separación
  sheet.getRow(3).height = 10;
  
  // Información General
  let row = 4;
  sheet.getCell(`A${row}`).value = 'INFORMACIÓN DE LA PROGRAMACIÓN';
  sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  sheet.mergeCells(`A${row}:B${row}`);
  sheet.getRow(row).height = 22;
  row++;
  
  agregarFilaInfo(sheet, row++, 'Programación ID:', datos.programacion.id);
  agregarFilaInfo(sheet, row++, 'Código / Nombre:', datos.programacion.nombre || datos.programacion.codigo);
  agregarFilaInfo(sheet, row++, 'Ciclo Académico:', datos.programacion.periodo || datos.programacion.ciclo_nombre || '2025-II');
  agregarFilaInfo(sheet, row++, 'Estado de Publicación:', datos.programacion.estado.toUpperCase());
  agregarFilaInfo(sheet, row++, 'Generado el:', new Date().toLocaleString('es-PE'));
  
  row++;
  
  // Estadísticas
  sheet.getCell(`A${row}`).value = 'ESTADÍSTICAS GENERALES DE LA PROGRAMACIÓN';
  sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  sheet.getCell(`A${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E7FF' }
  };
  sheet.mergeCells(`A${row}:B${row}`);
  sheet.getRow(row).height = 22;
  row++;
  
  const uniqueCoursesCount = new Set(datos.asignaciones.map((a: any) => a.curso_codigo)).size;
  agregarFilaInfo(sheet, row++, 'Total de cursos programados:', uniqueCoursesCount);
  agregarFilaInfo(sheet, row++, 'Total de docentes programados:', datos.docentes.length);
  agregarFilaInfo(sheet, row++, 'Total de ambientes/aulas usadas:', datos.aulas.length);
  agregarFilaInfo(sheet, row++, 'Total de asignaciones horarias:', datos.asignaciones.length);
  agregarFilaInfo(sheet, row++, 'Total de ciclos académicos:', datos.ciclos.length);
  
  row++;
  
  // Métricas CSP
  if (datos.metricas || datos.programacion.config?.csp_stats) {
    const met = datos.metricas || datos.programacion.config?.csp_stats;
    sheet.getCell(`A${row}`).value = 'MÉTRICAS Y RESULTADOS DEL MOTOR CSP';
    sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF065F46' } };
    sheet.getCell(`A${row}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' }
    };
    sheet.mergeCells(`A${row}:B${row}`);
    sheet.getRow(row).height = 22;
    row++;
    
    agregarFilaInfo(sheet, row++, 'Total bloques CSP:', `${met.asignados || datos.asignaciones.length} de ${met.total_bloques || met.total || datos.asignaciones.length}`);
    agregarFilaInfo(sheet, row++, 'Prioridad P1 (Nombrados):', met.prioridad_alta || met.p1 || 0);
    agregarFilaInfo(sheet, row++, 'Prioridad P2 (Contratados):', met.prioridad_baja || met.p2 || 0);
    agregarFilaInfo(sheet, row++, 'Asesorías / Consejerías:', met.asesorias_asignadas || 0);
    if (met.bloques_continuos !== undefined) agregarFilaInfo(sheet, row++, 'Bloques continuos:', met.bloques_continuos);
    if (met.franjas_labs_paralelos !== undefined) agregarFilaInfo(sheet, row++, 'Laboratorios en paralelo:', met.franjas_labs_paralelos);
  }
  
  // Índice del Libro Excel
  row += 2;
  sheet.getCell(`A${row}`).value = 'ESTRUCTURA DE HOJAS DEL LIBRO EXCEL';
  sheet.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF334155' } };
  sheet.getCell(`A${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
  };
  sheet.mergeCells(`A${row}:B${row}`);
  sheet.getRow(row).height = 22;
  row++;
  
  const hojas = [
    ['📄 Resumen', 'Información ejecutiva y estadísticas del algoritmo.'],
    ['📅 Horario General', 'Visualización de la grilla horaria consolidada de todos los semestres.'],
    ...datos.ciclos.sort((a:number, b:number)=>a-b).map((c: number) => [`🎓 Ciclo ${romanizar(c)}`, `Horario semanal para las asignaciones del semestre ${romanizar(c)}.`]),
    [`🏛️ Por Aula (${datos.aulas.length} hojas)`, 'Ocupación semanal de aulas y laboratorios activos.'],
    [`👤 Por Docente (${datos.docentes.length} hojas)`, 'Horario individual programado de los docentes.'],
    ['🎨 Leyenda', 'Guía y glosario de colores de cursos por ciclo, sesiones T/P/L/C y prioridades.']
  ];
  
  hojas.forEach(([nombreHoja, desc]) => {
    sheet.getCell(`A${row}`).value = nombreHoja;
    sheet.getCell(`A${row}`).font = { bold: true, size: 9 };
    sheet.getCell(`B${row}`).value = desc;
    sheet.getCell(`B${row}`).font = { size: 9, color: { argb: 'FF475569' } };
    sheet.getRow(row).height = 20;
    
    sheet.getCell(`A${row}`).border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    sheet.getCell(`B${row}`).border = {
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
    
    row++;
  });
}

function agregarFilaInfo(sheet: ExcelJS.Worksheet, row: number, label: string, value: any) {
  sheet.getCell(`A${row}`).value = label;
  sheet.getCell(`A${row}`).font = { bold: true, size: 9, color: { argb: 'FF334155' } };
  sheet.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getCell(`A${row}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }
  };
  
  sheet.getCell(`B${row}`).value = value;
  sheet.getCell(`B${row}`).font = { size: 9, color: { argb: 'FF0F172A' } };
  sheet.getCell(`B${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  
  sheet.getCell(`A${row}`).border = {
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  sheet.getCell(`B${row}`).border = {
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };
  
  sheet.getRow(row).height = 20;
}
