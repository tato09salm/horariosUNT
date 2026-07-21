'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTheme } from '@/lib/theme';
import FichaHorarioProfesional from '@/components/reportes/FichaHorarioProfesional';
import AsyncSearchCombobox from '@/components/reportes/AsyncSearchCombobox';
import ActiveFilterChips from '@/components/reportes/ActiveFilterChips';
import Pagination from '@/components/reportes/Pagination';
import LoadingSkeleton from '@/components/reportes/LoadingSkeleton';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_L: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

const AZUL = { principal: '#17446B', accion: '#2563EB', claro: '#EFF6FF', fondo: '#F4F7FB', borde: '#DCE3EC', text: '#172033', textSec: '#64748B' };

const SX = {
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    height: '42px', padding: '0 20px',
    background: AZUL.accion, color: '#fff',
    border: 'none', borderRadius: '8px',
    fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
    textDecoration: 'none',
  } as React.CSSProperties,
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    height: '38px', padding: '0 14px',
    background: '#fff', color: AZUL.text,
    border: '1px solid #DCE3EC', borderRadius: '8px',
    fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s',
  } as React.CSSProperties,
  card: {
    background: '#fff', border: '1px solid #DCE3EC', borderRadius: '10px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  } as React.CSSProperties,
  input: {
    height: '42px', padding: '0 12px', fontSize: '14px',
    borderRadius: '8px', border: '1px solid #DCE3EC',
    background: '#fff', color: AZUL.text,
    width: '100%', boxSizing: 'border-box',
    outline: 'none',
  } as React.CSSProperties,
  select: {
    height: '42px', padding: '0 12px', fontSize: '14px',
    borderRadius: '8px', border: '1px solid #DCE3EC',
    background: '#fff', color: AZUL.text,
    width: '100%', boxSizing: 'border-box',
    cursor: 'pointer', outline: 'none',
  } as React.CSSProperties,
};

export default function ReportesPage() {
  const { darkMode } = useTheme();
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [tipoReporte, setTipoReporte] = useState<'operacional'|'gestion'|'docente'|'ficha'>('docente');
  const [docenteId, setDocenteId] = useState('');
  const [ambienteId, setAmbienteId] = useState('');
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [restringidos, setRestringidos] = useState<Record<string, string>>({});
  const [loadedRestringidos, setLoadedRestringidos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportableProgId, setExportableProgId] = useState<string | null>(null);
  const [fichaData, setFichaData] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'nombre' | 'horas' | 'cursos'>('nombre');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filtroDia, setFiltroDia] = useState('');
  const [filtroTipoSesion, setFiltroTipoSesion] = useState('');
  const [filtroCurso, setFiltroCurso] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef<HTMLDivElement>(null);
  const [docenteSearchResults, setDocenteSearchResults] = useState<any[]>([]);
  const [ambienteSearchResults, setAmbienteSearchResults] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/ciclos').then(r=>r.json()).then(d=>{
      setCiclos(d.data||[]);
      const a = d.data?.find((c:any)=>c.activo);
      if(a) setCicloId(a.id);
    });
    fetch('/api/docentes?limit=1000&activo=true').then(r=>r.json()).then(d=>setDocentes(d.data||[]));
    fetch('/api/aulas').then(r=>r.json()).then(d=>setAmbientes(d.data||[]));
    Promise.all([
      fetch('/api/dashboard').then(r=>r.json()),
      fetch('/api/configuracion?clave=HORARIOS_RESTRINGIDOS').then(r=>r.json()).catch(() => ({ data: null }))
    ]).then(([dashRes, configRes]) => {
      const activeSlots = dashRes?.slots || [];
      setSlots(activeSlots);
      setDashData(dashRes);
      let restDict: Record<string, string> = {};
      if (configRes.data && configRes.data.valor) {
        try {
          const parsed = JSON.parse(configRes.data.valor);
          if (Array.isArray(parsed)) {
            parsed.forEach(id => { restDict[id] = 'HORA LIBRE (REFRIGERIO)'; });
          } else if (parsed && typeof parsed === 'object') {
            restDict = parsed;
          }
        } catch(e) {}
      }
      setRestringidos(restDict);
      setLoadedRestringidos(true);
    });
  }, []);

  useEffect(() => {
    let active = true;
    if (!cicloId) {
      setExportableProgId(null);
      return () => { active = false; };
    }
    fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        const progs = d.data || [];
        const published = progs.find((p: any) => p.estado === 'publicado' || p.fase === 4) || null;
        setExportableProgId(published ? published.id : null);
      })
      .catch(() => { if (active) setExportableProgId(null); });
    return () => { active = false; };
  }, [cicloId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportBtnRef.current && !exportBtnRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function generarReporte() {
    if (!cicloId) return;
    setLoading(true);
    setHasSearched(false);
    setSelectedTeacher(null);
    try {
      const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`).then(r => r.json());
      const progs = progsRes.data || [];
      const selectedProg = progs.find((p: any) => p.estado === 'publicado') || progs[0];
      if (selectedProg && selectedProg.config && selectedProg.config.horarios_restringidos) {
        setRestringidos(selectedProg.config.horarios_restringidos);
      }
      
      let asignacionesData: any[] = [];
      const q = new URLSearchParams({ciclo_id:cicloId});
      if (docenteId) q.set('docente_id', docenteId);
      if (ambienteId) q.set('ambiente_id', ambienteId);
      const res = await fetch(`/api/horarios?${q}`);
      const data = await res.json();
      asignacionesData = data.data || [];

      if (asignacionesData.length === 0 && cicloId) {
        if (selectedProg) {
          const exportRes = await fetch(`/api/horarios/programaciones/${selectedProg.id}/exportar`);
          if (exportRes.ok) {
            const exportData = await exportRes.json();
            asignacionesData = (exportData.asignaciones || []).map((a: any) => ({
              dia: a.dia,
              hora_inicio: a.hora_inicio,
              hora_fin: a.hora_fin,
              curso_nombre: a.curso_nombre,
              curso_codigo: a.curso_codigo,
              grupo: a.grupo,
              numero_grupo: parseInt(String(a.grupo || '').replace('G', ''), 10) || 1,
              tipo: a.tipo_sesion || a.tipo,
              ambiente_nombre: a.aula || '',
              ambiente_codigo: a.aula || '',
              docente_nombre: a.docente_nombre || '',
              docente_id: a.docente_id || null,
              ciclo_plan: a.ciclo_plan || a.ciclo,
            }));

            if (docenteId) {
              const docSeleccionado = docentes.find(d => String(d.id) === String(docenteId));
              const apellidos = docSeleccionado?.apellidos?.toLowerCase() || '';
              asignacionesData = asignacionesData.filter((a: any) => {
                const idCoincide = a.docente_id && String(a.docente_id) === String(docenteId);
                const nombreCoincide = a.docente_nombre && apellidos && a.docente_nombre.toLowerCase().includes(apellidos);
                return idCoincide || nombreCoincide;
              });
            }
            if (ambienteId) {
              const amb = ambientes.find(a => a.id === ambienteId);
              if (amb) {
                asignacionesData = asignacionesData.filter((a: any) =>
                  a.ambiente_codigo === amb.codigo || a.ambiente_nombre === amb.nombre
                );
              }
            }
          }
        }
      }

      const ambienteByCodigo = new Map(ambientes.map(a => [a.codigo, a]));
      const normalized = asignacionesData.map((a: any) => {
        const code = a.ambiente_codigo || a.aula || '';
        const amb = code ? ambienteByCodigo.get(code) : null;
        return {
          ...a,
          ambiente_nombre: a.ambiente_nombre || amb?.nombre || code || '',
          ambiente_codigo: a.ambiente_codigo || amb?.codigo || code || '',
          aula: a.aula || (amb?.codigo || code || ''),
        };
      });

      setAsignaciones(normalized);
      if (cicloId) {
        const [d, chRes, docRes] = await Promise.all([
          fetch(`/api/dashboard?ciclo_id=${cicloId}`).then(r => r.json()),
          fetch(`/api/carga-horaria?ciclo_academico_id=${cicloId}`).then(r => r.json()),
          fetch('/api/docentes?limit=1000&activo=true').then(r => r.json()),
        ]);

        let finalDash = d;
        const cargaHorariaList = chRes.data || [];
        const allLoadedDocentes = docRes.data || [];
        if (allLoadedDocentes.length > 0) setDocentes(allLoadedDocentes);

        if (tipoReporte === 'gestion') {
          const listDocentes = allLoadedDocentes.length > 0 ? allLoadedDocentes : (docentes && docentes.length > 0 ? docentes : (d.cargaDocentes || []));
          const cargaDocentes = listDocentes.map((doc: any) => {
            const chList = cargaHorariaList.filter((ch: any) => ch.docente_id === doc.id);
            const primeraCarga = chList[0];

            let adicional: any = null;
            if (primeraCarga?.adicional) {
              try {
                adicional = typeof primeraCarga.adicional === 'string'
                  ? JSON.parse(primeraCarga.adicional)
                  : primeraCarga.adicional;
              } catch (e) {}
            }

            const modStr = (adicional?.regimen_dedicacion || doc.modalidad || primeraCarga?.modalidad || '').toString().toUpperCase();
            let horasModalidad = 40;
            const match = modStr.match(/(\d+)\s*H/i);
            if (match) {
              horasModalidad = parseInt(match[1], 10);
            } else if (modStr.includes('DE') || modStr.includes('DEDICACION EXCLUSIVA') || modStr.includes('TC') || modStr.includes('TIEMPO COMPLETO')) {
              horasModalidad = 40;
            } else if (modStr.includes('TP') || modStr.includes('TIEMPO PARCIAL')) {
              horasModalidad = 20;
            } else if (doc.horas_max_semana && doc.horas_max_semana > 0) {
              horasModalidad = doc.horas_max_semana;
            }

            let chl = 0;
            chList.forEach((ch: any) => {
              if (ch.cursos && Array.isArray(ch.cursos)) {
                ch.cursos.forEach((c: any) => {
                  const hrsTeo = c.hrs_teo || 0;
                  const gTeo = c.teoria_grupos ?? 1;
                  const hrsPra = c.hrs_pra || 0;
                  const gPra = c.practica_grupos ?? 1;
                  const hrsLab = c.hrs_lab || 0;
                  const gLab = c.laboratorio_grupos ?? 1;
                  chl += (hrsTeo * gTeo) + (hrsPra * gPra) + (hrsLab * gLab);
                });
              }
            });

            if (chl === 0) {
              const docAsig = normalized.filter((a: any) => a.docente_id === doc.id);
              chl = docAsig.length;
            }

            let chnl = 0;
            const secKeys = ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'];
            chList.forEach((ch: any) => {
              for (const key of secKeys) {
                const secVal = ch[key];
                if (secVal) {
                  if (typeof secVal === 'object' && secVal !== null && 'horas' in secVal) {
                    chnl += parseFloat(secVal.horas || '0');
                  } else if (Array.isArray(secVal)) {
                    secVal.forEach((item: any) => {
                      if (item && item.horas) chnl += parseFloat(item.horas || '0');
                    });
                  }
                }
              }
            });

            let chla = 0;
            if (adicional) {
              if (adicional.total_horas_adicional) {
                const val = parseFloat(adicional.total_horas_adicional || '0');
                if (val > 0) chla = val;
              } else if (Array.isArray(adicional.cursos)) {
                chla = adicional.cursos.reduce((sum: number, c: any) => sum + parseFloat(c.total_horas || '0'), 0);
              }
            }

            const horasColocadas = chl + chnl;
            const porcentajeCarga = horasModalidad > 0 ? Math.round((horasColocadas * 100) / horasModalidad) : 0;

            const nombreFmt = doc.apellidos ? `${doc.apellidos}, ${doc.nombre}` : (doc.nombre || 'Docente');

            return {
              id: doc.id,
              nombre: nombreFmt,
              categoria: doc.categoria || 'auxiliar',
              condicion: doc.condicion || 'contratado',
              modalidad: modStr || (doc.condicion === 'nombrado' ? 'TC' : 'TP'),
              chl,
              chnl,
              chla,
              horas_colocadas: horasColocadas,
              horas_asignadas: horasColocadas,
              horas_max_semana: horasModalidad,
              horas_modalidad: horasModalidad,
              porcentaje_carga: porcentajeCarga,
            };
          }).sort((a: any, b: any) => (b.porcentaje_carga || 0) - (a.porcentaje_carga || 0));

          finalDash = {
            ...d,
            cargaDocentes,
          };
        }

        setDashData(finalDash);
      }

      // Build ficha data
      const slotByTime = new Map(slots.map(s => [s.hora_inicio?.substring(0,5), s.id]));
      const fichaDocentes: any[] = [];
      const fichaAsignaciones: any[] = [];
      const uniqueDocMap = new Map<string, { rows: any[] }>();
      normalized.forEach((a: any) => {
        const docenteKey = a.docente_nombre || 'Sin docente';
        if (!uniqueDocMap.has(docenteKey)) uniqueDocMap.set(docenteKey, { rows: [] });
        uniqueDocMap.get(docenteKey)!.rows.push(a);
      });
      let docIdx = 0;
      uniqueDocMap.forEach((entry, nombre) => {
        docIdx++;
        const rows = entry.rows;
        const t = rows.filter((r: any) => (r.tipo||'').toLowerCase() === 'teoria').length;
        const p = rows.filter((r: any) => (r.tipo||'').toLowerCase() === 'practica').length;
        const l = rows.filter((r: any) => (r.tipo||'').toLowerCase() === 'laboratorio').length;
        const cursoNombres = [...new Set(rows.map((r: any) => r.curso_nombre))].join(', ');
        const cursoCodigos = [...new Set(rows.map((r: any) => r.curso_codigo).filter(Boolean))].join(', ');
        fichaDocentes.push({ numero: docIdx, profesor: nombre, asignatura: cursoNombres, t, p, l, g: 0, total: t + p + l, departamento: '', curso_codigo: cursoCodigos });
      });
      normalized.forEach((a: any) => {
        const timeKey = a.hora_inicio?.substring(0,5);
        fichaAsignaciones.push({
          id: a.id || Math.random().toString(36).slice(2),
          curso_codigo: a.curso_codigo || '', curso_nombre: a.curso_nombre || '',
          numero_grupo: a.numero_grupo ?? a.grupo ?? 1, tipo: a.tipo || 'teoria',
          ambiente_codigo: a.ambiente_codigo || a.aula || '', ambiente_nombre: a.ambiente_nombre || '',
          ambiente_tipo: a.ambiente_tipo || '', docente_nombre: a.docente_nombre || '',
          dia: a.dia || 'lunes', slot_id: slotByTime.get(timeKey) || '',
          hora_inicio: a.hora_inicio || '07:00', hora_fin: a.hora_fin || '08:00',
        });
      });
      const cicloSeleccionado = ciclos.find(c => c.id === cicloId);
      setFichaData({ docentes: fichaDocentes, asignaciones: fichaAsignaciones, slots: slots.map(s => ({ id: s.id, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin })), ciclo: cicloSeleccionado?.nombre || '', año: String(cicloSeleccionado?.año || '2025'), semestre: cicloSeleccionado?.semestre || 'I', });
    } finally { setLoading(false); setHasSearched(true); }
  }

  async function exportarPDF() {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const { generarMapaColores, obtenerColorCurso } = await import('@/lib/colores-curso');
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const ciclo = ciclos.find(c=>c.id===cicloId);
    const nombreCiclo = ciclo?.nombre || '';

    function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }

    interface BloqueAgrupado {
      curso_codigo: string; curso_nombre: string; grupo: string; aula: string;
      docente_nombre: string; docente_id?: any; tipo_sesion: string;
      dia: string; hora_inicio: string; hora_fin: string; duracion_horas: number; ciclo: number;
    }

    const getGrupoString = (asig: any): string => {
      if (typeof asig.grupo === 'string' && asig.grupo.startsWith('G')) return asig.grupo;
      const numGrupo = asig.numero_grupo || asig.grupo;
      return numGrupo ? `G${numGrupo}` : '';
    };

    function agruparBloquesContiguos(asigList: any[]): BloqueAgrupado[] {
      const normalizeDay = (d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const ordenDias = (dia: string): number => {
        const orden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        return orden.indexOf(normalizeDay(dia));
      };
      const calcularDuracion = (inicio: string, fin: string) => {
        if (!inicio || !fin) return 1;
        const hIni = parseInt(inicio.split(':')[0], 10);
        const hFin = parseInt(fin.split(':')[0], 10);
        return Math.max(1, hFin - hIni);
      };
      const ordenadas = [...asigList].sort((a, b) => {
        if (normalizeDay(a.dia) !== normalizeDay(b.dia)) return ordenDias(a.dia) - ordenDias(b.dia);
        return a.hora_inicio.localeCompare(b.hora_inicio);
      });
      const bloques: BloqueAgrupado[] = [];
      let bloqueActual: BloqueAgrupado | null = null;
      for (const asig of ordenadas) {
        const currentCycle = asig.ciclo_plan || asig.ciclo || 0;
        const grupoStr = getGrupoString(asig);
        const aulaStr = asig.ambiente_codigo || asig.aula || asig.ambiente_nombre || '';
        const isContinuation = bloqueActual && 
          normalizeDay(bloqueActual.dia) === normalizeDay(asig.dia) &&
          bloqueActual.curso_codigo === asig.curso_codigo &&
          bloqueActual.grupo === grupoStr &&
          bloqueActual.aula === aulaStr &&
          (String(bloqueActual.docente_id) === String(asig.docente_id) || bloqueActual.docente_nombre === asig.docente_nombre) &&
          bloqueActual.tipo_sesion === asig.tipo &&
          bloqueActual.hora_fin === asig.hora_inicio;
        if (isContinuation && bloqueActual) {
          bloqueActual.hora_fin = asig.hora_fin;
          bloqueActual.duracion_horas = calcularDuracion(bloqueActual.hora_inicio, asig.hora_fin);
        } else {
          if (bloqueActual) bloques.push(bloqueActual);
          bloqueActual = {
            curso_codigo: asig.curso_codigo || '', curso_nombre: asig.curso_nombre || '',
            grupo: grupoStr, aula: aulaStr, docente_nombre: asig.docente_nombre || '',
            docente_id: asig.docente_id, tipo_sesion: asig.tipo || '',
            dia: asig.dia, hora_inicio: asig.hora_inicio, hora_fin: asig.hora_fin,
            duracion_horas: calcularDuracion(asig.hora_inicio, asig.hora_fin), ciclo: currentCycle,
          };
        }
      }
      if (bloqueActual) bloques.push(bloqueActual);
      return bloques;
    }

    function construirFilasHorarioPdf(bloquesAgrupados: BloqueAgrupado[], slotsOrdenados: any[], diasSem: string[], tipoReporteHorario: string, mapaColores: any) {
      const formatearBloque = (bloque: BloqueAgrupado, mostrarDuracion = false) => {
        const tipoEtiqueta = bloque.tipo_sesion === 'asesoria' ? 'C' : bloque.tipo_sesion[0].toUpperCase();
        const detalle = tipoReporteHorario === 'docente' ? `Aula: ${bloque.aula}` : `Docente: ${bloque.docente_nombre}`;
        const duracion = mostrarDuracion ? `\nDuración: ${bloque.duracion_horas}h` : '';
        return [`${bloque.curso_nombre}`, `Código ${bloque.curso_codigo}  ·  Grupo ${bloque.grupo}`, `${detalle}  ·  Tipo ${tipoEtiqueta}`, `Horario ${bloque.hora_inicio.substring(0, 5)} - ${bloque.hora_fin.substring(0, 5)}${duracion}`,].join('\n');
      };
      const normalizeDay = (d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const llaveInicio = (dia: string, horaInicio: string) => `${normalizeDay(dia)}|${horaInicio}`;
      const bloquesPorInicio = new Map<string, BloqueAgrupado[]>();
      bloquesAgrupados.forEach((bloque) => {
        const key = llaveInicio(bloque.dia, bloque.hora_inicio);
        const lista = bloquesPorInicio.get(key) || [];
        lista.push(bloque);
        bloquesPorInicio.set(key, lista);
      });
      const spansPendientes = new Map<number, number>();
      return slotsOrdenados.map((slot) => {
        const horaIni = slot.hora_inicio.substring(0, 5);
        const horaFin = slot.hora_fin.substring(0, 5);
        const fila: any[] = [`${horaIni}\n${horaFin}`];
        const esRefrigerio = loadedRestringidos && (slot.id in restringidos);
        const msgRefrigerio = restringidos[slot.id] || 'HORA LIBRE (REFRIGERIO)';
        diasSem.forEach((dia, diaIdx) => {
          const spanRestante = spansPendientes.get(diaIdx) || 0;
          if (spanRestante > 0) { spansPendientes.set(diaIdx, spanRestante - 1); return; }
          const key = llaveInicio(dia, slot.hora_inicio);
          const bloquesEnInicio = bloquesPorInicio.get(key) || [];
          if (esRefrigerio && bloquesEnInicio.length === 0) { fila.push(msgRefrigerio); return; }
          if (bloquesEnInicio.length === 0) { fila.push(''); return; }
          if (bloquesEnInicio.length === 1 && bloquesEnInicio[0].duracion_horas > 1) {
            const bloque = bloquesEnInicio[0];
            spansPendientes.set(diaIdx, bloque.duracion_horas - 1);
            const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
            const rgb = hexToRgb(color.bg); const borderRgb = hexToRgb(color.border);
            fila.push({ content: formatearBloque(bloque, true), rowSpan: bloque.duracion_horas, styles: { fillColor: bloque.tipo_sesion === 'asesoria' ? [243,244,246] : rgb ? [rgb.r,rgb.g,rgb.b] : [255,255,255], textColor: [51,65,85], lineColor: bloque.tipo_sesion === 'asesoria' ? [107,114,128] : borderRgb ? [borderRgb.r,borderRgb.g,borderRgb.b] : [203,213,225], lineWidth: { top: 0.45, right: 0.45, bottom: 0.45, left: 1.1 }, valign: 'middle', halign: 'left' } });
            return;
          }
          if (bloquesEnInicio.length > 1) {
            fila.push({ content: bloquesEnInicio.map(b => formatearBloque(b, false)).join('\n\n• • • • • • • • • •\n\n'), styles: { fillColor: [248,250,252], textColor: [51,65,85], lineColor: [203,213,225], lineWidth: { top: 0.45, right: 0.45, bottom: 0.45, left: 1.1 }, valign: 'middle', halign: 'left' } });
            return;
          }
          const bloque = bloquesEnInicio[0];
          const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
          const rgb = hexToRgb(color.bg); const borderRgb = hexToRgb(color.border);
          fila.push({ content: formatearBloque(bloque, false), styles: { fillColor: bloque.tipo_sesion === 'asesoria' ? [243,244,246] : rgb ? [rgb.r,rgb.g,rgb.b] : [255,255,255], textColor: [51,65,85], lineColor: bloque.tipo_sesion === 'asesoria' ? [107,114,128] : borderRgb ? [borderRgb.r,borderRgb.g,borderRgb.b] : [203,213,225], lineWidth: { top: 0.45, right: 0.45, bottom: 0.45, left: 1.1 }, valign: 'middle', halign: 'left' } });
        });
        return fila;
      });
    }

    let y = 62;
    if (tipoReporte === 'gestion') {
      doc.setFontSize(16); doc.setTextColor(30, 41, 59); doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 148.5, 20, { align: 'center' });
      doc.setFontSize(12); doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 148.5, 28, { align: 'center' });
      doc.setDrawColor(226, 232, 240); doc.line(14, 35, 283, 35);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text(`REPORTE DE GESTIÓN — ${ciclo?.nombre||''}`, 14, 45);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59); doc.text('RESUMEN EJECUTIVO', 14, y); y += 6;
      doc.setFontSize(9); doc.setFont('helvetica','normal');
      const stats = [['Docentes programados', `${dashData?.stats?.totalDocentes} de ${dashData?.stats?.globalDocentes||0} (${Math.round((dashData?.stats?.totalDocentes / (dashData?.stats?.globalDocentes||1))*100)}%)`], ['Cursos programados', `${dashData?.stats?.totalCursos} de ${dashData?.stats?.globalCursos||0} (${Math.round((dashData?.stats?.totalCursos / (dashData?.stats?.globalCursos||1))*100)}%)`], ['Ambientes usados', `${dashData?.stats?.totalAmbientes} de ${dashData?.stats?.globalAmbientes||0} (${Math.round((dashData?.stats?.totalAmbientes / (dashData?.stats?.globalAmbientes||1))*100)}%)`], ['Total asignaciones', `${dashData?.stats?.totalAsignaciones}`]];
      autoTable(doc, { startY: y, head:[['Indicador','Valor']], body: stats, theme:'striped', headStyles:{fillColor:[30,41,59], textColor:[255,255,255], fontStyle:'bold'}, bodyStyles:{textColor:[51,65,85]}, margin:{left:14,right:14}, tableWidth: 100 });
      y = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59); doc.text('CARGA HORARIA POR DOCENTE', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Docente','Categoría','Condición','CHL','CHNL','CHLA','Horas Colocadas','Horas Mod.','% Carga']],
        body: dashData?.cargaDocentes?.map((d:any)=>[
          d.nombre,
          (d.categoria || '').replace('_',' ').toUpperCase(),
          (d.condicion || '').toUpperCase(),
          d.chl > 0 ? `${d.chl}h` : '—',
          d.chnl > 0 ? `${d.chnl}h` : '—',
          d.chla > 0 ? `${d.chla}h` : '—',
          `${d.horas_colocadas ?? d.horas_asignadas ?? 0}h`,
          `${d.horas_modalidad ?? d.horas_max_semana ?? 40}h`,
          `${d.porcentaje_carga||0}%`
        ])||[],
        theme:'striped',
        headStyles:{fillColor:[30,41,59], textColor:[255,255,255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51,65,85], fontSize:8},
        columnStyles: { 3:{halign:'center'}, 4:{halign:'center'}, 5:{halign:'center'}, 6:{halign:'center'}, 7:{halign:'center'}, 8:{halign:'center'} },
        margin:{left:14,right:14}
      });
      y = (doc as any).lastAutoTable.finalY + 12;
      if (y > 150) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59); doc.text('OCUPACIÓN DE AMBIENTES', 14, y); y += 6;
      autoTable(doc, { startY: y, head:[['Ambiente','Tipo','Horas Usadas','% Ocupación']], body: dashData?.ocupacionAmbientes?.map((a:any)=>[a.nombre, a.tipo.toUpperCase(), `${a.horas_usadas}h`, `${a.porcentaje}%`])||[], theme:'striped', headStyles:{fillColor:[30,41,59], textColor:[255,255,255], fontStyle:'bold', halign:'center'}, bodyStyles:{textColor:[51,65,85], fontSize:8}, columnStyles: { 2:{halign:'center'}, 3:{halign:'center'} }, margin:{left:14,right:14} });
      
      const pageCountGestion = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCountGestion; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
        doc.text(`SiHorarios UNT — Universidad Nacional de Trujillo`, 14, doc.internal.pageSize.getHeight() - 8);
        doc.text(`Página ${i} de ${pageCountGestion}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
      }
    } else {
      const docGrp: Record<string,any[]> = {};
      if (tipoReporte === 'docente' && docenteId) {
        const docente = docentes.find(d => String(d.id) === String(docenteId));
        const apellidos = docente?.apellidos?.toLowerCase() || '';
        const docAsig = asignaciones.filter(a => (a.docente_id && String(a.docente_id) === String(docenteId)) || (a.docente_nombre && apellidos && a.docente_nombre.toLowerCase().includes(apellidos)));
        const key = docente ? `${docente.nombre} ${docente.apellidos}` : (docAsig[0]?.docente_nombre || 'Docente');
        docGrp[key] = docAsig;
      } else {
        asignaciones.forEach(a => {
          if (a.tipo === 'asesoria') return;
          const k = tipoReporte==='docente' ? a.docente_nombre : a.ambiente_nombre;
          if (!docGrp[k]) docGrp[k] = [];
          docGrp[k].push(a);
        });
      }
      const items = Object.entries(docGrp);
      items.forEach(([tituloGrp, grpAsignaciones], idxPage) => {
        if (idxPage > 0) doc.addPage();
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59); doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 14, 15);
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(71, 85, 105); doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 14, 20);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(15, 23, 42);
        const subTitle = tipoReporte === 'docente' ? `HORARIO SEMANAL DEL DOCENTE: ${tituloGrp.toUpperCase()}` : `HORARIO SEMANAL DEL AMBIENTE: ${tituloGrp.toUpperCase()}`;
        doc.text(`${subTitle} — ${nombreCiclo}`, 14, 26);
        doc.setDrawColor(226, 232, 240); doc.line(14, 29, 283, 29);
        const bloquesAgrupados = agruparBloquesContiguos(grpAsignaciones);
        const mapaColores = generarMapaColores(grpAsignaciones);
        const docentesUnicos = Array.from(new Map(grpAsignaciones.filter((a: any) => a.docente_nombre).map((a: any) => [a.docente_nombre, a])).values());
        const cursosUnicos = Array.from(new Map(grpAsignaciones.filter((a: any) => a.curso_codigo).map((a: any) => [a.curso_codigo, a])).values());
        const totalHoras = bloquesAgrupados.reduce((acc, bloque) => acc + bloque.duracion_horas, 0);
        const resumirLista = (items: any[], selector: (item: any) => string) => items.map(selector).filter(Boolean).join('  ·  ');
        const footerDocentes = resumirLista(docentesUnicos, (d) => d.docente_nombre || 'Sin docente');
        const footerCursos = resumirLista(cursosUnicos, (c) => `${c.curso_codigo}${c.curso_nombre ? ` ${c.curso_nombre}` : ''}`);
        const diasSem = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const headersTable = ['Hora', ...diasSem];
        const uniqueSlotsMap = new Map();
        [...slots].sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio)).forEach(slot => { if (!uniqueSlotsMap.has(slot.hora_inicio)) uniqueSlotsMap.set(slot.hora_inicio, slot); });
        let sortedSlots = Array.from(uniqueSlotsMap.values());
        let maxSlotIndex = 0;
        bloquesAgrupados.forEach(b => {
          const idx = sortedSlots.findIndex(s => s.hora_inicio === b.hora_inicio);
          if (idx !== -1) { const endIdx = idx + b.duracion_horas - 1; if (endIdx > maxSlotIndex) maxSlotIndex = endIdx; }
        });
        const cutOffIndex = Math.max(10, maxSlotIndex);
        if (cutOffIndex < sortedSlots.length - 1) sortedSlots = sortedSlots.slice(0, cutOffIndex + 1);
        const rowsTable = construirFilasHorarioPdf(bloquesAgrupados, sortedSlots, diasSem, tipoReporte, mapaColores);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const sectionWidth = (pageWidth - 24) / 3;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4);
        const docLines = doc.splitTextToSize(footerDocentes || 'Sin asignar', sectionWidth - 8);
        const curLines = doc.splitTextToSize(footerCursos || 'Sin asignar', sectionWidth - 8);
        const blkLines = doc.splitTextToSize(`Totales: ${bloquesAgrupados.length}  ·  Horas: ${totalHoras}  ·  SiHorarios UNT`, sectionWidth - 8);
        const maxFooterLines = Math.max(docLines.length, curLines.length, blkLines.length);
        const footerBoxHeight = Math.max(14, maxFooterLines * 2.2 + 6);
        const marginBottom = footerBoxHeight + 6;
        autoTable(doc, {
          head: [headersTable], body: rowsTable, startY: 33, theme: 'grid', pageBreak: 'avoid', rowPageBreak: 'avoid', tableWidth: 'auto',
          margin: { top: 8, bottom: marginBottom, left: 10, right: 10 },
          styles: { fontSize: 5.95, cellPadding: { top: 1.05, right: 1.15, bottom: 1.05, left: 1.35 }, overflow: 'linebreak', valign: 'middle', halign: 'left', textColor: [51, 65, 85] },
          headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.2 },
          columnStyles: { 0: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
          didDrawPage: () => {
            const footerTop = pageHeight - footerBoxHeight - 4;
            const drawFooterBox = (x: number, title: string, lines: string[], accent: [number, number, number]) => {
              doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
              doc.roundedRect(x, footerTop, sectionWidth, footerBoxHeight, 1.5, 1.5, 'FD');
              doc.setFillColor(accent[0], accent[1], accent[2]);
              doc.roundedRect(x + 1, footerTop + 1, 2.2, footerBoxHeight - 2, 0.6, 0.6, 'F');
              doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2); doc.setTextColor(30, 41, 59);
              doc.text(title, x + 5, footerTop + 3.5);
              doc.setFont('helvetica', 'normal'); doc.setFontSize(5.4); doc.setTextColor(71, 85, 105);
              doc.text(lines, x + 5, footerTop + 6.5);
            };
            drawFooterBox(10, 'Docentes', docLines, [59, 130, 246]);
            drawFooterBox(10 + sectionWidth + 7, 'Cursos', curLines, [16, 185, 129]);
            drawFooterBox(10 + (sectionWidth + 7) * 2, 'Bloques', blkLines, [249, 115, 22]);
          },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const rawCell = data.cell.raw;
              const textContent = typeof rawCell === 'string' ? rawCell : rawCell && typeof rawCell === 'object' && 'content' in rawCell ? String(rawCell.content ?? '') : '';
              const isRestringidoMsg = Object.values(restringidos).includes(textContent);
              if (isRestringidoMsg || textContent === 'HORA LIBRE (REFRIGERIO)') {
                data.cell.styles.fillColor = [241, 245, 249]; data.cell.styles.textColor = [100, 116, 139]; data.cell.styles.fontStyle = 'italic'; data.cell.styles.halign = 'center'; return;
              }
              if (data.column.index === 0) return;
              const slot = sortedSlots[data.row.index];
              if (!slot) return;
              const dia = diasSem[data.column.index - 1];
              const normalizeDay = (d: string) => d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const bloquesEnInicio = bloquesAgrupados.filter(b => normalizeDay(b.dia) === normalizeDay(dia) && b.hora_inicio === slot.hora_inicio);
              if (bloquesEnInicio.length === 0) return;
              if (bloquesEnInicio.length === 1 && bloquesEnInicio[0].duracion_horas > 1) return;
              if (bloquesEnInicio.length > 1) { data.cell.styles.fillColor = [249, 250, 251]; data.cell.styles.lineColor = [229, 231, 235]; data.cell.styles.lineWidth = 0.5; return; }
              const bloque = bloquesEnInicio[0];
              if (bloque.tipo_sesion === 'asesoria') { data.cell.styles.fillColor = [229, 231, 235]; data.cell.styles.lineColor = [107, 114, 128]; data.cell.styles.lineWidth = 0.4; return; }
              const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
              const rgb = hexToRgb(color.bg);
              if (rgb) data.cell.styles.fillColor = [rgb.r, rgb.g, rgb.b];
              const borderRgb = hexToRgb(color.border);
              if (borderRgb) { data.cell.styles.lineColor = [borderRgb.r, borderRgb.g, borderRgb.b]; data.cell.styles.lineWidth = 0.5; }
            }
          }
        });
      });
    }
    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    doc.save(`${nombre}-${ciclo?.nombre||'unt'}.pdf`);
  }

  async function exportarExcelUNT() {
    if (!cicloId) { alert('Por favor seleccione un ciclo'); return; }
    if (!exportableProgId) { alert('El formato UNT solo se habilita cuando la programacion esta en Fase 4.'); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/horarios/programaciones/${exportableProgId}/exportar-unt`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Error al obtener datos de exportación oficial UNT');
      const resData = await response.json();
      const { exportarHorariosFormatoUNT } = await import('@/lib/exportar/excel-horarios-unt');
      await exportarHorariosFormatoUNT(resData);
    } catch (err: any) { alert(err.message || 'Error al exportar a Formato Oficial UNT'); console.error(err);
    } finally { setLoading(false); }
  }

  async function exportarCSV() {
    const { utils, writeFile } = await import('xlsx');
    const ciclo = ciclos.find(c=>c.id===cicloId);
    let wb = utils.book_new();
    if (tipoReporte === 'gestion') {
      const headers = ['Docente', 'Categoría', 'Condición', 'CHL', 'CHNL', 'CHLA', 'Horas Colocadas (CHL+CHNL)', 'Horas Modalidad', '% Carga'];
      const bodyRows = (dashData?.cargaDocentes || []).map((d: any) => [
        d.nombre,
        (d.categoria || '').replace('_', ' ').toUpperCase(),
        (d.condicion || '').toUpperCase(),
        d.chl || 0,
        d.chnl || 0,
        d.chla || 0,
        d.horas_colocadas ?? d.horas_asignadas ?? 0,
        d.horas_modalidad ?? d.horas_max_semana ?? 40,
        `${d.porcentaje_carga || 0}%`
      ]);
      utils.book_append_sheet(wb, utils.aoa_to_sheet([headers, ...bodyRows]), 'Carga Docentes');
    } else {
      const rows = asignaciones.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(r=>[DIAS_L[r.dia]||r.dia, r.hora_inicio, r.hora_fin, r.curso_nombre, tipoReporte==='docente' ? r.ambiente_nombre : r.docente_nombre, r.tipo, `G${r.numero_grupo}`]);
      utils.book_append_sheet(wb, utils.aoa_to_sheet([['Día','Hora Inicio','Hora Fin','Curso','Ambiente/Docente','Tipo','Grupo'], ...rows]), 'Horarios');
    }
    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    writeFile(wb, `${nombre}-${ciclo?.nombre||'unt'}.csv`, { bookType: 'csv' });
  }

  const docenteSelec = docentes.find(d=>d.id===docenteId);

  // Data processing for preview
  const porDocente: Record<string,any[]> = {};
  const porAmbiente: Record<string,any[]> = {};

  if (tipoReporte === 'docente' && docenteSelec) {
    porDocente[`${docenteSelec.nombre} ${docenteSelec.apellidos}`] = [];
  }
  if (tipoReporte === 'operacional' && ambienteId) {
    const amb = ambientes.find(a=>a.id===ambienteId);
    if (amb) porAmbiente[amb.nombre] = [];
  }

  asignaciones.forEach(a => {
    if (!porDocente[a.docente_nombre]) porDocente[a.docente_nombre] = [];
    porDocente[a.docente_nombre].push(a);
    if (!porAmbiente[a.ambiente_nombre]) porAmbiente[a.ambiente_nombre] = [];
    porAmbiente[a.ambiente_nombre].push(a);
  });

  const aplicarFiltros = (items: any[]) => {
    return items.filter(item => {
      const matchDia = !filtroDia || item.dia === filtroDia;
      const matchTipo = !filtroTipoSesion || item.tipo === filtroTipoSesion;
      const matchCurso = !filtroCurso ||
        item.curso_codigo?.toLowerCase().includes(filtroCurso.toLowerCase()) ||
        item.curso_nombre?.toLowerCase().includes(filtroCurso.toLowerCase());
      return matchDia && matchTipo && matchCurso;
    });
  };

  const ordenarItems = (entries: [string, any[]][]) => {
    return entries.sort(([a, itemsA], [b, itemsB]) => {
      const horasA = itemsA.length; const horasB = itemsB.length;
      const cursosA = new Set(itemsA.map(i => i.curso_nombre)).size;
      const cursosB = new Set(itemsB.map(i => i.curso_nombre)).size;
      let comparison = 0;
      if (sortBy === 'nombre') comparison = a.localeCompare(b);
      else if (sortBy === 'horas') comparison = horasA - horasB;
      else if (sortBy === 'cursos') comparison = cursosA - cursosB;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const porDocenteFiltrado: Record<string, any[]> = {};
  const porAmbienteFiltrado: Record<string, any[]> = {};
  Object.entries(porDocente).forEach(([key, items]) => { porDocenteFiltrado[key] = aplicarFiltros(items); });
  Object.entries(porAmbiente).forEach(([key, items]) => { porAmbienteFiltrado[key] = aplicarFiltros(items); });

  const docentesOrdenados = ordenarItems(Object.entries(porDocenteFiltrado));
  const ambientesOrdenados = ordenarItems(Object.entries(porAmbienteFiltrado));

  const activeFilters = [
    { label: 'Día', value: filtroDia, onRemove: () => setFiltroDia('') },
    { label: 'Tipo', value: filtroTipoSesion, onRemove: () => setFiltroTipoSesion('') },
    { label: 'Curso', value: filtroCurso, onRemove: () => setFiltroCurso('') },
  ];

  const totalPages = Math.ceil(docentesOrdenados.length / pageSize);
  const paginatedDocentes = docentesOrdenados.slice((page - 1) * pageSize, page * pageSize);

  const searchDocentes = useCallback(async (q: string) => {
    const res = await fetch(`/api/docentes?search=${encodeURIComponent(q)}&limit=20`);
    const data = await res.json();
    const items = data.data || [];
    setDocenteSearchResults(items);
    return items.map((d: any) => ({
      value: d.id,
      label: `${d.nombre} ${d.apellidos}`.trim(),
      subtitle: `${d.codigo || '—'} · ${d.departamento || '—'}`,
      detail: d.categoria ? `${d.categoria.replace('_', ' ')} · ${d.condicion || ''}` : '',
    }));
  }, []);

  const searchAmbientes = useCallback(async (q: string) => {
    const res = await fetch(`/api/aulas?search=${encodeURIComponent(q)}&limit=20`);
    const data = await res.json();
    const items = data.data || [];
    setAmbienteSearchResults(items);
    return items.map((a: any) => ({
      value: a.id,
      label: `${a.codigo} — ${a.nombre}`,
      subtitle: `${a.tipo || 'Aula'} · ${a.pabellon || '—'} · Capacidad: ${a.capacidad || '—'}`,
      detail: a.equipamiento?.length > 0 ? `Equipamiento: ${a.equipamiento.join(', ')}` : '',
    }));
  }, []);

  const handleClearFilters = () => {
    setFiltroDia(''); setFiltroTipoSesion(''); setFiltroCurso(''); setSortBy('nombre'); setSortOrder('asc');
  };

  const handleExportClick = (format: 'pdf' | 'excel' | 'csv') => {
    setShowExportMenu(false);
    if (format === 'pdf') exportarPDF();
    else if (format === 'excel') exportarExcelUNT();
    else exportarCSV();
  };

  const cicloActual = ciclos.find(c => c.id === cicloId);

  // ── Render ──
  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px 32px', background: AZUL.fondo, minHeight: '100vh' }}>
      <style>{`
        @media (max-width: 768px) { body > div { padding: 16px !important; } }
        @keyframes sk-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>

      {/* ═══════════════ SECTION 1: HEADER ═══════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
        marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: AZUL.principal, margin: 0, lineHeight: 1.2 }}>
            Reportes
          </h1>
          <p style={{ fontSize: '14px', color: AZUL.textSec, margin: '4px 0 0' }}>
            Genera, filtra y exporta reportes académicos oficiales
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasSearched && (
            <div ref={exportBtnRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{
                  ...SX.btnPrimary, background: AZUL.principal,
                }}
                aria-haspopup="true" aria-expanded={showExportMenu}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar reporte
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transition: 'transform 0.2s', transform: showExportMenu ? 'rotate(180deg)' : '' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showExportMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                  background: '#fff', border: '1px solid #DCE3EC', borderRadius: '8px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50,
                  minWidth: '220px', overflow: 'hidden',
                }}>
                  <button type="button" onClick={() => handleExportClick('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: AZUL.text, textAlign: 'left', borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontSize: '18px' }}>📄</span>
                    <div><div style={{ fontWeight: 500 }}>PDF institucional</div><div style={{ fontSize: '12px', color: AZUL.textSec }}>Listo para impresión</div></div>
                  </button>
                  <button type="button" onClick={() => handleExportClick('excel')} disabled={!exportableProgId} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: exportableProgId ? 'pointer' : 'default', fontSize: '14px', color: exportableProgId ? AZUL.text : '#CBD5E1', textAlign: 'left', borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (exportableProgId) e.currentTarget.style.background = '#F8FAFC'; }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                    <span style={{ fontSize: '18px' }}>📊</span>
                    <div><div style={{ fontWeight: 500 }}>Excel Formato UNT</div><div style={{ fontSize: '12px', color: exportableProgId ? AZUL.textSec : '#CBD5E1' }}>{exportableProgId ? 'Formato oficial' : 'Requiere Fase 4'}</div></div>
                  </button>
                  <button type="button" onClick={() => handleExportClick('csv')} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: AZUL.text, textAlign: 'left', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontSize: '18px' }}>📦</span>
                    <div><div style={{ fontWeight: 500 }}>CSV de respaldo</div><div style={{ fontSize: '12px', color: AZUL.textSec }}>Datos planos</div></div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ SECTION 2: CONFIG ═══════════════ */}
      <div style={{ ...SX.card, padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: AZUL.text, margin: 0 }}>
            Configuración del reporte
          </h2>
          <div style={{ fontSize: '12px', color: AZUL.textSec }}>Define el alcance y genera la vista previa</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: AZUL.text, marginBottom: '6px' }}>
              Tipo de reporte
            </label>
            <select
              value={tipoReporte}
              onChange={e => { setTipoReporte(e.target.value as any); setHasSearched(false); setSelectedTeacher(null); setPage(1); }}
              style={SX.select}
              aria-label="Tipo de reporte"
            >
              <option value="docente">👤 Horario por Docente</option>
              <option value="operacional">📋 Operacional (Aulas y Docentes)</option>
              <option value="gestion">📊 Gestión (Resumen Ejecutivo)</option>
              <option value="ficha">🏛️ Ficha Profesional (Cuadrícula)</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: AZUL.text, marginBottom: '6px' }}>
              Ciclo académico
            </label>
            <select
              value={cicloId}
              onChange={e => { setCicloId(e.target.value); setHasSearched(false); setSelectedTeacher(null); }}
              style={SX.select}
              aria-label="Ciclo académico"
            >
              {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.activo ? ' (Activo)' : ''}</option>)}
            </select>
          </div>

          {/* Dynamic filter based on report type */}
          {tipoReporte === 'docente' && (
            <AsyncSearchCombobox
              label="Docente"
              placeholder="Buscar docente por nombre o código..."
              value={docenteId}
              onChange={val => { setDocenteId(val); setHasSearched(false); }}
              onSearch={searchDocentes}
              initialOptions={docentes.map(d => ({
                value: d.id,
                label: `${d.nombre} ${d.apellidos}`.trim(),
                subtitle: `${d.codigo || '—'} · ${d.departamento || '—'}`,
                detail: d.categoria ? `${d.categoria.replace('_', ' ')} · ${d.condicion || ''}` : '',
              }))}
            />
          )}

          {tipoReporte === 'operacional' && (
            <AsyncSearchCombobox
              label="Ambiente (opcional)"
              placeholder="Buscar aula, laboratorio o código..."
              value={ambienteId}
              onChange={val => { setAmbienteId(val); setHasSearched(false); }}
              onSearch={searchAmbientes}
              initialOptions={ambientes.map(a => ({
                value: a.id,
                label: `${a.codigo} — ${a.nombre}`,
                subtitle: `${a.tipo || 'Aula'} · ${a.pabellon || '—'} · Capacidad: ${a.capacidad || '—'}`,
              }))}
            />
          )}
        </div>

        <button
          type="button"
          onClick={generarReporte}
          disabled={loading}
          style={{
            ...SX.btnPrimary,
            opacity: loading ? 0.7 : 1,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? (
            <>
              <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spinner 0.6s linear infinite' }} />
              Generando...
            </>
          ) : (
            <>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              Generar vista previa
            </>
          )}
        </button>
      </div>

      {/* ═══════════════ SECTION 3: PREVIEW ═══════════════ */}
      {loading && <LoadingSkeleton type="preview" />}

      {hasSearched && !loading && tipoReporte === 'gestion' && dashData && (
        <div style={{ ...SX.card, overflow: 'hidden' }}>
          {/* Preview header */}
          <div style={{ background: AZUL.principal, color: '#fff', padding: '16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>Reporte de Gestión</h2>
                <p style={{ fontSize: '13px', margin: 0, opacity: 0.8 }}>Ciclo: {cicloActual?.nombre} · Generado: {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={exportarPDF} style={{ ...SX.btnSecondary, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '12px', padding: '0 12px', height: '34px' }}>
                  📄 PDF
                </button>
                <button type="button" onClick={exportarCSV} style={{ ...SX.btnSecondary, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '12px', padding: '0 12px', height: '34px' }}>
                  📦 CSV
                </button>
              </div>
            </div>
          </div>

          {/* Dashboard content */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '20px', borderBottom: '1px solid #DCE3EC' }}>
            {[
              { l: 'Docentes', v: dashData.stats?.totalDocentes, c: AZUL.principal },
              { l: 'Cursos', v: dashData.stats?.totalCursos, c: '#065f46' },
              { l: 'Ambientes', v: dashData.stats?.totalAmbientes, c: '#92400e' },
              { l: 'Asignaciones', v: dashData.stats?.totalAsignaciones, c: '#581c87' },
            ].map((k, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: k.c }}>{k.v ?? '—'}</div>
                <div style={{ fontSize: '13px', color: AZUL.textSec, marginTop: '2px' }}>{k.l}</div>
              </div>
            ))}
          </div>

          {/* Carga docente */}
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: AZUL.text, margin: '0 0 12px' }}>Carga Horaria por Docente</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #DCE3EC' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: AZUL.textSec }}>Docente</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>Categoría</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>Condición</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>CHL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>CHNL</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>CHLA</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>Horas Colocadas (CHL+CHNL)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>Horas Mod.</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.textSec }}>% Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashData.cargaDocentes || []).map((d: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px', color: AZUL.text, fontWeight: 500 }}>{d.nombre}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px' }}>
                        <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', color: AZUL.textSec }}>{(d.categoria || '').replace('_', ' ').toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: AZUL.textSec }}>{(d.condicion || '').toUpperCase()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: AZUL.text }}>{d.chl > 0 ? `${d.chl}h` : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: AZUL.text }}>{d.chnl > 0 ? `${d.chnl}h` : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: AZUL.text }}>{d.chla > 0 ? `${d.chla}h` : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: AZUL.text }}>
                        {d.horas_colocadas ?? d.horas_asignadas ?? 0}h
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: AZUL.textSec }}>
                        {d.horas_modalidad ?? d.horas_max_semana ?? 40}h
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                          background: (d.porcentaje_carga || 0) === 100 ? '#F0FDF4' : (d.porcentaje_carga || 0) > 100 ? '#EFF6FF' : '#FEF2F2',
                          color: (d.porcentaje_carga || 0) === 100 ? '#166534' : (d.porcentaje_carga || 0) > 100 ? '#1E40AF' : '#991B1B',
                        }}>{d.porcentaje_carga || 0}%</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {hasSearched && !loading && tipoReporte === 'ficha' && fichaData && (
        <div style={{ marginTop: 0 }}>
          <FichaHorarioProfesional
            universidad="UNIVERSIDAD NACIONAL DE TRUJILLO"
            facultad="FACULTAD DE INGENIERÍA"
            escuela="INGENIERÍA DE SISTEMAS"
            ciclo={fichaData.ciclo}
            seccion="A"
            año={fichaData.año}
            semestre={fichaData.semestre}
            docentes={fichaData.docentes}
            asignaciones={fichaData.asignaciones}
            slots={fichaData.slots}
            restringidos={restringidos}
          />
        </div>
      )}

      {hasSearched && !loading && (tipoReporte === 'docente' || tipoReporte === 'operacional') && (
        <div style={{ ...SX.card, overflow: 'hidden' }}>
          {/* ═══ Preview Header ═══ */}
          <div style={{ background: AZUL.principal, color: '#fff', padding: '16px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px' }}>
                  {tipoReporte === 'docente'
                    ? selectedTeacher ? `Horario: ${selectedTeacher}` : 'Horario por Docente'
                    : 'Reporte Operacional de Horarios'}
                </h2>
                <p style={{ fontSize: '13px', margin: 0, opacity: 0.8 }}>
                  Ciclo: {cicloActual?.nombre} · {docentesOrdenados.length} docente{docentesOrdenados.length !== 1 ? 's' : ''} encontrado{docentesOrdenados.length !== 1 ? 's' : ''} · Generado: {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={exportarPDF} style={{ ...SX.btnSecondary, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '12px', padding: '0 12px', height: '34px' }}>
                  📄 PDF
                </button>
                {exportableProgId && (
                  <button type="button" onClick={exportarExcelUNT} style={{ ...SX.btnSecondary, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '12px', padding: '0 12px', height: '34px' }}>
                    📊 Excel
                  </button>
                )}
                <button type="button" onClick={exportarCSV} style={{ ...SX.btnSecondary, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '12px', padding: '0 12px', height: '34px' }}>
                  📦 CSV
                </button>
              </div>
            </div>
          </div>

          {/* ═══ Filters Bar ═══ */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #DCE3EC', background: '#FAFBFC' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 200px', minWidth: '160px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: AZUL.textSec, marginBottom: '4px' }}>Buscar en resultados</label>
                <input
                  type="text"
                  value={filtroCurso}
                  onChange={e => { setFiltroCurso(e.target.value); setPage(1); }}
                  placeholder="Buscar docente, curso, aula o código..."
                  style={SX.input}
                  aria-label="Buscar en resultados"
                />
              </div>
              <div style={{ flex: '1 1 140px', minWidth: '120px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: AZUL.textSec, marginBottom: '4px' }}>Día</label>
                <select value={filtroDia} onChange={e => setFiltroDia(e.target.value)} style={SX.select} aria-label="Filtrar por día">
                  <option value="">Todos</option>
                  <option value="lunes">Lunes</option>
                  <option value="martes">Martes</option>
                  <option value="miercoles">Miércoles</option>
                  <option value="jueves">Jueves</option>
                  <option value="viernes">Viernes</option>
                  <option value="sabado">Sábado</option>
                </select>
              </div>
              <div style={{ flex: '1 1 140px', minWidth: '120px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: AZUL.textSec, marginBottom: '4px' }}>Tipo</label>
                <select value={filtroTipoSesion} onChange={e => setFiltroTipoSesion(e.target.value)} style={SX.select} aria-label="Filtrar por tipo">
                  <option value="">Todos</option>
                  <option value="teoria">Teoría</option>
                  <option value="practica">Práctica</option>
                  <option value="laboratorio">Laboratorio</option>
                </select>
              </div>
              <div style={{ flex: '1 1 140px', minWidth: '120px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: AZUL.textSec, marginBottom: '4px' }}>Orden</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ ...SX.select, flex: 1 }} aria-label="Ordenar por">
                    <option value="nombre">Nombre</option>
                    <option value="horas">Horas</option>
                    <option value="cursos">Cursos</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    aria-label={sortOrder === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
                    style={{
                      width: '42px', height: '42px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '8px', border: '1px solid #DCE3EC', background: '#fff',
                      color: AZUL.text, cursor: 'pointer', fontSize: '16px',
                    }}
                    title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
              <button type="button" onClick={handleClearFilters} style={{ ...SX.btnSecondary, height: '42px', alignSelf: 'flex-end', color: AZUL.textSec }}>
                Limpiar
              </button>
            </div>
            <ActiveFilterChips filters={activeFilters} />
          </div>

          {/* ═══ Results: Split pane for docente, cards for operacional ═══ */}
          {tipoReporte === 'docente' && (
            <div style={{ display: 'flex', minHeight: '500px' }}>
              {/* Left: Teacher List */}
              <div style={{
                width: '35%', minWidth: '280px', borderRight: '1px solid #DCE3EC',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #DCE3EC', background: '#FAFBFC' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: AZUL.text }}>
                    Docentes · {docentesOrdenados.length}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {paginatedDocentes.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: AZUL.textSec, fontSize: '14px' }}>
                      No se encontraron docentes con los filtros seleccionados
                    </div>
                  ) : (
                    paginatedDocentes.map(([nombre, rows]) => {
                      const cursosUnicos = Array.from(new Set(rows.map(r => r.curso_nombre)));
                      const totalHoras = rows.length;
                      const isSelected = selectedTeacher === nombre;
                      return (
                        <button
                          key={nombre}
                          type="button"
                          onClick={() => setSelectedTeacher((isSelected ? null : nombre))}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            width: '100%', padding: '12px 16px', cursor: 'pointer',
                            border: 'none', borderBottom: '1px solid #F1F5F9',
                            background: isSelected ? '#EFF6FF' : 'transparent',
                            borderLeft: isSelected ? '3px solid #2563EB' : '3px solid transparent',
                            textAlign: 'left', transition: 'all 0.1s',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F8FAFC'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: AZUL.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {nombre}
                            </div>
                            <div style={{ fontSize: '12px', color: AZUL.textSec, marginTop: '2px' }}>
                              {cursosUnicos.length} curso{cursosUnicos.length !== 1 ? 's' : ''} · {totalHoras} hora{totalHoras !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '11px', fontWeight: 600, color: '#fff',
                            background: isSelected ? '#2563EB' : '#94A3B8',
                            borderRadius: '9999px', width: '24px', height: '24px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            {cursosUnicos.length}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <Pagination page={page} totalPages={totalPages} totalItems={docentesOrdenados.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
              </div>

              {/* Right: Teacher Detail */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {selectedTeacher ? (
                  <div style={{ padding: '20px 24px' }}>
                    {(() => {
                      const rows = porDocenteFiltrado[selectedTeacher] || [];
                      const cursos = new Map<string, { teoria: number; practica: number; laboratorio: number; total: number; codigo: string }>();
                      rows.forEach((r: any) => {
                        const key = r.curso_nombre || r.curso_codigo || '—';
                        if (!cursos.has(key)) cursos.set(key, { teoria: 0, practica: 0, laboratorio: 0, total: 0, codigo: r.curso_codigo || '' });
                        const c = cursos.get(key)!;
                        const tipo = (r.tipo || '').toLowerCase();
                        if (tipo === 'teoria') c.teoria++;
                        else if (tipo === 'practica') c.practica++;
                        else if (tipo === 'laboratorio') c.laboratorio++;
                        c.total++;
                      });
                      const totalHoras = rows.length;
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                              <h3 style={{ fontSize: '18px', fontWeight: 700, color: AZUL.text, margin: 0 }}>{selectedTeacher}</h3>
                              <p style={{ fontSize: '13px', color: AZUL.textSec, margin: '4px 0 0' }}>
                                {cursos.size} curso{cursos.size !== 1 ? 's' : ''} · {totalHoras} hora{totalHoras !== 1 ? 's' : ''} asignadas
                              </p>
                            </div>
                          </div>

                          {/* Course cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                            {Array.from(cursos.entries()).map(([nombre, info]) => (
                              <div key={nombre} style={{ background: '#fff', border: '1px solid #DCE3EC', borderRadius: '8px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: AZUL.text, marginBottom: '8px' }}>
                                  {info.codigo} · {nombre}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {info.teoria > 0 && <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>T: {info.teoria}h</span>}
                                  {info.practica > 0 && <span style={{ background: '#F0FDF4', color: '#15803D', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>P: {info.practica}h</span>}
                                  {info.laboratorio > 0 && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>L: {info.laboratorio}h</span>}
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: 700, color: AZUL.principal, marginTop: '8px' }}>{info.total}h</div>
                              </div>
                            ))}
                          </div>

                          {/* Schedule list */}
                          <div style={{ border: '1px solid #DCE3EC', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ background: '#FAFBFC', padding: '10px 16px', borderBottom: '1px solid #DCE3EC', fontSize: '13px', fontWeight: 600, color: AZUL.text }}>
                              Detalle de horario ({rows.length} sesiones)
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                              {rows.sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia) || a.hora_inicio.localeCompare(b.hora_inicio)).map((r: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}>
                                  <div>
                                    <span style={{ fontWeight: 600, color: AZUL.text, textTransform: 'capitalize', display: 'inline-block', width: '80px' }}>{DIAS_L[r.dia] || r.dia}</span>
                                    <span style={{ color: AZUL.text }}>{r.hora_inicio?.substring(0, 5)} - {r.hora_fin?.substring(0, 5)}</span>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontWeight: 500, color: AZUL.text }}>{r.curso_codigo} <span style={{ color: AZUL.textSec, fontSize: '12px' }}>(G{r.numero_grupo})</span></span>
                                    <div style={{ fontSize: '12px', color: AZUL.textSec }}>
                                      {r.ambiente_codigo}
                                      <span style={{ margin: '0 6px' }}>·</span>
                                      <span style={{
                                        color: r.tipo === 'teoria' ? '#2563EB' : r.tipo === 'practica' ? '#059669' : '#D97706',
                                        fontWeight: 500,
                                      }}>
                                        {r.tipo}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: AZUL.textSec, padding: '40px' }}>
                    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.3, marginBottom: '16px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px' }}>Selecciona un docente</p>
                    <p style={{ fontSize: '13px', margin: 0, textAlign: 'center' }}>Haz clic en un docente de la lista para ver su horario detallado</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operacional: Card grid */}
          {tipoReporte === 'operacional' && (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {ambientesOrdenados.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '60px', textAlign: 'center', color: AZUL.textSec }}>
                    No hay horarios registrados en ningún ambiente con los filtros seleccionados.
                  </div>
                ) : (
                  ambientesOrdenados.slice((page - 1) * pageSize, page * pageSize).map(([ambNombre, rows]) => {
                    const totalHoras = rows.length;
                    const cursosUnicos = Array.from(new Set(rows.map(r => r.curso_nombre)));
                    return (
                      <div key={ambNombre} style={{
                        ...SX.card, padding: '16px', display: 'flex', flexDirection: 'column',
                      }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: AZUL.text, marginBottom: '8px' }}>
                          {ambNombre}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          <span style={{ background: '#F1F5F9', color: AZUL.textSec, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                            {cursosUnicos.length} curso{cursosUnicos.length !== 1 ? 's' : ''}
                          </span>
                          <span style={{ background: '#F1F5F9', color: AZUL.textSec, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                            {totalHoras}h
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          {rows.sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia)).slice(0, 4).map((r: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #F1F5F9' }}>
                              <div style={{ fontWeight: 500, color: AZUL.text }}>
                                <span style={{ textTransform: 'capitalize', width: '60px', display: 'inline-block' }}>{r.dia.substring(0, 3)}.</span>
                                {r.hora_inicio?.substring(0, 5)} - {r.hora_fin?.substring(0, 5)}
                              </div>
                              <div style={{ textAlign: 'right', color: AZUL.textSec }}>
                                <div>{r.curso_codigo} <span style={{ fontSize: '11px' }}>(G{r.numero_grupo})</span></div>
                              </div>
                            </div>
                          ))}
                          {rows.length > 4 && (
                            <div style={{ textAlign: 'center', fontSize: '12px', color: AZUL.textSec, fontStyle: 'italic' }}>
                              + {rows.length - 4} sesiones más
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {ambientesOrdenados.length > pageSize && (
                <Pagination page={page} totalPages={Math.ceil(ambientesOrdenados.length / pageSize)} totalItems={ambientesOrdenados.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!hasSearched && !loading && (
        <div style={{ ...SX.card, textAlign: 'center', padding: '80px 40px' }}>
          <svg width="56" height="56" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', display: 'block', opacity: 0.2, color: AZUL.principal }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: AZUL.text, margin: '0 0 4px' }}>Configura y genera tu reporte</h3>
          <p style={{ fontSize: '14px', color: AZUL.textSec, margin: 0, maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            Selecciona el tipo de reporte, ciclo académico, filtros opcionales y haz clic en "Generar vista previa"
          </p>
        </div>
      )}
    </div>
  );
}
