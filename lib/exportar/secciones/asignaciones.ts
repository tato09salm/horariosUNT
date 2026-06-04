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
  
  // Agrupar bloques por día y hora_inicio para manejar múltiples cursos en el mismo slot
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

    // Calcular filaFin como la última fila del slot (máxima duración en el slot)
    const filaFin = Math.max(...bloquesEnSlot.map(b => 
      filaInicio + b.duracion_horas - 1
    ));

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

    // Hacer merge del rango completo
    const rangoBloque = `${colDia.inicio}${filaInicio}:${colDia.fin}${filaFin}`;
    try {
      ws.mergeCells(rangoBloque);
    } catch (e) {
      try {
        ws.unMergeCells(rangoBloque);
        ws.mergeCells(rangoBloque);
      } catch (e2) {}
    }

    // Construir contenido con todos los bloques del slot
    const lineasTotales: string[] = [];
    bloquesEnSlot.forEach(bloque => {
      const lineas: string[] = [];
      lineas.push(String(bloque.docente_n));
      lineas.push(bloque.aula);
      const tipo = etiquetaTipoSesion(bloque.tipo_sesion);
      if (tipo) lineas.push(tipo);
      lineasTotales.push(...lineas, '───'); // Separador entre cursos
    });
    if (lineasTotales.length > 0) {
      lineasTotales.pop(); // quitar último separador
    }

    // Color: usar color del primer bloque (o gris si múltiples)
    const color = bloquesEnSlot.length === 1 
      ? PALETA_COLORES_UNT[(mapaDocenteColor.get(bloquesEnSlot[0].docente_id) ?? 0) % PALETA_COLORES_UNT.length]
      : 'FFF0F0F0';

    // Aplicar contenido y formato
    const cell = ws.getCell(`${colDia.inicio}${filaInicio}`);
    cell.value = lineasTotales.join('\n');
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.border = BORDE_FINO;

    // Aplicar bordes y fondo a todo el rango del merge
    for (let f = filaInicio; f <= filaFin; f++) {
      const colStart = colDia.inicio.charCodeAt(0);
      const colEnd = colDia.fin.charCodeAt(0);
      for (let c = colStart; c <= colEnd; c++) {
        const charCol = String.fromCharCode(c);
        const cellTemp = ws.getCell(`${charCol}${f}`);
        cellTemp.border = BORDE_FINO;
        cellTemp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      }
    }

    // Ajustar altura de la fila para que quepa todo el texto
    const filaObj = ws.getRow(filaInicio);
    const alturaNecesaria = Math.max(20, lineasTotales.length * 15);
    filaObj.height = alturaNecesaria;
  }
}
