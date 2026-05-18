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
    'FF0891B2', // VI - Cian
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

export function tipoSesionAbrev(tipo: string): string {
  const map: Record<string, string> = {
    'teoria': 'T',
    'practica': 'P',
    'laboratorio': 'L',
    'asesoria': 'C'
  };
  return map[tipo] || tipo[0].toUpperCase();
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
  
  const filaTitulo = filaInicio;
  sheet.mergeCells(`A${filaTitulo}:G${filaTitulo}`);
  const celdaTitulo = sheet.getCell(`A${filaTitulo}`);
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
      sheet.mergeCells(`A${filaActual}:C${filaActual}`);
      const celdaIzq = sheet.getCell(`A${filaActual}`);
      celdaIzq.value = `  • ${docenteIzq.nombre}  (${docenteIzq.cursos.length} curso${docenteIzq.cursos.length > 1 ? 's' : ''} · ${docenteIzq.total_horas}h)`;
      celdaIzq.font = { size: 9 };
      celdaIzq.alignment = { vertical: 'middle' };
    }
    
    if (docenteDer) {
      sheet.mergeCells(`D${filaActual}:G${filaActual}`);
      const celdaDer = sheet.getCell(`D${filaActual}`);
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
  const horas = generarHorasUnicas();
  
  // Configurar columnas: Hora (18) + 6 días (32 c/u)
  sheet.columns = [
    { header: 'Hora', width: 18 },
    ...dias.map(d => ({ header: d, width: 32 }))
  ];
  
  // Título principal de la grilla
  sheet.mergeCells('A1:G1');
  const titulo = sheet.getCell('A1');
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
    sheet.mergeCells(`A${filaInicio}:G${filaInicio}`);
    const sub = sheet.getCell(`A${filaInicio}`);
    sub.value = config.subtitulo;
    sub.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(filaInicio).height = 20;
    filaInicio++;
  }
  
  // Agregar Leyenda de Docentes
  filaInicio = agregarLeyendaDocentes(sheet, config.bloques, filaInicio + 1);
  
  // Encabezados de Día
  const filaHeader = filaInicio;
  sheet.getCell(`A${filaHeader}`).value = 'Hora';
  dias.forEach((dia, idx) => {
    const cell = sheet.getCell(filaHeader, idx + 2);
    cell.value = dia;
  });
  
  const headerRow = sheet.getRow(filaHeader);
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }
    };
    cell.border = bordeCompleto('FFFFFFFF');
  });
  
  const celdasCombinadas = new Set<string>();

  // Poblar grilla
  horas.forEach((hora, horaIdx) => {
    const filaActual = filaHeader + 1 + horaIdx;
    
    // Celda de Hora (Columna A)
    const celdaHora = sheet.getCell(`A${filaActual}`);
    celdaHora.value = hora.rango;
    celdaHora.font = { bold: true, size: 9, color: { argb: 'FF1E293B' } };
    celdaHora.alignment = { horizontal: 'center', vertical: 'middle' };
    celdaHora.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    celdaHora.border = bordeCompleto('FFCBD5E1');
    sheet.getRow(filaActual).height = 42; // Altura base
    
    dias.forEach((dia, diaIdx) => {
      const colIdx = diaIdx + 2;
      const keyCelda = `${filaActual},${colIdx}`;
      if (celdasCombinadas.has(keyCelda)) return; // Saltar si combinada
      
      const celda = sheet.getCell(filaActual, colIdx);
      
      // Buscar bloques en esta celda
      const bloquesEnCelda = config.bloques.filter(b => 
        b.dia.toLowerCase() === dia.toLowerCase() &&
        b.hora_inicio === hora.inicio
      );
      
      if (bloquesEnCelda.length > 0) {
        if (bloquesEnCelda.length === 1 && bloquesEnCelda[0].duracion_horas > 1) {
          const bloque = bloquesEnCelda[0];
          const filaFin = filaActual + bloque.duracion_horas - 1;
          for (let f = filaActual; f <= filaFin; f++) {
            celdasCombinadas.add(`${f},${colIdx}`);
          }
          sheet.mergeCells(filaActual, colIdx, filaFin, colIdx);
          celda.alignment = {
            horizontal: 'left',
            vertical: 'middle',
            wrapText: true,
            indent: 1
          };
        } else {
          celda.alignment = {
            horizontal: 'left',
            vertical: 'top',
            wrapText: true,
            indent: 1
          };
        }
        
        const contenidoBloques = bloquesEnCelda.map(b => {
          const abrev = b.tipo_sesion === 'asesoria' ? 'C' : tipoSesionAbrev(b.tipo_sesion);
          return (
            `${b.curso_nombre}\n` +
            `[${abrev}] ${b.grupo} · ${b.aula}\n` +
            `👤 ${b.docente_nombre}\n` +
            `🕐 ${b.hora_inicio} - ${b.hora_fin} (${b.duracion_horas}h)`
          );
        });
        
        const separador = '\n━━━━━━━━━━━━━━━━━━━\n';
        celda.value = contenidoBloques.join(separador);
        celda.font = { size: bloquesEnCelda.length > 1 ? 8 : 8.5, color: { argb: 'FF1E293B' }, name: 'Calibri' };
        
        if (bloquesEnCelda.length > 1) {
          celda.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' }
          };
          celda.border = {
            top: { style: 'thick', color: { argb: 'FF7C3AED' } },
            left: { style: 'medium', color: { argb: 'FF7C3AED' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
          
          celda.note = {
            texts: [
              { 'font': { 'bold': true }, 'text': `${bloquesEnCelda.length} cursos en paralelo\n` },
              { 'text': bloquesEnCelda.map(b => `• ${b.curso_nombre} (${b.aula})`).join('\n') }
            ]
          };
        } else {
          const bloque = bloquesEnCelda[0];
          if (bloque.tipo_sesion === 'asesoria') {
            celda.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE5E7EB' }
            };
            celda.border = {
              left: { style: 'thick', color: { argb: 'FF6B7280' } },
              right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
              bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
            };
          } else {
            const color = config.mapaColores.get(`${bloque.ciclo}-${bloque.curso_codigo}`);
            if (color) {
              celda.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: hexToArgb(color.bg) }
              };
              celda.border = {
                left: { style: 'thick', color: { argb: hexToArgb(color.border) } },
                right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
              };
            } else {
              celda.border = bordeCompleto('FFCBD5E1');
              celda.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFBEB' }
              };
            }
          }
        }
        
        // Ajustar altura de fila según contenido
        const lineasPorBloque = 4;
        const lineasSeparador = 1;
        const totalLineas = (bloquesEnCelda.length * lineasPorBloque) + 
                            ((bloquesEnCelda.length - 1) * lineasSeparador);
        
        const alturaMinima = 60;
        const alturaPorLinea = 12;
        const alturaCalculada = Math.max(
          alturaMinima,
          totalLineas * alturaPorLinea
        );
        
        const filaObj = sheet.getRow(filaActual);
        filaObj.height = Math.max(filaObj.height || 0, alturaCalculada);
      } else {
        celda.border = bordeCompleto('FFE2E8F0');
        celda.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' }
        };
      }
    });
  });
  
  sheet.pageSetup.printArea = `A1:G${filaHeader + horas.length}`;
  sheet.pageSetup.margins = {
    left: 0.4, right: 0.4,
    top: 0.4, bottom: 0.4,
    header: 0.2, footer: 0.2
  };
}
