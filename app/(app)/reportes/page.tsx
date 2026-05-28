'use client';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_L: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

export default function ReportesPage() {
  const { darkMode } = useTheme();
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [tipoReporte, setTipoReporte] = useState<'operacional'|'gestion'|'docente'>('operacional');
  const [docenteId, setDocenteId] = useState('');
  const [ambienteId, setAmbienteId] = useState('');
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exportableProgId, setExportableProgId] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ciclos').then(r=>r.json()).then(d=>{
      setCiclos(d.data||[]);
      const a = d.data?.find((c:any)=>c.activo);
      if(a) setCicloId(a.id);
    });
    fetch('/api/docentes').then(r=>r.json()).then(d=>setDocentes(d.data||[]));
    fetch('/api/aulas').then(r=>r.json()).then(d=>setAmbientes(d.data||[]));
    fetch('/api/dashboard').then(r=>r.json()).then(d=>{ setSlots(d.slots||[]); setDashData(d); });
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
      .catch(() => {
        if (active) setExportableProgId(null);
      });

    return () => { active = false; };
  }, [cicloId]);

  async function generarReporte() {
    if (!cicloId) return;
    setLoading(true);
    setHasSearched(false);
    try {
      const q = new URLSearchParams({ciclo_id:cicloId});
      if (tipoReporte==='docente' && docenteId) q.set('docente_id',docenteId);
      if (tipoReporte==='operacional' && ambienteId) q.set('ambiente_id',ambienteId);
      const res = await fetch(`/api/horarios?${q}`);
      const data = await res.json();
      let asignacionesData = data.data || [];

      if (asignacionesData.length === 0 && cicloId) {
        const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`).then(r => r.json());
        const progs = progsRes.data || [];
        const selectedProg = progs.find((p: any) => p.estado === 'publicado') || progs[0];

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
              numero_grupo: parseInt(String(a.grupo || '').replace('G', ''), 10) || 1,
              tipo: a.tipo_sesion || a.tipo,
              ambiente_nombre: a.aula || '',
              ambiente_codigo: a.aula || '',
              docente_nombre: a.docente_nombre || '',
              docente_id: a.docente_id || null,
            }));

            if (docenteId) {
              asignacionesData = asignacionesData.filter((a: any) => a.docente_id === docenteId);
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
        const ambienteNombre = a.ambiente_nombre || amb?.nombre || code || '';
        const ambienteCodigo = a.ambiente_codigo || amb?.codigo || code || '';
        return {
          ...a,
          ambiente_nombre: ambienteNombre,
          ambiente_codigo: ambienteCodigo,
          aula: a.aula || ambienteCodigo,
        };
      });

      setAsignaciones(normalized);
      if (cicloId) {
        const d = await fetch(`/api/dashboard?ciclo_id=${cicloId}`).then(r=>r.json());

        let finalDash = d;
        const totalAsig = normalized.length;
        const statsEmpty = (d?.stats?.totalAsignaciones || 0) === 0;

        if (tipoReporte === 'gestion' && totalAsig > 0 && statsEmpty) {
          const uniqueDocentes = new Map<string, any>();
          const uniqueCursos = new Set<string>();
          const uniqueAmbientes = new Map<string, any>();
          const docenteHoras = new Map<string, number>();

          normalized.forEach((a: any) => {
            if (a.docente_id) {
              uniqueDocentes.set(a.docente_id, a.docente_nombre || 'Docente');
              docenteHoras.set(a.docente_id, (docenteHoras.get(a.docente_id) || 0) + 1);
            }
            if (a.curso_codigo) uniqueCursos.add(a.curso_codigo);
            if (a.ambiente_codigo) {
              uniqueAmbientes.set(a.ambiente_codigo, {
                codigo: a.ambiente_codigo,
                nombre: a.ambiente_nombre || a.ambiente_codigo,
                tipo: a.ambiente_tipo || 'aula',
              });
            }
          });

          const docenteMap = new Map(docentes.map(d => [d.id, d]));
          const cargaDocentes = Array.from(uniqueDocentes.entries()).map(([id, nombre]) => {
            const doc = docenteMap.get(id) || {};
            const horasAsignadas = docenteHoras.get(id) || 0;
            const horasMax = doc.horas_max_semana || 20;
            return {
              nombre: doc.nombre ? `${doc.nombre} ${doc.apellidos || ''}`.trim() : nombre,
              categoria: doc.categoria || 'auxiliar',
              condicion: doc.condicion || 'contratado',
              horas_max_semana: horasMax,
              horas_asignadas: horasAsignadas,
              porcentaje_carga: horasMax ? Math.round((horasAsignadas * 100) / horasMax) : 0,
            };
          }).sort((a, b) => (b.porcentaje_carga || 0) - (a.porcentaje_carga || 0));

          const totalSlots = (ambientes.length || uniqueAmbientes.size || 1) * (slots.length || 1) * 5;
          const ocupacionAmbientes = Array.from(uniqueAmbientes.values()).map((a: any) => {
            const horasUsadas = normalized.filter((x: any) => x.ambiente_codigo === a.codigo).length;
            return {
              nombre: a.nombre,
              tipo: a.tipo,
              codigo: a.codigo,
              horas_usadas: horasUsadas,
              porcentaje: totalSlots ? Math.round((horasUsadas * 1000) / totalSlots) / 10 : 0,
            };
          }).sort((a, b) => (b.porcentaje || 0) - (a.porcentaje || 0));

          finalDash = {
            ...d,
            stats: {
              ...d?.stats,
              totalDocentes: uniqueDocentes.size,
              totalCursos: uniqueCursos.size,
              totalAmbientes: uniqueAmbientes.size,
              totalAsignaciones: totalAsig,
            },
            cargaDocentes,
            ocupacionAmbientes,
          };
        }

        if (tipoReporte === 'gestion' && totalAsig === 0 && statsEmpty) {
          const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`).then(r => r.json());
          const progs = progsRes.data || [];
          const selectedProg = progs.find((p: any) => p.estado === 'publicado') || progs[0];

          if (selectedProg) {
            const pcRes = await fetch(`/api/horarios/programaciones/${selectedProg.id}/programacion-cursos`);
            if (pcRes.ok) {
              const pcData = await pcRes.json();
              const cursosProg = pcData.data || [];
              const cargaDocentesProg = pcData.cargaDocentes || [];
              const docentesProg = new Set(cursosProg.map((c: any) => c.docente_id).filter(Boolean));

              finalDash = {
                ...d,
                stats: {
                  ...d?.stats,
                  totalDocentes: docentesProg.size,
                  totalCursos: cursosProg.length,
                  totalAmbientes: 0,
                  totalAsignaciones: 0,
                },
                cargaDocentes: cargaDocentesProg,
                ocupacionAmbientes: [],
              };
            }
          }
        }

        setDashData(finalDash);
      }
    } finally { 
      setLoading(false); 
      setHasSearched(true);
    }
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
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }

    interface BloqueAgrupado {
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

    function agruparBloquesContiguos(asigList: any[]): BloqueAgrupado[] {
      const ordenDias = (dia: string): number => {
        const orden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        return orden.indexOf(dia.toLowerCase());
      };

      const ordenadas = [...asigList].sort((a, b) => {
        if (a.dia !== b.dia) return ordenDias(a.dia) - ordenDias(b.dia);
        return a.hora_inicio.localeCompare(b.hora_inicio);
      });
      
      const bloques: BloqueAgrupado[] = [];
      let bloqueActual: BloqueAgrupado | null = null;
      
      for (const asig of ordenadas) {
        const currentCycle = asig.ciclo_plan || asig.ciclo || 0;
        const isContinuation = bloqueActual && 
          bloqueActual.dia === asig.dia &&
          bloqueActual.curso_codigo === asig.curso_codigo &&
          bloqueActual.grupo === `G${asig.numero_grupo || asig.grupo}` &&
          bloqueActual.aula === (asig.ambiente_codigo || asig.aula || asig.ambiente_nombre) &&
          bloqueActual.docente_nombre === asig.docente_nombre &&
          bloqueActual.tipo_sesion === asig.tipo &&
          bloqueActual.hora_fin === asig.hora_inicio;

        if (isContinuation && bloqueActual) {
          bloqueActual.hora_fin = asig.hora_fin;
          bloqueActual.duracion_horas += 1;
        } else {
          if (bloqueActual) bloques.push(bloqueActual);
          
          bloqueActual = {
            curso_codigo: asig.curso_codigo || '',
            curso_nombre: asig.curso_nombre || '',
            grupo: `G${asig.numero_grupo || asig.grupo || ''}`,
            aula: asig.ambiente_codigo || asig.aula || asig.ambiente_nombre || '',
            docente_nombre: asig.docente_nombre || '',
            tipo_sesion: asig.tipo || '',
            dia: asig.dia,
            hora_inicio: asig.hora_inicio,
            hora_fin: asig.hora_fin,
            duracion_horas: 1,
            ciclo: currentCycle
          };
        }
      }
      
      if (bloqueActual) bloques.push(bloqueActual);
      return bloques;
    }

    function construirFilasHorarioPdf(
      bloquesAgrupados: BloqueAgrupado[],
      slotsOrdenados: any[],
      diasSem: string[],
      tipoReporteHorario: 'docente' | 'operacional',
      mapaColores: any
    ) {
      const formatearBloque = (bloque: BloqueAgrupado, mostrarDuracion = false) => {
        const tipoEtiqueta = bloque.tipo_sesion === 'asesoria' ? 'C' : bloque.tipo_sesion[0].toUpperCase();
        const detalle = tipoReporteHorario === 'docente' ? `Aula: ${bloque.aula}` : `Docente: ${bloque.docente_nombre}`;
        const duracion = mostrarDuracion ? `\nDuración: ${bloque.duracion_horas}h` : '';

        return [
          `${bloque.curso_nombre}`,
          `Código ${bloque.curso_codigo}  ·  Grupo ${bloque.grupo}`,
          `${detalle}  ·  Tipo ${tipoEtiqueta}`,
          `Horario ${bloque.hora_inicio.substring(0, 5)} - ${bloque.hora_fin.substring(0, 5)}${duracion}`,
        ].join('\n');
      };

      const bloquesPorInicio = new Map<string, BloqueAgrupado[]>();
      const llaveInicio = (dia: string, horaInicio: string) => `${dia.toLowerCase()}|${horaInicio}`;

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

        const esRefrigerio = slot.hora_inicio.startsWith('13:00');

        diasSem.forEach((dia, diaIdx) => {
          const spanRestante = spansPendientes.get(diaIdx) || 0;
          if (spanRestante > 0) {
            spansPendientes.set(diaIdx, spanRestante - 1);
            return;
          }

          if (esRefrigerio) {
            fila.push('HORA LIBRE (REFRIGERIO)');
            return;
          }

          const bloquesEnInicio = bloquesPorInicio.get(llaveInicio(dia, slot.hora_inicio)) || [];
          if (bloquesEnInicio.length === 0) {
            fila.push('');
            return;
          }

          if (bloquesEnInicio.length === 1 && bloquesEnInicio[0].duracion_horas > 1) {
            const bloque = bloquesEnInicio[0];
            spansPendientes.set(diaIdx, bloque.duracion_horas - 1);

            const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
            const rgb = hexToRgb(color.bg);
            const borderRgb = hexToRgb(color.border);

            fila.push({
              content: formatearBloque(bloque, true),
              rowSpan: bloque.duracion_horas,
              styles: {
                fillColor: bloque.tipo_sesion === 'asesoria' ? [243, 244, 246] : rgb ? [rgb.r, rgb.g, rgb.b] : [255, 255, 255],
                textColor: [51, 65, 85],
                lineColor: bloque.tipo_sesion === 'asesoria' ? [107, 114, 128] : borderRgb ? [borderRgb.r, borderRgb.g, borderRgb.b] : [203, 213, 225],
                lineWidth: { top: 0.45, right: 0.45, bottom: 0.45, left: 1.1 },
                valign: 'middle',
                halign: 'left'
              }
            });
            return;
          }

          if (bloquesEnInicio.length > 1) {
            const cellText = bloquesEnInicio
              .map((b) => formatearBloque(b, false))
              .join('\n\n• • • • • • • • • •\n\n');

            fila.push({
              content: cellText,
              styles: {
                fillColor: [248, 250, 252],
                textColor: [51, 65, 85],
                lineColor: [203, 213, 225],
                lineWidth: { top: 0.45, right: 0.45, bottom: 0.45, left: 1.1 },
                valign: 'middle',
                halign: 'left'
              }
            });
            return;
          }

          const bloque = bloquesEnInicio[0];
          const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
          const rgb = hexToRgb(color.bg);
          const borderRgb = hexToRgb(color.border);

          fila.push({
            content: formatearBloque(bloque, false),
            styles: {
              fillColor: bloque.tipo_sesion === 'asesoria' ? [243, 244, 246] : rgb ? [rgb.r, rgb.g, rgb.b] : [255, 255, 255],
              textColor: [51, 65, 85],
              lineColor: bloque.tipo_sesion === 'asesoria' ? [107, 114, 128] : borderRgb ? [borderRgb.r, borderRgb.g, borderRgb.b] : [203, 213, 225],
              lineWidth: { top: 0.45, right: 0.45, bottom: 0.45, left: 1.1 },
              valign: 'middle',
              halign: 'left'
            }
          });
        });

        return fila;
      });
    }

    let y = 62;

    if (tipoReporte === 'gestion') {
      // Encabezado Formal
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 148.5, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 148.5, 28, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(14, 35, 283, 35);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`REPORTE DE GESTIÓN — ${ciclo?.nombre||''}`, 14, 45);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);

      // Estadísticas
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('RESUMEN EJECUTIVO', 14, y); y += 6;

      doc.setFontSize(9); doc.setFont('helvetica','normal');
      const stats = [
        ['Docentes programados', `${dashData?.stats?.totalDocentes} de ${dashData?.stats?.globalDocentes||0} (${Math.round((dashData?.stats?.totalDocentes / (dashData?.stats?.globalDocentes||1))*100)}%)`],
        ['Cursos programados', `${dashData?.stats?.totalCursos} de ${dashData?.stats?.globalCursos||0} (${Math.round((dashData?.stats?.totalCursos / (dashData?.stats?.globalCursos||1))*100)}%)`],
        ['Ambientes usados', `${dashData?.stats?.totalAmbientes} de ${dashData?.stats?.globalAmbientes||0} (${Math.round((dashData?.stats?.totalAmbientes / (dashData?.stats?.globalAmbientes||1))*100)}%)`],
        ['Total asignaciones', `${dashData?.stats?.totalAsignaciones}`],
      ];
      autoTable(doc, {
        startY: y, head:[['Indicador','Valor']],
        body: stats, theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85]},
        margin:{left:14,right:14},
        tableWidth: 100,
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Carga docentes
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('CARGA HORARIA POR DOCENTE', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Docente','Categoría','Condición','Horas Asignadas','Horas Máx.','% Carga']],
        body: dashData?.cargaDocentes?.map((d:any)=>[
          d.nombre, d.categoria.replace('_',' ').toUpperCase(), d.condicion,
          `${d.horas_asignadas}h`, `${d.horas_max_semana}h`, `${d.porcentaje_carga||0}%`
        ])||[],
        theme:'striped', 
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 3:{halign:'center'}, 4:{halign:'center'}, 5:{halign:'center'} },
        margin:{left:14,right:14},
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Ocupación ambientes
      if (y > 160) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('OCUPACIÓN DE AMBIENTES', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Ambiente','Tipo','Horas Usadas','% Ocupación']],
        body: dashData?.ocupacionAmbientes?.map((a:any)=>[
          a.nombre, a.tipo.toUpperCase(), `${a.horas_usadas}h`, `${a.porcentaje}%`
        ])||[],
        theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 2:{halign:'center'}, 3:{halign:'center'} },
        margin:{left:14,right:14},
      });
    } else {
      // Reporte operacional semanal agrupado y pintado
      const docGrp: Record<string,any[]> = {};
      asignaciones.forEach(a => {
        const k = tipoReporte==='docente' ? a.docente_nombre : a.ambiente_nombre;
        if (!docGrp[k]) docGrp[k] = [];
        docGrp[k].push(a);
      });

      const items = Object.entries(docGrp);
      items.forEach(([tituloGrp, grpAsignaciones], idxPage) => {
        if (idxPage > 0) doc.addPage();

        // Encabezado institucional de la página
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 14, 15);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 14, 20);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const subTitle = tipoReporte === 'docente' 
          ? `HORARIO SEMANAL DEL DOCENTE: ${tituloGrp.toUpperCase()}`
          : `HORARIO SEMANAL DEL AMBIENTE: ${tituloGrp.toUpperCase()}`;
        doc.text(`${subTitle} — ${nombreCiclo}`, 14, 26);

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 29, 283, 29);

        // Agrupar bloques contiguos
        const bloquesAgrupados = agruparBloquesContiguos(grpAsignaciones);
        
        // Generar mapa de colores
        const mapaColores = generarMapaColores(grpAsignaciones);
        const docentesUnicos = Array.from(
          new Map(
            grpAsignaciones
              .filter((a: any) => a.docente_nombre)
              .map((a: any) => [a.docente_nombre, a])
          ).values()
        );
        const cursosUnicos = Array.from(
          new Map(
            grpAsignaciones
              .filter((a: any) => a.curso_codigo)
              .map((a: any) => [a.curso_codigo, a])
          ).values()
        );
        const totalHoras = bloquesAgrupados.reduce((acc, bloque) => acc + bloque.duracion_horas, 0);
        const resumirLista = (items: any[], selector: (item: any) => string, limite = 3) => {
          const valores = items.map(selector).filter(Boolean);
          if (valores.length <= limite) return valores.join(' · ');
          return `${valores.slice(0, limite).join(' · ')} +${valores.length - limite}`;
        };
        const footerDocentes = resumirLista(docentesUnicos, (d) => d.docente_nombre || 'Sin docente');
        const footerCursos = resumirLista(cursosUnicos, (c) => `${c.curso_codigo}${c.curso_nombre ? ` ${c.curso_nombre}` : ''}`);

        // Columnas y filas
        const diasSem = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const headersTable = ['Hora', ...diasSem];

        const sortedSlots = [...slots].sort((a,b)=>a.hora_inicio.localeCompare(b.hora_inicio));
        
        const rowsTable = construirFilasHorarioPdf(
          bloquesAgrupados,
          sortedSlots,
          diasSem,
          tipoReporte,
          mapaColores
        );

        // Renderizar autoTable
        autoTable(doc, {
          head: [headersTable],
          body: rowsTable,
          startY: 33,
          theme: 'grid',
          pageBreak: 'avoid',
          rowPageBreak: 'avoid',
          tableWidth: 'auto',
          margin: { top: 8, bottom: 14, left: 10, right: 10 },
          styles: {
            fontSize: 5.95,
            cellPadding: { top: 1.05, right: 1.15, bottom: 1.05, left: 1.35 },
            overflow: 'linebreak',
            valign: 'middle',
            halign: 'left',
            textColor: [51, 65, 85]
          },
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7.2
          },
          columnStyles: {
            0: {
              cellWidth: 18,
              halign: 'center',
              fontStyle: 'bold',
              fillColor: [248, 250, 252]
            }
          },
          didDrawPage: () => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const footerTop = pageHeight - 17;
            const sectionWidth = (pageWidth - 24) / 3;

            const drawFooterBox = (x: number, title: string, body: string, accent: [number, number, number]) => {
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(226, 232, 240);
              doc.roundedRect(x, footerTop - 2, sectionWidth, 11, 1.5, 1.5, 'FD');

              doc.setFillColor(accent[0], accent[1], accent[2]);
              doc.roundedRect(x + 1, footerTop - 1, 2.2, 9, 0.6, 0.6, 'F');

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.setTextColor(30, 41, 59);
              doc.text(title, x + 5, footerTop + 1.1);

              doc.setFont('helvetica', 'normal');
              doc.setFontSize(5.4);
              doc.setTextColor(71, 85, 105);
              doc.text(body, x + 5, footerTop + 4.7, { maxWidth: sectionWidth - 6 });
            };

            drawFooterBox(10, 'Docentes', footerDocentes || 'Sin asignar', [59, 130, 246]);
            drawFooterBox(10 + sectionWidth + 7, 'Cursos', footerCursos || 'Sin asignar', [16, 185, 129]);
            drawFooterBox(10 + (sectionWidth + 7) * 2, 'Bloques', `Totales: ${bloquesAgrupados.length}  ·  Horas: ${totalHoras}  ·  SiHorarios UNT`, [249, 115, 22]);
          },
          didParseCell: (data) => {
            if (data.section === 'body') {
              const rawCell = data.cell.raw;
              const textContent = typeof rawCell === 'string'
                ? rawCell
                : rawCell && typeof rawCell === 'object' && 'content' in rawCell
                  ? String(rawCell.content ?? '')
                  : '';
              if (textContent === 'HORA LIBRE (REFRIGERIO)') {
                data.cell.styles.fillColor = [241, 245, 249];
                data.cell.styles.textColor = [100, 116, 139];
                data.cell.styles.fontStyle = 'italic';
                data.cell.styles.halign = 'center';
                return;
              }

              if (data.column.index === 0) {
                return;
              }

              const slot = sortedSlots[data.row.index];
              if (!slot) return;
              const dia = diasSem[data.column.index - 1];

              const bloquesEnInicio = bloquesAgrupados.filter(b => 
                b.dia.toLowerCase() === dia.toLowerCase() &&
                b.hora_inicio === slot.hora_inicio
              );

              if (bloquesEnInicio.length === 0) return;

              if (bloquesEnInicio.length === 1 && bloquesEnInicio[0].duracion_horas > 1) {
                return;
              }

              if (bloquesEnInicio.length > 1) {
                data.cell.styles.fillColor = [249, 250, 251];
                data.cell.styles.lineColor = [229, 231, 235];
                data.cell.styles.lineWidth = 0.5;
                return;
              }

              const bloque = bloquesEnInicio[0];
              if (bloque.tipo_sesion === 'asesoria') {
                data.cell.styles.fillColor = [229, 231, 235]; // Gris neutro
                data.cell.styles.lineColor = [107, 114, 128];
                data.cell.styles.lineWidth = 0.4;
                return;
              }

              const color = obtenerColorCurso(mapaColores, bloque.ciclo, bloque.curso_codigo, bloque.tipo_sesion);
              const rgb = hexToRgb(color.bg);
              if (rgb) {
                data.cell.styles.fillColor = [rgb.r, rgb.g, rgb.b];
              }
              const borderRgb = hexToRgb(color.border);
              if (borderRgb) {
                data.cell.styles.lineColor = [borderRgb.r, borderRgb.g, borderRgb.b];
                data.cell.styles.lineWidth = 0.5;
              }
            }
          }
        });
      });
    }
    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    doc.save(`${nombre}-${ciclo?.nombre||'unt'}.pdf`);
  }

  async function exportarExcelUNT() {
    if (!cicloId) {
      alert('Por favor seleccione un ciclo');
      return;
    }
    if (!exportableProgId) {
      alert('El formato UNT solo se habilita cuando la programacion esta en Fase 4.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/horarios/programaciones/${exportableProgId}/exportar-unt`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Error al obtener datos de exportación oficial UNT');
      }
      
      const resData = await response.json();
      
      const { exportarHorariosFormatoUNT } = await import('@/lib/exportar/excel-horarios-unt');
      await exportarHorariosFormatoUNT(resData);
    } catch (err: any) {
      alert(err.message || 'Error al exportar a Formato Oficial UNT');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function exportarCSV() {
    const { utils, writeFile } = await import('xlsx');
    const ciclo = ciclos.find(c=>c.id===cicloId);
    let wb = utils.book_new();
    
    if (tipoReporte === 'gestion') {
      const rows = [['Indicador', 'Valor'],
        ['Docentes activos', dashData?.stats?.totalDocentes],
        ['Cursos activos', dashData?.stats?.totalCursos],
        ['Ambientes disponibles', dashData?.stats?.totalAmbientes],
        ['Total asignaciones', dashData?.stats?.totalAsignaciones]
      ];
      const ws = utils.aoa_to_sheet(rows);
      utils.book_append_sheet(wb, ws, 'Datos');
    } else {
      const rows = asignaciones.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(r=>[
        DIAS_L[r.dia]||r.dia, r.hora_inicio, r.hora_fin, r.curso_nombre,
        tipoReporte==='docente' ? r.ambiente_nombre : r.docente_nombre,
        r.tipo, `G${r.numero_grupo}`
      ]);
      const data = [['Día','Hora Inicio','Hora Fin','Curso','Ambiente/Docente','Tipo','Grupo'], ...rows];
      const ws = utils.aoa_to_sheet(data);
      utils.book_append_sheet(wb, ws, 'Horarios');
    }
    
    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    writeFile(wb, `${nombre}-${ciclo?.nombre||'unt'}.csv`, { bookType: 'csv' });
  }

  const docenteSelec = docentes.find(d=>d.id===docenteId);

  // Organizar asignaciones para vista previa
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

  return (
    <div style={{padding:'32px', color:'var(--text-primary)'}}>
      <div style={{marginBottom:'24px',display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color: darkMode ? '#ffffff' : '#1e293b',margin:'0 0 4px'}}>Reportes</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Crea reportes listos para impresión y exportación oficial</p>
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
          <div style={{background: darkMode ? 'rgba(148,163,184,0.14)' : '#e2e8f0',color: darkMode ? '#fff' : '#0f172a',padding:'6px 12px',borderRadius:'999px',fontSize:'12px',fontWeight:'600',border:'1px solid var(--border-color)'}}>Formato UNT</div>
          <div style={{background: darkMode ? 'rgba(148,163,184,0.08)' : '#f1f5f9',color: darkMode ? '#e2e8f0' : '#475569',padding:'6px 12px',borderRadius:'999px',fontSize:'12px',fontWeight:'600',border:'1px solid var(--border-color)'}}>PDF profesional</div>
        </div>
      </div>

      {/* Config Panel */}
      <div className="card" style={{marginBottom:'20px',border:'1px solid var(--border-color)', background:'var(--bg-card)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',marginBottom:'16px',flexWrap:'wrap'}}>
          <h3 style={{fontSize:'16px',fontWeight:'600',margin:0,color:'var(--text-primary)'}}>Configuración del reporte</h3>
          <div style={{fontSize:'12px',color:'var(--text-secondary)'}}>Define el alcance y luego previsualiza</div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))',gap:'16px',marginBottom:'20px'}}>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label" style={{color:'var(--text-secondary)', fontWeight:'600'}}>Tipo de reporte</label>
            <select 
              className="form-input" 
              style={{background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color:'var(--text-primary)', fontWeight:500, boxShadow:'var(--shadow-sm)'}} 
              value={tipoReporte} 
              onChange={e=>{setTipoReporte(e.target.value as any); setHasSearched(false);}}
            >
              <option value="operacional">📋 Operacional (Aulas y Docentes)</option>
              <option value="docente">👤 Horario por Docente</option>
              <option value="gestion">📊 Gestión (Resumen Ejecutivo)</option>
            </select>
          </div>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label" style={{color:'var(--text-secondary)', fontWeight:'600'}}>Ciclo académico</label>
            <select 
              className="form-input" 
              style={{background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color:'var(--text-primary)', fontWeight:500, boxShadow:'var(--shadow-sm)'}} 
              value={cicloId} 
              onChange={e=>{setCicloId(e.target.value); setHasSearched(false);}}
            >
              {ciclos.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.activo?' (Activo)':''}</option>)}
            </select>
          </div>
          {tipoReporte==='docente' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label" style={{color:'var(--text-secondary)', fontWeight:'600'}}>Docente</label>
              <select 
                className="form-input" 
                style={{background: darkMode ? 'rgba(16,185,129,0.08)' : '#f0fdf4', border:'1px solid ' + (darkMode ? 'rgba(52,211,153,0.35)' : '#86efac'), borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color: darkMode ? '#d1fae5' : '#166534', fontWeight:500, boxShadow:'var(--shadow-sm)'}} 
                value={docenteId} 
                onChange={e=>{setDocenteId(e.target.value); setHasSearched(false);}}
              >
                <option value="">Todos los docentes</option>
                {docentes.map(d=><option key={d.id} value={d.id}>[{d.categoria}] {d.apellidos}, {d.nombre}</option>)}
              </select>
            </div>
          )}
          {tipoReporte==='operacional' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label" style={{color:'var(--text-secondary)', fontWeight:'600'}}>Filtrar por ambiente (opcional)</label>
              <select 
                className="form-input" 
                style={{background: darkMode ? 'rgba(16,185,129,0.08)' : '#f0fdf4', border:'1px solid ' + (darkMode ? 'rgba(52,211,153,0.35)' : '#86efac'), borderRadius:'8px', padding:'10px 12px', transition:'all 0.2s', cursor:'pointer', color: darkMode ? '#d1fae5' : '#166534', fontWeight:500, boxShadow:'var(--shadow-sm)'}} 
                value={ambienteId} 
                onChange={e=>{setAmbienteId(e.target.value); setHasSearched(false);}}
              >
                <option value="">Todos los ambientes</option>
                {ambientes.map(a=><option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
          <button className="btn-primary" onClick={generarReporte} disabled={loading} style={{minWidth:'160px',justifyContent:'center'}}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            {loading ? 'Generando...' : 'Previsualizar'}
          </button>
          {loading && (
            <div style={{fontSize:'12px',color:'var(--text-secondary)',display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#1a3a5c',display:'inline-block'}} />
              Procesando datos...
            </div>
          )}
        </div>
      </div>

      {hasSearched && (Object.keys(porDocente).length > 0 || Object.keys(porAmbiente).length > 0 || tipoReporte === 'gestion') && (
        <div className="card" style={{marginBottom:'20px',border:'1px solid var(--border-color)',padding:'20px', background:'var(--bg-card)'}}>
          <h3 style={{fontSize:'15px',fontWeight:'600',margin:'0 0 12px', color:'var(--text-primary)'}}>Formatos de descarga</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'12px'}}>
            <button onClick={exportarPDF} className="btn-secondary" style={{justifyContent:'space-between',padding:'14px 16px',borderRadius:'12px',border:'1px solid var(--border-color)', background:'var(--bg-card)'}}>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:'700',color:'var(--text-primary)'}}>PDF institucional</div>
                <div style={{fontSize:'12px',color:'var(--text-secondary)'}}>Listo para impresión</div>
              </div>
              <span style={{fontSize:'20px'}}>📄</span>
            </button>

            {exportableProgId && (
              <button onClick={exportarExcelUNT} className="btn-secondary" style={{justifyContent:'space-between',padding:'14px 16px',borderRadius:'12px',border:'1px solid ' + (darkMode ? 'rgba(99,102,241,0.35)' : '#c7d2fe'),background: darkMode ? 'rgba(99,102,241,0.12)' : '#eef2ff',color: darkMode ? '#c7d2fe' : '#3730a3'}}>
                <div style={{textAlign:'left'}}>
                  <div style={{fontWeight:'700', color: darkMode ? '#fff' : 'inherit'}}>Excel Formato UNT</div>
                  <div style={{fontSize:'12px',color: darkMode ? '#c7d2fe' : '#4338ca'}}>Formato oficial</div>
                </div>
                <span style={{fontSize:'20px'}}>📊</span>
              </button>
            )}

            <button onClick={exportarCSV} className="btn-secondary" style={{justifyContent:'space-between',padding:'14px 16px',borderRadius:'12px',border:'1px solid var(--border-color)', background:'var(--bg-card)'}}>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:'700',color:'var(--text-primary)'}}>CSV de respaldo</div>
                <div style={{fontSize:'12px',color:'var(--text-secondary)'}}>Datos planos</div>
              </div>
              <span style={{fontSize:'20px'}}>📦</span>
            </button>
          </div>
        </div>
      )}

      {/* Vista previa */}
      {hasSearched && tipoReporte !== 'gestion' && (
        <div ref={reportRef}>
          {/* Cabecera reporte */}
          <div style={{background: darkMode ? '#020817' : '#1a3a5c',color:'white',borderRadius:'12px 12px 0 0',padding:'20px 24px',marginBottom:0}}>
            <p style={{fontSize:'12px',margin:'0 0 2px',opacity:0.7}}>UNIVERSIDAD NACIONAL DE TRUJILLO — Escuela de Ingeniería de Sistemas</p>
            <h2 style={{fontSize:'18px',fontWeight:'700',margin:'0 0 2px'}}>
              {tipoReporte==='docente' ? `Horario del Docente: ${docenteSelec ? `${docenteSelec.apellidos}, ${docenteSelec.nombre}` : 'Todos'}` : 'Reporte Operacional de Horarios'}
            </h2>
            <p style={{fontSize:'13px',margin:0,opacity:0.8}}>Ciclo: {ciclos.find(c=>c.id===cicloId)?.nombre} • Generado: {new Date().toLocaleDateString('es-PE')}</p>
          </div>

          {tipoReporte==='docente' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', marginTop:'24px'}}>
              {Object.entries(porDocente).map(([docNombre, rows]) => {
                const totalHoras = rows.length;
                const cursosUnicos = Array.from(new Set(rows.map(r => r.curso_nombre)));
                return (
                  <div key={docNombre} className="card" style={{padding:'20px', display:'flex', flexDirection:'column', borderTop:'4px solid #1a3a5c', background:'var(--bg-card)', borderColor:'var(--border-color)'}}>
                    <h3 style={{fontSize:'16px',fontWeight:'700',color:'var(--text-primary)',margin:'0 0 8px'}}>{docNombre}</h3>
                    <div style={{display:'flex', gap:'12px', marginBottom:'16px'}}>
                      <span style={{background: darkMode ? 'rgba(148,163,184,0.12)' : '#f1f5f9', color: darkMode ? '#fff' : '#475569', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>📚 {cursosUnicos.length} Cursos</span>
                      <span style={{background: darkMode ? 'rgba(59,130,246,0.12)' : '#dbeafe', color: darkMode ? '#dbeafe' : '#1e40af', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>⏱️ {totalHoras} hrs asignadas</span>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'8px', flex:1}}>
                      {rows.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).slice(0, 5).map((r, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'8px', background:'var(--bg-card-hover)', borderRadius:'6px', border:'1px solid var(--border-color)'}}>
                          <div style={{fontWeight:'500', color:'var(--text-primary)'}}><span style={{textTransform:'capitalize', width:'70px', display:'inline-block'}}>{r.dia.substring(0,3)}.</span> {r.hora_inicio} - {r.hora_fin}</div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontWeight:'600', color:'var(--text-primary)'}}>{r.curso_codigo} <span style={{color:'var(--text-secondary)', fontSize:'11px'}}>(G{r.numero_grupo})</span></div>
                            <div style={{color:'var(--text-secondary)', fontSize:'11px'}}>{r.ambiente_codigo} • <span style={{color:r.tipo==='teoria'?'#2563eb':r.tipo==='practica'?'#059669':'#d97706'}}>{r.tipo}</span></div>
                          </div>
                        </div>
                      ))}
                      {rows.length > 5 && (
                        <div style={{textAlign:'center', fontSize:'12px', color:'var(--text-secondary)', marginTop:'4px', fontStyle:'italic'}}>+ {rows.length - 5} sesiones más...</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tipoReporte==='docente' && Object.keys(porDocente).length === 0 && (
            <div style={{padding:'40px',textAlign:'center',color:'var(--text-secondary)',background:'var(--bg-card-hover)',borderRadius:'12px',border:'1px dashed var(--border-color)', marginTop:'24px'}}>
              No hay horarios registrados para ningún docente en este ciclo.
            </div>
          )}

          {tipoReporte==='operacional' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'20px', marginTop:'24px'}}>
              {Object.entries(porAmbiente).map(([ambNombre, rows]) => {
                const totalHoras = rows.length;
                const cursosUnicos = Array.from(new Set(rows.map(r => r.curso_nombre)));
                return (
                  <div key={ambNombre} className="card" style={{padding:'20px', display:'flex', flexDirection:'column', borderTop:'4px solid #10b981', background:'var(--bg-card)', borderColor:'var(--border-color)'}}>
                    <h3 style={{fontSize:'16px',fontWeight:'700',color:'var(--text-primary)',margin:'0 0 8px'}}>🚪 {ambNombre}</h3>
                    <div style={{display:'flex', gap:'12px', marginBottom:'16px'}}>
                      <span style={{background: darkMode ? 'rgba(148,163,184,0.12)' : '#f1f5f9', color: darkMode ? '#fff' : '#475569', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>📚 {cursosUnicos.length} Cursos</span>
                      <span style={{background: darkMode ? 'rgba(16,185,129,0.12)' : '#d1fae5', color: darkMode ? '#d1fae5' : '#065f46', padding:'4px 10px', borderRadius:'6px', fontSize:'13px', fontWeight:'600'}}>⏱️ {totalHoras} hrs de uso</span>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'8px', flex:1}}>
                      {rows.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).slice(0, 5).map((r, i) => (
                        <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'8px', background:'var(--bg-card-hover)', borderRadius:'6px', border:'1px solid var(--border-color)'}}>
                          <div style={{fontWeight:'500', color:'var(--text-primary)'}}><span style={{textTransform:'capitalize', width:'70px', display:'inline-block'}}>{r.dia.substring(0,3)}.</span> {r.hora_inicio} - {r.hora_fin}</div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontWeight:'600', color:'var(--text-primary)'}}>{r.curso_codigo} <span style={{color:'var(--text-secondary)', fontSize:'11px'}}>(G{r.numero_grupo})</span></div>
                            <div style={{color:'var(--text-secondary)', fontSize:'11px', maxWidth:'120px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={r.docente_nombre}>{r.docente_nombre}</div>
                          </div>
                        </div>
                      ))}
                      {rows.length > 5 && (
                        <div style={{textAlign:'center', fontSize:'12px', color:'var(--text-secondary)', marginTop:'4px', fontStyle:'italic'}}>+ {rows.length - 5} sesiones más...</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tipoReporte==='operacional' && Object.keys(porAmbiente).length === 0 && (
            <div style={{padding:'40px',textAlign:'center',color:'var(--text-secondary)',background:'var(--bg-card-hover)',borderRadius:'12px',border:'1px dashed var(--border-color)', marginTop:'24px'}}>
              No hay horarios registrados en ningún ambiente en este ciclo.
            </div>
          )}
        </div>
      )}

      {/* Reporte de gestión */}
      {tipoReporte==='gestion' && hasSearched && dashData && (
        <div>
          <div style={{background: darkMode ? '#020817' : '#1a3a5c',color:'white',borderRadius:'12px 12px 0 0',padding:'20px 24px'}}>
            <p style={{fontSize:'12px',margin:'0 0 2px',opacity:0.7}}>UNIVERSIDAD NACIONAL DE TRUJILLO — Escuela de Ingeniería de Sistemas</p>
            <h2 style={{fontSize:'18px',fontWeight:'700',margin:'0 0 2px'}}>Reporte de Gestión — Resumen Ejecutivo</h2>
            <p style={{fontSize:'13px',margin:0,opacity:0.8}}>Ciclo: {ciclos.find(c=>c.id===cicloId)?.nombre}</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',padding:'20px',background:'var(--bg-card)',borderBottom:'1px solid var(--border-color)'}}>
            {[
              {l:'Docentes',v:dashData.stats?.totalDocentes,c:'#1a3a5c'},
              {l:'Cursos',v:dashData.stats?.totalCursos,c:'#065f46'},
              {l:'Ambientes',v:dashData.stats?.totalAmbientes,c:'#92400e'},
              {l:'Asignaciones',v:dashData.stats?.totalAsignaciones,c:'#6b21a8'},
            ].map((s,i)=>(
              <div key={i} style={{background:'var(--bg-card)',borderRadius:'10px',padding:'16px',textAlign:'center',boxShadow:'var(--shadow-sm)',border:'1px solid var(--border-color)'}}>
                <p style={{fontSize:'26px',fontWeight:'700',color:s.c,margin:'0 0 4px'}}>{s.v}</p>
                <p style={{fontSize:'12px',color:'var(--text-secondary)',margin:0}}>{s.l}</p>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',borderTop:'1px solid var(--border-color)'}}>
            <div style={{padding:'20px',borderRight:'1px solid var(--border-color)'}}>
              <h3 style={{fontSize:'14px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 12px'}}>Carga horaria docentes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {dashData.cargaDocentes?.slice(0,8).map((d:any,i:number)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'12px',color:'var(--text-primary)',fontWeight:'500',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombre}</span>
                      <span style={{fontSize:'11px',color:'var(--text-secondary)',marginLeft:'8px',flexShrink:0}}>{d.horas_asignadas}/{d.horas_max_semana}h</span>
                    </div>
                    <div style={{background:'var(--bg-card-hover)',borderRadius:'9999px',height:'5px'}}>
                      <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(d.porcentaje_carga)>90?'#dc2626':parseFloat(d.porcentaje_carga)>60?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(d.porcentaje_carga),100)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'20px'}}>
              <h3 style={{fontSize:'14px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 12px'}}>Ocupación de ambientes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {dashData.ocupacionAmbientes?.slice(0,8).map((a:any,i:number)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'12px',color:'var(--text-primary)',fontWeight:'500'}}>{a.codigo} — {a.nombre}</span>
                      <span style={{fontSize:'11px',color:'var(--text-secondary)'}}>{a.porcentaje}%</span>
                    </div>
                    <div style={{background:'var(--bg-card-hover)',borderRadius:'9999px',height:'5px'}}>
                      <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(a.porcentaje)>70?'#dc2626':parseFloat(a.porcentaje)>40?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(a.porcentaje),100)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{padding:'16px 20px',borderTop:'1px solid var(--border-color)',textAlign:'right',display:'flex',justifyContent:'flex-end',gap:'8px',flexWrap:'wrap'}}>
            <button className="btn-secondary" onClick={exportarCSV}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              CSV
            </button>
            <button className="btn-secondary" onClick={exportarExcelUNT} style={{ background: '#eef2ff', color: '#4f46e5', borderColor: '#c7d2fe' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Excel Formato UNT
            </button>
            <button className="btn-secondary" onClick={exportarPDF}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              PDF
            </button>
          </div>
        </div>
      )}

      {!hasSearched && !loading && (
        <div style={{textAlign:'center',padding:'60px',color:'var(--text-secondary)'}}>
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{margin:'0 auto 12px',display:'block',opacity:0.4}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p style={{fontSize:'15px',margin:'0 0 4px'}}>Configure y previsualice el reporte</p>
          <p style={{fontSize:'13px',margin:0}}>Seleccione el tipo de reporte y haga clic en Previsualizar</p>
        </div>
      )}
    </div>
  );
}
