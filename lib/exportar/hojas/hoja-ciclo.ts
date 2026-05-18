import ExcelJS from 'exceljs';
import { generarGrillaSemanal, colorPorCiclo, romanizar } from '../utils-excel';

export async function generarHojaCiclo(
  workbook: ExcelJS.Workbook,
  datos: any,
  ciclo: number
) {
  const bloquesCiclo = datos.bloquesAgrupados.filter((b: any) => b.ciclo === ciclo);
  const cursosCiclo = new Set(bloquesCiclo.map((b: any) => b.curso_codigo)).size;
  
  await generarGrillaSemanal(workbook, `Ciclo ${romanizar(ciclo)}`, {
    titulo: `HORARIO SEMANAL — CICLO ${romanizar(ciclo)}`,
    subtitulo: `${cursosCiclo} Cursos Programados · Semestre ${romanizar(ciclo)}`,
    bloques: bloquesCiclo,
    mapaColores: datos.mapaColores,
    tabColor: colorPorCiclo(ciclo)
  });
}
