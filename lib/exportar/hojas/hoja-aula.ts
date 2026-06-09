import ExcelJS from 'exceljs';
import { generarGrillaSemanal } from '../utils-excel';

export async function generarHojaAula(
  workbook: ExcelJS.Workbook,
  datos: any,
  aula: any
) {
  const bloquesAula = datos.bloquesAgrupados.filter(
    (b: any) => b.aula?.toLowerCase() === aula.codigo?.toLowerCase()
  );
  
  const nombreHoja = `Aula ${aula.codigo}`.substring(0, 31);
  
  await generarGrillaSemanal(workbook, nombreHoja, {
    titulo: `OCUPACIÓN DE AMBIENTE: ${aula.codigo}`,
    subtitulo: `Capacidad: ${aula.capacidad || 'N/A'} Alumnos · Tipo: ${aula.tipo?.toUpperCase() || 'AULA'}`,
    bloques: bloquesAula,
    mapaColores: datos.mapaColores,
    tabColor: 'FF059669',
    slots: datos.slots || []
  });
}
