import ExcelJS from 'exceljs';
import { generarGrillaSemanal } from '../utils-excel';

export async function generarHojaGeneral(
  workbook: ExcelJS.Workbook,
  datos: any
) {
  await generarGrillaSemanal(workbook, 'Horario General', {
    titulo: 'HORARIO GENERAL CONSOLIDADO',
    subtitulo: `${datos.programacion.nombre || datos.programacion.codigo} — Periodo Académico`,
    bloques: datos.bloquesAgrupados,
    mapaColores: datos.mapaColores,
    tabColor: 'FF6366F1',
    slots: datos.slots || []
  });
}
