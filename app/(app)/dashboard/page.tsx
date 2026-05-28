'use client';
import { useState, useEffect } from 'react';
import { useUser } from '../layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useTheme } from '@/lib/theme';
import { Users, Building2, BookOpen, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Colores dinámicos para los gráficos
const LIGHT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
const DARK_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#22d3ee'];

// Colores suaves para elementos secundarios
const SOFT_COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];

type DashboardCargaDocente = {
  nombre: string;
  categoria: string;
  condicion: string;
  horas_max_semana: number;
  horas_asignadas: number;
  porcentaje_carga: number;
};

type DashboardOcupacion = {
  nombre: string;
  tipo: string;
  codigo: string;
  horas_usadas: number;
  porcentaje: number;
};

type DashboardCategoria = {
  categoria: string;
  condicion: string;
  docentes: number | string;
};

type DashboardAulaTipo = {
  tipo: string;
  ambientes: number | string;
};

type DashboardStats = {
  totalDocentes?: number;
  totalCursos?: number;
  totalAmbientes?: number;
  totalAsignaciones?: number;
  globalDocentes?: number;
  globalCursos?: number;
  globalAmbientes?: number;
  totalGrupos?: number;
  gruposConHorario?: number;
  gruposSinHorario?: number;
};

type DashboardCiclo = { id: string; nombre: string; activo?: boolean };
type DashboardSlot = { hora_inicio: string; hora_fin: string };
type DashboardDistribucion = { dia: string; cantidad: number };
type DashboardAsignacion = { hora_inicio: string; hora_fin: string; cantidad: number };
type DashboardSesion = { tipo: string; cantidad: number };
type DashboardSobrecarga = { id?: string; nombre: string; horas_asignadas: number; horas_max_semana: number; porcentaje_carga?: number };
type DashboardCapacidad = { id?: string; curso: string; numero_grupo: number; ambiente_codigo: string; capacidad: number; num_alumnos: number };
type DashboardProgramacion = { id: string; nombre: string; estado: string; fase: number };

type DashboardData = {
  ciclo?: DashboardCiclo;
  ciclos?: DashboardCiclo[];
  slots?: DashboardSlot[];
  stats?: DashboardStats;
  cargaDocentes?: DashboardCargaDocente[];
  ocupacionAmbientes?: DashboardOcupacion[];
  distribucionDias?: DashboardDistribucion[];
  asignacionesPorSlot?: DashboardAsignacion[];
  asignacionesPorTipo?: DashboardSesion[];
  docentesSobrecarga?: DashboardSobrecarga[];
  capacidadExcedida?: DashboardCapacidad[];
  docentesPorCategoria?: DashboardCategoria[];
  aulasPorTipo?: DashboardAulaTipo[];
  conflictosPendientes?: number;
};

type DashboardApiResponse = DashboardData & { error?: string };
type ProgramacionesApiResponse = { data?: DashboardProgramacion[] };

const TIPO_SESION_LABELS: Record<string, string> = {
  teoria: 'Teoria',
  practica: 'Practica',
  laboratorio: 'Laboratorio',
};

function formatTime(value?: string) {
  if (!value) return '';
  return value.slice(0, 5);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [cicloId, setCicloId] = useState('');
  const [programaciones, setProgramaciones] = useState<DashboardProgramacion[]>([]);

  const user = useUser();
  const isDocente = user?.rol === 'docente';
  const { darkMode } = useTheme();

  const fetchDashboard = async (selectedCicloId?: string): Promise<DashboardApiResponse | null> => {
    const url = selectedCicloId ? `/api/dashboard?ciclo_id=${selectedCicloId}` : '/api/dashboard';
    const res = await fetch(url);
    const text = await res.text();
    if (!text) {
      if (!res.ok) {
        throw new Error(`Respuesta vacia del servidor (${res.status})`);
      }
      console.warn(`Respuesta vacia del servidor en ${url}`);
      return null;
    }
    let payload: DashboardApiResponse | null = null;
    try {
      payload = JSON.parse(text) as DashboardApiResponse;
    } catch {
      throw new Error('Respuesta no valida del servidor');
    }
    if (!res.ok) {
      throw new Error(payload?.error || 'No se pudo cargar el dashboard');
    }
    let finalPayload = payload;

    const statsEmpty = (payload?.stats?.totalAsignaciones || 0) === 0;
    if (statsEmpty && payload?.ciclo?.id) {
      try {
        const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${payload.ciclo.id}`).then(r => r.json() as Promise<ProgramacionesApiResponse>);
        const progs = progsRes.data || [];
        const selectedProg = progs.find((p) => p.estado === 'publicado') || progs[0];
        if (selectedProg) {
          const exportRes = await fetch(`/api/horarios/programaciones/${selectedProg.id}/exportar`);
          if (exportRes.ok) {
            const exportData = await exportRes.json();
            const asignaciones = exportData.asignaciones || [];

            if (asignaciones.length > 0) {
              const totalSlots = (payload?.slots?.length || 0) * 5 || 1;

              const docenteMap = new Map<string, DashboardCargaDocente>();
              const cursosSet = new Set<string>();
              const ambientesMap = new Map<string, DashboardOcupacion>();
              const diasMap = new Map<string, number>();
              const tipoMap = new Map<string, number>();
              const slotMap = new Map<string, number>();

              asignaciones.forEach((a: { docente_id?: string; docente_nombre?: string; curso_codigo?: string; aula?: string; dia?: string; tipo_sesion?: string; tipo?: string; hora_inicio?: string; hora_fin?: string; }) => {
                if (a.docente_id) {
                  const current: DashboardCargaDocente = docenteMap.get(a.docente_id) || {
                    nombre: a.docente_nombre || 'Docente',
                    categoria: 'auxiliar',
                    condicion: 'contratado',
                    horas_max_semana: 20,
                    horas_asignadas: 0,
                    porcentaje_carga: 0,
                  };
                  current.horas_asignadas += 1;
                  current.porcentaje_carga = Math.round((current.horas_asignadas * 100) / (current.horas_max_semana || 1));
                  docenteMap.set(a.docente_id, current);
                }
                if (a.curso_codigo) cursosSet.add(a.curso_codigo);
                if (a.aula) {
                  const amb: DashboardOcupacion = ambientesMap.get(a.aula) || { nombre: a.aula, tipo: 'aula', codigo: a.aula, horas_usadas: 0, porcentaje: 0 };
                  amb.horas_usadas += 1;
                  amb.porcentaje = Math.round((amb.horas_usadas * 1000) / totalSlots) / 10;
                  ambientesMap.set(a.aula, amb);
                }
                if (a.dia) diasMap.set(a.dia, (diasMap.get(a.dia) || 0) + 1);
                const tipo = a.tipo_sesion || a.tipo || 'teoria';
                tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1);
                if (a.hora_inicio && a.hora_fin) {
                  const key = `${a.hora_inicio}-${a.hora_fin}`;
                  slotMap.set(key, (slotMap.get(key) || 0) + 1);
                }
              });

              finalPayload = {
                ...payload,
                stats: {
                  ...payload.stats,
                  totalDocentes: docenteMap.size,
                  totalCursos: cursosSet.size,
                  totalAmbientes: ambientesMap.size,
                  totalAsignaciones: asignaciones.length,
                },
                cargaDocentes: Array.from(docenteMap.values()).sort((a, b) => (b.porcentaje_carga || 0) - (a.porcentaje_carga || 0)),
                ocupacionAmbientes: Array.from(ambientesMap.values()).sort((a, b) => (b.porcentaje || 0) - (a.porcentaje || 0)),
                distribucionDias: Array.from(diasMap.entries()).map(([dia, cantidad]) => ({ dia, cantidad })),
                asignacionesPorTipo: Array.from(tipoMap.entries()).map(([tipo, cantidad]) => ({ tipo, cantidad })),
                asignacionesPorSlot: Array.from(slotMap.entries()).map(([key, cantidad]) => {
                  const [hora_inicio, hora_fin] = key.split('-');
                  return { hora_inicio, hora_fin, cantidad };
                }),
              };
            }
          }
        }
      } catch (err) {
        console.warn('Fallback dashboard export failed', err);
      }
    }

    return finalPayload;
  };

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const finalPayload = await fetchDashboard();
        setData(finalPayload);
        setCicloId(finalPayload?.ciclo?.id || '');
      } catch (err) {
        console.error(err);
        alert('No se pudo cargar el dashboard. Revisa tu sesion e intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    const loadProgramaciones = async () => {
      try {
        const res = await fetch('/api/horarios/programaciones');
        const text = await res.text();
        if (!text) return;
        let payload: ProgramacionesApiResponse | null = null;
        try {
          payload = JSON.parse(text) as ProgramacionesApiResponse;
        } catch {
          return;
        }
        if (res.ok) {
          setProgramaciones(payload.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadDashboard();
    loadProgramaciones();
  }, []);

  async function recargar(id: string) {
    setCicloId(id);
    setLoading(true);
    try {
      const finalPayload = await fetchDashboard(id);
      setData(finalPayload);
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar el dashboard. Revisa tu sesion e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  async function generarReporteGestion() {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const ciclo = data?.ciclo;
      const dashData = data;
      const reportStats = dashData?.stats ?? {};

      const fechaEmision = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
      const horaEmision = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const coberturaGrupos = reportStats.totalGrupos ? Math.round(((reportStats.gruposConHorario ?? 0) / reportStats.totalGrupos) * 100) : 0;
      const ocupacionGlobal = reportStats.globalAmbientes && dashData?.slots?.length
        ? Math.round(((reportStats.totalAsignaciones ?? 0) / (reportStats.globalAmbientes * dashData.slots.length * 5)) * 100)
        : 0;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 297, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 14, 15);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE DE GESTIÓN DE HORARIOS', 14, 36);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 14, 43);
      doc.text(`Ciclo: ${ciclo?.nombre || 'Sin ciclo activo'}`, 14, 50);
      doc.text(`Fecha de emisión: ${fechaEmision} ${horaEmision}`, 14, 57);
      doc.text(`Usuario: ${user?.nombre || ''} ${user?.apellidos || ''}`, 14, 64);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 70, 283, 70);

      let y = 80;

      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('RESUMEN EJECUTIVO', 14, y); y += 6;

      doc.setFontSize(9); doc.setFont('helvetica','normal');
      const stats = [
        ['Docentes programados', `${reportStats.totalDocentes ?? 0} de ${reportStats.globalDocentes||0} (${Math.round(((reportStats.totalDocentes ?? 0) / (reportStats.globalDocentes||1))*100)}%)`],
        ['Cursos programados', `${reportStats.totalCursos ?? 0} de ${reportStats.globalCursos||0} (${Math.round(((reportStats.totalCursos ?? 0) / (reportStats.globalCursos||1))*100)}%)`],
        ['Ambientes usados', `${reportStats.totalAmbientes ?? 0} de ${reportStats.globalAmbientes||0} (${Math.round(((reportStats.totalAmbientes ?? 0) / (reportStats.globalAmbientes||1))*100)}%)`],
        ['Cobertura de grupos', `${reportStats.gruposConHorario || 0} de ${reportStats.totalGrupos || 0} (${coberturaGrupos}%)`],
        ['Ocupación global', `${ocupacionGlobal}%`],
        ['Total asignaciones', `${reportStats.totalAsignaciones ?? 0}`],
      ];
      autoTable(doc, {
        startY: y, head:[['Indicador','Valor']],
        body: stats, theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85]},
        margin:{left:14,right:14},
        tableWidth: 120,
      });
      const reportDoc = doc as typeof doc & { lastAutoTable?: { finalY?: number } };
      y = (reportDoc.lastAutoTable?.finalY || y) + 8;

      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('ALERTAS Y OBSERVACIONES', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Indicador','Detalle']],
        body: [
          ['Grupos sin horario', `${reportStats.gruposSinHorario || 0}`],
          ['Docentes sobrecargados', `${dashData?.docentesSobrecarga?.length || 0}`],
          ['Capacidad excedida', `${dashData?.capacidadExcedida?.length || 0}`],
          ['Conflictos pendientes', `${dashData?.conflictosPendientes || 0}`],
        ],
        theme:'striped',
        headStyles:{fillColor:[148, 163, 184], textColor:[15, 23, 42], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85]},
        margin:{left:14,right:14},
        tableWidth: 120,
      });
      y = (reportDoc.lastAutoTable?.finalY || y) + 10;

      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('CARGA HORARIA POR DOCENTE', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Docente','Categoría','Condición','Horas Asignadas','Horas Máx.','% Carga']],
        body: (dashData?.cargaDocentes || []).map((d) => [
          d.nombre || '', d.categoria ? d.categoria.replace('_',' ') : '', d.condicion || '',
          `${d.horas_asignadas ?? 0}h`, `${d.horas_max_semana ?? 0}h`, `${d.porcentaje_carga||0}%`
        ])||[],
        theme:'striped', 
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 3:{halign:'center'}, 4:{halign:'center'}, 5:{halign:'center'} },
        margin:{left:14,right:14},
      });
      y = (reportDoc.lastAutoTable?.finalY || y) + 10;

      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('OCUPACIÓN DE AMBIENTES', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Ambiente','Tipo','Horas Usadas','% Ocupación']],
        body: (dashData?.ocupacionAmbientes || []).map((a) => [
          a.nombre || '', a.tipo || '', `${a.horas_usadas ?? 0}h`, `${a.porcentaje ?? 0}%`
        ])||[],
        theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold', halign:'center'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 2:{halign:'center'}, 3:{halign:'center'} },
        margin:{left:14,right:14},
      });
      y = (reportDoc.lastAutoTable?.finalY || y) + 10;

      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('DISTRIBUCIÓN POR DÍA', 14, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Día','Asignaciones']],
        body: dashData?.distribucionDias?.map((d) => [
          d.dia, d.cantidad
        ])||[],
        theme:'striped',
        headStyles:{fillColor:[30, 41, 59], textColor:[255, 255, 255], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        margin:{left:14,right:14},
      });

      // Seccion detallada
      doc.addPage();
      doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('ANEXO: DETALLE DE INCIDENCIAS', 14, 20);

      let detailY = 30;
      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('DOCENTES CON SOBRECARGA', 14, detailY); detailY += 6;
      autoTable(doc, {
        startY: detailY,
        head:[['Docente','Horas Asignadas','Horas Máx.','% Carga']],
        body: dashData?.docentesSobrecarga?.map((d) => [
          d.nombre, `${d.horas_asignadas}h`, `${d.horas_max_semana}h`, `${d.porcentaje_carga||0}%`
        ])||[['Sin registros','-','-','-']],
        theme:'striped',
        headStyles:{fillColor:[226, 232, 240], textColor:[15, 23, 42], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 1:{halign:'center'}, 2:{halign:'center'}, 3:{halign:'center'} },
        margin:{left:14,right:14},
      });
      detailY = (reportDoc.lastAutoTable?.finalY || detailY) + 8;

      doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
      doc.text('SOBRECUPO EN AMBIENTES', 14, detailY); detailY += 6;
      autoTable(doc, {
        startY: detailY,
        head:[['Curso','Grupo','Ambiente','Capacidad','Inscritos']],
        body: dashData?.capacidadExcedida?.map((c) => [
          c.curso, `G${c.numero_grupo}`, c.ambiente_codigo, c.capacidad, c.num_alumnos
        ])||[['Sin registros','-','-','-','-']],
        theme:'striped',
        headStyles:{fillColor:[226, 232, 240], textColor:[15, 23, 42], fontStyle:'bold'},
        bodyStyles:{textColor:[51, 65, 85], fontSize:8},
        columnStyles: { 3:{halign:'center'}, 4:{halign:'center'} },
        margin:{left:14,right:14},
      });

      // Capture charts with html2canvas
      try {
        const html2canvas = (await import('html2canvas')).default;
        const chartDensidad = document.getElementById('chart-densidad');


        const addChartPage = async (title: string, element: HTMLElement) => {
          doc.addPage();
          doc.setFontSize(14); doc.setFont('helvetica','bold'); doc.setTextColor(30, 41, 59);
          doc.text('GRÁFICOS ESTADÍSTICOS', 14, 20);
          doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(71, 85, 105);
          doc.text(title, 14, 28);

          const captureFixedElement = async (el: HTMLElement) => {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.style.position = 'fixed';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = '680px';
            clone.style.height = '340px';
            clone.style.background = '#ffffff';
            clone.style.padding = '20px';
            clone.style.borderRadius = '0';
            clone.style.boxShadow = 'none';
            document.body.appendChild(clone);

            // Wait for SVG render
            await new Promise(resolve => setTimeout(resolve, 250));

            const canvas = await html2canvas(clone, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            });

            document.body.removeChild(clone);
            return canvas;
          };

          const canvas = await captureFixedElement(element);
          const img = canvas.toDataURL('image/png');
          doc.addImage(img, 'PNG', 14, 36, 260, Math.min(140, (canvas.height * 260) / canvas.width));

          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text('Documento generado por el Sistema de Horarios Académicos UNT. Uso interno.', 14, 200);
        };

        if (chartDensidad) {
          await addChartPage('Densidad de clases por día', chartDensidad);
        }
      } catch (err) {
        console.warn('Could not export charts:', err);
      }

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Documento generado por el Sistema de Horarios Académicos UNT. Uso interno.', 14, 200);

      doc.save(`reporte-gestion-${ciclo?.nombre||'unt'}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error al generar el reporte');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return (
    <div style={{padding:'40px',textAlign:'center', background: 'var(--bg-body)', minHeight: '100vh'}}>
      <div style={{width:'40px',height:'40px',border:'3px solid var(--border-color)',borderTop:'3px solid var(--color-primary)',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 12px'}} />
      <p style={{color:'var(--text-muted)'}}>Cargando dashboard...</p>
    </div>
  );

  const categoriaData = data?.docentesPorCategoria?.map((h) => ({
    name: `${h.categoria.replace('_', ' ')} (${h.condicion})`,
    horas: Number(h.docentes || 0),
    condicion: h.condicion,
  })) || [];

  const aulasData = data?.aulasPorTipo?.map((a) => ({
    name: a.tipo,
    cantidad: Number(a.ambientes),
  })) || [];

  const ambientesConEspacio = [...(data?.ocupacionAmbientes ?? [])]
    .sort((a, b) => (a.porcentaje || 0) - (b.porcentaje || 0))
    .slice(0, 9)
    .map((a) => ({
      name: a.codigo,
      porcentaje: Number(a.porcentaje),
      tipo: a.tipo,
    }));

  const dashboardStats = data?.stats ?? {};
  const gruposTotal = dashboardStats.totalGrupos || 0;
  const gruposConHorario = dashboardStats.gruposConHorario || 0;
  const gruposSinHorario = dashboardStats.gruposSinHorario || 0;
  const porcentajeGrupos = gruposTotal > 0 ? Math.round((gruposConHorario / gruposTotal) * 100) : 0;
  const totalSlots = (dashboardStats.globalAmbientes || 0) * (data?.slots?.length || 0) * 5;
  const ocupacionPromedio = totalSlots > 0 ? Math.round(((dashboardStats.totalAsignaciones || 0) / totalSlots) * 100) : 0;

  const cargaDocentes = data?.cargaDocentes ?? [];
  const ciclos = data?.ciclos ?? [];
  const docentesSobrecargaLista = data?.docentesSobrecarga ?? [];
  const capacidadExcedidaLista = data?.capacidadExcedida ?? [];
  const docentesConEspacio = [...cargaDocentes]
    .sort((a, b) => (a.porcentaje_carga || 0) - (b.porcentaje_carga || 0))
    .slice(0, 10);

  const asignacionesPorSlot = data?.asignacionesPorSlot?.map((s) => ({
    name: `${formatTime(s.hora_inicio)}-${formatTime(s.hora_fin)}`,
    cantidad: Number(s.cantidad),
  })) || [];

  const tiposSesion = data?.asignacionesPorTipo?.map((t) => ({
    name: TIPO_SESION_LABELS[t.tipo] || t.tipo,
    value: Number(t.cantidad),
  })) || [];

  const conflictosPendientes = data?.conflictosPendientes || 0;
  const hasAlertas = gruposSinHorario > 0 || docentesSobrecargaLista.length > 0 || capacidadExcedidaLista.length > 0 || conflictosPendientes > 0;
  const hasDetalles = docentesSobrecargaLista.length > 0 || capacidadExcedidaLista.length > 0;

  const COLORS = darkMode ? DARK_COLORS : LIGHT_COLORS;

  const tooltipStyle = {
    borderRadius: '12px',
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
    background: darkMode ? '#1e293b' : 'white',
    color: darkMode ? '#f8fafc' : '#1e293b'
  };

  if (isDocente) {
    const miCarga = data?.cargaDocentes?.find((d) => d.nombre?.toLowerCase().includes(user?.nombre?.toLowerCase() || '') || d.nombre?.toLowerCase().includes(user?.apellidos?.toLowerCase() || ''));
    const programacionesActivas = programaciones.filter((p) => p.estado !== 'publicado' && p.estado !== 'cancelado');

    return (
      <div className="dashboard-page" style={{padding:'32px'}}>
        <div style={{marginBottom:'28px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px', color: 'var(--text-primary)'}}>Bienvenido, {user?.nombre}</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Panel de control — Perfil docente</p>
        </div>

        {/* Stats Row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'16px',marginBottom:'24px'}}>
          <div className="stat-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius:'14px', padding:'20px', display:'flex', alignItems:'center', gap:'16px'}}>
            <div className="stat-icon" style={{background: darkMode ? 'rgba(148,163,184,0.1)' : '#f1f5f9', padding:'12px', borderRadius:'12px'}}>
              <Clock size={22} strokeWidth={1.5} color="var(--text-secondary)" />
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color: 'var(--text-primary)',margin:'0 0 2px'}}>{miCarga ? `${miCarga.horas_asignadas}h` : '0h'}</p>
              <p style={{fontSize:'13px',color: 'var(--text-muted)',margin:0}}>Horas asignadas ({data?.ciclo?.nombre || 'Ciclo actual'})</p>
            </div>
          </div>
          <div className="stat-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius:'14px', padding:'20px', display:'flex', alignItems:'center', gap:'16px'}}>
            <div className="stat-icon" style={{background: darkMode ? 'rgba(148,163,184,0.1)' : '#f1f5f9', padding:'12px', borderRadius:'12px'}}>
              <CheckCircle2 size={22} strokeWidth={1.5} color="var(--text-secondary)" />
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color: 'var(--text-primary)',margin:'0 0 2px'}}>{miCarga ? `${miCarga.horas_max_semana}h` : '—'}</p>
              <p style={{fontSize:'13px',color: 'var(--text-muted)',margin:0}}>Límite de horas semanales</p>
            </div>
          </div>
          <div className="stat-card" style={{background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius:'14px', padding:'20px', display:'flex', alignItems:'center', gap:'16px'}}>
            <div className="stat-icon" style={{background: darkMode ? 'rgba(148,163,184,0.1)' : '#f1f5f9', padding:'12px', borderRadius:'12px'}}>
              <BookOpen size={22} strokeWidth={1.5} color="var(--text-secondary)" />
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color: 'var(--text-primary)',margin:'0 0 2px'}}>{programacionesActivas.length}</p>
              <p style={{fontSize:'13px',color: 'var(--text-muted)',margin:0}}>Programaciones activas</p>
            </div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px'}}>
          <div className="card" style={{padding:'32px',textAlign:'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)'}}>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>🎓</div>
            <h2 style={{fontSize:'20px',fontWeight:'600',color: 'var(--text-primary)',margin:'0 0 8px'}}>Tu portal académico</h2>
            <p style={{color: 'var(--text-secondary)',fontSize:'14px',margin:'0 auto 24px'}}>Desde aquí podrás ver tu horario publicado final y consultar tus asignaciones de clase.</p>
            <div style={{display:'flex',justifyContent:'center',gap:'16px'}}>
              <a href="/horarios" className="btn-primary" style={{textDecoration:'none',padding:'8px 24px'}}>Ver mi horario general</a>
            </div>
          </div>

          <div className="card" style={{padding:'24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)'}}>
            <h3 style={{fontSize:'16px',fontWeight:'600',color: 'var(--text-primary)',margin:'0 0 16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <Clock size={18} strokeWidth={2} /> Disponibilidad Pendiente
            </h3>
            {programacionesActivas.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {programacionesActivas.map((p) => (
                  <div key={p.id} style={{padding:'12px',background: 'var(--bg-card-hover)',borderRadius:'8px',border:'1px solid var(--border-color)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <h4 style={{margin:'0 0 4px',fontSize:'14px',fontWeight:'600',color: 'var(--text-primary)'}}>{p.nombre}</h4>
                      <p style={{margin:0,fontSize:'12px',color: 'var(--text-muted)'}}>Fase actual: {p.fase}</p>
                    </div>
                    <a href={`/horarios/${p.id}/disponibilidad`} style={{textDecoration:'none'}}>
                      <button className="btn-primary" style={{padding:'6px 12px',fontSize:'12px'}}>Marcar disponibilidad</button>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{padding:'24px',textAlign:'center',background: 'var(--bg-card-hover)',borderRadius:'8px',border:'1px dashed var(--border-color)'}}>
                <p style={{margin:0,fontSize:'13px',color: 'var(--text-muted)'}}>No hay programaciones activas en este momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page" style={{padding:'32px'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px', flexWrap:'wrap', gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px', color: 'var(--text-primary)'}}>Dashboard</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Panel de control — Gestión de horarios académicos</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px', flexWrap:'wrap'}}>
          <select className="form-input" style={{width:'auto',minWidth:'180px'}} value={cicloId} onChange={e => recargar(e.target.value)}>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} {c.activo ? '(Activo)' : ''}</option>
            ))}
          </select>
          <div style={{background: darkMode ? 'rgba(16,185,129,0.1)' : '#dcfce7', color: darkMode ? '#34d399' : '#166534', padding:'6px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:'600', border: '1px solid ' + (darkMode ? 'rgba(16,185,129,0.2)' : '#bbf7d0')}}>
            {data?.ciclo?.nombre || 'Sin ciclo'}
          </div>
          <button className="btn-primary" onClick={generarReporteGestion} disabled={exporting} style={{display:'flex',alignItems:'center',gap:'8px', padding:'8px 16px', border:'none', cursor: exporting ? 'not-allowed' : 'pointer'}}>
            {exporting ? 'Generando...' : (
              <>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Exportar Reporte
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'20px',marginBottom:'32px'}}
      >
        {[
          { label: 'Docentes programados', value: data?.stats?.totalDocentes, global: data?.stats?.globalDocentes, color: darkMode ? '#94a3b8' : '#475569', bg: darkMode ? 'rgba(148,163,184,0.1)' : '#f8fafc', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
          { label: 'Cursos programados', value: data?.stats?.totalCursos, global: data?.stats?.globalCursos, color: darkMode ? '#94a3b8' : '#475569', bg: darkMode ? 'rgba(148,163,184,0.1)' : '#f8fafc', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { label: 'Ambientes usados', value: data?.stats?.totalAmbientes, global: data?.stats?.globalAmbientes, color: darkMode ? '#94a3b8' : '#475569', bg: darkMode ? 'rgba(148,163,184,0.1)' : '#f8fafc', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
          { label: 'Total Asignaciones', value: data?.stats?.totalAsignaciones, global: null, color: darkMode ? '#94a3b8' : '#475569', bg: darkMode ? 'rgba(148,163,184,0.1)' : '#f8fafc', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        ].map((stat, i) => {
          const statValue = stat.value ?? 0;
          const pct = stat.global ? Math.round((statValue / stat.global) * 100) || 0 : null;
          return (
          <motion.div 
            key={i} 
            className="card" 
            style={{padding:'20px', position:'relative', overflow:'hidden', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
            whileHover={{ scale: 1.02, boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{position:'absolute', top:'-20px', right:'-20px', width:'100px', height:'100px', background:stat.color, opacity:0.05, borderRadius:'50%'}} />
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px'}}>
              <div style={{background:stat.bg, padding:'10px', borderRadius:'12px'}}>
                <svg width="24" height="24" fill="none" stroke={stat.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
              {pct !== null && (
                <div style={{background: pct > 80 ? (darkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7') : pct > 40 ? (darkMode ? 'rgba(245,158,11,0.15)' : '#fef9c3') : (darkMode ? 'rgba(148,163,184,0.15)' : '#f1f5f9'), color: pct > 80 ? (darkMode ? '#34d399' : '#166534') : pct > 40 ? (darkMode ? '#fbbf24' : '#854d0e') : (darkMode ? '#94a3b8' : '#475569'), padding:'4px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:'700'}}>
                  {pct}% del total
                </div>
              )}
            </div>
            <div>
              <p style={{fontSize:'32px',fontWeight:'800',color: 'var(--text-primary)',margin:'0 0 4px', lineHeight:1}}>{stat.value ?? '0'}</p>
              <p style={{fontSize:'14px',color: 'var(--text-secondary)',margin:0, fontWeight:500}}>{stat.label}</p>
              {stat.global !== null && <p style={{fontSize:'12px',color:'var(--text-muted)',margin:'4px 0 0 0'}}>de {stat.global} registrados en el sistema</p>}
            </div>
          </motion.div>
        )})}
      </motion.div>

      {/* Indicadores operativos */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'16px',marginBottom:'24px'}}>
        <div className="card" style={{padding:'18px', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:'var(--text-muted)'}}>Cobertura de grupos</span>
            <span style={{fontSize:'12px',fontWeight:'700',color:porcentajeGrupos >= 85 ? '#166534' : porcentajeGrupos >= 60 ? '#854d0e' : '#b91c1c'}}>{porcentajeGrupos}%</span>
          </div>
          <p style={{fontSize:'26px',fontWeight:'800',margin:'0 0 6px',color:'var(--text-primary)'}}>{gruposConHorario} / {gruposTotal}</p>
          <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0}}>Grupos con horario asignado</p>
        </div>

        <div className="card" style={{padding:'18px', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:'var(--text-muted)'}}>Ocupacion global</span>
            <span style={{fontSize:'12px',fontWeight:'700',color:ocupacionPromedio >= 75 ? '#166534' : ocupacionPromedio >= 45 ? '#854d0e' : 'var(--text-muted)'}}>{ocupacionPromedio}%</span>
          </div>
          <p style={{fontSize:'26px',fontWeight:'800',margin:'0 0 6px',color:'var(--text-primary)'}}>{data?.stats?.totalAsignaciones || 0}</p>
          <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0}}>Asignaciones vs. {totalSlots || 0} slots disponibles</p>
        </div>

        <div className="card" style={{padding:'18px', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:'var(--text-muted)'}}>Conflictos pendientes</span>
            <span style={{fontSize:'12px',fontWeight:'700',color:conflictosPendientes > 0 ? '#b91c1c' : '#166534'}}>{conflictosPendientes}</span>
          </div>
          <p style={{fontSize:'26px',fontWeight:'800',margin:'0 0 6px',color:'var(--text-primary)'}}>{conflictosPendientes}</p>
          <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0}}>Incidencias sin resolver</p>
        </div>

        <div className="card" style={{padding:'18px', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:'var(--text-muted)'}}>Capacidad excedida</span>
            <span style={{fontSize:'12px',fontWeight:'700',color:capacidadExcedidaLista.length > 0 ? '#b45309' : '#166534'}}>{capacidadExcedidaLista.length}</span>
          </div>
          <p style={{fontSize:'26px',fontWeight:'800',margin:'0 0 6px',color:'var(--text-primary)'}}>{capacidadExcedidaLista.length}</p>
          <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0}}>Asignaciones con sobrecupo</p>
        </div>
      </div>

      {/* Alertas y acciones */}
      {(hasAlertas || hasDetalles) && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(360px, 1fr))',gap:'24px',marginBottom:'24px'}}>
          {hasAlertas && (
            <div className="card dashboard-alert-card" style={{padding:'20px', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}>
              <h3 style={{fontSize:'16px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 14px',display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{background: darkMode ? 'rgba(239,68,68,0.15)' : '#fee2e2', padding:'6px', borderRadius:'8px', color: darkMode ? '#f87171' : '#b91c1c'}}>⚠️</span> Alertas operativas
              </h3>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {gruposSinHorario > 0 && (
                  <div className="dashboard-alert-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',border:'1px solid var(--border-color)',borderRadius:'8px',background:'var(--bg-card-hover)'}}>
                    <div>
                      <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Grupos sin horario</p>
                      <p style={{margin:0,fontSize:'12px',color:'var(--text-muted)'}}>Pendientes de asignar en el ciclo</p>
                    </div>
                    <span style={{fontSize:'14px',fontWeight:'700',color:darkMode ? '#f87171' : '#b91c1c'}}>{gruposSinHorario}</span>
                  </div>
                )}

                {docentesSobrecargaLista.length > 0 && (
                  <div className="dashboard-alert-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',border:'1px solid var(--border-color)',borderRadius:'8px',background:'var(--bg-card-hover)'}}>
                    <div>
                      <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Docentes sobrecargados</p>
                      <p style={{margin:0,fontSize:'12px',color:'var(--text-muted)'}}>Superan horas maximas</p>
                    </div>
                    <span style={{fontSize:'14px',fontWeight:'700',color:darkMode ? '#fbbf24' : '#b45309'}}>{docentesSobrecargaLista.length}</span>
                  </div>
                )}

                {capacidadExcedidaLista.length > 0 && (
                  <div className="dashboard-alert-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',border:'1px solid var(--border-color)',borderRadius:'8px',background:'var(--bg-card-hover)'}}>
                    <div>
                      <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Capacidad excedida</p>
                      <p style={{margin:0,fontSize:'12px',color:'var(--text-muted)'}}>Aulas con sobrecupo</p>
                    </div>
                    <span style={{fontSize:'14px',fontWeight:'700',color:darkMode ? '#fbbf24' : '#b45309'}}>{capacidadExcedidaLista.length}</span>
                  </div>
                )}

                {conflictosPendientes > 0 && (
                  <div className="dashboard-alert-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',border:'1px solid var(--border-color)',borderRadius:'8px',background:'var(--bg-card-hover)'}}>
                    <div>
                      <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Conflictos pendientes</p>
                      <p style={{margin:0,fontSize:'12px',color:'var(--text-muted)'}}>Registros sin resolver</p>
                    </div>
                    <span style={{fontSize:'14px',fontWeight:'700',color:darkMode ? '#f87171' : '#b91c1c'}}>{conflictosPendientes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {hasDetalles && (
            <div className="card dashboard-detail-card" style={{padding:'20px', border:'1px solid var(--border-color)', background: 'var(--bg-card)'}}>
              <h3 style={{fontSize:'16px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 14px',display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{background: darkMode ? 'rgba(14,165,233,0.15)' : '#e0f2fe', padding:'6px', borderRadius:'8px', color: darkMode ? '#38bdf8' : '#0369a1'}}>📌</span> Detalles prioritarios
              </h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr',gap:'12px'}}>
                {docentesSobrecargaLista.length > 0 && (
                  <div className="dashboard-detail-item" style={{border:'1px solid var(--border-color)',borderRadius:'10px',padding:'12px',background:'var(--bg-card-hover)'}}>
                    <p style={{margin:'0 0 8px',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Docentes sobrecarga</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                      {docentesSobrecargaLista.slice(0, 4).map((d) => (
                        <div key={d.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span style={{fontSize:'12px',color:'var(--text-primary)'}}>{d.nombre}</span>
                          <span style={{fontSize:'12px',fontWeight:'600',color: darkMode ? '#fbbf24' : '#b45309'}}>{d.horas_asignadas} / {d.horas_max_semana}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {capacidadExcedidaLista.length > 0 && (
                  <div className="dashboard-detail-item" style={{border:'1px solid var(--border-color)',borderRadius:'10px',padding:'12px',background:'var(--bg-card-hover)'}}>
                    <p style={{margin:'0 0 8px',fontSize:'13px',fontWeight:'600',color:'var(--text-primary)'}}>Aulas con sobrecupo</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                      {capacidadExcedidaLista.slice(0, 4).map((c) => (
                        <div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span style={{fontSize:'12px',color:'var(--text-primary)'}}>{c.curso} · G{c.numero_grupo}</span>
                          <span style={{fontSize:'12px',fontWeight:'600',color: darkMode ? '#fbbf24' : '#b45309'}}>{c.num_alumnos}/{c.capacidad}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Widget de Fases Activas */}
      {programaciones.filter((p) => p.estado !== 'cancelado').length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="card" 
          style={{ marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} strokeWidth={2} /> Programaciones Activas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {programaciones.filter((p) => p.estado !== 'cancelado').map((p, idx) => {
              const faseBadge: Record<number, { label: string; color: string; bg: string; url: string }> = {
                1: { label: 'Fase 1 · Carga', color: darkMode ? '#60a5fa' : '#1d4ed8', bg: darkMode ? 'rgba(59,130,246,0.1)' : '#dbeafe', url: `/horarios/crear` },
                2: { label: 'Fase 2 · Disponibilidad', color: darkMode ? '#a78bfa' : '#7c3aed', bg: darkMode ? 'rgba(139,92,246,0.1)' : '#ede9fe', url: `/horarios/${p.id}/disponibilidad` },
                3: { label: 'Fase 3 · Programación CSP', color: darkMode ? '#fbbf24' : '#b45309', bg: darkMode ? 'rgba(251,191,36,0.1)' : '#fef3c7', url: `/horarios/${p.id}/programar` },
                4: { label: 'Fase 4 · Publicación', color: darkMode ? '#34d399' : '#065f46', bg: darkMode ? 'rgba(16,185,129,0.1)' : '#d1fae5', url: `/horarios/${p.id}/publicar` },
              };
              const badge = faseBadge[p.fase];
              return (
                <motion.div 
                  key={p.id} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 + idx * 0.1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ background: badge?.bg, color: badge?.color, padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                      {p.estado === 'publicado' ? '✅ Publicado' : badge?.label}
                    </span>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '14px' }}>{p.nombre}</span>
                  </div>
                  {p.estado !== 'publicado' && badge && (
                    <a href={badge.url} style={{ textDecoration: 'none' }}>
                      <button className="btn-primary" style={{ padding: '4px 14px', fontSize: '12px' }}>Continuar →</button>
                    </a>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Charts Row 1 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))',gap:'24px',marginBottom:'24px'}}
      >
        {/* Aulas por Tipo */}
        <motion.div 
          className="card" 
          style={{padding:'24px', border:'1px solid var(--border-color)', boxShadow:'var(--shadow-md)', backgroundColor: 'var(--bg-card)'}}
          whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lg)' }}
        >
          <h3 style={{fontSize:'16px',fontWeight:'600',color: 'var(--text-primary)',margin:'0 0 20px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{background: darkMode ? 'rgba(52,211,153,0.1)' : '#f0fdf4', padding:'6px', borderRadius:'8px', color: darkMode ? '#34d399' : '#10b981'}}><Building2 size={18} strokeWidth={2} /></span> Aulas por Tipo
          </h3>
          {aulasData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={aulasData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fontSize:12,fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize:12,fill: 'var(--text-muted)'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  itemStyle={{color: darkMode ? '#f8fafc' : '#1e293b', fontWeight:'700'}}
                  cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
                />
                <Bar dataKey="cantidad" radius={[8, 8, 0, 0]} name="Ambientes">
                  {aulasData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{color: 'var(--text-muted)',fontSize:'14px',textAlign:'center',padding:'40px 0'}}>Sin datos</p>}
        </motion.div>

        {/* Horas por categoría */}
        <motion.div 
          className="card" 
          style={{padding:'24px', border:'1px solid var(--border-color)', boxShadow:'var(--shadow-md)', backgroundColor: 'var(--bg-card)'}}
          whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lg)' }}
        >
          <h3 style={{fontSize:'16px',fontWeight:'600',color: 'var(--text-primary)',margin:'0 0 20px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{background: darkMode ? 'rgba(139,92,246,0.1)' : '#f5f3ff', padding:'6px', borderRadius:'8px', color: darkMode ? '#a78bfa' : '#8b5cf6'}}><Users size={18} strokeWidth={2} /></span> Docentes por Categoría y Condición
          </h3>
          {categoriaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie 
                  data={categoriaData} 
                  cx="50%" cy="50%" 
                  innerRadius={65} 
                  outerRadius={90} 
                  dataKey="horas" 
                  nameKey="name" 
                  paddingAngle={5}
                >
                  {categoriaData.map((_, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{fontSize:'12px', paddingTop:'10px', color: 'var(--text-muted)'}} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{color: 'var(--text-muted)',fontSize:'14px',textAlign:'center',padding:'40px 0'}}>Sin datos</p>}
        </motion.div>
      </motion.div>

      {/* Charts Row 2 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))',gap:'24px',marginBottom:'24px'}}>
        {/* Asignaciones por hora */}
        <div className="card dashboard-chart-card" style={{padding:'24px', border:'1px solid var(--border-color)', boxShadow:'var(--shadow-md)', backgroundColor: 'var(--bg-card)'}}>
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 20px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{background: darkMode ? 'rgba(245,158,11,0.15)' : '#fef9c3', padding:'6px', borderRadius:'8px', color: darkMode ? '#fbbf24' : '#a16207'}}>🕒</span> Asignaciones por Hora
          </h3>
          {asignacionesPorSlot.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={asignacionesPorSlot} margin={{top:10,right:10,left:-18,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{fontSize:11,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{fontSize:12,fill:'var(--text-muted)'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  itemStyle={{color: darkMode ? '#f8fafc' : '#1e293b', fontWeight:'700'}}
                  cursor={{fill: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}}
                />
                <Bar dataKey="cantidad" name="Asignaciones" radius={[6,6,0,0]}>
                  {asignacionesPorSlot.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{color:'var(--text-muted)',fontSize:'14px',textAlign:'center',padding:'40px 0'}}>Sin datos</p>}
        </div>

        {/* Tipos de sesion */}
        <div className="card dashboard-chart-card" style={{padding:'24px', border:'1px solid var(--border-color)', boxShadow:'var(--shadow-md)', backgroundColor: 'var(--bg-card)'}}>
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 20px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{background: darkMode ? 'rgba(16,185,129,0.15)' : '#ecfdf5', padding:'6px', borderRadius:'8px', color: darkMode ? '#34d399' : '#059669'}}>🧭</span> Tipos de Sesion
          </h3>
          {tiposSesion.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={tiposSesion} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" paddingAngle={4}>
                  {tiposSesion.map((_, i: number) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} stroke="transparent" />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{fontSize:'12px', paddingTop:'10px', color: 'var(--text-muted)'}} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{color:'var(--text-muted)',fontSize:'14px',textAlign:'center',padding:'40px 0'}}>Sin datos</p>}
        </div>
      </div>

      {/* Ocupación de ambientes + Carga docentes */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(400px, 1fr))',gap:'24px',marginBottom:'32px'}}
      >
        {/* Ocupación ambientes */}
        <motion.div 
          className="card" 
          style={{padding:'24px', border:'1px solid var(--border-color)', boxShadow:'var(--shadow-md)', background: 'var(--bg-card)'}}
          whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lg)' }}
        >
          <h3 style={{fontSize:'16px',fontWeight:'600',color: 'var(--text-primary)',margin:'0 0 20px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{background: darkMode ? 'rgba(245,158,11,0.15)' : '#fffbeb', padding:'6px', borderRadius:'8px', color: darkMode ? '#fbbf24' : '#f59e0b'}}><Building2 size={18} strokeWidth={2} /></span> Ambientes con mayor disponibilidad
          </h3>
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {ambientesConEspacio.length > 0 ? ambientesConEspacio.map((a, i: number) => (
              <motion.div 
                key={i} 
                style={{background: 'var(--bg-card-hover)', padding:'12px', borderRadius:'12px', border:'1px solid var(--border-color)'}}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 1.0 + i * 0.05 }}
              >
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                  <span style={{fontSize:'14px',color: 'var(--text-primary)',fontWeight:'600'}}>{a.name} <span style={{fontSize:'12px',fontWeight:'400',color: 'var(--text-muted)'}}>({a.tipo})</span></span>
                  <span style={{fontSize:'13px',color: 'var(--text-muted)', fontWeight:'600'}}>{a.porcentaje}% ocupado</span>
                </div>
                <div style={{background: 'var(--border-color)',borderRadius:'9999px',height:'8px',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:'9999px',background:a.porcentaje > 80 ? 'linear-gradient(90deg, #ef4444, #f87171)' : a.porcentaje > 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #10b981, #34d399)',width:`${Math.min(a.porcentaje,100)}%`,transition:'width 1s ease-out'}} />
                </div>
              </motion.div>
            )) : <p style={{color: 'var(--text-muted)',fontSize:'14px',textAlign:'center',padding:'20px 0'}}>Sin datos</p>}
          </div>
        </motion.div>

        {/* Carga docentes */}
        <motion.div 
          className="card" 
          style={{padding:'24px', border:'1px solid var(--border-color)', boxShadow:'var(--shadow-md)', background: 'var(--bg-card)'}}
          whileHover={{ scale: 1.01, boxShadow: 'var(--shadow-lg)' }}
        >
          <h3 style={{fontSize:'16px',fontWeight:'600',color: 'var(--text-primary)',margin:'0 0 20px', display:'flex', alignItems:'center', gap:'8px'}}>
            <span style={{background: darkMode ? 'rgba(16,185,129,0.15)' : '#f0fdf4', padding:'6px', borderRadius:'8px', color: darkMode ? '#34d399' : '#10b981'}}><Users size={18} strokeWidth={2} /></span> Docentes con mayor disponibilidad
          </h3>
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {docentesConEspacio.length > 0 ? docentesConEspacio.map((d, i: number) => {
              const pct = Number(d.porcentaje_carga || 0);
              return (
              <motion.div 
                key={i} 
                style={{display:'flex',alignItems:'center',gap:'12px', padding:'10px', background: 'var(--bg-card-hover)', borderRadius:'12px', border:'1px solid var(--border-color)'}}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 1.0 + i * 0.05 }}
              >
                <div style={{width:'36px',height:'36px',borderRadius:'10px',background: darkMode ? 'rgba(79,70,229,0.2)' : '#e0e7ff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0, color: darkMode ? '#a78bfa' : '#4338ca', fontWeight:'700', fontSize:'13px'}}>
                  {d.nombre.split(' ')[0][0]}{d.nombre.split(' ').slice(-1)[0]?.[0] || ''}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontSize:'13px',color: 'var(--text-primary)',fontWeight:'600',whiteSpace:'normal',wordBreak:'break-word',flex:1}} title={d.nombre}>{d.nombre}</span>
                    <span style={{fontSize:'12px',color: 'var(--text-muted)',flexShrink:0,marginLeft:'8px', fontWeight:'600'}}>{d.horas_asignadas} / {d.horas_max_semana}h</span>
                  </div>
                  <div style={{background: 'var(--border-color)',borderRadius:'9999px',height:'6px'}}>
                    <div style={{height:'100%',borderRadius:'9999px',background:pct>90?'#ef4444':pct>60?'#f59e0b':'#3b82f6',width:`${Math.min(pct,100)}%`}} />
                  </div>
                </div>
              </motion.div>
            )}) : <p style={{color: 'var(--text-muted)',fontSize:'14px',textAlign:'center',padding:'20px 0'}}>Sin datos</p>}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
