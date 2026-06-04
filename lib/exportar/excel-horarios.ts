import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { generarMapaColores } from '@/lib/colores-curso';
import { generarHojaResumen } from './hojas/hoja-resumen';
import { generarHojaGeneral } from './hojas/hoja-general';
import { generarHojaCiclo } from './hojas/hoja-ciclo';
import { generarHojaAula } from './hojas/hoja-aula';
import { generarHojaDocente } from './hojas/hoja-docente';
import { generarHojaLeyenda } from './hojas/hoja-leyenda';
import { type BloqueAgrupado } from './utils-excel';

interface ConfigExportacion {
  programacion: any;
  asignaciones: any[];
  docentes: any[];
  aulas: any[];
  ciclos: number[];
  metricas?: any;
}

export function agruparBloquesContiguos(asignaciones: any[]): BloqueAgrupado[] {
  const normalizeDay = (d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const dayOrder: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  
  const sorted = [...asignaciones].sort((a, b) => {
    const dayA = dayOrder[normalizeDay(a.dia)] || 99;
    const dayB = dayOrder[normalizeDay(b.dia)] || 99;
    if (dayA !== dayB) return dayA - dayB;
    
    const cA = a.curso_codigo || '';
    const cB = b.curso_codigo || '';
    if (cA !== cB) return cA.localeCompare(cB);
    
    const gA = a.grupo || '';
    const gB = b.grupo || '';
    if (gA !== gB) return gA.localeCompare(gB);
    
    const tA = a.tipo_sesion || '';
    const tB = b.tipo_sesion || '';
    if (tA !== tB) return tA.localeCompare(tB);
    
    const dA = a.docente_nombre || '';
    const dB = b.docente_nombre || '';
    if (dA !== dB) return dA.localeCompare(dB);
    
    const auA = a.aula || '';
    const auB = b.aula || '';
    if (auA !== auB) return auA.localeCompare(auB);
    
    const timeA = a.hora_inicio || '';
    const timeB = b.hora_inicio || '';
    return timeA.localeCompare(timeB);
  });

  const result: (BloqueAgrupado & { docente_id?: any })[] = [];
  for (const a of sorted) {
    const curso_codigo = a.curso_codigo || '';
    const curso_nombre = a.curso_nombre || '';
    const grupo = a.grupo || '';
    const aula = a.aula || '';
    const docente_nombre = a.docente_nombre || '';
    const docente_id = a.docente_id || null;
    const tipo_sesion = a.tipo_sesion || '';
    const dia = a.dia || '';
    const hora_inicio = a.hora_inicio?.slice(0, 5) || '';
    const hora_fin = a.hora_fin?.slice(0, 5) || '';
    const ciclo = Number(a.ciclo_plan || a.ciclo || 1);

    if (result.length === 0) {
      result.push({
        curso_codigo,
        curso_nombre,
        grupo,
        aula,
        docente_nombre,
        docente_id,
        tipo_sesion,
        dia,
        hora_inicio,
        hora_fin,
        duracion_horas: 1,
        ciclo
      });
      continue;
    }
    const last = result[result.length - 1];
    const sameSession =
      normalizeDay(last.dia) === normalizeDay(dia) &&
      last.curso_codigo === curso_codigo &&
      last.grupo === grupo &&
      last.tipo_sesion === tipo_sesion &&
      last.docente_nombre === docente_nombre &&
      String(last.docente_id) === String(docente_id) &&
      last.aula === aula;

    if (sameSession && last.hora_fin === hora_inicio) {
      last.hora_fin = hora_fin;
      last.duracion_horas += 1;
    } else {
      result.push({
        curso_codigo,
        curso_nombre,
        grupo,
        aula,
        docente_nombre,
        docente_id,
        tipo_sesion,
        dia,
        hora_inicio,
        hora_fin,
        duracion_horas: 1,
        ciclo
      });
    }
  }

  return result;
}

export async function exportarHorariosExcel(config: ConfigExportacion) {
  const workbook = new ExcelJS.Workbook();
  
  // Metadata del archivo
  workbook.creator = 'Sistema de Horarios UNT';
  workbook.lastModifiedBy = 'Sistema CSP';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Preparar datos compartidos
  console.log('🚀 Iniciando exportación...');
  console.log(`📦 Asignaciones recibidas: ${config.asignaciones.length}`);
  
  // Analizar distribución de ciclos
  const distribucionCiclos = new Map<any, number>();
  config.asignaciones.forEach(a => {
    const ciclo = a.ciclo;
    distribucionCiclos.set(ciclo, (distribucionCiclos.get(ciclo) || 0) + 1);
  });
  
  console.log('📊 Distribución por ciclo:');
  distribucionCiclos.forEach((count, ciclo) => {
    console.log(`  Ciclo ${ciclo}: ${count} asignaciones`);
  });

  const bloquesAgrupados = agruparBloquesContiguos(config.asignaciones);
  const mapaColores = generarMapaColores(config.asignaciones);
  
  // Filtrar ciclos que REALMENTE tienen bloques
  const ciclosConBloques = Array.from(new Set(bloquesAgrupados.map(b => b.ciclo)))
    .filter(c => c !== null && c !== undefined && typeof c === 'number' && c > 0 && c <= 10)
    .sort((a, b) => a - b);
  
  console.log('📊 Ciclos detectados en la programación:', ciclosConBloques);
  
  const datos = {
    ...config,
    bloquesAgrupados,
    mapaColores,
    ciclos: ciclosConBloques
  };
  
  // 1. Hoja de Resumen
  await generarHojaResumen(workbook, datos);
  
  // 2. Hoja de Horario General
  await generarHojaGeneral(workbook, datos);
  
  // 3. Hojas por Ciclo (solo crear hojas para ciclos que existen y tienen bloques)
  for (const ciclo of ciclosConBloques) {
    const bloquesCiclo = bloquesAgrupados.filter(b => b.ciclo === ciclo);
    if (bloquesCiclo.length === 0) {
      console.warn(`⚠️ Saltando Ciclo ${ciclo} (sin bloques)`);
      continue;
    }
    await generarHojaCiclo(workbook, datos, ciclo);
  }
  
  // 4. Hojas por Aula
  for (const aula of config.aulas) {
    const tieneAsignaciones = config.asignaciones.some(
      a => a.aula_id === aula.id || a.aula?.toLowerCase() === aula.codigo?.toLowerCase()
    );
    if (tieneAsignaciones) {
      await generarHojaAula(workbook, datos, aula);
    }
  }
  
  // 5. Hojas por Docente
  for (const docente of config.docentes) {
    const tieneAsignaciones = config.asignaciones.some(
      a => String(a.docente_id) === String(docente.id) || 
        (a.docente_nombre && docente.nombre && docente.apellidos && (
          a.docente_nombre.toLowerCase().includes(docente.nombre.toLowerCase()) && 
          a.docente_nombre.toLowerCase().includes(docente.apellidos.toLowerCase())
        )) ||
        a.docente_nombre?.toLowerCase() === docente.nombre?.toLowerCase()
    );
    if (tieneAsignaciones) {
      await generarHojaDocente(workbook, datos, docente);
    }
  }
  
  // 6. Hoja de Leyenda
  await generarHojaLeyenda(workbook, datos);
  
  // Generar archivo y descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  const fecha = new Date().toISOString().split('T')[0];
  const codigoProg = config.programacion?.codigo || config.programacion?.id || 'unt';
  const nombreArchivo = `horarios-${codigoProg}-${fecha}.xlsx`;
  
  saveAs(blob, nombreArchivo);
}
