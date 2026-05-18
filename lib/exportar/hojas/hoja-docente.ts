import ExcelJS from 'exceljs';
import { generarGrillaSemanal } from '../utils-excel';

export async function generarHojaDocente(
  workbook: ExcelJS.Workbook,
  datos: any,
  docente: any
) {
  const bloquesDocente = datos.bloquesAgrupados.filter(
    (b: any) => b.docente_nombre?.toLowerCase() === docente.nombre?.toLowerCase()
  );
  
  const nombreHoja = `Doc-${docente.nombre.split(',')[0]}`.substring(0, 31);
  
  await generarGrillaSemanal(workbook, nombreHoja, {
    titulo: `HORARIO DOCENTE: ${docente.nombre}`,
    subtitulo: `Categoría: ${docente.categoria?.replace('_',' ')?.toUpperCase() || 'DOCENTE'} · Condición: ${docente.condicion?.toUpperCase() || 'NOMBRADO'}`,
    bloques: bloquesDocente,
    mapaColores: datos.mapaColores,
    tabColor: 'FFDC2626'
  });
}
