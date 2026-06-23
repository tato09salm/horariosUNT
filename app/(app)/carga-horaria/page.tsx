
'use client';

import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { useRouter } from 'next/navigation';

const DIAS_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };
const ORDER_TIPO: Record<string, number> = { teoria: 1, teoria_virtual: 2, practica: 3, laboratorio: 4 };

function mergeBloquesContiguos(bloques: any[]) {
  if (!bloques.length) return [];
  const sorted = [...bloques].sort((a, b) => (a.dia || '').localeCompare(b.dia || '') || (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  const merged: any[] = [];
  for (const b of sorted) {
    if (!b.hora_inicio || !b.hora_fin) continue;
    const last = merged[merged.length - 1];
    if (last && last.dia === b.dia && last.hora_fin === b.hora_inicio) {
      last.hora_fin = b.hora_fin;
    } else {
      merged.push({ dia: b.dia, inicio: b.hora_inicio, fin: b.hora_fin, hora_inicio: b.hora_inicio, hora_fin: b.hora_fin });
    }
  }
  return merged;
}
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';
import { Edit2, Trash2, Eye } from 'lucide-react';

interface CicloAcademico {
  id: string;
  nombre: string;
  año: number;
  semestre: string;
  estado: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  activo?: boolean;
}

interface Curso {
  id: string;
  curso_id: string;
  curso_nombre: string;
  curso_codigo: string;
  seccion: string;
  nombre?: string;
  codigo?: string;
  escuela?: string;
  cicloPlan?: string;
  numAlumnos?: string;
  hrsTeo?: string;
  gruposTeo?: string;
  hrsPra?: string;
  gruposPra?: string;
  hrsLab?: string;
  gruposLab?: string;
  totalHrs?: string;
  num_alumnos: number;
  hrs_teo: number;
  hrs_pra: number;
  hrs_lab: number;
  total_hrs: number;
  ciclo_plan: number;
}

interface CargaHoraria {
  id: string;
  docente_id: string;
  docente_nombre: string;
  docente_apellidos: string;
  docente_codigo?: string;
  docente_dni?: string;
  ciclo_academico_id: string;
  ciclo_academico_nombre: string;
  ciclo_plan: number;
  horas_asignadas: number;
  activo: boolean;
  cursos: Curso[];
  modalidad?: string;
  docente_facultad?: string;
  facultad?: string;
  docente_dpto_academico?: string;
  dpto_academico?: string;
  [key: string]: any;
}

interface Docente {
  id: string;
  nombre: string;
  apellidos: string;
  codigo?: string;
  dni?: string;
  activo: boolean;
  condicion?: string;
  categoria?: string;
  modalidad?: string;
  horas_max_semana?: number;
}

export default function CargaHorariaPage() {
  const router = useRouter();
  const { darkMode } = useTheme();
  const user = useUser();
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const isDocente = user?.rol.codigo === 'docente';
  const isSecretaria = user?.rol.codigo === 'secretaria';
  const canWrite = isAdmin || isDirector;
  const canManageCarga = isAdmin || isDirector || isSecretaria;

  const [ciclosAcademicos, setCiclosAcademicos] = useState<CicloAcademico[]>([]);
  const [cicloAcademicoSeleccionado, setCicloAcademicoSeleccionado] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'carga-horaria' | 'carga-aula' | 'carga-docentes' | 'reportes' | 'carga-observaciones'>('carga-horaria');
  const [aulaData, setAulaData] = useState<any[]>([]);
  const [loadingAula, setLoadingAula] = useState(false);
  
  // Estado para pestaña Carga por Docentes
  const [docentesCarga, setDocentesCarga] = useState<any[]>([]);
  const [loadingDocentesCarga, setLoadingDocentesCarga] = useState(false);
  const [filtroNombreDocente, setFiltroNombreDocente] = useState('');
  const [filtroEstadoCarga, setFiltroEstadoCarga] = useState<'todos' | 'llenado' | 'no_llenado'>('todos');
  const [filtroCurso, setFiltroCurso] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroNombreDocente, filtroEstadoCarga, filtroCurso]);
  
  // Guardar el ciclo academico seleccionado en sessionStorage
  useEffect(() => {
    if (cicloAcademicoSeleccionado) {
      sessionStorage.setItem('cargaHoraria_cicloAcademicoSeleccionado', cicloAcademicoSeleccionado);
    }
  }, [cicloAcademicoSeleccionado]);
  const [cargaHoraria, setCargaHoraria] = useState<CargaHoraria[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [allDocentes, setAllDocentes] = useState<Docente[]>([]);
  const [totalCursosPorCiclo, setTotalCursosPorCiclo] = useState<Record<number, number>>({});
  
  const [loading, setLoading] = useState(true);
  const [loadingCiclos, setLoadingCiclos] = useState(false);
  const [loadingDocentes, setLoadingDocentes] = useState(false);
  const [loadingAllDocentes, setLoadingAllDocentes] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [cicloPlanSeleccionado, setCicloPlanSeleccionado] = useState<number | null>(null);
  const [buscarCiclo, setBuscarCiclo] = useState('');
  const [filtroSinAsignacion, setFiltroSinAsignacion] = useState(false);
  const [buscarDocente, setBuscarDocente] = useState('');
  const [buscarDocenteReporte, setBuscarDocenteReporte] = useState('');
  const [docenteSeleccionado, setDocenteSeleccionado] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: string; text: string } | null>(null);
  const [ciclosExpandidos, setCiclosExpandidos] = useState<Set<number>>(new Set());

  // Cargar todos los docentes para la pestaña de reportes
  useEffect(() => {
    if (activeTab !== 'reportes') return;
    setLoadingAllDocentes(true);
    const params = new URLSearchParams();
    params.set('limit', '1000');
    fetch(`/api/docentes?${params}`)
      .then(r => r.json())
      .then(data => { setAllDocentes(data.data || []); })
      .catch(() => setToast({ type: 'error', text: 'Error al cargar docentes' }))
      .finally(() => setLoadingAllDocentes(false));
  }, [activeTab]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Cargar ciclos academicos y auto-seleccionar
  useEffect(() => {
    console.log('⏳ Fetching ciclos academicos...');
    fetch('/api/ciclos?reporte=true')
      .then(r => {
        console.log('📦 Received response from /api/ciclos, status:', r.status);
        return r.json();
      })
      .then(data => { 
        console.log('✅ Ciclos academicos data:', data);
        const ciclos = data.data || [];
        setCiclosAcademicos(ciclos);
        
        // Verificar si hay un ciclo guardado y es válido
        const savedCicloId = sessionStorage.getItem('cargaHoraria_cicloAcademicoSeleccionado');
        const savedCicloExists = savedCicloId && ciclos.some((c: any) => c.id === savedCicloId);
        
        if (savedCicloExists) {
          // Usar el ciclo guardado si existe
          setCicloAcademicoSeleccionado(savedCicloId!);
        } else {
          // Si no hay ciclo guardado o no existe, auto-seleccionar
          const activeCiclo = ciclos.find((c: any) => c.activo === true);
          if (activeCiclo) {
            setCicloAcademicoSeleccionado(activeCiclo.id);
          } else {
            // Si no hay ciclo activo, buscar 2026-I
            const ciclo2026I = ciclos.find((c: any) => c.nombre === '2026-I');
            if (ciclo2026I) {
              setCicloAcademicoSeleccionado(ciclo2026I.id);
            } else if (ciclos.length > 0) {
              // Último recurso: usar el primer ciclo
              setCicloAcademicoSeleccionado(ciclos[0].id);
            }
          }
        }
      })
      .catch(err => {
        console.error('❌ Error fetching ciclos academicos:', err);
        setToast({ type: 'error', text: 'Error al cargar ciclos academicos' });
      })
      .finally(() => setLoading(false));
  }, []);

  // Cargar carga horaria completa cuando se selecciona un ciclo académico
  useEffect(() => {
    console.log('🔄 carga horaria effect triggered, ciclo selected:', cicloAcademicoSeleccionado);
    if (!cicloAcademicoSeleccionado) {
      console.log('ℹ️ No ciclo selected, clearing carga horaria');
      setCargaHoraria([]);
      return;
    }

    setLoadingCiclos(true);
    const params = new URLSearchParams();
    params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
    if (isDocente && user?.docente_id) {
      params.set('docente_id', user.docente_id);
    }
    console.log('⏳ Fetching carga horaria for ciclo:', params.toString());

    fetch(`/api/carga-horaria?${params}`)
      .then(r => {
        console.log('📦 Received response from /api/carga-horaria, status:', r.status);
        return r.json();
      })
      .then(data => {
        console.log('✅ Carga horaria data:', data);
        console.log('📚 Carga horaria array:', data.data);
        console.log('📚 Carga horaria array length:', data.data?.length);
        console.log('📚 Carga horaria array detailed:', JSON.stringify(data.data, null, 2));
        setCargaHoraria(data.data || []);
        setTotalCursosPorCiclo(data.total_cursos_por_ciclo || {});
      })
      .catch(err => {
        console.error('❌ Error fetching carga horaria:', err);
        setToast({ type: 'error', text: 'Error al cargar carga horaria' });
      })
      .finally(() => setLoadingCiclos(false));
  }, [cicloAcademicoSeleccionado]);

  // Cargar docentes cuando se abre el modal - no pagination!
  useEffect(() => {
    if (!showModal) return;
    
    setLoadingDocentes(true);
    const params = new URLSearchParams();
    if (buscarDocente) {
      params.set('buscar', buscarDocente);
    }
    params.set('limit', '1000'); // Load all docentes for search

    fetch(`/api/docentes?${params}`)
      .then(r => r.json())
      .then(data => { setDocentes(data.data || []); })
      .catch(() => setToast({ type: 'error', text: 'Error al cargar docentes' }))
      .finally(() => setLoadingDocentes(false));
  }, [showModal, buscarDocente]);

  // Cargar horario asignado para vista "Carga por Aula"
  useEffect(() => {
    if (activeTab !== 'carga-aula' || !cicloAcademicoSeleccionado) return;
    setLoadingAula(true);
    const aulaUrl = isDocente && user?.docente_id
      ? `/api/horarios/por-aula?ciclo_id=${cicloAcademicoSeleccionado}&docente_id=${user.docente_id}`
      : `/api/horarios/por-aula?ciclo_id=${cicloAcademicoSeleccionado}`;
    fetch(aulaUrl)
      .then(r => r.json())
      .then(json => {
        const rows = (json.data || []).map((a: any) => ({
          ambiente_nombre: a.ambiente_nombre || a.ambiente_codigo || '—',
          ambiente_codigo: a.ambiente_codigo || '—',
          ambiente_tipo: a.ambiente_tipo || 'aula',
          curso_codigo: a.curso_codigo || '—',
          curso_nombre: a.curso_nombre || '—',
          numero_grupo: a.numero_grupo || '—',
          docente_nombre: a.docente_nombre || '—',
          dia: a.dia || '—',
          hora_inicio: (a.hora_inicio || '').slice(0, 5),
          hora_fin: (a.hora_fin || '').slice(0, 5),
        }));
        setAulaData(rows);
      })
      .catch(() => setAulaData([]))
      .finally(() => setLoadingAula(false));
  }, [activeTab, cicloAcademicoSeleccionado]);

  // Cargar docentes con estado de carga para vista "Carga por Docentes"
  useEffect(() => {
    if (activeTab !== 'carga-docentes' || !cicloAcademicoSeleccionado) return;
    setLoadingDocentesCarga(true);
    
    // Cargar todos los docentes activos
    fetch('/api/docentes?limit=1000&activo=true')
      .then(r => r.json())
      .then(data => {
        const todosDocentes = data.data || [];
        
        // Cargar carga horaria para el ciclo seleccionado
        return fetch(`/api/carga-horaria?ciclo_academico_id=${cicloAcademicoSeleccionado}`)
          .then(r => r.json())
          .then(cargaData => {
            const cargaHoraria = cargaData.data || [];
            const docentesConCarga = new Set(cargaHoraria.map((ch: any) => ch.docente_id));
            
            // Combinar datos y calcular horas
            const docentesConEstado = todosDocentes.map((d: any) => {
              const tieneCarga = docentesConCarga.has(d.id);
              const cargaDocente = cargaHoraria.find((ch: any) => ch.docente_id === d.id);
              
              // Calcular horas lectivas desde cursos
              let horasLectivas = 0;
              if (cargaDocente?.cursos) {
                horasLectivas = cargaDocente.cursos.reduce((sum: number, c: any) => {
                  const ht = c.hrs_teo || 0;
                  const hp = c.hrs_pra || 0;
                  const hl = c.hrs_lab || 0;
                  const tG = c.teoria_grupos ?? 1;
                  const pG = c.practica_grupos ?? 1;
                  const lG = c.laboratorio_grupos ?? 1;
                  return sum + (ht * tG) + (hp * pG) + (hl * lG);
                }, 0);
              }
              
              // Calcular horas no lectivas desde secciones
              let horasNoLectivas = 0;
              const secciones = ['preparacion', 'consejeria', 'investigacion', 'capacitacion', 'gobierno', 'administracion', 'asesoria', 'rsu', 'comites'];
              if (cargaDocente) {
                for (const sec of secciones) {
                  const secData = cargaDocente[sec];
                  if (secData) {
                    if (Array.isArray(secData)) {
                      horasNoLectivas += secData.reduce((sum: number, item: any) => sum + (item.horas || 0), 0);
                    } else {
                      horasNoLectivas += secData.horas || 0;
                    }
                  }
                }
              }
              
              return {
                ...d,
                tiene_carga: tieneCarga,
                carga_horaria: cargaDocente || null,
                cursos_asignados: cargaDocente?.cursos || [],
                horas_lectivas: horasLectivas,
                horas_no_lectivas: horasNoLectivas
              };
            });
            
            setDocentesCarga(docentesConEstado);
          });
      })
      .catch(() => {
        setToast({ type: 'error', text: 'Error al cargar docentes' });
        setDocentesCarga([]);
      })
      .finally(() => setLoadingDocentesCarga(false));
  }, [activeTab, cicloAcademicoSeleccionado]);

  async function asignarDocente() {
    if (!docenteSeleccionado || !cicloAcademicoSeleccionado || cicloPlanSeleccionado === null) {
      setToast({ type: 'error', text: 'Selecciona un docente' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docente_id: docenteSeleccionado,
          ciclo_academico_id: cicloAcademicoSeleccionado,
          ciclo_plan: cicloPlanSeleccionado,
          horas_asignadas: 0
        }),
      });

      if (!res.ok) throw new Error('Error al asignar docente');

      setToast({ type: 'success', text: 'Docente asignado correctamente' });
      setDocenteSeleccionado('');
      
      // Recargar carga horaria completa
      const params = new URLSearchParams();
      params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
      const data = await (await fetch(`/api/carga-horaria?${params}`)).json();
      setCargaHoraria(data.data || []);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message || 'Error al asignar docente' });
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCurso(chcId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/carga-horaria-cursos/${chcId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar curso');

      setToast({ type: 'success', text: 'Curso eliminado correctamente' });
      
      // Recargar carga horaria completa
      const params = new URLSearchParams();
      params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
      const data = await (await fetch(`/api/carga-horaria?${params}`)).json();
      setCargaHoraria(data.data || []);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message || 'Error al eliminar curso' });
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCargaHoraria(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/carga-horaria/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar asignación');

      setToast({ type: 'success', text: 'Asignación eliminada correctamente' });
      
      // Recargar carga horaria completa
      const params = new URLSearchParams();
      params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
      const data = await (await fetch(`/api/carga-horaria?${params}`)).json();
      setCargaHoraria(data.data || []);
    } catch (e: any) {
      setToast({ type: 'error', text: e.message || 'Error al eliminar asignación' });
    } finally {
      setSaving(false);
    }
  }

  function abrirModal(cicloPlan: number) {
    setCicloPlanSeleccionado(cicloPlan);
    setShowModal(true);
    setDocenteSeleccionado('');
    setBuscarDocente('');
  }

  function cerrarModal() {
    setShowModal(false);
    setCicloPlanSeleccionado(null);
    setDocenteSeleccionado('');
    setBuscarDocente('');
  }

  function toggleCiclo(cicloPlan: number) {
    const newExpandidos = new Set(ciclosExpandidos);
    if (newExpandidos.has(cicloPlan)) {
      newExpandidos.delete(cicloPlan);
    } else {
      newExpandidos.add(cicloPlan);
    }
    setCiclosExpandidos(newExpandidos);
  }
async function marcarFormatosGenerados(docenteId: string) {
  const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
  for (const ch of cargasDocente) {
    await fetch(`/api/carga-horaria/${ch.id}/bloquear`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formatos_generados: true })
    });
    // Actualizar estado local
    setCargaHoraria(prev => prev.map(c =>
      c.id === ch.id ? { ...c, formatos_generados: true } : c
    ));
  }
}

async function generarTodosFormatosZip(docenteId: string) {
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return;
    }

    const nombreDocente = `${cargasDocente[0].docente_apellidos}-${cargasDocente[0].docente_nombre}`.replace(/\s+/g, '-');

    try {
      const zip = new JSZip();

      const docF01 = generarF01CAD(docenteId, true);
      const docF02 = generarF02CAD(docenteId, true);
      const docF03 = await generarF03CAD(docenteId, true);
      const docAdicional = generarCargaAdicionalPDF(docenteId, true);

      if (docF01) zip.file(`F01-CAD-${nombreDocente}.pdf`, docF01.output('blob'));
      if (docF02) zip.file(`F02-CAD-${nombreDocente}.pdf`, docF02.output('blob'));
      if (docF03) zip.file(`F03-CAD-${nombreDocente}.pdf`, docF03.output('blob'));
      if (docAdicional) zip.file(`Dec-Adicional-${nombreDocente}.pdf`, docAdicional.output('blob'));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Formatos-${nombreDocente}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await marcarFormatosGenerados(docenteId);
      setToast({ type: 'success', text: 'Formatos descargados en .zip correctamente' });
    } catch (e) {
      console.error('Error generando zip:', e);
      setToast({ type: 'error', text: 'Error al generar el archivo .zip' });
    }
  }

function generarCargaAdicionalPDF(docenteId: string, returnBlob: boolean = false): jsPDF | null {
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return null;
    }

    const primeraCarga = cargasDocente[0];
    const docenteCompleto = allDocentes.find(d => d.id === docenteId);

    let adicional: any = null;
    if (primeraCarga.adicional) {
      try {
        adicional = typeof primeraCarga.adicional === 'string'
          ? JSON.parse(primeraCarga.adicional)
          : primeraCarga.adicional;
      } catch (err) {
        console.error('Error parsing adicional in PDF generator:', err);
      }
    }

    const nombreDocente = (adicional?.nombre_docente || (primeraCarga 
      ? `${primeraCarga.docente_apellidos}, ${primeraCarga.docente_nombre}` 
      : 'DOCENTE')).toUpperCase();

    const codigoDocente = adicional?.codigo_docente || docenteCompleto?.codigo || '';
    const dniDocente = adicional?.dni_docente || docenteCompleto?.dni || '';
    const condStr = (adicional?.condicion || docenteCompleto?.condicion || 'NOMBRADO').toUpperCase();
    const catStr = (adicional?.categoria || docenteCompleto?.categoria || 'ASOCIADO').toUpperCase();
    const dpto = adicional?.dpto_academico || primeraCarga?.docente_dpto_academico || primeraCarga?.dpto_academico || 'DEPARTAMENTO ACADÉMICO';
    const facultad = adicional?.facultad || primeraCarga?.docente_facultad || primeraCarga?.facultad || 'FACULTAD';

    let regStr = (adicional?.regimen_dedicacion || '').toUpperCase();
    const modalidad = primeraCarga?.modalidad || docenteCompleto?.modalidad || '';
    if (!regStr) {
      if (modalidad.includes('COMPLETO')) regStr = 'TC';
      else if (modalidad.includes('PARCIAL')) regStr = 'TP';
      else regStr = 'DE';
    }

    const isRegular = condStr.includes('NOMBRADO') || condStr.includes('REGULAR');
    const isContratado = condStr.includes('CONTRATADO');
    const isHonorarios = condStr.includes('HONORARIOS');

    const isPrincipal = catStr.includes('PRINCIPAL');
    const isAsociado = catStr.includes('ASOCIADO');
    const isAuxiliar = catStr.includes('AUXILIAR');
    const isTipoA = catStr.includes('TIPO A') || catStr.includes('JEFE_PRACTICA') || catStr.includes('JEFE DE PRACTICA');
    const isTipoB = catStr.includes('TIPO B');

    const isDE = regStr.includes('DE');
    const isTC = regStr.includes('TC');
    const isTP = regStr.includes('TP');
    
    let tpHoras = '';
    if (isTP) {
      const match = (adicional?.regimen_dedicacion || modalidad || '').match(/(\d+)\s*H/i);
      if (match) tpHoras = match[1];
      else {
        const chHours = docenteCompleto?.horas_max_semana;
        if (chHours) tpHoras = String(chHours);
      }
    }

    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const añoAcademico = adicional?.periodo_academico || cicloAcademico?.nombre || '';
    
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '..../..../....';
      const clean = dateStr.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '..../..../....';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };

    const fechaInicio = formatDate(adicional?.fecha_inicio_periodo || cicloAcademico?.fecha_inicio);
    const fechaFin = formatDate(adicional?.fecha_termino_periodo || cicloAcademico?.fecha_fin);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pw = doc.internal.pageSize.getWidth();
    const ml = 15;
    let y = 15;

    // 1. TITLE
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(
      'DECLARACIÓN DE CARGA HORARIA LECTIVA ADICIONAL ASIGNADA EN FILIALES, POSGRADO SEGUNDA ESPECIALIDADES Y CENTROS DE PRODUCCIÓN Y EXTENSIÓN UNIVERSITARIA',
      pw - 2 * ml
    );
    doc.text(titleLines, pw / 2, y, { align: 'center' });
    y += 15;

    // 2. FACULTAD & DEPARTAMENTO
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`FACULTAD: ${facultad.toUpperCase()}`, ml, y);
    doc.text(`DPTO. ACADÉMICO: ${dpto.toUpperCase()}`, pw - ml, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL DOCENTE:', ml, y);
    y += 3;

    // 3. DATOS DEL DOCENTE TABLE
    const condCol = `REGULAR       (  ${isRegular ? 'X' : '  '}  )\nCONTRATADO (  ${isContratado ? 'X' : '  '}  )\nHONORARIOS  (  ${isHonorarios ? 'X' : '  '}  )`;
    const catCol = `PRINCIPAL     (  ${isPrincipal ? 'X' : '  '}  )\nASOCIADO     (  ${isAsociado ? 'X' : '  '}  )\nAUXILIAR      (  ${isAuxiliar ? 'X' : '  '}  )\nTIPO A          (  ${isTipoA ? 'X' : '  '}  )\nTIPO B          (  ${isTipoB ? 'X' : '  '}  )`;
    const modCol = `DE.               (  ${isDE ? 'X' : '  '}  )\nTC.               (  ${isTC ? 'X' : '  '}  )\nTP                (  ${isTP ? 'X' : '  '}  )   ${isTP && tpHoras ? tpHoras : '  '} HS`;

    autoTable(doc, {
      head: [[
        { content: 'NOMBRES Y APELLIDOS', styles: { halign: 'center' } },
        { content: 'CONDICIÓN', styles: { halign: 'center' } },
        { content: 'CATEGORIA / TIPO DE CONTRATO', styles: { halign: 'center' } },
        { content: 'MODALIDAD', styles: { halign: 'center' } }
      ]],
      body: [[
        `NOMBRES Y APELLIDOS:\n${nombreDocente}\n\nCÓDIGO: ${codigoDocente}`,
        condCol,
        catCol,
        modCol
      ]],
      startY: y,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.3, fontStyle: 'bold' },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: ml, right: ml },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 38 },
        2: { cellWidth: 55 },
        3: { cellWidth: 38 }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // 4. PERIODO ACADEMICO
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`AÑO ACADÉMICO: ${añoAcademico}`, ml, y);
    doc.text(`SEMESTRE: ${cicloAcademico?.semestre || 'I'}`, ml + 60, y);
    doc.text(`INICIO: ${fechaInicio}`, ml + 105, y);
    doc.text(`FINAL: ${fechaFin}`, pw - ml, y, { align: 'right' });
    y += 5;

    // 5. CURSOS ADICIONALES TABLE
    const adCursos = adicional?.cursos || [];
    const tableBody = adCursos.map((c: any) => {
      const fi = formatDate(c.fecha_inicio);
      const ft = formatDate(c.fecha_termino);
      return [
        c.curso || '',
        c.dependencia || '',
        `F.I.: ${fi}\nF.T.: ${ft}`,
        c.horario_semanal || '',
        c.total_horas || '0'
      ];
    });

    while (tableBody.length < 4) {
      tableBody.push([
        '',
        '',
        'F.I.: ..../..../....\nF.T.: ..../..../....',
        '',
        ''
      ]);
    }

    const totalAdHoras = adCursos.reduce((sum: number, c: any) => sum + parseFloat(c.total_horas || '0'), 0);

    autoTable(doc, {
      head: [[
        { content: 'CURSO', styles: { halign: 'center' } },
        { content: 'DEPENDENCIA', styles: { halign: 'center' } },
        { content: 'FECHA DE INICIO/TERMINO', styles: { halign: 'center' } },
        { content: 'HORARIO SEMANAL', styles: { halign: 'center' } },
        { content: 'TOTAL HORAS', styles: { halign: 'center' } }
      ]],
      body: [
        ...tableBody,
        [
          { content: 'TOTAL, HORAS', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: totalAdHoras > 0 ? String(totalAdHoras) : '', styles: { halign: 'center', fontStyle: 'bold' } }
        ]
      ],
      startY: y,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.3 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', fontSize: 7.5 },
      margin: { left: ml, right: ml },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 45 },
        2: { cellWidth: 38 },
        3: { cellWidth: 38 },
        4: { cellWidth: 15, halign: 'center' }
      }
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // 6. DATE LINE
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const dateStr = `Trujillo, ${new Date().getDate()} de ${new Date().toLocaleString('es-PE', { month: 'long' }).toUpperCase()} de ${new Date().getFullYear()}`;
    doc.text(dateStr, pw - ml, y, { align: 'right' });
    y += 22;

    // 7. SIGNATURES BLOCK
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    
    // Left signatures
    doc.line(ml, y, ml + 65, y);
    doc.text('Firma del Profesor', ml + 32.5, y + 4, { align: 'center' });
    
    // Right signatures (Decano V° B°)
    doc.line(pw - ml - 65, y, pw - ml, y);
    doc.text('V° B°', pw - ml - 32.5, y + 4, { align: 'center' });
    doc.text('DECANO: .................................................', pw - ml - 32.5, y + 8, { align: 'center' });

    y += 20;
    doc.line(ml, y, ml + 65, y);
    doc.text('Director del Departamento Académico', ml + 32.5, y + 4, { align: 'center' });

    y += 20;
    doc.line(ml, y, ml + 65, y);
    doc.text('Director de la Unidad Académica', ml + 32.5, y + 4, { align: 'center' });

    if (returnBlob) {
          return doc;
        }
        doc.save(`carga-adicional-${nombreDocente.replace(/\s+/g, '-')}.pdf`);
        return null;
  }

  function generarF01CAD(docenteId: string, returnBlob: boolean = false): jsPDF | null {
    // Obtener todos los datos de carga horaria del docente en el ciclo seleccionado
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
      if (cargasDocente.length === 0) {
        setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
        return null;
      }
    
    // Combinar todos los cursos de todas las cargas horarias del docente
    const cursosDocente: any[] = [];
    let totalHorasLectivas = 0;
    cargasDocente.forEach(ch => {
      if (ch.cursos && ch.cursos.length > 0) {
        ch.cursos.forEach(curso => {
          const hrsTeo = curso.hrs_teo || 0;
          const gruposTeo = (curso as any).teoria_grupos ?? 1;
          const hrsPra = curso.hrs_pra || 0;
          const gruposPra = (curso as any).practica_grupos ?? 1;
          const hrsLab = curso.hrs_lab || 0;
          const gruposLab = (curso as any).laboratorio_grupos ?? 1;
          const totalHrs = (hrsTeo * gruposTeo) + (hrsPra * gruposPra) + (hrsLab * gruposLab);
          
          const cursoData = {
            codigo: curso.curso_codigo || '',
            nombre: curso.curso_nombre || (curso as any).nombre || '',
            seccion: curso.seccion,
            cicloPlan: getRomanNumeral(curso.ciclo_plan || ch.ciclo_plan || 1),
            escuela: curso.escuela || 'Ingeniería de Sistemas',
            numAlumnos: curso.num_alumnos || 0,
            hrsTeo,
            hrsPra,
            hrsLab,
            gruposTeo,
            gruposPra,
            gruposLab,
            totalHrs
          };
          cursosDocente.push(cursoData);
          totalHorasLectivas += cursoData.totalHrs;
        });
      }
    });

    // Obtener datos completos del docente
    const docenteCompleto = allDocentes.find(d => d.id === docenteId);
    const primeraCarga = cargasDocente[0];
    
    const nombreDocente = primeraCarga 
      ? `${primeraCarga.docente_apellidos}, ${primeraCarga.docente_nombre}`.toUpperCase()
      : 'DOCENTE';
    
    const condicion = docenteCompleto?.condicion ? docenteCompleto.condicion.toUpperCase() : 'NOMBRADO';
    const categoria = docenteCompleto?.categoria ? docenteCompleto.categoria.toUpperCase() : 'ASOCIADO';
    const modalidad = primeraCarga?.modalidad || docenteCompleto?.modalidad || 'TIEMPO COMPLETO 40 H';
    const facultad = primeraCarga?.docente_facultad || primeraCarga?.facultad || 'Ingeniería';
    const dptoAcademico = primeraCarga?.docente_dpto_academico || primeraCarga?.dpto_academico || 'Dpto. de Ingeniería de Sistemas';
    
    // Obtener nombre del ciclo académico
    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const nombreCiclo = cicloAcademico ? cicloAcademico.nombre : 'Ciclo Académico';
    const añoAcademico = cicloAcademico?.año || new Date().getFullYear();
    
    // Obtener datos de las secciones (combinar todas las cargas)
    const secciones: Record<string, any> = {
      preparacion: null,
      consejeria: null,
      investigacion: null,
      capacitacion: null,
      gobierno: null,
      administracion: null,
      asesoria: null,
      rsu: null,
      comites: null
    };
    
    cargasDocente.forEach(ch => {
      for (const key of Object.keys(secciones)) {
        if (ch[key]) {
          if (!secciones[key]) {
            secciones[key] = ch[key];
          } else if (Array.isArray(ch[key])) {
            // Merge arrays if they exist
            if (!Array.isArray(secciones[key])) {
              secciones[key] = [secciones[key]];
            }
            secciones[key] = [...secciones[key], ...ch[key]];
          }
        }
      }
    });

    // Crear PDF en modo landscape para mejor ajuste
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'letter'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Márgenes
    const marginLeft = 10;
    const marginRight = 10;
    let currentY = 10;
    
    // Título principal
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMATO N° 1', pageWidth / 2, currentY, { align: 'center' });
    currentY += 7;
    doc.setFontSize(12);
    doc.text('DECLARACIÓN DE CARGA HORARIA ASIGNADA', pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;
    
    // I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:', marginLeft, currentY);
    currentY += 7;
    doc.setFont('helvetica', 'normal');
    
    // Facultad y Dpto. Académico en una línea
    doc.setFontSize(10);
    doc.text(`FACULTAD:`, marginLeft, currentY);
    doc.text(facultad, 45, currentY);
    doc.text('DPTO. ACADÉMICO:', 120, currentY);
    doc.text(dptoAcademico, 170, currentY);
    currentY += 8;
    
    // Tabla de datos del profesor
    const headerDatos = [['NOMBRE COMPLETO', 'CONDICIÓN', 'CATEGORÍA', 'MODALIDAD']];
    const bodyDatos = [[nombreDocente, condicion, categoria, modalidad]];
    autoTable(doc, {
      head: headerDatos,
      body: bodyDatos,
      startY: currentY,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
      margin: { left: marginLeft, right: marginRight }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 6;
    
    // Año académico, ciclo y fechas
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`AÑO ACADÉMICO: ${añoAcademico}`, marginLeft, currentY);
    const cicloSemestre = cicloAcademico?.semestre ? `CICLO(SEM): ${cicloAcademico.semestre}` : 'CICLO(SEM): I';
    doc.text(cicloSemestre, 90, currentY);
    
    // Formatear fechas
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    const fechaInicio = formatDate(cicloAcademico?.fecha_inicio);
    const fechaFin = formatDate(cicloAcademico?.fecha_fin);
    
    if (fechaInicio && fechaFin) {
      doc.text(`INICIO: ${fechaInicio}   -   FINAL: ${fechaFin}`, 170, currentY);
    }
    currentY += 8;
    
    // 1. TRABAJO LECTIVO
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('1. TRABAJO LECTIVO.- Datos completos y con claridad', marginLeft, currentY);
    currentY += 6;
    doc.setFont('helvetica', 'normal');
    
    // Tabla de trabajo lectivo compacta
    const headerLectivo = [
      ['CÓDIGO', 'NOMBRE DEL CURSO', 'CUR', 'Escuela Prof.', 'CIC', 'SEC', 'N° AL.', 'H.T.', 'H.P.', 'H.L.', 'Total']
    ];
    const bodyLectivo = cursosDocente.map(c => [
      c.codigo,
      c.nombre.substring(0, 35), // Limitar longitud del nombre
      'OB',
      c.escuela.substring(0, 15),
      c.cicloPlan,
      c.seccion,
      c.numAlumnos,
      `${c.hrsTeo} x ${c.gruposTeo}`,
      `${c.hrsPra} x ${c.gruposPra}`,
      `${c.hrsLab} x ${c.gruposLab}`,
      c.totalHrs
    ]);
    
    autoTable(doc, {
      head: headerLectivo,
      body: bodyLectivo,
      startY: currentY,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
      margin: { left: marginLeft, right: marginRight },
      columnStyles: {
        1: { cellWidth: 60 }, // Nombre del curso
        3: { cellWidth: 30 }  // Escuela
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 5;
    
    // Crear tabla para las secciones restantes (compacta, dos columnas)
    // Helper function to get total hours from section (handles arrays)
    const getSectionHoras = (section: any) => {
      if (!section) return 0;
      if (Array.isArray(section)) {
        return section.reduce((sum: number, item: any) => sum + (item.horas || 0), 0);
      }
      return section.horas || 0;
    };

    // Helper function to get details from section (handles arrays)
    const getSectionDetalles = (section: any, field: string = 'detalles') => {
      if (!section) return '';
      if (Array.isArray(section)) {
        return section.map((item: any) => item[field] || item.descripcion || item.proyecto || item.plan || '').filter(Boolean).join('; ');
      }
      return section[field] || section.descripcion || section.proyecto || section.plan || '';
    };

    const seccionesData = [
      {
        titulo: '2. PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)',
        horas: getSectionHoras(secciones.preparacion),
        detalles: getSectionDetalles(secciones.preparacion, 'descripcion')
      },
      {
        titulo: '3. CONSEJERÍA: Señalar número de alumnos y el ciclo académico en el que se desarrolla. (Como mínimo 01 hora semanal)',
        horas: getSectionHoras(secciones.consejeria),
        detalles: getSectionDetalles(secciones.consejeria, 'detalles')
      },
      {
        titulo: '4. INVESTIGACIÓN: Consignar el N° de inscripción, código, nombre y duración del proyecto. (Como mínimo 04 y 05 horas semanales, según modalidad de trabajo).',
        horas: getSectionHoras(secciones.investigacion),
        detalles: getSectionDetalles(secciones.investigacion, 'proyecto')
      },
      {
        titulo: '5. CAPACITACIÓN: Señale lo referente a este rubro en el marco de los planes de cada Facultad (como máximo 05 semanales)',
        horas: getSectionHoras(secciones.capacitacion),
        detalles: getSectionDetalles(secciones.capacitacion, 'detalles')
      },
      {
        titulo: '6. ACTIVIDADES DE GOBIERNO: Si desempeña cargo indique.',
        horas: getSectionHoras(secciones.gobierno),
        detalles: getSectionDetalles(secciones.gobierno, 'detalles')
      },
      {
        titulo: '7. ACTIVIDADES DE ADMINISTRACIÓN: Si desempeña cargo indique.',
        horas: getSectionHoras(secciones.administracion),
        detalles: getSectionDetalles(secciones.administracion, 'detalles')
      },
      {
        titulo: '8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL: Indicar el número de Resolución Decanal, precisando el nombre y duración de la actividad programada.',
        horas: getSectionHoras(secciones.asesoria),
        detalles: getSectionDetalles(secciones.asesoria, 'detalles')
      },
      {
        titulo: '9. RESPONSABILIDAD SOCIAL UNIVERSITARIA: Señalar actividad, proyecto programa a ejecutarse n beneficio de la comunidad local o regional. (Como máximo 02 horas semanales)',
        horas: getSectionHoras(secciones.rsu),
        detalles: getSectionDetalles(secciones.rsu, 'plan')
      },
      {
        titulo: '10. COMITÉS TÉCNICOS Y COMISIONES: Consignar el número de Resolución autoritativa indicando el lapso de vigencia.',
        horas: getSectionHoras(secciones.comites),
        detalles: getSectionDetalles(secciones.comites, 'detalles')
      }
    ];
    
    // Crear tabla para secciones
    const bodySecciones = seccionesData.map(s => [
      { content: s.titulo, styles: { fontStyle: 'bold' } },
      s.detalles.substring(0, 80),
      s.horas
    ]);
    
    autoTable(doc, {
      body: bodySecciones,
      startY: currentY,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      margin: { left: marginLeft, right: marginRight },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 15, halign: 'center' }
      }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 5;
    
    // Total horas
    const totalHoras = totalHorasLectivas + seccionesData.reduce((sum, s) => sum + s.horas, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL`, pageWidth - 70, currentY);
    doc.text(totalHoras.toString(), pageWidth - 20, currentY, { align: 'right' });
    currentY += 10;
    
    // Fecha y firmas
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const fecha = new Date();
    const mes = fecha.toLocaleString('es-ES', { month: 'long' });
    const fechaStr = `Trujillo, ${fecha.getDate()} de ${mes} del ${fecha.getFullYear()}`;
    doc.text(fechaStr, pageWidth / 2, currentY, { align: 'center' });
    currentY += 15;
    
    // Líneas de firma
    const firmaY = currentY;
    doc.line(marginLeft + 20, firmaY, marginLeft + 90, firmaY);
    doc.line(pageWidth / 2 - 35, firmaY, pageWidth / 2 + 35, firmaY);
    doc.line(pageWidth - 90, firmaY, pageWidth - 20, firmaY);
    
    doc.setFontSize(9);
    doc.text('Firma del Profesor', marginLeft + 55, firmaY + 5, { align: 'center' });
    doc.text('Firma del Director de Dpto.', pageWidth / 2, firmaY + 5, { align: 'center' });
    doc.text('V° B° Decano Fac.', pageWidth - 55, firmaY + 5, { align: 'center' });
    
    // Descargar PDF
    if (returnBlob) {
      return doc;
    }
    doc.save(`carga-horaria-${nombreDocente.replace(/\s+/g, '-')}.pdf`);
    return null;
  }

    function generarF02CAD(docenteId: string, returnBlob: boolean = false): jsPDF | null {
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return null;
    }

    const primeraCarga = cargasDocente[0];
    const docenteCompleto = allDocentes.find(d => d.id === docenteId) as any;

    let adicional: any = null;
    if (primeraCarga.adicional) {
      try {
        adicional = typeof primeraCarga.adicional === 'string'
          ? JSON.parse(primeraCarga.adicional)
          : primeraCarga.adicional;
      } catch {}
    }

    const nombreDocente = (adicional?.nombre_docente ||
      `${primeraCarga.docente_apellidos}, ${primeraCarga.docente_nombre}`).toUpperCase();
    const dniDocente = adicional?.dni_docente || docenteCompleto?.dni || '...........';
    const dptoAcademico = adicional?.dpto_academico || primeraCarga?.dpto_academico || primeraCarga?.docente_dpto_academico || '...............';
    const facultad = adicional?.facultad || primeraCarga?.facultad || primeraCarga?.docente_facultad || '...............';

    // Determinar opción seleccionada
    const opcionSeleccionada = adicional?.declaracion_jurada_opcion || '';

    const opciones = [
      { key: 'opcion1', num: '1', texto: 'Soy docente, ordinario a Dedicación Exclusiva y NO EJERZO cualquier otra actividad o cargo remunerado en otra universidad, entidad pública o privada, fuera de la Universidad Nacional de Trujillo (De conformidad con el Artículo 225° del Estatuto Institucional vigente).' },
      { key: 'opcion2', num: '2', texto: 'Soy docente, ordinario a Tiempo Completo y NO ejerzo cualquier otra actividad o cargo remunerado en otra universidad, entidad pública o privada, fuera de la Universidad Nacional de Trujillo (De conformidad con el Artículo 225° del Estatuto Institucional vigente), así mismo en caso de incumplimiento, me someto a las sanciones dispuestas en el Reglamento del Docente Investigador y Promoción de la Investigación, aprobado por R.C.U. N°281-2021/UNT' },
      { key: 'opcion3', num: '3', texto: 'Soy docente, ordinario a Tiempo Parcial y NO TENGO incompatibilidad horaria con mi carga académica en la Universidad Nacional de Trujillo y otra institución donde laboro' },
      { key: 'opcion4', num: '4', texto: 'Soy docente, Investigador de la UNT a acreditado con Resolución Vicerrectoral y NO ejerzo cualquier otra actividad o cargo remunerado en otra universidad, entidad pública o privada, fuera de la Universidad Nacional de Trujillo (De conformidad con el Artículo 225° del Estatuto Institucional vigente), así mismo en caso de incumplimiento, me someto a las sanciones dispuestas en el Reglamento del Docente Investigador y Promoción de la Investigación, aprobado por R.C.U. N°281-2021/UNT' },
      { key: 'opcion5', num: '5', texto: 'Soy docente, contratado a Tiempo Completo y NO EJERZO la misma modalidad en otra entidad pública o privada, así mismo, no tengo otra responsabilidad remunerada en alguna institución pública o privada más de diez (10 horas) semanales, excepto ley expresa que lo permita' },
      { key: 'opcion6', num: '6', texto: 'Soy docente, contratado a Tiempo Parcial y NO TENGO incompatibilidad horaria con mi carga académica en la Universidad Nacional de Trujillo y otra institución donde laboro.' },
    ];

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pw = doc.internal.pageSize.getWidth();
    const ml = 20;
    const mr = 20;
    const contentWidth = pw - ml - mr;
    let y = 18;

    // TÍTULO
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    const titulo1 = 'DECLARACION JURADA DE NO ESTAR INCURSO EN CAUSALES';
    const titulo2 = 'DE INCOMPATIBILIDAD O IMPEDIMENTO LABORAL (F02-CAD)';
    doc.text(titulo1, pw / 2, y, { align: 'center' });
    y += 6;
    doc.text(titulo2, pw / 2, y, { align: 'center' });
    y += 12;

    // PÁRRAFO INICIAL
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    const parrafo1 = `Yo, ${nombreDocente}, identificado(a) con DNI N° ${dniDocente}, adscrito al Departamento Académico de ${dptoAcademico} de la Facultad de ${facultad}, en el marco de la Ley Universitaria 30220, D.S. N° 418-2017-EF, Estatuto Reformado 2021 y el reglamento de asignación de la Carga Académica de los Docentes de la UNT, `;
    
    // Texto con parte en negrita
    const lines1 = doc.splitTextToSize(parrafo1, contentWidth);
    doc.text(lines1, ml, y);
    y += lines1.length * 4.5;

    doc.setFont('helvetica', 'bold');
    const boldText = 'DECLARO BAJO JURAMENTO Y EN HONOR A LA VERDAD, que:';
    const linesBold = doc.splitTextToSize(boldText, contentWidth);
    doc.text(linesBold, ml, y);
    y += linesBold.length * 4.5 + 4;

    // PÁRRAFO NO ESTOY INCURSO
    doc.setFontSize(9.5);
    const p2start = 'NO ESTOY INCURSO';
    const p2rest = ' en causales de incompatibilidad laboral y ';
    const p2bold2 = 'NO TENGO';
    const p2rest2 = ' impedimento para ejercer la docencia en la Universidad Nacional de Trujillo, de conformidad con lo previsto en el Capítulo VIII de las Incompatibilidades, Impedimentos y sanciones, del Título XII: de los docentes, del Estatuto institucional vigente, según la especificación siguiente:';

    // Renderizar párrafo con negritas inline
    const fullP2 = p2start + p2rest + p2bold2 + p2rest2;
    const linesP2 = doc.splitTextToSize(fullP2, contentWidth);
    
    // Dibujar línea por línea con negritas aproximadas
    let xCursor = ml;
    doc.setFont('helvetica', 'bold');
    doc.text('NO ESTOY INCURSO', xCursor, y);
    const w1 = doc.getTextWidth('NO ESTOY INCURSO');
    doc.setFont('helvetica', 'normal');
    
    const restLine1 = ' en causales de incompatibilidad laboral y ';
    doc.text(restLine1, xCursor + w1, y);
    const w2 = doc.getTextWidth(restLine1);
    
    doc.setFont('helvetica', 'bold');
    doc.text('NO TENGO', xCursor + w1 + w2, y);
    y += 4.5;
    
    doc.setFont('helvetica', 'normal');
    const restP2 = 'impedimento para ejercer la docencia en la Universidad Nacional de Trujillo, de conformidad con lo previsto en el Capítulo VIII de las Incompatibilidades, Impedimentos y sanciones, del Título XII: de los docentes, del Estatuto institucional vigente, según la especificación siguiente:';
    const linesRestP2 = doc.splitTextToSize(restP2, contentWidth);
    doc.text(linesRestP2, ml, y);
    y += linesRestP2.length * 4.5 + 6;

    // OPCIONES
    for (const opcion of opciones) {
      const marca = opcionSeleccionada === opcion.key ? 'X' : ' ';
      const prefijo = `${opcion.num}.( ${marca} ) `;
      const textoCompleto = prefijo + opcion.texto;
      const lineas = doc.splitTextToSize(textoCompleto, contentWidth);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(lineas, ml, y);
      y += lineas.length * 4.5 + 4;

      // Salto de página si es necesario
      if (y > 240) {
        doc.addPage();
        y = 20;
      }
    }

    y += 2;

    // PÁRRAFO FINAL EN MAYÚSCULAS
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    const parrafoFinal1 = 'EN CASO DE FALTAR A LA VERDAD ME SOMETO A LAS SANCIONES QUE SEAN APLICABLES DE ACUERDO A LEY; ASIMISMO, DE ENCONTRARME INCURSO EN SITUACIÓN DE INCOMPATIBILIDAD O IMPEDIMENTO PARA EJERCER LA DOCENCIA EN LA U.N.T., ME SOMETO A LAS SANCIONES PREVISTAS POR SU ESTATUTO, ';
    const linesFinal1 = doc.splitTextToSize(parrafoFinal1, contentWidth);
    doc.text(linesFinal1, ml, y);
    y += linesFinal1.length * 4.5;

    // Parte en negrita-cursiva subrayada
    doc.setFont('helvetica', 'bolditalic');
    const parrafoFinal2 = 'Y AUTORIZO AL FUNCIONARIO COMPETENTE DISPONGA EL DESCUENTO DE MI PLANILLA DE HABERES, DEL MONTO QUE LA UNIDAD DE REMUNERACIONES LIQUIDE COMO PAGOS INDEBIDOS POR EL LAPSO DE TIEMPO LABORADO ILEGALMENTE.';
    const linesFinal2 = doc.splitTextToSize(parrafoFinal2, contentWidth);
    
    // Subrayado manual
    for (const line of linesFinal2) {
      doc.text(line, ml, y);
      const lineW = doc.getTextWidth(line);
      doc.line(ml, y + 0.5, ml + lineW, y + 0.5);
      y += 4.5;
    }
    y += 10;

// FECHA Y FIRMA
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const now = new Date();
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    doc.text(`Trujillo, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`, ml, y);
    y += 20;

// Línea de firma centrada
    const firmaX = pw / 2;
    doc.line(firmaX - 35, y, firmaX + 35, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`DNI N° ${dniDocente}`, firmaX, y, { align: 'center' });

    if (returnBlob) {
          return doc;
        }
        doc.save(`F02-CAD-${nombreDocente.replace(/[\s,]+/g, '-')}.pdf`);
        return null;
      }
  
  async function generarF03CAD(docenteId: string, returnBlob: boolean = false): Promise<jsPDF | null> {
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return null;
    }

    const docenteData = allDocentes.find(d => d.id === docenteId);
    const primeraCarga = cargasDocente[0];
    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const dAny = docenteData as any;

    const apellidosNombre = `${primeraCarga.docente_apellidos}, ${primeraCarga.docente_nombre}`.toUpperCase();
    const dni = dAny?.dni || '—';
    const categoria = dAny?.categoria?.toUpperCase() || '—';
    const condicionDisplay = dAny?.condicion === 'nombrado' ? 'TC' : dAny?.condicion === 'contratado' ? 'TP' : 'TC';
    const facultad = (primeraCarga as any)?.facultad || (primeraCarga as any)?.docente_facultad || 'Ingeniería';
    const lugarLegendCode: Record<string, string> = {
      F01: 'CC. Agropecuarias', F02: 'CC. Biológicas', F03: 'CC. Económicas',
      F04: 'CC. Físicas y Matemáticas', F05: 'CC. Sociales', F06: 'Derecho y Ciencias Políticas',
      F07: 'Educación y Comunicación', F08: 'Enfermería', F09: 'Estomatología',
      F10: 'Farmacia y Bioquímica', F11: 'Ingeniería', F12: 'Ingeniería Química',
      F13: 'Medicina', F14: 'Filial Valle Jequetepeque', F15: 'Filial Huamachuco',
      F16: 'Filial Santiago de Chuco', OA: 'Oficina Administrativa', SC: 'Salida de Campo'
    };
    const lugarLegendName = Object.fromEntries(Object.entries(lugarLegendCode).map(([k, v]) => [v.toLowerCase(), k]));
    const lugarCode = lugarLegendName[facultad.toLowerCase()] || 'F11';
    const lugarDisplay = `${lugarCode}`;
    const dpto = (primeraCarga as any)?.dpto_academico || (primeraCarga as any)?.docente_dpto_academico || 'Ingeniería de Sistemas';
    const año = cicloAcademico?.año || new Date().getFullYear();
    const semestre = cicloAcademico?.semestre || 'I';
    const formatDate = (ds: string) => {
      if (!ds) return '—';
      const d = new Date(ds);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    };
    const fechaInicio = formatDate((cicloAcademico as any)?.fecha_inicio);
    const fechaFin = formatDate((cicloAcademico as any)?.fecha_fin);

    // 0. FETCH HORARIO ASIGNADO DEL DOCENTE
    const diaLabels: Record<string, string> = { lunes: 'LU', martes: 'MA', miercoles: 'MI', jueves: 'JU', viernes: 'VI', sabado: 'SA' };
    const tipoLabels: Record<string, string> = { teoria: 'T', practica: 'P', laboratorio: 'L' };
    let horarioLookup: Map<string, { tipo: string; dia: string; hora_inicio: string; hora_fin: string; lugar: string; aula: string }[]> = new Map();
    let noLectivaLookup: Map<string, { dia: string; hora_inicio: string; hora_fin: string; aula: string }[]> = new Map();
    try {
      const res = await fetch(`/api/docentes/${docenteId}/horario?ciclo_id=${cicloAcademicoSeleccionado}`);
      if (res.ok) {
        const json = await res.json();
        const asignaciones: any[] = json.data || [];
        for (const a of asignaciones) {
          if (a.tipo === 'no_lectiva') {
            const key = a.seccion_key || '';
            if (!noLectivaLookup.has(key)) noLectivaLookup.set(key, []);
            noLectivaLookup.get(key)!.push({
              dia: a.dia,
              hora_inicio: (a.hora_inicio || '').slice(0, 5),
              hora_fin: (a.hora_fin || '').slice(0, 5),
              aula: a.ambiente_codigo || 'CUBICULO',
            });
          } else {
            const key = a.curso_codigo || a.curso_nombre || '';
            if (!horarioLookup.has(key)) horarioLookup.set(key, []);
            horarioLookup.get(key)!.push({
              tipo: a.tipo || 'teoria',
              dia: a.dia,
              hora_inicio: (a.hora_inicio || '').slice(0, 5),
              hora_fin: (a.hora_fin || '').slice(0, 5),
              lugar: 'F11',
              aula: a.ambiente_codigo || a.ambiente_nombre || '—',
            });
          }
        }
      }
    } catch { /* si no hay horario, queda vacío -> NO DEFINIDO */ }

    const formatHorarioNoLectiva = (entries: { dia: string; hora_inicio: string; hora_fin: string }[]): string => {
      if (entries.length === 0) return 'NO DEFINIDO';
      const porDia: Record<string, { hora_inicio: string; hora_fin: string }[]> = {};
      for (const e of entries) {
        if (!porDia[e.dia]) porDia[e.dia] = [];
        porDia[e.dia].push({ hora_inicio: e.hora_inicio, hora_fin: e.hora_fin });
      }
      const bloques: string[] = [];
      for (const [dia, hrs] of Object.entries(porDia)) {
        hrs.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
        let merged: { inicio: string; fin: string }[] = [];
        for (const h of hrs) {
          const last = merged[merged.length - 1];
          if (last && last.fin === h.hora_inicio) last.fin = h.hora_fin;
          else merged.push({ inicio: h.hora_inicio, fin: h.hora_fin });
        }
        for (const m of merged) bloques.push(`${diaLabels[dia] || dia}(${m.inicio}-${m.fin})`);
      }
      return bloques.join(', ');
    };

    const formatHorarioF03 = (entries: { tipo: string; dia: string; hora_inicio: string; hora_fin: string }[]): string => {
      if (entries.length === 0) return 'NO DEFINIDO';
      // Group by tipo
      const porTipo: Record<string, { dia: string; hora_inicio: string; hora_fin: string }[]> = {};
      for (const e of entries) {
        const t = tipoLabels[e.tipo] || 'T';
        if (!porTipo[t]) porTipo[t] = [];
        porTipo[t].push({ dia: e.dia, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin });
      }
      // For each tipo, group by day and merge consecutive slots
      const partes: string[] = [];
      for (const [t, slots] of Object.entries(porTipo)) {
        const porDia: Record<string, { hora_inicio: string; hora_fin: string }[]> = {};
        for (const s of slots) {
          if (!porDia[s.dia]) porDia[s.dia] = [];
          porDia[s.dia].push({ hora_inicio: s.hora_inicio, hora_fin: s.hora_fin });
        }
        const bloques: string[] = [];
        for (const [dia, hrs] of Object.entries(porDia)) {
          // Sort by hora_inicio
          hrs.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
          // Merge consecutive
          let merged: { inicio: string; fin: string }[] = [];
          for (const h of hrs) {
            const last = merged[merged.length - 1];
            if (last && last.fin === h.hora_inicio) last.fin = h.hora_fin;
            else merged.push({ inicio: h.hora_inicio, fin: h.hora_fin });
          }
          for (const m of merged) bloques.push(`${diaLabels[dia] || dia}(${m.inicio}-${m.fin})`);
        }
        partes.push(`${t}: ${bloques.join(', ')}`);
      }
      return partes.join('\n');
    };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pw = doc.internal.pageSize.getWidth();
    const ml = 7;
    let y = 10;

    // 1. TITLE
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('HORARIO SEMANAL DE LA CARGA ACADÉMICA DOCENTE (F03-CAD)', pw / 2, y, { align: 'center' });
    y += 7;

    // 2. HEADER BLOCK
    autoTable(doc, {
      body: [
        [
          { content: `Facultad / Filial: ${facultad}`, styles: { fontSize: 8, fontStyle: 'bold' } },
          { content: `Dpto. Académico: ${dpto}`, styles: { fontSize: 8, fontStyle: 'bold' }, colSpan: 2 }
        ],
        [
          { content: `DNI ${dni}`, styles: { fontSize: 8, fontStyle: 'bold' } },
          { content: `Docente: ${apellidosNombre}`, styles: { fontSize: 8, fontStyle: 'bold' } },
          { content: `${categoria}\n${condicionDisplay}`, styles: { fontSize: 8, fontStyle: 'bold', halign: 'center' } }
        ],
        [
          { content: `AÑO ACADEMICO: ${año}  SEMESTRE: ${semestre}  Inicio: ${fechaInicio}  Término: ${fechaFin}`, styles: { fontSize: 7.5, fontStyle: 'bold', halign: 'center' }, colSpan: 3 }
        ]
      ],
      startY: y,
      theme: 'grid',
      styles: { cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      margin: { left: ml, right: ml },
      columnStyles: { 0: { cellWidth: 48 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 } },
      tableLineWidth: 0.5,
      tableLineColor: [0, 0, 0]
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    const headStyle = { fillColor: [220, 230, 241] as [number, number, number], textColor: 0 as number, fontSize: 7.5, fontStyle: 'bold' as const, halign: 'center' as const };
    const cellStyle = { fontSize: 7.5, fontStyle: 'bold' as const };

    // 3. CHL TABLE
    const chlRows: any[] = [];
    let totalLectiva = 0;
    cargasDocente.forEach(ch => {
      if (ch.cursos && ch.cursos.length > 0) {
        ch.cursos.forEach(curso => {
          const cAny = curso as any;
          const ht = cAny.hrs_teo || 0;
          const hp = cAny.hrs_pra || 0;
          const hl = cAny.hrs_lab || 0;
          const tG = cAny.teoria_grupos ?? 1;
          const pG = cAny.practica_grupos ?? 1;
          const lG = cAny.laboratorio_grupos ?? 1;
          const sum = (ht * tG) + (hp * pG) + (hl * lG);
          totalLectiva += sum;
          const codCurso = cAny.curso_codigo || '';
          const horarioEntradas = horarioLookup.get(codCurso) || [];
          const horarioStr = formatHorarioF03(horarioEntradas);
          // Collect unique aulas
          const aulasSet = new Set(horarioEntradas.map(e => e.aula));
          const aulaStr = aulasSet.size > 0 ? [...aulasSet].join(', ') : 'NO DEFINIDO';
          const lugarStr = horarioEntradas.length > 0 ? lugarDisplay : 'NO DEFINIDO';
          const cicloPlan = cAny.ciclo_plan || ch.ciclo_plan || 1;
          const cicloCurso = `${cicloPlan}-C`;
          const escuelaCurso = cAny.escuela || (primeraCarga as any)?.docente_dpto_academico || 'Ingeniería de Sistemas';
          const seccionCurso = cAny.seccion || '';
          const cursoDisplay = `${cAny.curso_nombre || ''} / ${cicloCurso} ${escuelaCurso}${seccionCurso ? ' ' + seccionCurso : ''}`;
          chlRows.push([
            { content: horarioStr, styles: { ...cellStyle, halign: 'center' as const, fontSize: 6 } },
            { content: cursoDisplay, styles: cellStyle },
            { content: lugarStr, styles: { ...cellStyle, halign: 'center' as const, fontSize: 6 } },
            { content: aulaStr, styles: { ...cellStyle, halign: 'center' as const, fontSize: 6.5 } },
            { content: String(sum), styles: { ...cellStyle, halign: 'center' as const } }
          ]);
        });
      }
    });
    if (chlRows.length === 0) {
      chlRows.push([{ content: '—', styles: cellStyle }, { content: 'Sin cursos asignados', styles: cellStyle }, { content: '—', styles: { ...cellStyle, halign: 'center' as const } }, { content: '—', styles: { ...cellStyle, halign: 'center' as const } }, { content: '—', styles: { ...cellStyle, halign: 'center' as const } }]);
    }

    autoTable(doc, {
      head: [[
        { content: 'HORARIO', styles: headStyle },
        { content: 'CARGA HORARIA LECTIVA (CHL)', styles: headStyle },
        { content: 'LUGAR', styles: headStyle },
        { content: 'AULA', styles: headStyle },
        { content: 'TOTAL', styles: headStyle }
      ]],
      body: chlRows,
      startY: y,
      theme: 'grid',
      styles: { cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      margin: { left: ml, right: ml },
      columnStyles: { 0: { cellWidth: 28 }, 2: { cellWidth: 22 }, 3: { cellWidth: 18 }, 4: { cellWidth: 12 } },
      tableLineWidth: 0.5,
      tableLineColor: [0, 0, 0]
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // 4. CHNL TABLE
    const secMapping: { key: string; label: string; field: string | null }[] = [
      { key: 'preparacion', label: 'PREPARACION Y EVALUACION', field: 'preparacion' },
      { key: 'consejeria', label: 'TUTORIA Y CONSEJERIA', field: 'consejeria' },
      { key: 'investigacion', label: 'INVESTIGACION', field: 'investigacion' },
      { key: 'rsu', label: 'RESPONSABILIDAD SOCIAL UNIVERSITARIA', field: 'rsu' },
      { key: 'asesoria', label: 'ASESORÍA DE TESIS Y EXAMENES PROFESIONALES', field: 'asesoria' },
      { key: 'capacitacion', label: 'FORMACION ACADEMICA Y CAPACITACION', field: 'capacitacion' },
      { key: 'autoevaluacion', label: 'AUTOEVALUACION Y/O ACREDITACION DE LA ESCUELA PROFESIONAL', field: null },
      { key: 'comites', label: 'COMITES O COMISIONES ESPECIALES', field: 'comites' },
      { key: 'gobierno', label: 'ACTIVIDADES DE GOBIERNO O AUTORIDAD', field: 'gobierno' },
      { key: 'administracion', label: 'ACTIVIDADES DE GESTION INSTITUCIONAL', field: 'administracion' },
    ];

    const secciones: Record<string, any> = {};
    cargasDocente.forEach((ch: any) => {
      for (const s of secMapping) {
        if (s.field && ch[s.field]) {
          if (!secciones[s.field]) {
            secciones[s.field] = ch[s.field];
          } else if (Array.isArray(ch[s.field])) {
            // Merge arrays if they exist
            if (!Array.isArray(secciones[s.field])) {
              secciones[s.field] = [secciones[s.field]];
            }
            secciones[s.field] = [...secciones[s.field], ...ch[s.field]];
          }
        }
      }
    });

    let totalNoLectiva = 0;
    const chnlRows: any[] = [];
    for (const s of secMapping) {
      // Calculate total hours from all items in the section
      let hr = 0;
      if (s.field && secciones[s.field]) {
        if (Array.isArray(secciones[s.field])) {
          hr = secciones[s.field].reduce((sum: number, item: any) => sum + (item.horas || 0), 0);
        } else {
          hr = secciones[s.field]?.horas || 0;
        }
      }
      totalNoLectiva += hr;
      // Build horario entries from the section data (which has dia/hora_inicio/hora_fin from the grid)
      let horarioEntradas: { dia: string; hora_inicio: string; hora_fin: string }[] = [];
      if (s.field && secciones[s.field]) {
        const secData = secciones[s.field];
        if (Array.isArray(secData)) {
          horarioEntradas = secData
            .filter((item: any) => item.dia && item.hora_inicio)
            .map((item: any) => ({
              dia: item.dia,
              hora_inicio: (item.hora_inicio || '').slice(0, 5),
              hora_fin: (item.hora_fin || '').slice(0, 5),
            }));
        } else if (secData.items && Array.isArray(secData.items)) {
          horarioEntradas = secData.items
            .filter((item: any) => item.dia && item.hora_inicio)
            .map((item: any) => ({
              dia: item.dia,
              hora_inicio: (item.hora_inicio || '').slice(0, 5),
              hora_fin: (item.hora_fin || '').slice(0, 5),
            }));
        }
      }
      const horarioStr = formatHorarioNoLectiva(horarioEntradas);
      const aulaStr = horarioEntradas.length > 0 ? 'CUBICULO' : 'CUBICULO';
      const lugarStr = horarioEntradas.length > 0 ? 'OA' : lugarDisplay;
      chnlRows.push([
        { content: horarioStr, styles: { ...cellStyle, halign: 'center' as const, fontSize: 6 } },
        { content: s.label, styles: cellStyle },
        { content: lugarStr, styles: { ...cellStyle, halign: 'center' as const, fontSize: 5.5 } },
        { content: aulaStr, styles: { ...cellStyle, halign: 'center' as const, fontSize: 6 } },
        { content: String(hr), styles: { ...cellStyle, halign: 'center' as const } }
      ]);
    }

    autoTable(doc, {
      head: [[
        { content: 'HORARIO', styles: headStyle },
        { content: 'CARGA HORARIA NO LECTIVA (CHNL)', styles: headStyle },
        { content: 'LUGAR', styles: headStyle },
        { content: 'AULA', styles: headStyle },
        { content: 'TOTAL', styles: headStyle }
      ]],
      body: chnlRows,
      startY: y,
      theme: 'grid',
      styles: { cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.5 },
      margin: { left: ml, right: ml },
      columnStyles: { 0: { cellWidth: 28 }, 2: { cellWidth: 22 }, 3: { cellWidth: 18 }, 4: { cellWidth: 12 } },
      tableLineWidth: 0.5,
      tableLineColor: [0, 0, 0]
    });
    y = (doc as any).lastAutoTable.finalY;

    // 5. TOTAL ROW
    const totalGeneral = totalLectiva + totalNoLectiva;
    autoTable(doc, {
      body: [[
        { content: 'TOTAL HORAS CARGA ACADÉMICA', styles: { fillColor: [220, 230, 241], fontSize: 8.5, fontStyle: 'bold', halign: 'center' }, colSpan: 4 },
        { content: String(totalGeneral), styles: { fillColor: [220, 230, 241], fontSize: 8.5, fontStyle: 'bold', halign: 'center' } }
      ]],
      startY: y,
      theme: 'grid',
      styles: { cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.5 },
      margin: { left: ml, right: ml },
      tableLineWidth: 0.5,
      tableLineColor: [0, 0, 0]
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // 6. LEGEND
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const legend = [
      'T: TEORIA - P: PRACTICA',
      'LU (LUNES); MA (MARTES); MI (MIERCOLES); JU (JUEVES); VI (VIERNES); TIEMPO EN FORMATO DE 24 HORAS.',
      'LUGAR: (F01: "CC. Agropecuarias", F02: "CC. Biológicas"; F03: "CC. Económicas"; F04: "CC. Físicas y Matemáticas"; F05: "CC. Sociales"; F06: "Derecho y Ciencias Políticas"; F07: "Educación y Comunicación"; F08: "Enfermería"; F09: "Estomatología"; F10: "Farmacia y Bioquímica"; F11: "Ingeniería"; F12: "Ingeniería Química"; F13: "Medicina"; F14: "Filial Valle Jequetepeque"; F15: "Filial Huamachuco"; F16: "Filial Santiago de Chuco"; OA: "Oficina Administrativa"; SC: "Salida de Campo").'
    ];
    for (const line of legend) {
      const lines = doc.splitTextToSize(line, pw - ml * 2);
      lines.forEach((l: string) => { doc.text(l, ml, y); y += 3.8; });
    }
    y += 6;

    // 7. SIGNATURES
    const colW3 = (pw - ml * 2) / 3;
    const centers = [ml + colW3 / 2, ml + colW3 * 1.5, ml + colW3 * 2.5];
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    centers.forEach((cx, i) => {
      doc.line(cx - 25, y, cx + 25, y);
      const labels = ['FIRMA DEL DOCENTE', 'FIRMA Y SELLO DEL DIRECTOR DE DPTO. ACADÉMICO', "V° B° DECANO"];
      doc.text(labels[i], cx, y + 5, { align: 'center' });
    });
    y += 11;

    // 8. DATE & EMAIL
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const fechaReg = `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    const email = dAny?.email || '—';

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`FECHA DE REGISTRO: (${fechaReg})    EMAIL: ${email}`, ml, y);

    if (returnBlob) {
          return doc;
        }
        doc.save(`F03-CAD-${apellidosNombre.replace(/[\s,]+/g, '-')}.pdf`);
        return null;
  }

  // Obtener todos los ciclos de estudio (I-X)
  const todosLosCiclos = Array.from({ length: 10 }, (_, i) => i + 1);

  const ciclosFiltrados = todosLosCiclos.filter(c => {
    const cicloStr = getRomanNumeral(c).toLowerCase();
    const cicloNumStr = c.toString();
    const searchLower = buscarCiclo.toLowerCase();
    return cicloStr.includes(searchLower) || cicloNumStr.includes(searchLower);
  });

  // Agrupar carga horaria por ciclo_plan (even without courses)
  const cargaPorCiclo: Record<number, CargaHoraria[]> = {};
  const cursoCicloMap: Record<number, { curso: Curso, cargaHoraria: CargaHoraria }[]> = {};
  const cursosAsignadosPorCiclo: Record<number, number> = {};
  const totalCursosPorCicloFromDB = totalCursosPorCiclo; // From API
  
  console.log('🔹 Processing cargaHoraria array:', cargaHoraria);
  
  cargaHoraria.forEach((ch, index) => {
    console.log(`🔹 Processing cargaHoraria index ${index}:`, ch);
    // Add carga horaria to its ciclo_plan group (even if no cursos)
    const cp = ch.ciclo_plan || 1;
    console.log(`🔹 cp (ciclo_plan) is:`, cp);
    if (!cargaPorCiclo[cp]) {
      cargaPorCiclo[cp] = [];
    }
    cargaPorCiclo[cp].push(ch);
    console.log(`🔹 cargaPorCiclo[${cp}] updated to:`, cargaPorCiclo[cp]);
    
    // Also add any cursos to cursoCicloMap
    if (ch.cursos && ch.cursos.length > 0) {
      ch.cursos.forEach(curso => {
        const cursoCp = curso.ciclo_plan || cp;
        if (!cursoCicloMap[cursoCp]) {
          cursoCicloMap[cursoCp] = [];
        }
        cursoCicloMap[cursoCp].push({ curso, cargaHoraria: ch });
        cursosAsignadosPorCiclo[cursoCp] = (cursosAsignadosPorCiclo[cursoCp] || 0) + 1;
      });
    }
  });
  
  console.log('🔹 Carga horaria state after grouping:', cargaHoraria);
  console.log('🔹 cursoCicloMap after grouping:', cursoCicloMap);
  console.log('🔹 cargaPorCiclo:', cargaPorCiclo);
  console.log('🔹 totalCursosPorCicloFromDB:', totalCursosPorCicloFromDB);
  console.log('🔹 todosLosCiclos:', todosLosCiclos);

  // Helper function to remove accents and special characters
  const normalizeText = (text: string) => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  const docentesFiltrados = docentes.filter(d =>
    d.activo && (
      normalizeText(d.nombre || '').includes(normalizeText(buscarDocente)) ||
      normalizeText(d.apellidos || '').includes(normalizeText(buscarDocente)) ||
      normalizeText(d.dni || '').includes(normalizeText(buscarDocente))
    )
  );

  const miCargaBloqueada = isDocente && user?.docente_id
      ? cargaHoraria.some(ch => ch.docente_id === user.docente_id && ch.formatos_generados)
      : false;

    const docentesFiltradosReporte = allDocentes.filter(d =>
    d.activo && (
      normalizeText(d.nombre || '').includes(normalizeText(buscarDocenteReporte)) ||
      normalizeText(d.apellidos || '').includes(normalizeText(buscarDocenteReporte)) ||
      normalizeText(d.dni || '').includes(normalizeText(buscarDocenteReporte))
    )
  );

  
  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: 12,
          background: toast.type === 'success' ? '#f0fdf4' : '#fff5f5',
          border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: toast.type === 'success' ? '#166534' : '#991b1b',
          fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
          animation: 'slideIn 0.2s ease',
        }}>
          {toast.type === 'success'
            ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          }
          {toast.text}
        </div>
      )}

      {/* Encabezado */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Carga Horaria</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Asignación de carga horaria a docentes por ciclo</p>
          </div>
          
          {/* Selector de ciclo académico - mostrar en ambas pestañas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Ciclo académico:</label>
            <select
              value={cicloAcademicoSeleccionado}
              onChange={e => setCicloAcademicoSeleccionado(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="">Seleccionar...</option>
              {ciclosAcademicos.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.activo ? '(Activo)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '24px'
        }}>
          <button
            onClick={() => setActiveTab('carga-horaria')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'carga-horaria' ? '600' : '500',
              color: activeTab === 'carga-horaria' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'carga-horaria' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            Carga Horaria
          </button>
          <button
            onClick={() => setActiveTab('carga-aula')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'carga-aula' ? '600' : '500',
              color: activeTab === 'carga-aula' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'carga-aula' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            Carga por Aula
          </button>
          {(user?.rol.codigo === 'secretaria' || isDirector) && (
            <button
              onClick={() => setActiveTab('carga-docentes')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeTab === 'carga-docentes' ? '600' : '500',
                color: activeTab === 'carga-docentes' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'carga-docentes' ? '2px solid #3b82f6' : '2px solid transparent',
                marginBottom: '-1px'
              }}
            >
              Carga por Docentes
            </button>
          )}
          <button
            onClick={() => setActiveTab('carga-observaciones')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'carga-observaciones' ? '600' : '500',
              color: activeTab === 'carga-observaciones' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'carga-observaciones' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            💬 Carga Observaciones
          </button>
          <button
            onClick={() => setActiveTab('reportes')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'reportes' ? '600' : '500',
              color: activeTab === 'reportes' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'reportes' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            Formatos
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'carga-horaria' ? (
        // Pestaña Carga Horaria (contenido original)
        <>
          {!cicloAcademicoSeleccionado ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40vh',
              padding: '40px',
              textAlign: 'center'
            }}>
              <div style={{ color: 'var(--text-secondary)' }}>
                <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p style={{ fontSize: '16px', margin: 0 }}>Selecciona un ciclo académico para comenzar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Filtros */}
              {(!isDocente || !miCargaBloqueada) && (
             <div className="card" style={{ marginBottom: '16px', padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end', justifyContent: 'space-between' }}>
                  {!isDocente ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Buscar ciclo</label>
                        <input
                          className="form-input"
                          style={{ width: '200px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px' }}
                          placeholder="I, II, III..."
                          value={buscarCiclo}
                          onChange={e => setBuscarCiclo(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Filtros</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                          <input
                            type="checkbox"
                            checked={filtroSinAsignacion}
                            onChange={e => setFiltroSinAsignacion(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          Solo sin asignación
                        </label>
                      </div>
                    </div>
                  ) : <div />}
                  <div>
                    {(canWrite || isDocente) && !miCargaBloqueada && (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          if (cicloAcademicoSeleccionado) {
                            const docenteParam = isDocente && user?.docente_id ? `&docenteId=${user.docente_id}` : '';
                            router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademicoSeleccionado}&reset=true${docenteParam}`);
                          } else {
                            setToast({ type: 'error', text: 'Primero selecciona un ciclo académico' });
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        disabled={!cicloAcademicoSeleccionado}
                      >
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                        </svg>
                        {isDocente ? 'Agregar Carga' : 'Asignar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
              {/* Accordion de ciclos de estudio */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loadingCiclos ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    Cargando...
                  </div>
                ) : ciclosFiltrados.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    {filtroSinAsignacion ? 'Todos los ciclos tienen asignación' : 'No hay ciclos disponibles'}
                  </div>
                ) : ciclosFiltrados.map(ciclo => {
                  const cargasEnCiclo = cargaPorCiclo[ciclo] || [];
                  const cursosEnCiclo = cursoCicloMap[ciclo] || [];
                  if (filtroSinAsignacion && (cargasEnCiclo.length > 0 || cursosEnCiclo.length > 0)) {
                    return null;
                  }
                  const isExpanded = ciclosExpandidos.has(ciclo);
                  // Get unique docentes in this ciclo
                  const docentesEnCiclo = Array.from(new Set([
                    ...cursosEnCiclo.map(c => c.cargaHoraria.docente_id),
                    ...cargasEnCiclo.map(ch => ch.docente_id)
                  ]));
                  
                  return (
                    <div key={ciclo} className="card" style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px 20px',
                          cursor: 'pointer',
                          background: 'var(--bg-secondary)',
                          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none'
                        }}
                        onClick={() => toggleCiclo(ciclo)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                            Ciclo {getRomanNumeral(ciclo)}
                          </h3>
                          {docentesEnCiclo.length > 0 && (
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '500',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: '#e0f2fe',
                              color: '#0369a1'
                            }}>
                              {docentesEnCiclo.length} docente{docentesEnCiclo.length > 1 ? 's' : ''}
                            </span>
                          )}
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '500',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            background: '#f0fdf4',
                            color: '#166534'
                          }}>
                            {cursosAsignadosPorCiclo[ciclo] || 0}/{totalCursosPorCicloFromDB[ciclo] || 0} cursos
                          </span>
                        </div>
                        <svg
                          style={{
                            width: '20px',
                            height: '20px',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                          }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: '0' }}>
                          {/* First check if we have any courses in this ciclo */}
                          {(!cursoCicloMap[ciclo] || cursoCicloMap[ciclo].length === 0) && cargasEnCiclo.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                              Aún no se asigna a los docentes carga horaria para este ciclo
                            </div>
                          ) : (
                            <div className="table-container">
                              <table className="data-table" style={{ border: 'none', margin: 0 }}>
                                  <thead>
                                    <tr>
                                      <th>Ciclo</th>
                                      <th>Curso</th>
                                      <th>Docente</th>
                                      <th>H.T</th>
                                      <th>H.P</th>
                                      <th>H.L</th>
                                      <th>Total</th>
                                      <th>Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {/* Render docentes with courses first */}
                                    {(cursoCicloMap[ciclo] || []).map(({ curso, cargaHoraria: ch }) => {
                                      const ht = curso.hrs_teo || 0;
                                      const hp = curso.hrs_pra || 0;
                                      const hl = curso.hrs_lab || 0;
                                      const tG = (curso as any).teoria_grupos ?? 1;
                                      const pG = (curso as any).practica_grupos ?? 1;
                                      const lG = (curso as any).laboratorio_grupos ?? 1;
                                      const total = (ht * tG) + (hp * pG) + (hl * lG);
                                      return (
                                      <tr key={`${ch.id}-${curso.id || curso.curso_id}`}>
                                        <td style={{ verticalAlign: 'middle' }}>
                                          {getRomanNumeral(ciclo)}
                                        </td>
                                        <td>{curso.curso_nombre || curso.nombre} ({curso.seccion})</td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                          {ch.docente_apellidos}, {ch.docente_nombre}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>{ht > 0 ? `${ht}×${tG}` : '—'}</td>
                                        <td style={{ textAlign: 'center' }}>{hp > 0 ? `${hp}×${pG}` : '—'}</td>
                                        <td style={{ textAlign: 'center' }}>{hl > 0 ? `${hl}×${lG}` : '—'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{total}h</td>
                                      <td style={{ verticalAlign: 'middle' }}>
                                        {(canManageCarga || (isDocente && user?.docente_id === ch.docente_id)) && (
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            {canManageCarga && (
                                              <button
                                                className="btn-secondary"
                                                style={{ 
                                                  padding: '6px 8px', 
                                                  fontSize: '11px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px'
                                                }}
                                                onClick={() => router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademicoSeleccionado}&docenteId=${ch.docente_id}`)}
                                              >
                                                <Edit2 size={14} />
                                                {isSecretaria ? 'Visualizar' : 'Editar'}
                                              </button>)}
                                            {isDocente && user?.docente_id === ch.docente_id && (
                                              <button
                                                className="btn-secondary"
                                                style={{ 
                                                  padding: '6px 8px', 
                                                  fontSize: '11px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px'
                                                }}
                                                onClick={() => router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademicoSeleccionado}&docenteId=${ch.docente_id}`)}
                                              >
                                                {ch.formatos_generados ? <Eye size={14} /> : <Edit2 size={14} />}
                                                {ch.formatos_generados ? 'Visualizar' : 'Editar'}
                                              </button>
                                            )}
                                            {canManageCarga && (
                                              <button
                                                className="btn-secondary btn-crud-deactivate"
                                                style={{ 
                                                  padding: '6px 8px', 
                                                  fontSize: '11px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px'
                                                }}
                                                onClick={() => eliminarCargaHoraria(ch.id)}
                                                disabled={saving}
                                              >
                                                <Trash2 size={14} />
                                                Eliminar
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Now render docentes with no courses */}
                                  {cargasEnCiclo.map((ch) => {
                                    // Skip if this docente already has courses shown
                                     if ((cursoCicloMap[ciclo] || []).some(c => c.cargaHoraria.id === ch.id)) {
                                       return null;
                                     }
                                     return (
                                       <tr key={`${ch.id}-no-course`}>
                                         <td style={{ verticalAlign: 'middle' }}>
                                           {getRomanNumeral(ciclo)}
                                         </td>
                                         <td style={{ color: '#94a3b8' }}>Sin cursos asignados</td>
                                         <td style={{ verticalAlign: 'middle' }}>
                                           {ch.docente_apellidos}, {ch.docente_nombre}
                                         </td>
                                         <td style={{ textAlign: 'center', color: '#94a3b8' }}>—</td>
                                         <td style={{ textAlign: 'center', color: '#94a3b8' }}>—</td>
                                         <td style={{ textAlign: 'center', color: '#94a3b8' }}>—</td>
                                         <td style={{ textAlign: 'center', fontWeight: 600 }}>{ch.horas_asignadas}h</td>
<td style={{ verticalAlign: 'middle' }}>
                                        {(canManageCarga || (isDocente && user?.docente_id === ch.docente_id)) && (
                                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {ch.formatos_generados && (
                                              <span title="Formatos generados — edición bloqueada" style={{ fontSize: '16px' }}>🔒</span>
                                            )}
                                            {canManageCarga && (
                                              <button
                                                className="btn-secondary"
                                                style={{ 
                                                  padding: '6px 8px', 
                                                  fontSize: '11px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px'
                                                }}
                                                onClick={() => router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademicoSeleccionado}&docenteId=${ch.docente_id}`)}
                                              >
                                                <Edit2 size={14} />
                                                {isSecretaria ? 'Visualizar' : 'Editar'}
                                              </button>
                                            )}
                                            {isDocente && user?.docente_id === ch.docente_id && !ch.formatos_generados && (
                                              <button
                                                className="btn-secondary"
                                                style={{ 
                                                  padding: '6px 8px', 
                                                  fontSize: '11px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px'
                                                }}
                                                onClick={() => router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademicoSeleccionado}&docenteId=${ch.docente_id}`)}
                                              >
                                                <Edit2 size={14} />
                                                Editar
                                              </button>
                                            )}
                                            {canManageCarga && ch.formatos_generados && (
                                              <button
                                                className="btn-secondary"
                                                style={{ padding: '6px 8px', fontSize: '11px', background: '#fef9c3', color: '#854d0e' }}
                                                onClick={async () => {
                                                  await fetch(`/api/carga-horaria/${ch.id}/bloquear`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ formatos_generados: false })
                                                  });
                                                  const params = new URLSearchParams();
                                                  params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
                                                  const data = await (await fetch(`/api/carga-horaria?${params}`)).json();
                                                  setCargaHoraria(data.data || []);
                                                  setToast({ type: 'success', text: 'Carga horaria desbloqueada' });
                                                }}
                                              >
                                                🔓 Desbloquear
                                              </button>
                                            )}
                                            {canManageCarga && (
                                              <button
                                                className="btn-secondary btn-crud-deactivate"
                                                style={{ 
                                                  padding: '6px 8px', 
                                                  fontSize: '11px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '6px'
                                                }}
                                                onClick={() => eliminarCargaHoraria(ch.id)}
                                                disabled={saving}
                                              >
                                                <Trash2 size={14} />
                                                Eliminar
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Modal para asignar docentes */}
          {showModal && (
            <div className="modal-overlay">
              <div className="modal" style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                  <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                    Asignar docentes - Ciclo {getRomanNumeral(cicloPlanSeleccionado || 0)}
                  </h2>
                  <button onClick={cerrarModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
                <div className="modal-body">
                  {/* Buscar docente */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                      Buscar docente
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="form-input"
                        style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px' }}
                        placeholder="Nombre, apellidos o código..."
                        value={buscarDocente}
                        onChange={e => setBuscarDocente(e.target.value)}
                      />
                      <select
                        value={docenteSeleccionado}
                        onChange={e => setDocenteSeleccionado(e.target.value)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                          cursor: 'pointer',
                          minWidth: '200px'
                        }}
                      >
                        <option value="">Seleccionar docente...</option>
                        {docentesFiltrados.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.apellidos}, {d.nombre} ({d.dni || d.codigo})
                          </option>
                        ))}
                      </select>
                      {canWrite && (
                        <button
                          className="btn-primary"
                          onClick={asignarDocente}
                          disabled={saving || !docenteSeleccionado}
                        >
                          {saving ? 'Agregando...' : 'Agregar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tabla de docentes asignados */}
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px', color: 'var(--text-secondary)' }}>
                      Docentes asignados
                    </h3>
                    {!cargaPorCiclo[cicloPlanSeleccionado || 0] || cargaPorCiclo[cicloPlanSeleccionado || 0].length === 0 ? (
                      <p style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                        No hay docentes asignados a este ciclo
                      </p>
                    ) : (
                      <table className="data-table" style={{ fontSize: '13px' }}>
                        <thead>
                          <tr>
                            <th>Docente</th>
                            <th>Código</th>
                            <th>Horas</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(cargaPorCiclo[cicloPlanSeleccionado || 0] || []).map(ch => (
                            <tr key={ch.id}>
                              <td>{ch.docente_apellidos}, {ch.docente_nombre}</td>
                              <td>{ch.docente_codigo}</td>
                              <td>{ch.horas_asignadas}h</td>
                              <td>
                                {canWrite && (
                                  <button
                                    className="btn-secondary btn-crud-deactivate"
                                    style={{ padding: '4px 8px', fontSize: '11px' }}
                                    onClick={() => eliminarCargaHoraria(ch.id)}
                                    disabled={saving}
                                  >
                                    Eliminar
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={cerrarModal}>Cerrar</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'carga-aula' ? (
        // Pestaña Carga por Aula
        <>
          {!cicloAcademicoSeleccionado ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Selecciona un ciclo académico para ver la carga por aula
            </div>
          ) : (
            <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px' }}>Horario por Aula</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  Distribución de cursos, docentes y horarios asignados por cada ambiente
                </p>
              </div>
              {loadingAula ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Cargando horario...</div>
              ) : aulaData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No hay horarios publicados para este ciclo académico
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Aula</th>
                        <th>Tipo</th>
                        <th>Curso</th>
                        <th>Grupo</th>
                        <th>Docente</th>
                        <th>Día</th>
                        <th>Horario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const agrupado = new Map<string, any[]>();
                        for (const row of aulaData) {
                          const key = row.ambiente_nombre;
                          if (!agrupado.has(key)) agrupado.set(key, []);
                          agrupado.get(key)!.push(row);
                        }
                        const rows: any[] = [];
                        const diaLabels: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb' };
                        const diasOrd: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
                        for (const [aula, entries] of agrupado) {
                          const tipo = entries[0].ambiente_tipo?.replace('_', ' ') || '';
                          // Sort by day then hour
                          entries.sort((a, b) => (diasOrd[a.dia] || 0) - (diasOrd[b.dia] || 0) || a.hora_inicio.localeCompare(b.hora_inicio));
                          // Merge consecutive slots (same day+curso+grupo+docente where hora_fin = next hora_inicio)
                          const merged: any[] = [];
                          for (const e of entries) {
                            const last = merged[merged.length - 1];
                            if (last && last.dia === e.dia && last.curso_codigo === e.curso_codigo &&
                                last.numero_grupo === e.numero_grupo && last.docente_nombre === e.docente_nombre &&
                                last.hora_fin === e.hora_inicio) {
                              last.hora_fin = e.hora_fin;
                            } else {
                              merged.push({ ...e });
                            }
                          }
                          rows.push(
                            <tr key={`${aula}-hdr`} style={{ background: 'var(--bg-secondary)' }}>
                              <td style={{ fontWeight: 600, verticalAlign: 'middle' }} rowSpan={merged.length + 1}>{aula}</td>
                            </tr>
                          );
                          for (const e of merged) {
                            rows.push(
                              <tr key={`${aula}-${e.dia}-${e.hora_inicio}-${e.curso_codigo}`}>
                                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tipo === 'laboratorio' ? 'Lab' : tipo === 'aula' ? 'Aula' : tipo}</td>
                                <td>{e.curso_codigo} - {e.curso_nombre}</td>
                                <td style={{ textAlign: 'center' }}>{e.numero_grupo}</td>
                                <td>{e.docente_nombre}</td>
                                <td style={{ textAlign: 'center' }}>{diaLabels[e.dia] || e.dia}</td>
                                <td style={{ textAlign: 'center' }}>{e.hora_inicio} - {e.hora_fin}</td>
                              </tr>
                            );
                          }
                        }
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : activeTab === 'carga-docentes' ? (
        <>
        <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          {!cicloAcademicoSeleccionado ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              Selecciona un ciclo académico para ver la carga por docentes
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Buscar por nombre</label>
                  <input
                    className="form-input"
                    style={{ width: '250px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px' }}
                    placeholder="Nombre, apellidos o código..."
                    value={filtroNombreDocente}
                    onChange={e => setFiltroNombreDocente(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Estado de carga</label>
                  <select
                    value={filtroEstadoCarga}
                    onChange={e => setFiltroEstadoCarga(e.target.value as 'todos' | 'llenado' | 'no_llenado')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      minWidth: '150px'
                    }}
                  >
                    <option value="todos">Todos</option>
                    <option value="llenado">Con carga</option>
                    <option value="no_llenado">Sin carga</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Filtrar por curso</label>
                  <input
                    className="form-input"
                    style={{ width: '200px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px' }}
                    placeholder="Código de curso..."
                    value={filtroCurso}
                    onChange={e => setFiltroCurso(e.target.value)}
                  />
                </div>
              </div>

              {/* Estadísticas */}
              <div style={{ marginBottom: '20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  <strong>Total docentes:</strong> {docentesCarga.length}
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #86efac', fontSize: '14px', color: '#166534' }}>
                  <strong>Con carga:</strong> {docentesCarga.filter(d => d.tiene_carga).length}
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fca5a5', fontSize: '14px', color: '#991b1b' }}>
                  <strong>Sin carga:</strong> {docentesCarga.filter(d => !d.tiene_carga).length}
                </div>
              </div>

              {/* Tabla de docentes */}
              {loadingDocentesCarga ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  Cargando...
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Código</th>
                        <th>Docente</th>
                        <th>Condición</th>
                        <th>Categoría</th>
                        <th>Cursos asignados</th>
                        <th>Horas lectivas</th>
                        <th>Horas no lectivas</th>
                        <th>Horas totales</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtrados = docentesCarga.filter(d => {
                          const matchNombre = !filtroNombreDocente || 
                            (d.nombre?.toLowerCase().includes(filtroNombreDocente.toLowerCase()) ||
                             d.apellidos?.toLowerCase().includes(filtroNombreDocente.toLowerCase()) ||
                             d.codigo?.toLowerCase().includes(filtroNombreDocente.toLowerCase()));
                          
                          const matchEstado = filtroEstadoCarga === 'todos' ||
                            (filtroEstadoCarga === 'llenado' && d.tiene_carga) ||
                            (filtroEstadoCarga === 'no_llenado' && !d.tiene_carga);
                          
                          const matchCurso = !filtroCurso || 
                            d.cursos_asignados?.some((c: any) => c.curso_codigo?.toLowerCase().includes(filtroCurso.toLowerCase()));
                          
                          return matchNombre && matchEstado && matchCurso;
                        });

                        if (filtrados.length === 0) {
                          return (
                            <tr>
                              <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                No se encontraron docentes con los filtros aplicados
                              </td>
                            </tr>
                          );
                        }

                        // Paginación
                        const ITEMS_PER_PAGE = 10;
                        const totalPages = Math.ceil(filtrados.length / ITEMS_PER_PAGE);
                        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
                        const endIndex = startIndex + ITEMS_PER_PAGE;
                        const paginados = filtrados.slice(startIndex, endIndex);

                        return paginados.map(d => (
                          <tr key={d.id}>
                            <td style={{ textAlign: 'center' }}>
                              {d.tiene_carga ? (
                                <span style={{ 
                                  padding: '4px 8px', 
                                  borderRadius: '12px', 
                                  background: '#f0fdf4', 
                                  color: '#166534', 
                                  fontSize: '11px', 
                                  fontWeight: '600' 
                                }}>
                                  ✅ Llenado
                                </span>
                              ) : (
                                <span style={{ 
                                  padding: '4px 8px', 
                                  borderRadius: '12px', 
                                  background: '#fef2f2', 
                                  color: '#991b1b', 
                                  fontSize: '11px', 
                                  fontWeight: '600' 
                                }}>
                                  ❌ Sin carga
                                </span>
                              )}
                            </td>
                            <td>{d.codigo || '—'}</td>
                            <td>{d.apellidos}, {d.nombre}</td>
                            <td>{d.condicion || '—'}</td>
                            <td>{d.categoria || '—'}</td>
                            <td>
                              {d.cursos_asignados?.length > 0 ? (
                                <div style={{ fontSize: '12px' }}>
                                  {d.cursos_asignados.map((c: any) => c.curso_codigo).join(', ')}
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>{d.horas_lectivas || 0}</td>
                            <td style={{ textAlign: 'center' }}>{d.horas_no_lectivas || 0}</td>
                            <td style={{ textAlign: 'center' }}>{(d.horas_lectivas || 0) + (d.horas_no_lectivas || 0)}</td>
                            <td>
                              <button
                                onClick={() => router.push(`/carga-horaria/nuevo?docenteId=${d.id}&cicloAcademico=${cicloAcademicoSeleccionado}`)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #3b82f6',
                                  background: 'transparent',
                                  color: '#3b82f6',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Controles de paginación */}
              {(() => {
                const ITEMS_PER_PAGE = 10;
                const filtrados = docentesCarga.filter(d => {
                  const matchNombre = !filtroNombreDocente || 
                    (d.nombre?.toLowerCase().includes(filtroNombreDocente.toLowerCase()) ||
                     d.apellidos?.toLowerCase().includes(filtroNombreDocente.toLowerCase()) ||
                     d.codigo?.toLowerCase().includes(filtroNombreDocente.toLowerCase()));
                  
                  const matchEstado = filtroEstadoCarga === 'todos' ||
                    (filtroEstadoCarga === 'llenado' && d.tiene_carga) ||
                    (filtroEstadoCarga === 'no_llenado' && !d.tiene_carga);
                  
                  const matchCurso = !filtroCurso || 
                    d.cursos_asignados?.some((c: any) => c.curso_codigo?.toLowerCase().includes(filtroCurso.toLowerCase()));
                  
                  return matchNombre && matchEstado && matchCurso;
                });

                const totalPages = Math.ceil(filtrados.length / ITEMS_PER_PAGE);
                
                if (totalPages <= 1) return null;

                return (
                  <div style={{ 
                    marginTop: '20px', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '8px' 
                  }}>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        fontSize: '14px'
                      }}
                    >
                      Anterior
                    </button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: currentPage === page ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                          background: currentPage === page ? '#3b82f6' : 'var(--bg-card)',
                          color: currentPage === page ? '#ffffff' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: currentPage === page ? '600' : '400'
                        }}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        fontSize: '14px'
                      }}
                    >
                      Siguiente
                    </button>
                    
                    <span style={{ marginLeft: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Página {currentPage} de {totalPages} ({filtrados.length} registros)
                    </span>
                  </div>
                );
              })()}
            </>
          )}
        </div>
        </>
      ) : activeTab === 'carga-observaciones' ? (
        // Pestaña Carga Observaciones (per-course observations from carga_horaria_cursos)
        <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          {!cicloAcademicoSeleccionado ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              Selecciona un ciclo académico para ver las observaciones de carga horaria
            </div>
          ) : (
            <>
              {(() => {
                const filas = cargaHoraria
                  .filter(ch => isDocente ? ch.docente_id === user?.docente_id : true)
                  .flatMap(ch => (ch.cursos || [])
                    .filter((c: any) => c.observaciones && c.observaciones.trim())
                    .map((c: any) => ({
                      ...c,
                      docente_id: ch.docente_id,
                      docente_nombre: ch.docente_nombre,
                      docente_apellidos: ch.docente_apellidos,
                    }))
                  );
                if (filas.length === 0) {
                  return (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'200px',textAlign:'center',color:'var(--text-secondary)'}}>
                      No hay observaciones de carga horaria para este ciclo académico
                    </div>
                  );
                }
                return (
                  <>
                    <div style={{marginBottom:'20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <h3 style={{fontSize:'16px',fontWeight:'600',color:'var(--text-primary)',margin:0}}>
                        Observaciones de Carga Horaria ({filas.length})
                      </h3>
                    </div>
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Docente</th>
                            <th>Curso</th>
                            <th>Observación</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map((curso: any, idx: number) => (
                            <tr key={curso.id || idx}>
                              <td style={{fontWeight:'500'}}>{curso.docente_apellidos}, {curso.docente_nombre}</td>
                              <td>{curso.curso_codigo} - {curso.curso_nombre}</td>
                              <td style={{maxWidth:'300px',wordWrap:'break-word'}}>{curso.observaciones}</td>
                              <td style={{textAlign:'center'}}>
                                <span className={`badge-${curso.estado_observaciones === 'validada' ? 'success' : curso.estado_observaciones === 'rechazada' ? 'danger' : 'warning'}`}
                                  style={{fontSize:'11px',padding:'2px 8px',borderRadius:'9999px',fontWeight:'600',textTransform:'uppercase'}}>
                                  {curso.estado_observaciones || 'pendiente'}
                                </span>
                              </td>
                              <td>
                                <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                                  {(isAdmin || isSecretaria) && curso.estado_observaciones !== 'validada' && (
                                    <button className="btn-primary" style={{padding:'4px 10px',fontSize:'11px'}}
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/carga-horaria/cursos/${curso.id}`, {
                                            method: 'PATCH',
                                            headers: {'Content-Type':'application/json'},
                                            body: JSON.stringify({estado_observaciones:'validada'}),
                                          });
                                          if (res.ok) {
                                            setCargaHoraria(prev => prev.map(ch => ({
                                              ...ch,
                                              cursos: (ch.cursos || []).map((c: any) =>
                                                c.id === curso.id ? {...c, estado_observaciones:'validada'} : c
                                              ),
                                            })));
                                          }
                                        } catch(e) {}
                                      }}>
                                      Validar
                                    </button>
                                  )}
                                  {(isAdmin || isSecretaria) && curso.estado_observaciones !== 'rechazada' && (
                                    <button className="btn-danger" style={{padding:'4px 10px',fontSize:'11px'}}
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/carga-horaria/cursos/${curso.id}`, {
                                            method: 'PATCH',
                                            headers: {'Content-Type':'application/json'},
                                            body: JSON.stringify({estado_observaciones:'rechazada'}),
                                          });
                                          if (res.ok) {
                                            setCargaHoraria(prev => prev.map(ch => ({
                                              ...ch,
                                              cursos: (ch.cursos || []).map((c: any) =>
                                                c.id === curso.id ? {...c, estado_observaciones:'rechazada'} : c
                                              ),
                                            })));
                                          }
                                        } catch(e) {}
                                      }}>
                                      Rechazar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      ) : activeTab === 'reportes' ? (
        // Pestaña Reportes
        <>
        <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
          {!cicloAcademicoSeleccionado ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minHeight: '200px',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              Selecciona un ciclo académico para ver los reportes
            </div>
          ) : (
            <>
              {!isDocente && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                  Buscar docente por nombre
                </label>
                <input
                  className="form-input"
                  style={{ width: '100%', maxWidth: '400px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px' }}
                  placeholder="Buscar docente..."
                  value={buscarDocenteReporte}
                  onChange={e => setBuscarDocenteReporte(e.target.value)}
                />
              </div>
              )}

              {/* Tabla de reportes */}
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Docente</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingCiclos ? (
                      <tr>
                        <td colSpan={2} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                          Cargando...
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        // Obtener docentes únicos con carga horaria en el ciclo seleccionado
                        const docentesUnicosMap = new Map();
                        const cargaFiltered = isDocente && user?.docente_id
                          ? cargaHoraria.filter(ch => ch.docente_id === user.docente_id)
                          : cargaHoraria;
                        cargaFiltered.forEach(ch => {
                          if (!docentesUnicosMap.has(ch.docente_id)) {
                            docentesUnicosMap.set(ch.docente_id, ch);
                          }
                        });
                        const docentesUnicos = Array.from(docentesUnicosMap.values());

                        // Filtrar por búsqueda
                        const docentesFiltrados = docentesUnicos.filter(ch => 
                          normalizeText(ch.docente_nombre || '').includes(normalizeText(buscarDocenteReporte)) ||
                          normalizeText(ch.docente_apellidos || '').includes(normalizeText(buscarDocenteReporte))
                        );

                        if (docentesFiltrados.length === 0) {
                          return (
                            <tr>
                              <td colSpan={2} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                                No hay docentes con carga horaria en este ciclo académico
                              </td>
                            </tr>
                          );
                        }

                        return docentesFiltrados.map(ch => (
                          <tr key={ch.docente_id}>
                            <td style={{ verticalAlign: 'middle' }}>
                              {ch.docente_apellidos}, {ch.docente_nombre}
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button
                                  className="btn-secondary"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => { generarF01CAD(ch.docente_id); marcarFormatosGenerados(ch.docente_id); }}
                                >
                                  <span style={{ fontSize: '14px' }}>📄</span>
                                  F01-CAD
                                </button>
                                <button
                                  className="btn-secondary"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => { generarF02CAD(ch.docente_id); marcarFormatosGenerados(ch.docente_id); }}
                                >
                                  <span style={{ fontSize: '14px' }}>📄</span>
                                  F02-CAD
                                </button>
                                <button
                                  className="btn-secondary"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => { generarF03CAD(ch.docente_id); marcarFormatosGenerados(ch.docente_id); }}
                                >
                                  <span style={{ fontSize: '14px' }}>📄</span>
                                  F03-CAD
                                </button>
                                <button
                                  className="btn-secondary"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => { generarCargaAdicionalPDF(ch.docente_id); marcarFormatosGenerados(ch.docente_id); }}
                                  >
                                    <span style={{ fontSize: '14px' }}>📄</span>
                                    Dec. Adicional
                                </button>
                                <button
                                  className="btn-primary"
                                  style={{ 
                                    padding: '6px 12px', 
                                    fontSize: '13px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => generarTodosFormatosZip(ch.docente_id)}
                                  >
                                    <span style={{ fontSize: '14px' }}>📦</span>
                                    Descargar Todo (.zip)
                                </button>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        </>
      ) : <></> }

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function getRomanNumeral(num: number): string {
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romanNumerals[num - 1] || num.toString();
}
