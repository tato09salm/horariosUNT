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

type DocenteDraft = {
  docente_id: string;
  nombre: string;
  cursos: Set<string>;
  grupos: Set<string>;
  t: number;
  p: number;
  l: number;
};

function safeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*\[\]:]/g, '').trim();
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
}

function normalizarDocenteId(docenteId: string | null | undefined): string {
  return docenteId && docenteId.trim() ? docenteId : 'sin-docente';
}

function normalizarAula(aula: string | null | undefined): string {
  return (aula || '').trim().toUpperCase();
}

function buildDocentesFromAsignaciones(
  asignaciones: Asignacion[],
  docenteNameMap: Map<string, string>
): DocenteFila[] {
  const docentesMap = new Map<string, DocenteDraft>();

  for (const a of asignaciones) {
    const docenteId = normalizarDocenteId(a.docente_id);
    const nombre = docenteNameMap.get(docenteId) || (docenteId === 'sin-docente' ? 'Sin docente' : 'Docente');
    const draft = docentesMap.get(docenteId) || {
      docente_id: docenteId,
      nombre,
      cursos: new Set<string>(),
      grupos: new Set<string>(),
      t: 0,
      p: 0,
      l: 0,
    };

    const horas = a.duracion_horas || 1;
    if (a.tipo_sesion === 'teoria') draft.t += horas;
    else if (a.tipo_sesion === 'practica') draft.p += horas;
    else if (a.tipo_sesion === 'laboratorio') draft.l += horas;
    else if (a.tipo_sesion === 'teoria_practica') {
      draft.t += horas;
      draft.p += horas;
    }

    if (a.curso_nombre) draft.cursos.add(a.curso_nombre);
    else if (a.curso_codigo) draft.cursos.add(a.curso_codigo);

    if (a.grupo) draft.grupos.add(a.grupo);

    docentesMap.set(docenteId, draft);
  }

  const docentes = Array.from(docentesMap.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((d, idx) => {
      const total = d.t + d.p + d.l;
      return {
        n: idx + 1,
        nombre: d.nombre,
        curso: Array.from(d.cursos.values()).join(', '),
        t: d.t,
        p: d.p,
        l: d.l,
        g: d.grupos.size,
        total,
        depto: 'Ingeniería de Sistemas',
        docente_id: d.docente_id,
      };
    });

  return docentes;
}

function remapAsignacionesDocenteN(
  asignaciones: Asignacion[],
  docentes: DocenteFila[]
): Asignacion[] {
  const docenteIndex = new Map<string, number>();
  docentes.forEach((d, idx) => docenteIndex.set(d.docente_id, idx + 1));

  return asignaciones.map(a => {
    const docenteId = normalizarDocenteId(a.docente_id);
    const docenteN = docenteIndex.get(docenteId) || 1;
    return {
      ...a,
      docente_id: docenteId,
      docente_n: docenteN,
    };
  });
}

function crearHojaUNT(
  workbook: ExcelJS.Workbook,
  nombreHoja: string,
  header: { ciclo: string; seccion: string; año: string; semestre: string; inicio: string; termino: string }
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(nombreHoja, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
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

  Object.entries(ANCHOS_COLUMNA).forEach(([col, ancho]) => {
    ws.getColumn(col).width = ancho;
  });

  aplicarEncabezadoInstitucional(ws, header);
  aplicarTablaDocentes(ws, []);
  aplicarTablaHorario(ws);

  return ws;
}

export async function exportarHorariosFormatoUNT(config: ConfigExportUNT) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Horarios UNT';
  workbook.created = new Date();

  const docenteNameMap = new Map<string, string>();
  const todasAsignaciones: Asignacion[] = [];

  for (const cicloData of config.ciclos) {
    cicloData.docentes.forEach(d => {
      docenteNameMap.set(d.docente_id, d.nombre);
    });
    todasAsignaciones.push(...cicloData.asignaciones);
  }

  // HOJA 1: Información Global (al inicio)
  const wsInfoGlobal = workbook.addWorksheet('INFORMACIÓN GLOBAL', {
    pageSetup: {
      orientation: 'portrait',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    }
  });

  // Encabezado institucional
  wsInfoGlobal.mergeCells('A1:E1');
  wsInfoGlobal.getCell('A1').value = 'UNIVERSIDAD NACIONAL DE TRUJILLO';
  wsInfoGlobal.getCell('A1').font = { bold: true, size: 14 };
  wsInfoGlobal.getCell('A1').alignment = { horizontal: 'center' };

  wsInfoGlobal.mergeCells('A2:E2');
  wsInfoGlobal.getCell('A2').value = 'Facultad de Ingeniería - Escuela de Ingeniería de Sistemas';
  wsInfoGlobal.getCell('A2').font = { size: 12 };
  wsInfoGlobal.getCell('A2').alignment = { horizontal: 'center' };

  wsInfoGlobal.mergeCells('A3:E3');
  wsInfoGlobal.getCell('A3').value = `HORARIOS ACADÉMICOS - ${config.programacion.año} - ${config.programacion.semestre}`;
  wsInfoGlobal.getCell('A3').font = { bold: true, size: 13 };
  wsInfoGlobal.getCell('A3').alignment = { horizontal: 'center' };

  wsInfoGlobal.mergeCells('A4:E4');
  wsInfoGlobal.getCell('A4').value = `Periodo: ${config.programacion.inicio} al ${config.programacion.termino}`;
  wsInfoGlobal.getCell('A4').font = { size: 11 };
  wsInfoGlobal.getCell('A4').alignment = { horizontal: 'center' };

  // Estadísticas generales
  wsInfoGlobal.getCell('A6').value = 'RESUMEN GENERAL';
  wsInfoGlobal.getCell('A6').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  wsInfoGlobal.getCell('A6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } };
  wsInfoGlobal.mergeCells('A6:E6');

  const totalDocentes = docenteNameMap.size;
  const totalCursos = new Set(todasAsignaciones.map(a => a.curso_codigo)).size;
  const totalAsignaciones = todasAsignaciones.length;
  const totalAulas = new Set(todasAsignaciones.map(a => a.aula)).size;

  wsInfoGlobal.getCell('A8').value = 'Total Docentes:';
  wsInfoGlobal.getCell('B8').value = totalDocentes;
  wsInfoGlobal.getCell('A9').value = 'Total Cursos:';
  wsInfoGlobal.getCell('B9').value = totalCursos;
  wsInfoGlobal.getCell('A10').value = 'Total Asignaciones:';
  wsInfoGlobal.getCell('B10').value = totalAsignaciones;
  wsInfoGlobal.getCell('A11').value = 'Total Aulas/Laboratorios:';
  wsInfoGlobal.getCell('B11').value = totalAulas;

  wsInfoGlobal.getColumn('A').width = 25;
  wsInfoGlobal.getColumn('B').width = 15;
  wsInfoGlobal.getColumn('C').width = 25;
  wsInfoGlobal.getColumn('D').width = 15;
  wsInfoGlobal.getColumn('E').width = 15;

  // Una hoja por cada ciclo (II, IV, VI, VIII, X)
  for (const cicloData of config.ciclos) {
    const ws = crearHojaUNT(workbook, safeSheetName(cicloData.ciclo), {
      ciclo: cicloData.ciclo,
      seccion: cicloData.seccion,
      año: config.programacion.año,
      semestre: config.programacion.semestre,
      inicio: config.programacion.inicio,
      termino: config.programacion.termino,
    });

    aplicarTablaDocentes(ws, cicloData.docentes);
    
    // 4. Crear mapa docente → color
    const mapaDocenteColor = new Map<string, number>();
    cicloData.docentes.forEach((d, idx) => {
      mapaDocenteColor.set(d.docente_id, idx);
    });
    
    // 5. Aplicar asignaciones (bloques de clases)
    aplicarAsignaciones(ws, cicloData.asignaciones, mapaDocenteColor);
  }

  if (todasAsignaciones.length > 0) {
    const docentesGeneral = buildDocentesFromAsignaciones(todasAsignaciones, docenteNameMap);
    const asignacionesGeneral = remapAsignacionesDocenteN(todasAsignaciones, docentesGeneral);

    const wsGeneral = crearHojaUNT(workbook, safeSheetName('GENERAL'), {
      ciclo: 'GENERAL',
      seccion: '-',
      año: config.programacion.año,
      semestre: config.programacion.semestre,
      inicio: config.programacion.inicio,
      termino: config.programacion.termino,
    });

    aplicarTablaDocentes(wsGeneral, docentesGeneral);

    const mapaDocenteColor = new Map<string, number>();
    docentesGeneral.forEach((d, idx) => {
      mapaDocenteColor.set(d.docente_id, idx);
    });
    aplicarAsignaciones(wsGeneral, asignacionesGeneral, mapaDocenteColor);

    const aulasMap = new Map<string, { label: string; asignaciones: Asignacion[] }>();
    for (const a of asignacionesGeneral) {
      const key = normalizarAula(a.aula);
      if (!key) continue;
      const entry = aulasMap.get(key) || { label: a.aula || key, asignaciones: [] };
      entry.asignaciones.push(a);
      aulasMap.set(key, entry);
    }

    Array.from(aulasMap.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((aulaData) => {
        const docentesAula = buildDocentesFromAsignaciones(aulaData.asignaciones, docenteNameMap);
        const asignacionesAula = remapAsignacionesDocenteN(aulaData.asignaciones, docentesAula);

        const wsAula = crearHojaUNT(workbook, safeSheetName(`AULA-${aulaData.label}`), {
          ciclo: 'AULA',
          seccion: aulaData.label,
          año: config.programacion.año,
          semestre: config.programacion.semestre,
          inicio: config.programacion.inicio,
          termino: config.programacion.termino,
        });

        aplicarTablaDocentes(wsAula, docentesAula);

        const mapaDocenteColorAula = new Map<string, number>();
        docentesAula.forEach((d, idx) => {
          mapaDocenteColorAula.set(d.docente_id, idx);
        });
        aplicarAsignaciones(wsAula, asignacionesAula, mapaDocenteColorAula);
      });

    // HOJAS POR DOCENTE
    const docentesMap = new Map<string, Asignacion[]>();
    for (const a of asignacionesGeneral) {
      const docenteId = normalizarDocenteId(a.docente_id);
      if (!docentesMap.has(docenteId)) {
        docentesMap.set(docenteId, []);
      }
      docentesMap.get(docenteId)!.push(a);
    }

    Array.from(docentesMap.entries())
      .sort((a, b) => {
        const nombreA = docenteNameMap.get(a[0]) || a[0];
        const nombreB = docenteNameMap.get(b[0]) || b[0];
        return nombreA.localeCompare(nombreB);
      })
      .forEach(([docenteId, asignacionesDocente]) => {
        const nombreDocente = docenteNameMap.get(docenteId) || 'Sin docente';
        const docenteData = docentesGeneral.find(d => d.docente_id === docenteId);

        const wsDocente = crearHojaUNT(workbook, safeSheetName(`DOC-${nombreDocente}`), {
          ciclo: 'DOCENTE',
          seccion: nombreDocente,
          año: config.programacion.año,
          semestre: config.programacion.semestre,
          inicio: config.programacion.inicio,
          termino: config.programacion.termino,
        });

        if (docenteData) {
          aplicarTablaDocentes(wsDocente, [docenteData]);
        }

        const mapaDocenteColorDocente = new Map<string, number>();
        if (docenteData) {
          mapaDocenteColorDocente.set(docenteData.docente_id, 0);
        }

        const asignacionesDocenteRemap = remapAsignacionesDocenteN(asignacionesDocente, docenteData ? [docenteData] : []);
        aplicarAsignaciones(wsDocente, asignacionesDocenteRemap, mapaDocenteColorDocente);
      });
  }

  // Generar archivo y descargar
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  
  const fecha = new Date().toISOString().split('T')[0];
  saveAs(blob, `Horarios_UNT_${fecha}.xlsx`);
}
