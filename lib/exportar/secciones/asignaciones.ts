import ExcelJS from 'exceljs';
import { 
  COLUMNAS_DIA, 
  PALETA_COLORES_UNT, 
  BORDE_FINO,
  horaAFila,
  etiquetaTipoSesion
} from '../utils-excel-unt';

export interface Asignacion {
  docente_n: number;       // Número del docente (referencia a tabla)
  docente_id: string;      // UUID del docente
  curso_codigo: string;
  curso_nombre: string;
  grupo: string;
  aula: string;            // "EPG-202" o "Lab. 4"
  tipo_sesion: 'teoria' | 'practica' | 'laboratorio' | 'teoria_practica';
  dia: string;             // "lunes", "martes"...
  hora_inicio: string;     // "07:00"
  hora_fin: string;        // "10:00"
  duracion_horas: number;  // 3
}

/**
 * Agrupa asignaciones contiguas del mismo docente/aula en bloques.
 * Esto evita repetir la información en cada hora.
 */
export function agruparAsignacionesContiguas(asignaciones: Asignacion[]): Asignacion[] {
  // Ordenar por día, hora_inicio
  const ordenadas = [...asignaciones].sort((a, b) => {
    if (a.dia !== b.dia) return a.dia.localeCompare(b.dia);
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });
  
  const agrupadas: Asignacion[] = [];
  let actual: Asignacion | null = null;
  
  for (const a of ordenadas) {
    if (actual &&
        actual.dia === a.dia &&
        actual.docente_id === a.docente_id &&
        actual.curso_codigo === a.curso_codigo &&
        actual.grupo === a.grupo &&
        actual.aula === a.aula &&
        actual.tipo_sesion === a.tipo_sesion &&
        actual.hora_fin === a.hora_inicio) {
      // Extender el bloque actual
      actual.hora_fin = a.hora_fin;
      actual.duracion_horas += 1;
    } else {
      if (actual) agrupadas.push(actual);
      actual = { ...a, duracion_horas: 1 };
    }
  }
  if (actual) agrupadas.push(actual);
  
  return agrupadas;
}

function renderizarBloque(
  ws: ExcelJS.Worksheet,
  bloques: Asignacion[],
  colInicio: string,
  colFin: string,
  filaInicio: number,
  filaFin: number,
  mapaDocenteColor: Map<string, number>
) {
  // Desmerge previo
  const masters = new Set<string>();
  for (let f = filaInicio; f <= filaFin; f++) {
    const colStart = colInicio.charCodeAt(0);
    const colEnd = colFin.charCodeAt(0);
    for (let c = colStart; c <= colEnd; c++) {
      const charCol = String.fromCharCode(c);
      const cell = ws.getCell(`${charCol}${f}`);
      if (cell.isMerged && cell.master) {
        masters.add(cell.master.address);
      }
    }
  }
  masters.forEach(addr => {
    try { ws.unMergeCells(addr); } catch (e) {}
  });

  // Hacer merge del rango
  const rangoBloque = `${colInicio}${filaInicio}:${colFin}${filaFin}`;
  if (colInicio !== colFin || filaInicio !== filaFin) {
    try {
      ws.mergeCells(rangoBloque);
    } catch (e) {
      try {
        ws.unMergeCells(rangoBloque);
        ws.mergeCells(rangoBloque);
      } catch (e2) {}
    }
  }

  // Construir contenido
  const lineasTotales: string[] = [];
  bloques.forEach(bloque => {
    const lineas: string[] = [];
    lineas.push(String(bloque.docente_n));
    lineas.push(bloque.aula);
    const tipo = etiquetaTipoSesion(bloque.tipo_sesion);
    if (tipo) lineas.push(tipo);
    lineasTotales.push(...lineas, '───');
  });
  if (lineasTotales.length > 0) lineasTotales.pop();

  const color = bloques.length === 1 
    ? PALETA_COLORES_UNT[(mapaDocenteColor.get(bloques[0].docente_id) ?? 0) % PALETA_COLORES_UNT.length]
    : 'FFF0F0F0';

  const cell = ws.getCell(`${colInicio}${filaInicio}`);
  cell.value = lineasTotales.join('\n');
  cell.font = { name: 'Arial', size: 10, bold: true };
  cell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true
  };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  cell.border = BORDE_FINO;

  for (let f = filaInicio; f <= filaFin; f++) {
    const colStart = colInicio.charCodeAt(0);
    const colEnd = colFin.charCodeAt(0);
    for (let c = colStart; c <= colEnd; c++) {
      const charCol = String.fromCharCode(c);
      const cellTemp = ws.getCell(`${charCol}${f}`);
      cellTemp.border = BORDE_FINO;
    }
  }

  const filaObj = ws.getRow(filaInicio);
  const alturaNecesaria = Math.max(20, lineasTotales.length * 15);
  filaObj.height = Math.max(filaObj.height || 0, alturaNecesaria);
}

export function aplicarAsignaciones(
  ws: ExcelJS.Worksheet,
  asignaciones: Asignacion[],
  mapaDocenteColor: Map<string, number>,
  esGeneral = false
) {
  const bloques = agruparAsignacionesContiguas(asignaciones);
  
  if (esGeneral) {
    // Lógica ESPECIAL para el horario GENERAL: distribuir todos los bloques por día sin solaparse
    const bloquesPorDia = new Map<string, Asignacion[]>();
    for (const bloque of bloques) {
      const dia = bloque.dia.toLowerCase();
      if (!bloquesPorDia.has(dia)) {
        bloquesPorDia.set(dia, []);
      }
      bloquesPorDia.get(dia)!.push(bloque);
    }

    for (const [dia, bloquesDia] of bloquesPorDia) {
      const colDia = COLUMNAS_DIA[dia];
      if (!colDia) continue;

      const colStartCharCode = colDia.inicio.charCodeAt(0);
      const colEndCharCode = colDia.fin.charCodeAt(0);
      const numCols = colEndCharCode - colStartCharCode + 1;

      // Ordenar bloques por hora de inicio
      bloquesDia.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

      // Array para registrar qué columnas están ocupadas en cada fila
      const columnasOcupadas: Record<number, number[]> = {};

      for (const bloque of bloquesDia) {
        const filaInicio = horaAFila(bloque.hora_inicio);
        if (filaInicio === null) continue;
        const filaFin = filaInicio + bloque.duracion_horas - 1;

        // Encontrar la primera columna libre
        let columnaAsignada = -1;
        for (let colIdx = 0; colIdx < numCols; colIdx++) {
          let ocupada = false;
          for (let fila = filaInicio; fila <= filaFin; fila++) {
            if (columnasOcupadas[fila]?.includes(colIdx)) {
              ocupada = true;
              break;
            }
          }
          if (!ocupada) {
            columnaAsignada = colIdx;
            break;
          }
        }

        // Si no encontramos columna libre, usamos la primera
        if (columnaAsignada === -1) {
          columnaAsignada = 0;
        }

        // Marcar la columna como ocupada
        for (let fila = filaInicio; fila <= filaFin; fila++) {
          if (!columnasOcupadas[fila]) {
            columnasOcupadas[fila] = [];
          }
          columnasOcupadas[fila].push(columnaAsignada);
        }

        const colStr = String.fromCharCode(colStartCharCode + columnaAsignada);
        renderizarBloque(
          ws, 
          [bloque], 
          colStr, 
          colStr, 
          filaInicio, 
          filaFin,
          mapaDocenteColor
        );
      }
    }
  } else {
    // Lógica ORIGINAL para las demás hojas
    const bloquesPorSlot = new Map<string, Asignacion[]>();
    for (const bloque of bloques) {
      const key = `${bloque.dia.toLowerCase()}-${bloque.hora_inicio}`;
      if (!bloquesPorSlot.has(key)) {
        bloquesPorSlot.set(key, []);
      }
      bloquesPorSlot.get(key)!.push(bloque);
    }

    for (const [key, bloquesEnSlot] of bloquesPorSlot) {
      if (bloquesEnSlot.length === 0) continue;
      const primerBloque = bloquesEnSlot[0];
      const filaInicio = horaAFila(primerBloque.hora_inicio);
      if (filaInicio === null) continue;
      const colDia = COLUMNAS_DIA[primerBloque.dia.toLowerCase()];
      if (!colDia) continue;

      const colStartCharCode = colDia.inicio.charCodeAt(0);
      const colEndCharCode = colDia.fin.charCodeAt(0);
      const numCols = colEndCharCode - colStartCharCode + 1;

      if (bloquesEnSlot.length === 1) {
        renderizarBloque(
          ws, 
          bloquesEnSlot, 
          colDia.inicio, 
          colDia.fin, 
          filaInicio, 
          filaInicio + bloquesEnSlot[0].duracion_horas - 1,
          mapaDocenteColor
        );
      } else {
        const buckets: Asignacion[][] = Array.from({ length: numCols }, () => []);
        bloquesEnSlot.forEach((bloque, idx) => {
          const bucketIdx = Math.min(idx, numCols - 1);
          buckets[bucketIdx].push(bloque);
        });

        buckets.forEach((bloquesInBucket, bucketIdx) => {
          if (bloquesInBucket.length === 0) return;
          
          const colStr = String.fromCharCode(colStartCharCode + bucketIdx);
          const filaFinBucket = Math.max(...bloquesInBucket.map(b => filaInicio + b.duracion_horas - 1));
          
          renderizarBloque(
            ws,
            bloquesInBucket,
            colStr,
            colStr,
            filaInicio,
            filaFinBucket,
            mapaDocenteColor
          );
        });
      }
    }
  }
}
