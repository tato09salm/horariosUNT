
'use client';

import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';
import { Edit2, Trash2 } from 'lucide-react';

interface CicloAcademico {
  id: string;
  nombre: string;
  año: number;
  semestre: string;
  estado: string;
}

interface Curso {
  id: string;
  curso_id: string;
  curso_nombre: string;
  curso_codigo: string;
  seccion: string;
  escuela: string;
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
}

interface Docente {
  id: string;
  nombre: string;
  apellidos: string;
  codigo?: string;
  dni?: string;
  activo: boolean;
}

export default function CargaHorariaPage() {
  const router = useRouter();
  const { darkMode } = useTheme();
  const user = useUser();
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const canWrite = isAdmin || isDirector;

  const [ciclosAcademicos, setCiclosAcademicos] = useState<CicloAcademico[]>([]);
  const [cicloAcademicoSeleccionado, setCicloAcademicoSeleccionado] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'carga-horaria' | 'reportes'>('carga-horaria');
  
  // Cargar el ciclo academico guardado en sessionStorage
  useEffect(() => {
    const savedCiclo = sessionStorage.getItem('cargaHoraria_cicloAcademicoSeleccionado');
    if (savedCiclo) {
      setCicloAcademicoSeleccionado(savedCiclo);
    }
  }, []);
  
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

  // Cargar ciclos academicos
  useEffect(() => {
    console.log('⏳ Fetching ciclos academicos...');
    fetch('/api/ciclos?reporte=true')
      .then(r => {
        console.log('📦 Received response from /api/ciclos, status:', r.status);
        return r.json();
      })
      .then(data => { 
        console.log('✅ Ciclos academicos data:', data);
        setCiclosAcademicos(data.data || []); 
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

  function generarPDF(docenteId: string) {
    // Obtener todos los cursos del docente en el ciclo seleccionado
    const cursosDocente = [];
    let totalHorasLectivas = 0;
    cargaHoraria.forEach(ch => {
      if (ch.docente_id === docenteId && ch.cursos && ch.cursos.length > 0) {
        ch.cursos.forEach(curso => {
          const cursoData = {
            codigo: curso.curso_codigo || '',
            nombre: curso.curso_nombre || curso.nombre,
            seccion: curso.seccion,
            cicloPlan: getRomanNumeral(curso.ciclo_plan || ch.ciclo_plan || 1),
            escuela: curso.escuela || 'Ingeniería de Sistemas',
            numAlumnos: curso.num_alumnos || 0,
            hrsTeo: curso.hrs_teo || 0,
            hrsPra: curso.hrs_pra || 0,
            hrsLab: curso.hrs_lab || 0,
            totalHrs: curso.total_horas || curso.total_hrs || 0
          };
          cursosDocente.push(cursoData);
          totalHorasLectivas += cursoData.totalHrs;
        });
      }
    });

    // Obtener datos completos del docente
    const docenteCarga = cargaHoraria.find(ch => ch.docente_id === docenteId);
    const docenteCompleto = allDocentes.find(d => d.id === docenteId);
    
    const nombreDocente = docenteCarga 
      ? `${docenteCarga.docente_apellidos}, ${docenteCarga.docente_nombre}`.toUpperCase()
      : 'DOCENTE';
    
    const condicion = docenteCompleto?.condicion ? docenteCompleto.condicion.toUpperCase() : 'NOMBRADO';
    const categoria = docenteCompleto?.categoria ? docenteCompleto.categoria.toUpperCase() : 'ASOCIADO';
    const modalidad = 'TIEMPO COMPLETO 40 H';
    
    // Obtener nombre del ciclo académico
    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const nombreCiclo = cicloAcademico ? cicloAcademico.nombre : 'Ciclo Académico';

    // Crear PDF
    const doc = new jsPDF();
    
    // Título principal
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMATO N° 1', 105, 20);
    doc.setFontSize(12);
    doc.text('DECLARACIÓN DE CARGA HORARIA ASIGNADA', 70, 28);
    
    // I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:', 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.text('FACULTAD:', 14, 46);
    doc.text('Ingeniería', 60, 46);
    doc.text('DPTO. ACADÉMICO:', 14, 54);
    doc.text('Dpto. de Ingeniería de Sistemas', 60, 54);
    
    // Tabla de datos del profesor
    const headerDatos = [['NOMBRE COMPLETO', 'CONDICIÓN', 'CATEGORÍA', 'MODALIDAD']];
    const bodyDatos = [[nombreDocente, condicion, categoria, modalidad]];
    autoTable(doc, {
      head: headerDatos,
      body: bodyDatos,
      startY: 60,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }
    });
    
    // Año académico
    const finalY1 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text(`AÑO ACADÉMICO: ${nombreCiclo}`, 14, finalY1);
    
    // 1. TRABAJO LECTIVO
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. TRABAJO LECTIVO.- Datos completos y con claridad', 14, finalY1 + 10);
    doc.setFont('helvetica', 'normal');
    
    // Tabla de trabajo lectivo
    const headerLectivo = [
      ['CÓDIGO', 'NOMBRE DEL CURSO', 'SECCIÓN', 'CURSO', 'Escuela Prof.', 'Año o Ciclo', 'Nro Tel. Alumnos', 'Hrs.Teo/Grupos', 'Hrs.Pra/Grupos', 'Hrs.Lab/Grupos', 'Total Hrs.']
    ];
    const bodyLectivo = cursosDocente.map(c => [
      c.codigo,
      c.nombre,
      c.seccion,
      '',
      c.escuela,
      c.cicloPlan,
      c.numAlumnos,
      c.hrsTeo,
      c.hrsPra,
      c.hrsLab,
      c.totalHrs
    ]);
    
    autoTable(doc, {
      head: headerLectivo,
      body: bodyLectivo,
      startY: finalY1 + 16,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' }
    });
    
    let currentY = (doc as any).lastAutoTable.finalY + 8;
    
    // 2. PREPARACIÓN Y EVALUACIÓN
    const maxPreparacion = Math.floor(totalHorasLectivas * 0.5);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)', 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 8;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // 3. CONSEJERÍA Y TUTORÍA
    doc.setFont('helvetica', 'bold');
    doc.text('3. CONSEJERÍA Y TUTORÍA', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('(Como mínimo 01 hora semanal)', 14, currentY + 6);
    currentY += 12;
    if (cursosDocente.length > 0) {
      cursosDocente.forEach(c => {
        doc.text(`${c.numAlumnos} alumnos, ciclo ${c.cicloPlan}, ${c.nombre}`, 14, currentY);
        currentY += 6;
      });
    }
    const horasConsejeria = Math.min(7, Math.max(1, cursosDocente.length));
    doc.text(`Horas: ${horasConsejeria}`, 14, currentY);
    currentY += 14;
    
    // 4. INVESTIGACIÓN
    doc.setFont('helvetica', 'bold');
    doc.text('4. INVESTIGACIÓN', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('(Como mínimo 04 y 05 horas semanales, según modalidad)', 14, currentY + 6);
    currentY += 12;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // 5. CAPACITACIÓN
    doc.setFont('helvetica', 'bold');
    doc.text('5. CAPACITACIÓN', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('(como máximo 05 semanales)', 14, currentY + 6);
    currentY += 12;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // 6. ACTIVIDADES DE GOBIERNO
    doc.setFont('helvetica', 'bold');
    doc.text('6. ACTIVIDADES DE GOBIERNO', 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 8;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // 7. ACTIVIDADES DE ADMINISTRACIÓN
    doc.setFont('helvetica', 'bold');
    doc.text('7. ACTIVIDADES DE ADMINISTRACIÓN', 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 8;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // 8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL
    doc.setFont('helvetica', 'bold');
    doc.text('8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL', 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 8;
    doc.text('Asesoría de tesis, exámenes profesionales y experiencia profesional', 14, currentY);
    doc.text('Horas: 2', 14, currentY + 6);
    currentY += 14;
    
    // 9. RESPONSABILIDAD SOCIAL UNIVERSITARIA
    doc.setFont('helvetica', 'bold');
    doc.text('9. RESPONSABILIDAD SOCIAL UNIVERSITARIA', 14, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text('(Como máximo 02 horas semanales)', 14, currentY + 6);
    currentY += 12;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // 10. COMITÉS TÉCNICOS Y COMISIONES
    doc.setFont('helvetica', 'bold');
    doc.text('10. COMITÉS TÉCNICOS Y COMISIONES', 14, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 8;
    doc.text('0', 14, currentY);
    doc.text('Horas: 0', 14, currentY + 6);
    currentY += 14;
    
    // Total horas
    const totalHoras = totalHorasLectivas + horasConsejeria + 2;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Horas: ${totalHoras}`, 14, currentY);
    
    // Descargar PDF
    doc.save(`carga-horaria-${nombreDocente.replace(/\s+/g, '-')}.pdf`);
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
                  {c.nombre} {c.estado === 'activo' ? '(Activo)' : ''}
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
            Reportes
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
              <div className="card" style={{ marginBottom: '16px', padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'end', justifyContent: 'space-between' }}>
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
                  <div>
                    {canWrite && (
                      <button
                        className="btn-primary"
                        onClick={() => {
                          if (cicloAcademicoSeleccionado) {
                            router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademicoSeleccionado}&reset=true`);
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
                        Asignar
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
                                    <th>HoraTotales</th>
                                    <th>Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Render docentes with courses first */}
                                  {(cursoCicloMap[ciclo] || []).map(({ curso, cargaHoraria: ch }) => (
                                    <tr key={`${ch.id}-${curso.id || curso.curso_id}`}>
                                      <td style={{ verticalAlign: 'middle' }}>
                                        {getRomanNumeral(ciclo)}
                                      </td>
                                      <td>{curso.curso_nombre || curso.nombre} ({curso.seccion})</td>
                                      <td style={{ verticalAlign: 'middle' }}>
                                        {ch.docente_apellidos}, {ch.docente_nombre}
                                      </td>
                                      <td>{ch.horas_asignadas}h</td>
                                      <td style={{ verticalAlign: 'middle' }}>
                                        {canWrite && (
                                          <div style={{ display: 'flex', gap: '8px' }}>
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
                                            <button
                                              className="btn-secondary btn-crud-deactivate"
                                              style={{ 
                                                padding: '6px 8px', 
                                                fontSize: '11px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                              }}
                                              onClick={() => eliminarCurso(curso.id)}
                                              disabled={saving}
                                            >
                                              <Trash2 size={14} />
                                              Eliminar
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
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
                                        <td>{ch.horas_asignadas}h</td>
                                        <td style={{ verticalAlign: 'middle' }}>
                                          {canWrite && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
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
      ) : (
        // Pestaña Reportes
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
              {/* Buscador de docentes */}
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
                        cargaHoraria.forEach(ch => {
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
                              <button
                                className="btn-secondary"
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '13px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                onClick={() => generarPDF(ch.docente_id)}
                              >
                                <span style={{ fontSize: '16px' }}>📄</span>
                                Ver PDF
                              </button>
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
      )}

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
