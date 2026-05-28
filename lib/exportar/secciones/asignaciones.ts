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

export function aplicarAsignaciones(
  ws: ExcelJS.Worksheet,
  asignaciones: Asignacion[],
  mapaDocenteColor: Map<string, number>  // docente_id → índice en paleta
) {
  // Agrupar bloques contiguos
  const bloques = agruparAsignacionesContiguas(asignaciones);
  
  for (const bloque of bloques) {
    const filaInicio = horaAFila(bloque.hora_inicio);
    if (filaInicio === null) continue;
    
    const filaFin = filaInicio + bloque.duracion_horas - 1;
    const colDia = COLUMNAS_DIA[bloque.dia.toLowerCase()];
    if (!colDia) continue;
    
    // Color del docente
    const indiceColor = mapaDocenteColor.get(bloque.docente_id) ?? 0;
    const color = PALETA_COLORES_UNT[indiceColor % PALETA_COLORES_UNT.length];
    
    // Desmerge previo para evitar conflictos con merges existentes
    const masters = new Set<string>();
    for (let f = filaInicio; f <= filaFin; f++) {
      const colStart = colDia.inicio.charCodeAt(0);
      const colEnd = colDia.fin.charCodeAt(0);
      for (let c = colStart; c <= colEnd; c++) {
        const charCol = String.fromCharCode(c);
        const cell = ws.getCell(`${charCol}${f}`);
        if (cell.isMerged && cell.master) {
          masters.add(cell.master.address);
        }
      }
    }
    masters.forEach(addr => {
      try {
        ws.unMergeCells(addr);
      } catch (e) {
        // Ignorar si ya no existe el merge
      }
    });
    
    // Hacer merge del bloque completo (vertical + horizontal)
    const rangoBloque = `${colDia.inicio}${filaInicio}:${colDia.fin}${filaFin}`;
    try {
      ws.mergeCells(rangoBloque);
    } catch (e) {
      // Si hay solapes residuales, intentar limpiar y reintentar
      try {
        ws.unMergeCells(rangoBloque);
        ws.mergeCells(rangoBloque);
      } catch (e2) {
        // Si falla, omitir el merge para evitar romper la exportacion
      }
    }
    
    // Construir contenido (2-3 líneas)
    const lineas: string[] = [];
    lineas.push(String(bloque.docente_n));     // Línea 1: número docente
    lineas.push(bloque.aula);                   // Línea 2: aula
    
    const tipo = etiquetaTipoSesion(bloque.tipo_sesion);
    if (tipo) {
      lineas.push(tipo);                        // Línea 3: tipo (opcional)
    }
    
    // Aplicar contenido y formato
    const cell = ws.getCell(`${colDia.inicio}${filaInicio}`);
    cell.value = lineas.join('\n');
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = { 
      horizontal: 'center', 
      vertical: 'middle', 
      wrapText: true 
    };
    cell.fill = {
      type: 'pattern', 
      pattern: 'solid',
      fgColor: { argb: color }
    };
    cell.border = BORDE_FINO;
    
    // Aplicar bordes y fondo a todo el rango del merge
    for (let f = filaInicio; f <= filaFin; f++) {
      const colStart = colDia.inicio.charCodeAt(0);
      const colEnd = colDia.fin.charCodeAt(0);
      for (let c = colStart; c <= colEnd; c++) {
        const charCol = String.fromCharCode(c);
        const cellTemp = ws.getCell(`${charCol}${f}`);
        cellTemp.border = BORDE_FINO;
        cellTemp.fill = {
          type: 'pattern', 
          pattern: 'solid',
          fgColor: { argb: color }
        };
      }
    }
  }
}
