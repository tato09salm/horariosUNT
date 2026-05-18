import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ANCHOS_COLUMNA } from './utils-excel-unt';
import { aplicarEncabezadoInstitucional } from './secciones/encabezado-institucional';
import { aplicarTablaDocentes, type DocenteFila } from './secciones/tabla-docentes';
import { aplicarTablaHorario } from './secciones/tabla-horario';
import { aplicarAsignaciones, type Asignacion } from './secciones/asignaciones';

interface ConfigExportUNT {
  programacion: {
    año: string;
    semestre: string;
    inicio: string;
    termino: string;
  };
  ciclos: Array<{
    ciclo: string;          // "II", "IV", "VI", "VIII", "X"
    seccion: string;        // "A"
    docentes: DocenteFila[];
    asignaciones: Asignacion[];
  }>;
}

export async function exportarHorariosFormatoUNT(config: ConfigExportUNT) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Horarios UNT';
  workbook.created = new Date();
  
  // Una hoja por cada ciclo (II, IV, VI, VIII, X)
  for (const cicloData of config.ciclos) {
    const ws = workbook.addWorksheet(cicloData.ciclo, {
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,  // A4
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        margins: { 
          left: 0.3, right: 0.3, 
          top: 0.3, bottom: 0.3,
          header: 0.3, footer: 0.3
        }
      }
    });
    
    // Configurar anchos de columna
    Object.entries(ANCHOS_COLUMNA).forEach(([col, ancho]) => {
      ws.getColumn(col).width = ancho;
    });
    
    // 1. Aplicar encabezado institucional
    aplicarEncabezadoInstitucional(ws, {
      ciclo: cicloData.ciclo,
      seccion: cicloData.seccion,
      año: config.programacion.año,
      semestre: config.programacion.semestre,
      inicio: config.programacion.inicio,
      termino: config.programacion.termino,
    });
    
    // 2. Aplicar tabla de docentes
    aplicarTablaDocentes(ws, cicloData.docentes);
    
    // 3. Aplicar tabla de horario (grilla vacía)
    aplicarTablaHorario(ws);
    
    // 4. Crear mapa docente → color
    const mapaDocenteColor = new Map<string, number>();
    cicloData.docentes.forEach((d, idx) => {
      mapaDocenteColor.set(d.docente_id, idx);
    });
    
    // 5. Aplicar asignaciones (bloques de clases)
    aplicarAsignaciones(ws, cicloData.asignaciones, mapaDocenteColor);
  }
  
  // Generar archivo y descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  const fecha = new Date().toISOString().split('T')[0];
  saveAs(blob, `Horarios_UNT_${fecha}.xlsx`);
}
