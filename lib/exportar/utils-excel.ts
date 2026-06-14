import ExcelJS from 'exceljs';
import { type ColorCurso } from '@/lib/colores-curso';

export interface BloqueAgrupado {
  curso_codigo: string;
  curso_nombre: string;
  grupo: string;
  aula: string;
  docente_nombre: string;
  tipo_sesion: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_horas: number;
  ciclo: number;
}

export interface ConfigGrilla {
  titulo: string;
  subtitulo?: string;
  bloques: BloqueAgrupado[];
  mapaColores: Map<string, ColorCurso>;
  tabColor?: string;
  slots?: Array<{ hora_inicio: string; hora_fin: string; id?: string }>;
}

export function romanizar(num: number): string {
  const romanos = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romanos[num] || num.toString();
}

export function colorPorCiclo(ciclo: number): string {
  const colores = [
    'FF1E40AF', // I - Azul Oscuro
    'FF059669', // II - Esmeralda
    'FFD97706', // III - Ámbar
    'FF7C3AED', // IV - Violeta
    'FFDC2626', // V - Rojo
    'FF0891B', // VI - Cian
    'FFDB2777', // VII - Rosa
    'FF4F46E5', // VIII - Índigo
    'FF475569', // IX - Slate
    'FF78350F'  // X - Marrón
  ];
  return colores[(ciclo - 1) % colores.length] || 'FF6366F1';
}

export function hexToArgb(hex: string): string {
  return 'FF' + hex.replace('#', '');
}

function normalizeText(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeDay(value: string | undefined | null): string {
  return normalizeText(value);
}

function normalizeTime(value: string | undefined | null): string {
  const raw = (value || '').trim();
  if (!raw) return '';

  const [hour = '', minute = '00'] = raw.slice(0, 5).split(':');
  const normalizedHour = hour.padStart(2, '0');
  const normalizedMinute = minute.padStart(2, '0').slice(0, 2);
  return `${normalizedHour}:${normalizedMinute}`;
}

function columnNumberToName(columnNumber: number): string {
  let dividend = columnNumber;
  let columnName = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnName;
}

function buildSubcolumnLabel(bloque: Pick<BloqueAgrupado, 'grupo' | 'aula' | 'curso_codigo' | 'tipo_sesion'>): string {
  const grupo = (bloque.grupo || '').trim();
  if (grupo) {
    return /^g/i.test(grupo) ? grupo.toUpperCase() : `G${grupo}`.slice(0, 12);
  }

  const aula = (bloque.aula || '').trim();
  if (aula) return aula.slice(0, 12);

  const codigo = (bloque.curso_codigo || '').trim();
  if (codigo) return codigo.slice(0, 12);

  return tipoSesionAbrev(bloque.tipo_sesion || '');
}

export function tipoSesionAbrev(tipo: string): string {
  const map: Record<string, string> = {
    'teoria': 'T',
    'practica': 'P',
    'laboratorio': 'L',
    'asesoria': 'C'
  };

  if (!tipo) return 'T';

  const tipoNormalizado = normalizeText(tipo);
  return map[tipoNormalizado] || tipo[0].toUpperCase();
}

export function bordeCompleto(color: string): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } }
  };
}

interface DocenteInfo {
  nombre: string;
  cursos: string[];
  total_horas: number;
}

function extraerDocentesDeGrilla(bloques: BloqueAgrupado[]): DocenteInfo[] {
  const docentesMap = new Map<string, DocenteInfo>();
  
  bloques.forEach(bloque => {
    if (!bloque.docente_nombre) return;
    if (!docentesMap.has(bloque.docente_nombre)) {
      docentesMap.set(bloque.docente_nombre, {
        nombre: bloque.docente_nombre,
        cursos: [],
        total_horas: 0
      });
    }
    
    const docente = docentesMap.get(bloque.docente_nombre)!;
    
    if (!docente.cursos.includes(bloque.curso_nombre)) {
      docente.cursos.push(bloque.curso_nombre);
    }
    
    docente.total_horas += bloque.duracion_horas;
  });
  
  return Array.from(docentesMap.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function agregarLeyendaDocentes(
  sheet: ExcelJS.Worksheet,
  bloques: BloqueAgrupado[],
  filaInicio: number = 1
): number {
  const docentes = extraerDocentesDeGrilla(bloques);
  
  if (docentes.length === 0) return filaInicio;
  
  const totalCols = Math.max(sheet.columnCount, 7);
  const mitad = Math.max(3, Math.floor(totalCols / 2));
  const inicioDer = Math.min(totalCols, mitad + 1);

  const filaTitulo = filaInicio;
  sheet.mergeCells(filaTitulo, 1, filaTitulo, totalCols);
  const celdaTitulo = sheet.getCell(filaTitulo, 1);
  celdaTitulo.value = `👥 DOCENTES QUE DICTAN EN ESTE HORARIO (${docentes.length})`;
  celdaTitulo.font = {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' }
  };
  celdaTitulo.alignment = {
    horizontal: 'left',
    vertical: 'middle',
    indent: 1
  };
  celdaTitulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4338CA' }
  };
  sheet.getRow(filaTitulo).height = 22;
  
  const docentesPorColumna = Math.ceil(docentes.length / 2);
  let filaActual = filaTitulo + 1;
  
  for (let i = 0; i < docentesPorColumna; i++) {
    const docenteIzq = docentes[i];
    const docenteDer = docentes[i + docentesPorColumna];
    
    if (docenteIzq) {
      sheet.mergeCells(filaActual, 1, filaActual, mitad);
      const celdaIzq = sheet.getCell(filaActual, 1);
      celdaIzq.value = `  • ${docenteIzq.nombre}  (${docenteIzq.cursos.length} curso${docenteIzq.cursos.length > 1 ? 's' : ''} · ${docenteIzq.total_horas}h)`;
      celdaIzq.font = { size: 9 };
      celdaIzq.alignment = { vertical: 'middle' };
    }
    
    if (docenteDer && inicioDer <= totalCols) {
      sheet.mergeCells(filaActual, inicioDer, filaActual, totalCols);
      const celdaDer = sheet.getCell(filaActual, inicioDer);
      celdaDer.value = `  • ${docenteDer.nombre}  (${docenteDer.cursos.length} curso${docenteDer.cursos.length > 1 ? 's' : ''} · ${docenteDer.total_horas}h)`;
      celdaDer.font = { size: 9 };
      celdaDer.alignment = { vertical: 'middle' };
    }
    
    sheet.getRow(filaActual).height = 16;
    filaActual++;
  }
  
  filaActual++;
  
  return filaActual;
}

export function generarHorasUnicas(): {
  inicio: string;
  fin: string;
  rango: string;
}[] {
  const horas = [];
  for (let h = 7; h <= 21; h++) {
    const horaInicio = `${h.toString().padStart(2, '0')}:00`;
    const horaFin = `${(h + 1).toString().padStart(2, '0')}:00`;
    horas.push({
      inicio: horaInicio,
      fin: horaFin,
      rango: `${horaInicio} - ${horaFin}`
    });
  }
  return horas;
}

export async function generarGrillaSemanal(
  workbook: ExcelJS.Workbook,
  nombreHoja: string,
  config: ConfigGrilla
) {
  const sheet = workbook.addWorksheet(nombreHoja, {
    properties: { tabColor: { argb: config.tabColor || 'FF6366F1' } },
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,  // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1
    }
  });
  
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // ─────────────────────────────────────────────────────────────
  // FIX 1: Construir uniqueSlots desde slots del servidor o desde
  // pares reales de cada bloque (expandidos hora a hora), en lugar
  // de inferir pares consecutivos de un array combinado de horas.
  // ─────────────────────────────────────────────────────────────
  let uniqueSlots: { hora_inicio: string; hora_fin: string }[];
  const slotMap = new Map<string, number>();

  if (config.slots && config.slots.length > 0) {
    // Usar slots del servidor (fuente de verdad)
    const slotsSeen = new Set<string>();
    uniqueSlots = config.slots
      .map(s => ({
        hora_inicio: normalizeTime(s.hora_inicio),
        hora_fin: normalizeTime(s.hora_fin)
      }))
      .filter(s => {
        if (!s.hora_inicio || slotsSeen.has(s.hora_inicio)) return false;
        slotsSeen.add(s.hora_inicio);
        return true;
      })
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  } else {
    // Inferir slots expandiendo cada bloque hora a hora
    const slotsMap = new Map<string, string>(); // inicio → fin
    config.bloques.forEach(b => {
      const hIni = parseInt(normalizeTime(b.hora_inicio).split(':')[0], 10);
      const hFin = parseInt(normalizeTime(b.hora_fin).split(':')[0], 10);
      if (isNaN(hIni) || isNaN(hFin)) return;
      for (let h = hIni; h < hFin; h++) {
        const ini = `${h.toString().padStart(2, '0')}:00`;
        const fin = `${(h + 1).toString().padStart(2, '0')}:00`;
        if (!slotsMap.has(ini)) slotsMap.set(ini, fin);
      }
    });

    if (slotsMap.size === 0) {
      // Fallback: generar horario estándar 07:00-22:00
      for (let h = 7; h <= 21; h++) {
        const ini = `${h.toString().padStart(2, '0')}:00`;
        const fin = `${(h + 1).toString().padStart(2, '0')}:00`;
        slotsMap.set(ini, fin);
      }
    }

    uniqueSlots = Array.from(slotsMap.entries())
      .map(([ini, fin]) => ({ hora_inicio: ini, hora_fin: fin }))
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }

  // ─────────────────────────────────────────────────────────────
  // FIX 2: slotMap mapea hora_inicio → índice de fila (0-based)
  // Cada hora de inicio tiene un índice ÚNICO y determinista.
  // ─────────────────────────────────────────────────────────────
  uniqueSlots.forEach((slot, i) => {
    slotMap.set(slot.hora_inicio, i);
  });

  // ─────────────────────────────────────────────────────────────
  // FIX 3: rowSpan calculado contando slots cubiertos, no por
  // diferencia de índices en un array combinado de horas.
  // ─────────────────────────────────────────────────────────────
  const bloquesNormalizados = config.bloques
    .map(bloque => {
      const horaInicio = normalizeTime(bloque.hora_inicio);
      const horaFin = normalizeTime(bloque.hora_fin);
      const startIdx = slotMap.get(horaInicio);

      if (startIdx === undefined) {
        console.warn(`⚠️ Bloque sin slot válido: ${bloque.curso_codigo} ${bloque.dia} ${horaInicio}`);
        return null;
      }

      // Contar cuántos slots cubre este bloque
      let rowSpan = 0;
      for (let i = startIdx; i < uniqueSlots.length; i++) {
        rowSpan++;
        if (uniqueSlots[i].hora_fin >= horaFin) break;
      }
      rowSpan = Math.max(1, rowSpan);

      return {
        ...bloque,
        diaNormalizado: normalizeDay(bloque.dia),
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        startIdx,
        endIdx: startIdx + rowSpan,
        rowSpan
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const diaA = dias.findIndex(d => normalizeDay(d) === a!.diaNormalizado);
      const diaB = dias.findIndex(d => normalizeDay(d) === b!.diaNormalizado);
      if (diaA !== diaB) return diaA - diaB;
      if (a!.startIdx !== b!.startIdx) return a!.startIdx - b!.startIdx;
      return b!.rowSpan - a!.rowSpan; // bloques más largos primero
    }) as Array<BloqueAgrupado & {
      diaNormalizado: string;
      startIdx: number;
      endIdx: number;
      rowSpan: number;
    }>;

  const bloquesPorDia = new Map<string, typeof bloquesNormalizados>();
  dias.forEach(dia => {
    bloquesPorDia.set(normalizeDay(dia), []);
  });

  bloquesNormalizados.forEach(bloque => {
    const lista = bloquesPorDia.get(bloque.diaNormalizado);
    if (lista) {
      lista.push(bloque);
    }
  });

  const calcularMaxSolapamiento = (diaNormalizado: string): number => {
    const bloquesDia = bloquesPorDia.get(diaNormalizado) || [];
    let max = 1;

    for (let rowIdx = 0; rowIdx < uniqueSlots.length; rowIdx++) {
      const concurrencia = bloquesDia.filter(
        bloque => rowIdx >= bloque.startIdx && rowIdx < bloque.endIdx
      ).length;
      max = Math.max(max, concurrencia || 1);
    }

    return max;
  };

  const dayColStart: Record<string, number> = {};
  const maxColsPorDia: Record<string, number> = {};
  const columnas: Array<{ header: string; width: number }> = [{ header: 'Hora', width: 18 }];
  let currentCol = 2;

  dias.forEach(dia => {
    const diaNormalizado = normalizeDay(dia);
    const maxCols = calcularMaxSolapamiento(diaNormalizado);
    maxColsPorDia[diaNormalizado] = maxCols;
    dayColStart[diaNormalizado] = currentCol;

    for (let i = 0; i < maxCols; i++) {
      columnas.push({ header: i === 0 ? dia : '', width: maxCols > 1 ? 18 : 32 });
    }

    currentCol += maxCols;
  });

  sheet.columns = columnas;
  const lastCol = columnas.length;

  // Título principal de la grilla
  sheet.mergeCells(1, 1, 1, lastCol);
  const titulo = sheet.getCell(1, 1);
  titulo.value = config.titulo;
  titulo.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titulo.alignment = { horizontal: 'center', vertical: 'middle' };
  titulo.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }
  };
  sheet.getRow(1).height = 28;
  
  // Subtítulo
  let filaInicio = 2;
  if (config.subtitulo) {
    sheet.mergeCells(filaInicio, 1, filaInicio, lastCol);
    const sub = sheet.getCell(filaInicio, 1);
    sub.value = config.subtitulo;
    sub.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(filaInicio).height = 20;
    filaInicio++;
  }
  
  // Agregar Leyenda de Docentes
  filaInicio = agregarLeyendaDocentes(sheet, config.bloques, filaInicio + 1);
  
  const matrizOcupacion: boolean[][] = [];

  // ─────────────────────────────────────────────────────────────
  // FIX 4: Registrar celdas ocupadas ANTES de hacer mergeCells
  // para prevenir conflictos de merge que corrompen el sheet.
  // ─────────────────────────────────────────────────────────────
  const mergedCells = new Set<string>();

  const marcarMergeOcupado = (startRow: number, startCol: number, rowSpan: number, colSpan: number = 1) => {
    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startCol; c < startCol + colSpan; c++) {
        mergedCells.add(`${r}:${c}`);
      }
    }
  };

  const estaMergeOcupado = (startRow: number, startCol: number, rowSpan: number, colSpan: number = 1): boolean => {
    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startCol; c < startCol + colSpan; c++) {
        if (mergedCells.has(`${r}:${c}`)) return true;
      }
    }
    return false;
  };

  const buscarColumnaLibre = (diaNormalizado: string, startIdx: number, endIdx: number): number => {
    const colBase = dayColStart[diaNormalizado];
    const maxCols = maxColsPorDia[diaNormalizado];

    for (let offset = 0; offset < maxCols; offset++) {
      const col = colBase + offset;
      let libre = true;

      for (let row = startIdx; row < endIdx; row++) {
        if (matrizOcupacion[row]?.[col]) {
          libre = false;
          break;
        }
      }

      if (libre) return col;
    }

    return colBase;
  };

  const obtenerEstiloBloque = (bloque: BloqueAgrupado) => {
    if (normalizeText(bloque.tipo_sesion) === 'asesoria') {
      return {
        fill: { argb: 'FFE5E7EB' },
        border: {
          left: { style: 'thick', color: { argb: 'FF6B7280' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        } as Partial<ExcelJS.Borders>
      };
    }

    const color = config.mapaColores.get(`${bloque.ciclo}-${bloque.curso_codigo}`);
    if (color) {
      return {
        fill: { argb: hexToArgb(color.bg) },
        border: {
          left: { style: 'thick', color: { argb: hexToArgb(color.border) } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        } as Partial<ExcelJS.Borders>
      };
    }

    return {
      fill: { argb: 'FFFFFBEB' },
      border: bordeCompleto('FFCBD5E1')
    };
  };

  const labelsPorDia: Record<string, string[]> = {};
  dias.forEach(dia => {
    const diaNormalizado = normalizeDay(dia);
    labelsPorDia[diaNormalizado] = Array.from(
      { length: maxColsPorDia[diaNormalizado] },
      (_, index) => `C${index + 1}`
    );
  });

  const bloquesUbicados: Array<(typeof bloquesNormalizados)[number] & { col: number }> = [];

  bloquesNormalizados.forEach(bloque => {
    const diaNormalizado = bloque.diaNormalizado;
    const col = buscarColumnaLibre(diaNormalizado, bloque.startIdx, bloque.endIdx);
    const offset = col - dayColStart[diaNormalizado];

    for (let row = bloque.startIdx; row < bloque.endIdx; row++) {
      if (!matrizOcupacion[row]) matrizOcupacion[row] = [];
      matrizOcupacion[row][col] = true;
    }

    if (labelsPorDia[diaNormalizado][offset]?.startsWith('C')) {
      labelsPorDia[diaNormalizado][offset] = buildSubcolumnLabel(bloque);
    }

    bloquesUbicados.push({
      ...bloque,
      col
    });
  });

  // Encabezados de Día + sub-columnas
  const filaHeader = filaInicio;
  const filaSubHeader = filaHeader + 1;
  sheet.getCell(filaHeader, 1).value = 'Hora';
  sheet.getCell(filaSubHeader, 1).value = 'Slot';

  dias.forEach(dia => {
    const diaNormalizado = normalizeDay(dia);
    const startCol = dayColStart[diaNormalizado];
    const endCol = startCol + maxColsPorDia[diaNormalizado] - 1;

    if (endCol > startCol) {
      sheet.mergeCells(filaHeader, startCol, filaHeader, endCol);
    }

    sheet.getCell(filaHeader, startCol).value = dia;

    for (let col = startCol; col <= endCol; col++) {
      const subCell = sheet.getCell(filaSubHeader, col);
      subCell.value = maxColsPorDia[diaNormalizado] > 1
        ? labelsPorDia[diaNormalizado][col - startCol]
        : '';
    }
  });
  
  const headerRow = sheet.getRow(filaHeader);
  headerRow.height = 24;
  const subHeaderRow = sheet.getRow(filaSubHeader);
  subHeaderRow.height = 20;

  for (let col = 1; col <= lastCol; col++) {
    const cell = sheet.getCell(filaHeader, col);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }
    };
    cell.border = bordeCompleto('FFFFFFFF');

    const subCell = sheet.getCell(filaSubHeader, col);
    subCell.font = { bold: true, color: { argb: 'FF1E293B' }, size: 9 };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' }
    };
    subCell.border = bordeCompleto('FFFFFFFF');
  }

  const HEADER_ROWS = filaSubHeader;

  // Inicializar toda la rejilla base antes de dibujar bloques.
  for (let rowIdx = 0; rowIdx < uniqueSlots.length; rowIdx++) {
    const excelRow = HEADER_ROWS + rowIdx + 1;

    dias.forEach(dia => {
      const diaNormalizado = normalizeDay(dia);
      const startCol = dayColStart[diaNormalizado];
      const endCol = startCol + maxColsPorDia[diaNormalizado] - 1;

      for (let col = startCol; col <= endCol; col++) {
        const cell = sheet.getCell(excelRow, col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' }
        };
        cell.border = bordeCompleto('FFE2E8F0');
      }
    });
  }

  bloquesUbicados.forEach(bloque => {
    const startExcelRow = HEADER_ROWS + bloque.startIdx + 1;
    const endExcelRow   = HEADER_ROWS + bloque.startIdx + bloque.rowSpan;
    const estilo = obtenerEstiloBloque(bloque);
    const col = bloque.col;

    // Expandir horizontalmente si hay columnas libres
    const diaNormalizado = bloque.diaNormalizado;
    const colBase = dayColStart[diaNormalizado];
    const maxCols = maxColsPorDia[diaNormalizado];
    const endColForDay = colBase + maxCols - 1;

    let colEndExpand = col;
    for (let c = col + 1; c <= endColForDay; c++) {
      let libre = true;
      for (let r = bloque.startIdx; r < bloque.endIdx; r++) {
        if (matrizOcupacion[r]?.[c]) {
          libre = false;
          break;
        }
      }
      if (libre) {
        colEndExpand = c;
        for (let r = bloque.startIdx; r < bloque.endIdx; r++) {
          if (!matrizOcupacion[r]) matrizOcupacion[r] = [];
          matrizOcupacion[r][c] = true;
        }
      } else {
        break;
      }
    }

    const colSpan = colEndExpand - col + 1;

    // PASO 1: Bordes a todas las celdas en el área (evita sobrescribir 'fill' de esclavas)
    for (let row = startExcelRow; row <= endExcelRow; row++) {
      for (let c = col; c <= colEndExpand; c++) {
        const cell = sheet.getCell(row, c);
        cell.border = estilo.border;
      }
    }

    // PASO 2: Mergear si es necesario (horizontal o vertical)
    const requiereMerge = bloque.rowSpan > 1 || colSpan > 1;
    if (requiereMerge) {
      if (!estaMergeOcupado(startExcelRow, col, bloque.rowSpan, colSpan)) {
        try {
          sheet.mergeCells(startExcelRow, col, endExcelRow, colEndExpand);
          marcarMergeOcupado(startExcelRow, col, bloque.rowSpan, colSpan);
        } catch (e) {
          console.error(`❌ mergeCells falló [${startExcelRow}:${col}→${endExcelRow}:${colEndExpand}]`, e);
        }
      } else {
        console.warn(`⚠️ Merge conflicto evitado para ${bloque.curso_codigo}`);
      }
    }

  // PASO 3: Colorear SOLO la celda maestra (evita corromper el XML de Excel)
  const masterCell = sheet.getCell(startExcelRow, col);
  masterCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: estilo.fill.argb }
  };

  // PASO 3: Escribir contenido en celda raíz (siempre después del merge)
  const celda = sheet.getCell(startExcelRow, col);
  const abrev = tipoSesionAbrev(bloque.tipo_sesion);
  celda.value = (
    `${bloque.curso_nombre}\n` +
    `[${abrev}] ${bloque.grupo} · ${bloque.aula}\n` +
    `👤 ${bloque.docente_nombre}\n` +
    `🕐 ${bloque.hora_inicio} - ${bloque.hora_fin} (${bloque.duracion_horas}h)`
  );
  celda.alignment = {
    horizontal: 'left',
    vertical: 'middle',
    wrapText: true,
    indent: 1
  };
  celda.font = { size: 8.5, color: { argb: 'FF1E293B' }, name: 'Calibri' };

  // Altura de fila
  const filaObj = sheet.getRow(startExcelRow);
  filaObj.height = Math.max(filaObj.height || 0, Math.max(60, bloque.rowSpan * 20));
});

  uniqueSlots.forEach((slot, rowIdx) => {
    const excelRow = HEADER_ROWS + rowIdx + 1;

    const celdaHora = sheet.getCell(excelRow, 1);
    celdaHora.value = `${slot.hora_inicio} - ${slot.hora_fin}`;
    celdaHora.font = { bold: true, size: 9, color: { argb: 'FF1E293B' } };
    celdaHora.alignment = { horizontal: 'center', vertical: 'middle' };
    celdaHora.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    celdaHora.border = bordeCompleto('FFCBD5E1');
    sheet.getRow(excelRow).height = Math.max(sheet.getRow(excelRow).height || 0, 42);
  });
  
  sheet.pageSetup.printArea = `A1:${columnNumberToName(lastCol)}${HEADER_ROWS + uniqueSlots.length}`;
  sheet.pageSetup.margins = {
    left: 0.4, right: 0.4,
    top: 0.4, bottom: 0.4,
    header: 0.2, footer: 0.2
  };
}
