import ExcelJS from 'exceljs';

const C = {
  azulPrincipal: 'FF173F67',
  azulSecundario: 'FF255F91',
  azulClaro: 'FFDCEAF7',
  fondo: 'FFF4F7FA',
  borde: 'FFC9D3DF',
  textPrincipal: 'FF1F2937',
  textSecundario: 'FF5F6B7A',
  blanco: 'FFFFFFFF',
};

function setCell(
  ws: ExcelJS.Worksheet, row: number, col: number, value: any,
  opts?: { font?: Partial<ExcelJS.Font>; fill?: Partial<ExcelJS.Fill>; alignment?: Partial<ExcelJS.Alignment>; border?: Partial<ExcelJS.Borders>; numFmt?: string; }
) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (opts?.font) cell.font = { name: 'Calibri', ...opts.font };
  if (opts?.fill) cell.fill = opts.fill as ExcelJS.Fill;
  if (opts?.alignment) cell.alignment = { vertical: 'middle', ...opts.alignment };
  if (opts?.border) cell.border = opts.border;
  if (opts?.numFmt) cell.numFmt = opts.numFmt;
  return cell;
}

function mergeCell(
  ws: ExcelJS.Worksheet, range: string, value: any,
  opts?: Parameters<typeof setCell>[4]
) {
  ws.mergeCells(range);
  const m = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
  if (!m) return;
  const colNum = ws.getColumn(m[1]).number;
  setCell(ws, parseInt(m[2], 10), colNum, value, { ...opts, alignment: { horizontal: 'center', vertical: 'middle', ...opts?.alignment } });
}

function card(
  ws: ExcelJS.Worksheet, row: number, colLabel: string, colEnd: string,
  label: string, value: string | number, subtitle?: string,
  valueColor?: string
) {
  const colNum = ws.getColumn(colLabel).number;
  const colEndNum = ws.getColumn(colEnd).number;
  const bdr = { top: { style: 'thin' as const, color: { argb: C.borde } }, bottom: { style: 'thin' as const, color: { argb: C.borde } }, left: { style: 'thin' as const, color: { argb: C.borde } }, right: { style: 'thin' as const, color: { argb: C.borde } } };
  const fontName = 'Calibri';

  for (let c = colNum; c <= colEndNum; c++) {
    for (let r = row; r <= row + 2; r++) {
      setCell(ws, r, c, '', { border: bdr });
    }
  }

  setCell(ws, row, colNum, label, {
    font: { size: 9, bold: true, color: { argb: C.textSecundario } },
    alignment: { horizontal: 'center', vertical: 'bottom' },
  });
  setCell(ws, row + 1, colNum, value, {
    font: { size: 22, bold: true, color: { argb: valueColor || C.azulPrincipal } },
    alignment: { horizontal: 'center', vertical: 'top' },
  });
  if (subtitle) {
    setCell(ws, row + 2, colNum, subtitle, {
      font: { size: 8, color: { argb: C.textSecundario } },
      alignment: { horizontal: 'center', vertical: 'top' },
    });
  }
}

function calcularMetricas(asignaciones: any[]) {
  const docentes = new Set<string>();
  const cursos = new Set<string>();
  const ambientes = new Set<string>();
  let totalHoras = 0;
  let horasTeoria = 0, horasPractica = 0, horasLaboratorio = 0;

  for (const a of asignaciones) {
    if (a.docente_id) docentes.add(a.docente_id);
    if (a.curso_codigo) cursos.add(a.curso_codigo);
    const aula = (a.aula || '').trim();
    if (aula) ambientes.add(aula);
    const h = a.duracion_horas || 1;
    totalHoras += h;
    if (a.tipo_sesion === 'teoria') horasTeoria += h;
    else if (a.tipo_sesion === 'practica') horasPractica += h;
    else if (a.tipo_sesion === 'laboratorio') horasLaboratorio += h;
  }

  return {
    totalDocentes: docentes.size,
    totalCursos: cursos.size,
    totalAsignaciones: asignaciones.length,
    totalAmbientes: ambientes.size,
    horasAsignadas: totalHoras,
    horasTeoria,
    horasPractica,
    horasLaboratorio,
    fechaGeneracion: new Date(),
  };
}

export function crearHojaResumenGeneral(
  workbook: ExcelJS.Workbook,
  config: { programacion: { año: string; semestre: string; inicio: string; termino: string } },
  todasAsignaciones: any[],
) {
  const metricas = calcularMetricas(todasAsignaciones);
  const ws = workbook.addWorksheet('Resumen General');
  const prog = config.programacion;

  // ── Page setup ──
  (ws as any).showGridLines = false;
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = {
    oddFooter: `&LUniversidad Nacional de Trujillo&CReporte General ${prog.año}-${prog.semestre}&RPágina &P de &N`,
  };

  // ── Column widths ──
  for (const c of 'ABCDEFGHIJKL') {
    const i = c.charCodeAt(0) - 65;
    ws.getColumn(c).width = (i === 0 || i === 11) ? 2.5 : 22;
  }

  // ── Row heights ──
  const rowH: Record<number, number> = {
    1: 4, 2: 22, 3: 14, 4: 4, 5: 18, 6: 14, 7: 4,
    8: 24,
    9: 14, 10: 24, 11: 16,
    12: 4,
    13: 22, 14: 14, 15: 14, 16: 14, 17: 14, 18: 14, 19: 14,
    20: 4,
    21: 22, 22: 18, 23: 18, 24: 18,
    25: 4,
    26: 22,
  };
  Object.entries(rowH).forEach(([r, h]) => ws.getRow(parseInt(r)).height = h);

  // ═══ 1. ENCABEZADO INSTITUCIONAL ═══
  mergeCell(ws, 'B2:K2', 'UNIVERSIDAD NACIONAL DE TRUJILLO', {
    font: { size: 16, bold: true, color: { argb: C.azulPrincipal } },
    alignment: { horizontal: 'left' },
  });
  mergeCell(ws, 'B3:K3', 'FACULTAD DE INGENIERÍA — ESCUELA DE INGENIERÍA DE SISTEMAS', {
    font: { size: 11, color: { argb: C.textSecundario } },
    alignment: { horizontal: 'left' },
  });
  mergeCell(ws, 'B5:K5', 'REPORTE GENERAL DE HORARIOS ACADÉMICOS', {
    font: { size: 14, bold: true, color: { argb: C.azulPrincipal } },
  });
  mergeCell(ws, 'B6:K6', `Año Académico ${prog.año} – Semestre ${prog.semestre}   |   Periodo: ${prog.inicio} al ${prog.termino}`, {
    font: { size: 10, color: { argb: C.textSecundario } },
  });

  // ═══ 2. RESUMEN GENERAL ═══
  mergeCell(ws, 'B8:K8', 'RESUMEN GENERAL DEL PERIODO ACADÉMICO', {
    font: { size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulPrincipal } },
    alignment: { horizontal: 'left', indent: 1 },
  });

  const hasData = todasAsignaciones.length > 0;
  if (hasData) {
    // Row 9-11: cards (label, value, subtitle)
    card(ws, 9, 'B', 'C', 'DOCENTES', metricas.totalDocentes, 'Con carga asignada');
    card(ws, 9, 'D', 'E', 'CURSOS', metricas.totalCursos, 'Programados');
    card(ws, 9, 'F', 'G', 'ASIGNACIONES', metricas.totalAsignaciones, 'Bloques horarios');
    card(ws, 9, 'H', 'I', 'AMBIENTES', metricas.totalAmbientes, 'Aulas / laboratorios');
    card(ws, 9, 'J', 'K', 'HORAS', `${metricas.horasAsignadas} h`, 'Académicas programadas');
  } else {
    mergeCell(ws, 'B9:K11', 'No se encontraron asignaciones registradas para este periodo', {
      font: { size: 12, color: { argb: C.textSecundario } },
      alignment: { horizontal: 'center' },
    });
  }

  // ═══ 3. INFORMACIÓN ACADÉMICA + ESTADO DE LA PROGRAMACIÓN ═══
  mergeCell(ws, 'B13:F13', 'INFORMACIÓN ACADÉMICA', {
    font: { size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulSecundario } },
    alignment: { horizontal: 'left', indent: 1 },
  });
  mergeCell(ws, 'G13:K13', 'ESTADO DE LA PROGRAMACIÓN', {
    font: { size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulSecundario } },
    alignment: { horizontal: 'left', indent: 1 },
  });

  const infoItems: [string, string][] = [
    ['Año académico', prog.año],
    ['Semestre', prog.semestre],
    ['Periodo', `${prog.inicio} al ${prog.termino}`],
    ['Escuela', 'Ingeniería de Sistemas'],
    ['Sede', 'Trujillo'],
    ['Generado', metricas.fechaGeneracion.toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })],
  ];
  infoItems.forEach(([label, value], i) => {
    const r = 14 + i;
    setCell(ws, r, ws.getColumn('B').number, label, {
      font: { size: 10, bold: true, color: { argb: C.textPrincipal } },
      alignment: { horizontal: 'left' },
      border: i < infoItems.length - 1 ? { bottom: { style: 'hair', color: { argb: C.borde } } } : undefined,
    });
    setCell(ws, r, ws.getColumn('C').number, value, {
      font: { size: 10, color: { argb: C.textSecundario } },
      alignment: { horizontal: 'left' },
      border: i < infoItems.length - 1 ? { bottom: { style: 'hair', color: { argb: C.borde } } } : undefined,
    });
  });

  if (hasData) {
    const statusItems: [string, string][] = [
      ['Docentes con carga', `${metricas.totalDocentes}`],
      ['Cursos programados', `${metricas.totalCursos}`],
      ['Ambientes utilizados', `${metricas.totalAmbientes}`],
      ['Horas programadas', `${metricas.horasAsignadas} h`],
      ['Asignaciones registradas', `${metricas.totalAsignaciones}`],
    ];
    statusItems.forEach(([label, value], i) => {
      const r = 14 + i;
      setCell(ws, r, ws.getColumn('G').number, label, {
        font: { size: 10, bold: true, color: { argb: C.textPrincipal } },
        alignment: { horizontal: 'left' },
        border: i < statusItems.length - 1 ? { bottom: { style: 'hair', color: { argb: C.borde } } } : undefined,
      });
      setCell(ws, r, ws.getColumn('H').number, value, {
        font: { size: 10, color: { argb: C.textSecundario } },
        alignment: { horizontal: 'left' },
        border: i < statusItems.length - 1 ? { bottom: { style: 'hair', color: { argb: C.borde } } } : undefined,
      });
    });
  }

  // ═══ 4. DISTRIBUCIÓN POR TIPO DE SESIÓN ═══
  if (hasData) {
    mergeCell(ws, 'B21:F21', 'DISTRIBUCIÓN POR TIPO DE SESIÓN', {
      font: { size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulSecundario } },
      alignment: { horizontal: 'left', indent: 1 },
    });

    const hdrFont = { size: 10, bold: true, color: { argb: C.textSecundario } };
    const hdrFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: C.fondo } };
    const bdr = { top: { style: 'thin' as const, color: { argb: C.borde } }, bottom: { style: 'thin' as const, color: { argb: C.borde } }, left: { style: 'thin' as const, color: { argb: C.borde } }, right: { style: 'thin' as const, color: { argb: C.borde } } };

    const total = metricas.horasTeoria + metricas.horasPractica + metricas.horasLaboratorio;
    const distRows: [string, number, number][] = [
      ['Teoría', metricas.horasTeoria, total > 0 ? Math.round((metricas.horasTeoria / total) * 100) : 0],
      ['Práctica', metricas.horasPractica, total > 0 ? Math.round((metricas.horasPractica / total) * 100) : 0],
      ['Laboratorio', metricas.horasLaboratorio, total > 0 ? Math.round((metricas.horasLaboratorio / total) * 100) : 0],
    ];

    if (metricas.horasTeoria + metricas.horasPractica + metricas.horasLaboratorio > 0) {
      setCell(ws, 22, ws.getColumn('B').number, 'Tipo', { font: hdrFont, fill: hdrFill, alignment: { horizontal: 'left' }, border: bdr });
      setCell(ws, 22, ws.getColumn('D').number, 'Horas', { font: hdrFont, fill: hdrFill, alignment: { horizontal: 'center' }, border: bdr });
      mergeCell(ws, 'E22:F22', '%', { font: hdrFont, fill: hdrFill, border: bdr });

      distRows.forEach(([tipo, horas, pct], i) => {
        const r = 23 + i;
        setCell(ws, r, ws.getColumn('B').number, tipo, { font: { size: 10, color: { argb: C.textPrincipal } }, alignment: { horizontal: 'left' }, border: bdr });
        setCell(ws, r, ws.getColumn('D').number, horas, { font: { size: 10, bold: true, color: { argb: C.azulPrincipal } }, alignment: { horizontal: 'center' }, border: bdr });
        setCell(ws, r, ws.getColumn('E').number, pct, { font: { size: 10, color: { argb: C.textSecundario } }, alignment: { horizontal: 'center' }, border: bdr, numFmt: '0"%"' });
      });
    }
  }

  // ═══ 5. COMPLETITUD ═══
  if (hasData) {
    mergeCell(ws, 'B26:K26', `PROGRAMACIÓN COMPLETADA — ${metricas.horasAsignadas} horas académicas registradas`, {
      font: { size: 11, bold: true, color: { argb: C.azulPrincipal } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: C.azulClaro } },
      alignment: { horizontal: 'center' },
    });
  }

  return ws;
}
