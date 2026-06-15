
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
  const isDocente = user?.rol.codigo === 'docente';
  const canWrite = isAdmin || isDirector;

  const [ciclosAcademicos, setCiclosAcademicos] = useState<CicloAcademico[]>([]);
  const [cicloAcademicoSeleccionado, setCicloAcademicoSeleccionado] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'carga-horaria' | 'carga-aula' | 'reportes'>('carga-horaria');
  const [aulaData, setAulaData] = useState<any[]>([]);
  const [loadingAula, setLoadingAula] = useState(false);
  
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

  function generarF01CAD(docenteId: string) {
    // Obtener todos los datos de carga horaria del docente en el ciclo seleccionado
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return;
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
    const secciones = {
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
        if (ch[key] && !secciones[key]) {
          secciones[key] = ch[key];
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
    const formatDate = (dateStr: string) => {
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
    const seccionesData = [
      {
        titulo: '2. PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)',
        horas: secciones.preparacion?.horas || 0,
        detalles: secciones.preparacion?.descripcion || ''
      },
      {
        titulo: '3. CONSEJERÍA: Señalar número de alumnos y el ciclo académico en el que se desarrolla. (Como mínimo 01 hora semanal)',
        horas: secciones.consejeria !== null && secciones.consejeria !== undefined ? secciones.consejeria.horas : (cursosDocente.length > 0 ? Math.min(7, Math.max(1, cursosDocente.length)) : 0),
        detalles: secciones.consejeria !== null && secciones.consejeria !== undefined && secciones.consejeria.detalles ? secciones.consejeria.detalles : ''
      },
      {
        titulo: '4. INVESTIGACIÓN: Consignar el N° de inscripción, código, nombre y duración del proyecto. (Como mínimo 04 y 05 horas semanales, según modalidad de trabajo).',
        horas: secciones.investigacion?.horas || 0,
        detalles: secciones.investigacion?.proyecto || ''
      },
      {
        titulo: '5. CAPACITACIÓN: Señale lo referente a este rubro en el marco de los planes de cada Facultad (como máximo 05 semanales)',
        horas: secciones.capacitacion?.horas || 0,
        detalles: secciones.capacitacion?.detalles || ''
      },
      {
        titulo: '6. ACTIVIDADES DE GOBIERNO: Si desempeña cargo indique.',
        horas: secciones.gobierno?.horas || 0,
        detalles: secciones.gobierno?.detalles || ''
      },
      {
        titulo: '7. ACTIVIDADES DE ADMINISTRACIÓN: Si desempeña cargo indique.',
        horas: secciones.administracion?.horas || 0,
        detalles: secciones.administracion?.detalles || ''
      },
      {
        titulo: '8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL: Indicar el número de Resolución Decanal, precisando el nombre y duración de la actividad programada.',
        horas: secciones.asesoria !== null && secciones.asesoria !== undefined ? secciones.asesoria.horas : 0,
        detalles: secciones.asesoria !== null && secciones.asesoria !== undefined && secciones.asesoria.detalles ? secciones.asesoria.detalles : ''
      },
      {
        titulo: '9. RESPONSABILIDAD SOCIAL UNIVERSITARIA: Señalar actividad, proyecto programa a ejecutarse n beneficio de la comunidad local o regional. (Como máximo 02 horas semanales)',
        horas: secciones.rsu?.horas || 0,
        detalles: secciones.rsu?.plan || ''
      },
      {
        titulo: '10. COMITÉS TÉCNICOS Y COMISIONES: Consignar el número de Resolución autoritativa indicando el lapso de vigencia.',
        horas: secciones.comites?.horas || 0,
        detalles: secciones.comites?.detalles || ''
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
    doc.save(`carga-horaria-${nombreDocente.replace(/\s+/g, '-')}.pdf`);
  }

  function generarF02CAD(docenteId: string) {
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return;
    }

    const nombreDocente = cargasDocente[0]
      ? `${cargasDocente[0].docente_apellidos}, ${cargasDocente[0].docente_nombre}`.toUpperCase()
      : 'DOCENTE';

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMATO N° 2 - CAD', pageWidth / 2, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.text('PROGRAMACIÓN DE ACTIVIDADES ACADÉMICAS', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.text(`Docente: ${nombreDocente}`, 15, y);
    y += 6;

    const cursosDocente: any[] = [];
    cargasDocente.forEach(ch => {
      if (ch.cursos && ch.cursos.length > 0) {
        ch.cursos.forEach((curso: any) => {
          const ht = curso.hrs_teo || 0;
          const hp = curso.hrs_pra || 0;
          const hl = curso.hrs_lab || 0;
          const tG = (curso as any).teoria_grupos ?? 1;
          const pG = (curso as any).practica_grupos ?? 1;
          const lG = (curso as any).laboratorio_grupos ?? 1;
          cursosDocente.push({
            codigo: curso.curso_codigo || '',
            nombre: curso.curso_nombre || curso.nombre,
            seccion: curso.seccion,
            hrsTeo: ht,
            hrsPra: hp,
            hrsLab: hl,
            total: (ht * tG) + (hp * pG) + (hl * lG)
          });
        });
      }
    });

    autoTable(doc, {
      head: [[{ content: 'Curso', styles: { fontStyle: 'bold' } }, { content: 'H.T', styles: { fontStyle: 'bold' } }, { content: 'H.P', styles: { fontStyle: 'bold' } }, { content: 'H.L', styles: { fontStyle: 'bold' } }, { content: 'Total', styles: { fontStyle: 'bold' } }]],
      body: cursosDocente.map((c: any) => [c.nombre.substring(0, 40), c.hrsTeo, c.hrsPra, c.hrsLab, c.total]),
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [220, 220, 220], textColor: 0 }
    });

    y = (doc as any).lastAutoTable.finalY + 10;
    const fecha = new Date();
    const mes = fecha.toLocaleString('es-ES', { month: 'long' });
    doc.text(`Trujillo, ${fecha.getDate()} de ${mes} del ${fecha.getFullYear()}`, pageWidth / 2, y, { align: 'center' });

    doc.save(`F02-CAD-${nombreDocente.replace(/\s+/g, '-')}.pdf`);
  }

  async function generarF03CAD(docenteId: string) {
    const cargasDocente = cargaHoraria.filter(ch => ch.docente_id === docenteId);
    if (cargasDocente.length === 0) {
      setToast({ type: 'error', text: 'No hay datos de carga horaria para este docente' });
      return;
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
        if (s.field && ch[s.field] && !secciones[s.field]) secciones[s.field] = ch[s.field];
      }
    });

    let totalNoLectiva = 0;
    const chnlRows: any[] = [];
    for (const s of secMapping) {
      const hr = s.field ? (secciones[s.field]?.horas || 0) : 0;
      totalNoLectiva += hr;
      const horarioEntradas = s.field ? (noLectivaLookup.get(s.field) || []) : [];
      const horarioStr = formatHorarioNoLectiva(horarioEntradas);
      const aulasSet = new Set(horarioEntradas.map(e => e.aula));
      const aulaStr = aulasSet.size > 0 ? [...aulasSet].join(', ') : 'CUBICULO';
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
      lines.forEach(l => { doc.text(l, ml, y); y += 3.8; });
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

    doc.save(`F03-CAD-${apellidosNombre.replace(/[\s,]+/g, '-')}.pdf`);
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
                    {(canWrite || isDocente) && (
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
                                        {(canWrite || (isDocente && user?.docente_id === ch.docente_id)) && (
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            {canWrite && (
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
                                                <Edit2 size={14} />
                                                Editar
                                              </button>
                                            )}
                                            {canWrite && (
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
                                          {(canWrite || (isDocente && user?.docente_id === ch.docente_id)) && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                              {canWrite && (
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
                                                  <Edit2 size={14} />
                                                  Editar
                                                </button>
                                              )}
                                              {canWrite && (
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
                                  onClick={() => generarF01CAD(ch.docente_id)}
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
                                  onClick={() => generarF02CAD(ch.docente_id)}
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
                                  onClick={() => generarF03CAD(ch.docente_id)}
                                >
                                  <span style={{ fontSize: '14px' }}>📄</span>
                                  F03-CAD
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
