'use client';

import { useRef, useMemo } from 'react';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = {
  lunes: 'LUNES', martes: 'MARTES', miercoles: 'MIÉRCOLES',
  jueves: 'JUEVES', viernes: 'VIERNES', sabado: 'SÁBADO',
};

const PALETA = [
  '#D8E6FA', '#F7D8D5', '#F8EDC8', '#D5EFD9', '#F9DFCE',
  '#D9EEF2', '#C9DCF7', '#F4B7AE', '#F8E2A2', '#20C3DF',
];

const BORDER = '1px solid #000';
const BORDER_M = '1.5px solid #000';
const BORDER_L = '2px solid #000';

function normalizeDay(d: string) {
  return d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

interface DocenteRow {
  numero: number;
  profesor: string;
  asignatura: string;
  t: number;
  p: number;
  l: number;
  g: number;
  total: number;
  departamento: string;
  curso_codigo: string;
}

interface AsigFicha {
  id: string;
  curso_codigo: string;
  curso_nombre: string;
  numero_grupo: number | string;
  tipo: string;
  ambiente_codigo?: string;
  ambiente_nombre?: string;
  ambiente_tipo?: string;
  docente_nombre?: string;
  dia: string;
  slot_id: string;
  hora_inicio: string;
  hora_fin: string;
  ciclo_plan?: number;
}

interface SlotInfo {
  id: string;
  hora_inicio: string;
  hora_fin: string;
  orden?: number;
}

interface Props {
  universidad?: string;
  facultad?: string;
  escuela?: string;
  ciclo?: string;
  seccion?: string;
  año?: string;
  semestre?: string;
  inicio?: string;
  termino?: string;
  docentes?: DocenteRow[];
  asignaciones?: AsigFicha[];
  slots?: SlotInfo[];
  restringidos?: Record<string, string>;
}

function ordenDia(d: string): number {
  const map: Record<string, number> = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5 };
  return map[normalizeDay(d)] ?? 0;
}

function slotCompare(a: SlotInfo, b: SlotInfo): number {
  if (a.orden !== undefined && b.orden !== undefined) return a.orden - b.orden;
  return a.hora_inicio.localeCompare(b.hora_inicio);
}

function formatHour(h: string): string {
  const parts = h.split(':');
  let hour = parseInt(parts[0]);
  return hour > 12 ? `${hour - 12}` : `${hour}`;
}

function formatHourRange(inicio: string, fin: string): string {
  return `${formatHour(inicio)}-${formatHour(fin)}`;
}

export default function FichaHorarioProfesional({
  universidad = 'UNIVERSIDAD NACIONAL DE TRUJILLO',
  facultad = 'FACULTAD DE INGENIERÍA',
  escuela = 'INGENIERÍA DE SISTEMAS',
  ciclo = 'VII',
  seccion = 'A',
  año = '2026',
  semestre = 'I',
  inicio = '',
  termino = '',
  docentes = [],
  asignaciones = [],
  slots = [],
  restringidos = {},
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    const unique = new Map<string, number>();
    asignaciones.forEach(a => {
      const key = a.curso_codigo || a.curso_nombre;
      if (key && !unique.has(key)) unique.set(key, unique.size);
    });
    unique.forEach((idx, key) => {
      map.set(key, PALETA[idx % PALETA.length]);
    });
    return map;
  }, [asignaciones]);

  const getColor = (curso_codigo?: string, curso_nombre?: string): string => {
    return colorMap.get(curso_codigo || curso_nombre || '') || '#fff';
  };

  const slotsOrdenados = useMemo(() => [...slots].sort(slotCompare), [slots]);

  const horasLabels = useMemo(() => {
    return slotsOrdenados.map(s => formatHourRange(s.hora_inicio, s.hora_fin));
  }, [slotsOrdenados]);

  const isRestricted = (slotId: string): boolean => {
    return slotId in (restringidos || {});
  };

  const slotIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    slotsOrdenados.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [slotsOrdenados]);

  type BlockGroup = { asigs: AsigFicha[]; startIdx: number; duration: number };

  const blocksByDaySlot = useMemo(() => {
    const map = new Map<string, AsigFicha[]>();
    asignaciones.forEach(a => {
      const key = `${normalizeDay(a.dia)}_${a.slot_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [asignaciones]);

  const groupedBlocks = useMemo(() => {
    const groups: BlockGroup[] = [];
    const handled = new Set<string>();
    asignaciones.forEach(a => {
      const key = `${normalizeDay(a.dia)}_${a.slot_id}_${a.curso_codigo || ''}_${a.numero_grupo || ''}_${a.tipo || ''}_${a.ambiente_codigo || ''}`;
      if (handled.has(key)) return;
      const startIdx = slotIndexMap.get(a.slot_id);
      if (startIdx === undefined) return;
      const dia = normalizeDay(a.dia);
      const block: AsigFicha[] = [a];
      handled.add(key);
      for (let i = startIdx + 1; i < slotsOrdenados.length; i++) {
        const nextSlot = slotsOrdenados[i];
        if (!nextSlot) break;
        const nextKey = `${dia}_${nextSlot.id}_${a.curso_codigo || ''}_${a.numero_grupo || ''}_${a.tipo || ''}_${a.ambiente_codigo || ''}`;
        const matchIdx = asignaciones.findIndex(as =>
          normalizeDay(as.dia) === dia &&
          as.slot_id === nextSlot.id &&
          as.curso_codigo === a.curso_codigo &&
          String(as.numero_grupo) === String(a.numero_grupo) &&
          as.tipo === a.tipo &&
          as.ambiente_codigo === a.ambiente_codigo
        );
        if (matchIdx === -1) break;
        handled.add(nextKey);
        block.push(asignaciones[matchIdx]);
      }
      if (block.length > 0) {
        groups.push({ asigs: block, startIdx, duration: block.length });
      }
    });
    return groups;
  }, [asignaciones, slotIndexMap, slotsOrdenados]);

  const blocksByStartKey = useMemo(() => {
    const map = new Map<string, BlockGroup[]>();
    groupedBlocks.forEach(g => {
      const first = g.asigs[0];
      const key = `${normalizeDay(first.dia)}_${first.slot_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return map;
  }, [groupedBlocks]);

  const blockEndSet = useMemo(() => {
    const set = new Set<string>();
    groupedBlocks.forEach(g => {
      for (let i = 1; i < g.asigs.length; i++) {
        const a = g.asigs[i];
        set.add(`${normalizeDay(a.dia)}_${a.slot_id}`);
      }
    });
    return set;
  }, [groupedBlocks]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ fontFamily: "'Arial Narrow', 'Roboto Condensed', 'Oswald', sans-serif", color: '#000' }}>
      <div style={{ textAlign: 'right', marginBottom: 12 }}>
        <button onClick={handlePrint} style={{ padding: '8px 20px', cursor: 'pointer' }}>
          Imprimir / PDF
        </button>
      </div>

      <div ref={ref} className="ficha-container"
        style={{
          width: '1120px',
          maxWidth: '100%',
          margin: '0 auto',
          background: '#fff',
          border: BORDER_L,
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
        }}
      >
        {/* ── HEADER: Institutional (left) + Teacher table (right) ── */}
        <div style={{ display: 'flex', borderBottom: BORDER_M }}>
          {/* Institutional Block */}
          <div style={{
            width: '35%',
            borderRight: BORDER_M,
            padding: '10px 12px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 }}>{universidad}</div>
              <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>{facultad}</div>
              <div style={{ fontSize: 13, marginTop: 1, color: '#555' }}>TRUJILLO</div>
            </div>
            <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ padding: '4px 0', fontWeight: 'bold', whiteSpace: 'nowrap', width: '40%' }}>ESCUELA:</td><td style={{ padding: '4px 0', color: '#2563eb', fontWeight: 'bold' }}>{escuela}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>CICLO:</td><td style={{ padding: '4px 0', color: '#2563eb', fontWeight: 'bold' }}>{ciclo}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>SECCIÓN:</td><td style={{ padding: '4px 0', color: '#2563eb', fontWeight: 'bold' }}>{seccion}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>AÑO ACADÉMICO:</td><td style={{ padding: '4px 0', color: '#2563eb', fontWeight: 'bold' }}>{año}</td></tr>
                <tr><td style={{ padding: '4px 0', fontWeight: 'bold' }}>SEMESTRE:</td><td style={{ padding: '4px 0', color: '#2563eb', fontWeight: 'bold' }}>{semestre}</td></tr>
              </tbody>
            </table>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#555' }}>
              <div>Inicio del ciclo: <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{inicio || '—'}</span></div>
              <div>Término del ciclo: <span style={{ color: '#2563eb', fontWeight: 'bold' }}>{termino || '—'}</span></div>
            </div>
          </div>

          {/* Teacher Table */}
          <div style={{ width: '65%', padding: '10px 12px', boxSizing: 'border-box', overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              fontSize: 13,
              borderCollapse: 'collapse',
              border: BORDER,
            }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center', width: '5%' }}>N.º</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center' }}>PROFESOR</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center' }}>ASIGNATURA</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center', width: '6%' }}>T</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center', width: '6%' }}>P</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center', width: '6%' }}>L</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center', width: '6%' }}>G</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center', width: '10%' }}>T. HORAS</th>
                  <th style={{ border: BORDER, padding: '6px 4px', fontWeight: 'bold', textAlign: 'center' }}>DEPARTAMENTO</th>
                </tr>
              </thead>
              <tbody>
                {(docentes || []).length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ border: BORDER, padding: 12, textAlign: 'center', color: '#999' }}>
                      Sin datos de docentes
                    </td>
                  </tr>
                ) : (
                  (docentes || []).map((d, i) => {
                    const bgColor = getColor(d.curso_codigo, d.asignatura);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? bgColor : undefined, height: 26 }}>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'center' }}>{d.numero}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'left', fontSize: 12 }}>{d.profesor}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'left', fontSize: 12 }}>{d.asignatura}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'center' }}>{d.t}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'center' }}>{d.p}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'center' }}>{d.l}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'center' }}>{d.g}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{d.total}</td>
                        <td style={{ border: BORDER, padding: '4px', textAlign: 'left', fontSize: 11 }}>{d.departamento}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SCHEDULE GRID ── */}
        <div style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            tableLayout: 'fixed',
            boxSizing: 'border-box',
          }}>
            <thead>
              <tr>
                <th style={{ width: '8%', border: BORDER, padding: '8px 4px', fontWeight: 'bold', textAlign: 'center', fontSize: 15, background: '#f5f5f5', textTransform: 'uppercase' }}>HORA</th>
                {DIAS.map(d => (
                  <th key={d} style={{ border: BORDER, padding: '8px 4px', fontWeight: 'bold', textAlign: 'center', fontSize: 15, background: '#f5f5f5', textTransform: 'uppercase', width: '12%' }}>{DIAS_LABEL[d]}</th>
                ))}
                <th style={{ width: '8%', border: BORDER, padding: '8px 4px', fontWeight: 'bold', textAlign: 'center', fontSize: 15, background: '#f5f5f5', textTransform: 'uppercase' }}>HORA</th>
              </tr>
            </thead>
            <tbody>
              {slotsOrdenados.map((slot, sIdx) => {
                const hourLabelL = horasLabels[sIdx] || '';
                const hourLabelR = hourLabelL;
                const restricted = isRestricted(slot.id);

                if (restricted) {
                  return (
                    <tr key={slot.id}>
                      <td style={{ border: BORDER, padding: '4px', textAlign: 'center', fontSize: 12, fontWeight: 'bold', background: '#FFF200' }}>{hourLabelL}</td>
                      <td colSpan={6} style={{ border: BORDER, padding: '4px', textAlign: 'center', background: '#FFF200', height: 20 }}>{''}</td>
                      <td style={{ border: BORDER, padding: '4px', textAlign: 'center', fontSize: 12, fontWeight: 'bold', background: '#FFF200' }}>{hourLabelR}</td>
                    </tr>
                  );
                }

                const cells = DIAS.map(dia => {
                  const key = `${normalizeDay(dia)}_${slot.id}`;
                  const isBlockEnd = blockEndSet.has(key);
                  if (isBlockEnd) return null;

                  const startBlocks = blocksByStartKey.get(key);
                  const asigsHere = blocksByDaySlot.get(key) || [];

                  if (asigsHere.length === 0 && (!startBlocks || startBlocks.length === 0)) return null;

                  const blockGroups = startBlocks || [];
                  const independentAsigs = asigsHere.filter(a => {
                    return !blockGroups.some(bg => bg.asigs.some(b => b.id === a.id));
                  });

                  const allGroups = [...blockGroups.map(bg => ({ asigs: bg.asigs, duration: bg.duration }))];

                  if (independentAsigs.length > 0) {
                    allGroups.push({ asigs: independentAsigs, duration: 1 });
                  }

                  if (allGroups.length === 0) return null;

                  const rowSpan = Math.max(...allGroups.map(g => g.duration));
                  const subCols = allGroups.length > 1 ? allGroups.length : 1;

                  return (
                    <td key={dia}
                      style={{
                        border: BORDER,
                        padding: 0,
                        verticalAlign: 'top',
                        position: 'relative',
                      }}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                    >
                      <div style={{
                        display: 'flex',
                        height: '100%',
                        minHeight: rowSpan > 1 ? `${rowSpan * 28}px` : '28px',
                      }}>
                        {allGroups.map((grp, gi) => {
                          const first = grp.asigs[0];
                          const color = getColor(first.curso_codigo, first.curso_nombre);
                          const numAsig = (colorMap.get(first.curso_codigo || first.curso_nombre || '') ? 
                            [...colorMap.entries()].findIndex(([k]) => k === (first.curso_codigo || first.curso_nombre || '')) + 1 : 1);
                          const aula = first.ambiente_codigo || first.ambiente_nombre || '';
                          const aulaShort = aula.replace(/^(LAB|AULA|LABORATORIO|TALLER)\s*/i, '').trim() || aula;
                          const tipoAula = first.ambiente_tipo || '';
                          const aulaDisplay = tipoAula.toLowerCase().includes('laboratorio') 
                            ? `Lab ${aulaShort}`
                            : tipoAula.toLowerCase().includes('taller')
                              ? `Taller ${aulaShort}`
                              : `Aula ${aulaShort}`;
                          const grupo = first.numero_grupo ? `G${first.numero_grupo}` : '';

                          return (
                            <div key={gi}
                              style={{
                                flex: subCols > 1 ? `0 0 ${100 / subCols}%` : '1',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: color,
                                borderRight: gi < subCols - 1 ? BORDER : 'none',
                                overflow: 'hidden',
                                padding: '4px 2px',
                                minHeight: rowSpan > 1 ? `${rowSpan * 28 - 8}px` : '20px',
                                boxSizing: 'border-box',
                              }}
                            >
                              <div style={{ fontSize: 17, fontWeight: 'bold', lineHeight: 1.2 }}>{numAsig}</div>
                              <div style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2, textAlign: 'center', wordBreak: 'break-word' }}>
                                {aulaDisplay}
                                {grupo ? ` (${grupo})` : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                });

                return (
                  <tr key={slot.id} style={{ height: restricted ? 20 : 28 }}>
                    <td style={{ border: BORDER, padding: '4px', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>{hourLabelL}</td>
                    {cells.map((c, i) => c !== null ? c : <td key={i} style={{ border: BORDER, padding: 0 }} />)}
                    <td style={{ border: BORDER, padding: '4px', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>{hourLabelR}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .ficha-container { 
            width: 100%; 
            border: 2px solid #000 !important;
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          button { display: none !important; }
          @page { 
            size: landscape; 
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
