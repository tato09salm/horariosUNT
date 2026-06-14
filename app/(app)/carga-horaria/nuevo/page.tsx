'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { useUser } from '@/app/(app)/layout';

interface Docente {
  id: string;
  nombre: string;
  apellidos: string;
  codigo?: string;
  dni?: string;
  categoria: string;
  condicion: string;
  activo: boolean;
  facultad: string;
  dpto_academico: string;
}

interface DocenteSeleccionado extends Docente {
  modalidad: string;
}

interface CursoAsignado {
  id: string;
  curso_id: string; // NEW - UUID from cursos table
  codigo: string;
  nombre: string;
  seccion: string;
  condicionCurso: 'OB' | 'EL'; // OB- obligatorio, EL-electivo
  curso: string; // from ciclo_plan or similar
  escuela: string;
  anioCiclo: string; // Año o Ciclo
  numeroAlumnos: string;
  // Horas Teoría
  teoriaHoras: string;
  teoriaGrupos: string;
  // Horas Práctica
  practicaHoras: string;
  practicaGrupos: string;
  // Horas Laboratorio
  laboratorioHoras: string;
  laboratorioGrupos: string;
  totalHoras: string;
}

interface ItemActividad {
  id: string;
  descripcion: string;
}

interface Actividad {
  items: ItemActividad[];
  horas: string;
}

interface Secciones {
  preparacionEvaluacion: Actividad;
  consejeriaTutoria: Actividad;
  investigacion: Actividad;
  capacitacion: Actividad;
  gobierno: Actividad;
  administracion: Actividad;
  asesoriaTesis: Actividad;
  responsabilidadSocial: Actividad;
  comitesTecnicos: Actividad;
}

export default function NuevaCargaHorariaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode } = useTheme();
  const { user } = useUser();
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const canWrite = isAdmin || isDirector;

  const initialCicloAcademico = searchParams.get('cicloAcademico');
  const initialDocenteId = searchParams.get('docenteId');
  const [cicloAcademicoSeleccionado, setCicloAcademicoSeleccionado] = useState<string>(initialCicloAcademico || '');
  const [ciclosAcademicos, setCiclosAcademicos] = useState<any[]>([]);
  
  // Initial state for secciones (each with 1 default item)
  const initialSecciones: Secciones = {
    preparacionEvaluacion: { items: [{ id: 'prep-1', descripcion: '' }], horas: '0' },
    consejeriaTutoria: { items: [{ id: 'consej-1', descripcion: '' }], horas: '0' },
    investigacion: { items: [{ id: 'invest-1', descripcion: '' }], horas: '0' },
    capacitacion: { items: [{ id: 'cap-1', descripcion: '' }], horas: '0' },
    gobierno: { items: [{ id: 'gob-1', descripcion: '' }], horas: '0' },
    administracion: { items: [{ id: 'admin-1', descripcion: '' }], horas: '0' },
    asesoriaTesis: { items: [{ id: 'tesis-1', descripcion: '' }], horas: '0' },
    responsabilidadSocial: { items: [{ id: 'rs-1', descripcion: '' }], horas: '0' },
    comitesTecnicos: { items: [{ id: 'comites-1', descripcion: '' }], horas: '0' },
  };
  
  // State
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState<Docente | null>(null);
  const [facultad, setFacultad] = useState('');
  const [dptoAcademico, setDptoAcademico] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [cursosAsignados, setCursosAsignados] = useState<CursoAsignado[]>([]);
  const [secciones, setSecciones] = useState<Secciones>(initialSecciones);
  const [guardando, setGuardando] = useState(false);
  const [mostrarExito, setMostrarExito] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Cursos for search/select modal
  const [cursos, setCursos] = useState<any[]>([]);
  const [showAgregarCursoModal, setShowAgregarCursoModal] = useState(false);
  const [cursoSearchQuery, setCursoSearchQuery] = useState('');
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [nuevoCurso, setNuevoCurso] = useState<Omit<CursoAsignado, 'id'>>({
    curso_id: '',
    codigo: '',
    nombre: '',
    seccion: 'A',
    condicionCurso: 'OB',
    curso: '',
    escuela: 'Ing. Sistemas',
    anioCiclo: '',
    numeroAlumnos: '40',
    teoriaHoras: '0',
    teoriaGrupos: '1',
    practicaHoras: '0',
    practicaGrupos: '1',
    laboratorioHoras: '0',
    laboratorioGrupos: '1',
    totalHoras: '0',
  });
  
  // Docentes seleccionados (for multiple docentes)
  const [docentesSeleccionados, setDocentesSeleccionados] = useState<DocenteSeleccionado[]>([]);
  
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  // Load docentes and cursos
  useEffect(() => {
    const loadData = async () => {
      try {
        const [docentesRes, cursosRes, ciclosRes] = await Promise.all([
          fetch('/api/docentes?limit=1000'),
          fetch('/api/cursos?reporte=true'),
          fetch('/api/ciclos?reporte=true')
        ]);
        const docentesData = await docentesRes.json();
        const cursosData = await cursosRes.json();
        const ciclosData = await ciclosRes.json();
        setDocentes(docentesData.data || []);
        setCursos(cursosData.data || []);
        setCiclosAcademicos(ciclosData.data || []);
      } catch (e) {
        console.error('Error loading data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);
  
  // Load initial docente if docenteId is provided
  useEffect(() => {
    if (initialDocenteId && docentes.length > 0 && cicloAcademicoSeleccionado) {
      const docente = docentes.find(d => d.id === initialDocenteId);
      if (docente) {
        handleSeleccionarDocenteFromList(docente);
      }
    }
  }, [initialDocenteId, docentes, cicloAcademicoSeleccionado]);
  
  // Handle docente selection and load saved data if available
  const handleSeleccionarDocenteFromList = async (docente: Docente) => {
    console.log('🎯 Selected docente:', docente);
    console.log('🎯 docente.facultad:', docente.facultad);
    console.log('🎯 docente.dpto_academico:', docente.dpto_academico);
    
    // Now set new docente
    setDocenteSeleccionado(docente);
    
    // First set default values from docente
    let newFacultad = docente.facultad || '';
    let newDptoAcademico = docente.dpto_academico || '';
    let newModalidad = '';
    let newCursosAsignados: CursoAsignado[] = [];
    let newSecciones = initialSecciones;
    
    // Check server first for existing carga horaria
    if (cicloAcademicoSeleccionado) {
      try {
        const params = new URLSearchParams();
        params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
        params.set('docente_id', docente.id);
        
        const res = await fetch(`/api/carga-horaria?${params}`);
        const data = await res.json();
        console.log('📄 Carga horaria from server:', data);
        console.log('📄 Carga horaria from server:', data);
          if (data.data && data.data.length > 0) {
            // Combine all carga horaria entries into one
            const allCursos: any[] = [];
            let combinedCh: any = null;
            
            for (const ch of data.data) {
              if (!combinedCh) {
                combinedCh = ch;
              }
              if (ch.cursos) {
                allCursos.push(...ch.cursos);
              }
            }
            
            console.log('📄 combinedCh:', combinedCh);
          console.log('📄 combinedCh.asesoria:', combinedCh.asesoria);
          // Convert server data to our state structure
          console.log('📄 ch.facultad:', combinedCh.facultad, 'docente.facultad:', docente.facultad);
          console.log('📄 ch.dpto_academico:', combinedCh.dpto_academico, 'docente.dpto_academico:', docente.dpto_academico);
          newFacultad = combinedCh.facultad || docente.facultad || '';
          newDptoAcademico = combinedCh.dpto_academico || docente.dpto_academico || '';
          newModalidad = combinedCh.modalidad || '';
          
          // Convert cursos
          const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
          const convertedCursos: CursoAsignado[] = allCursos.map((curso: any) => {
            const teoria = curso.horas_teoria ?? 0;
            const teoriaGrupos = curso.teoria_grupos ?? 1;
            const practica = curso.horas_practica ?? 0;
            const practicaGrupos = curso.practica_grupos ?? 1;
            const laboratorio = curso.horas_laboratorio ?? 0;
            const laboratorioGrupos = curso.laboratorio_grupos ?? 1;
            const total = (teoria * teoriaGrupos) + (practica * practicaGrupos) + (laboratorio * laboratorioGrupos);
            
            return {
              id: curso.curso_id, // or Date.now().toString(), but use curso_id
              curso_id: curso.curso_id, // NEW!
              curso: String(curso.ciclo_plan),
              codigo: curso.curso_codigo,
              nombre: curso.curso_nombre,
              seccion: curso.seccion,
              escuela: curso.escuela,
              condicionCurso: 'OB',
              anioCiclo: cicloAcademico?.nombre || '',
              numeroAlumnos: String(curso.num_alumnos ?? 0),
              teoriaHoras: String(teoria),
              teoriaGrupos: String(teoriaGrupos),
              practicaHoras: String(practica),
              practicaGrupos: String(practicaGrupos),
              laboratorioHoras: String(laboratorio),
              laboratorioGrupos: String(laboratorioGrupos),
              totalHoras: String(total)
            };
          });
          newCursosAsignados = convertedCursos;
          
          // Convert secciones
          newSecciones = {
            preparacionEvaluacion: { 
              items: [{ id: 'prep-1', descripcion: combinedCh.preparacion?.descripcion || '' }], 
              horas: String(combinedCh.preparacion?.horas ?? 0) 
            },
            consejeriaTutoria: { 
              items: [{ id: 'consej-1', descripcion: combinedCh.consejeria?.detalles || '' }], 
              horas: String(combinedCh.consejeria?.horas ?? 0) 
            },
            investigacion: { 
              items: [{ id: 'invest-1', descripcion: combinedCh.investigacion?.proyecto || '' }], 
              horas: String(combinedCh.investigacion?.horas ?? 0) 
            },
            capacitacion: { 
              items: [{ id: 'cap-1', descripcion: combinedCh.capacitacion?.detalles || '' }], 
              horas: String(combinedCh.capacitacion?.horas ?? 0) 
            },
            gobierno: { 
              items: [{ id: 'gob-1', descripcion: combinedCh.gobierno?.detalles || '' }], 
              horas: String(combinedCh.gobierno?.horas ?? 0) 
            },
            administracion: { 
              items: [{ id: 'admin-1', descripcion: combinedCh.administracion?.detalles || '' }], 
              horas: String(combinedCh.administracion?.horas ?? 0) 
            },
            asesoriaTesis: { 
              items: [{ id: 'tesis-1', descripcion: combinedCh.asesoria?.detalles || '' }], 
              horas: String(combinedCh.asesoria?.horas ?? 0) 
            },
            responsabilidadSocial: { 
              items: [{ id: 'rs-1', descripcion: combinedCh.rsu?.plan || '' }], 
              horas: String(combinedCh.rsu?.horas ?? 0) 
            },
            comitesTecnicos: { 
              items: [{ id: 'comites-1', descripcion: combinedCh.comites?.detalles || '' }], 
              horas: String(combinedCh.comites?.horas ?? 0) 
            }
          };
        }
      } catch (e) {
        console.error('Error loading carga horaria from server:', e);
      }
    }
    
    // Set all state at once
    setFacultad(newFacultad);
    setDptoAcademico(newDptoAcademico);
    setModalidad(newModalidad);
    setCursosAsignados(newCursosAsignados);
    setSecciones(newSecciones);
    
    setSearchQuery(`${docente.apellidos || ''}, ${docente.nombre || ''}`);
    setIsSearching(false);
  };
  
  const handleGuardar = async () => {
    if (!docenteSeleccionado || !cicloAcademicoSeleccionado) {
      setAlertMessage('Por favor seleccione un docente y ciclo académico');
      return;
    }

    if (!modalidad) {
      setAlertMessage('Por favor seleccione una modalidad');
      return;
    }
    
    // Filter out any courses that don't have curso_id!
    const validCursos = cursosAsignados.filter(curso => curso.curso_id && curso.curso_id.length > 0);
    
    if (validCursos.length === 0) {
      setAlertMessage('Por favor agregue al menos un curso');
      return;
    }

    if (parseFloat(totalHoras) <= 0) {
      setAlertMessage('El total de horas debe ser mayor a 0');
      return;
    }
    
    // Check that all cursos have numeroAlumnos > 0
    const cursosSinAlumnos = validCursos.filter(c => parseFloat(c.numeroAlumnos) <= 0);
    if (cursosSinAlumnos.length > 0) {
      setAlertMessage('Todos los cursos deben tener al menos 1 alumno');
      return;
    }
    
    console.log('Valid cursos with curso_id:', validCursos);
    
    const bodyToSend = {
          docente_id: docenteSeleccionado.id,
          ciclo_academico_id: cicloAcademicoSeleccionado,
          ciclo_plan: 1,
          modalidad,
          facultad,
          dpto_academico: dptoAcademico,
          cursos: validCursos, // Only send valid courses
          preparacion: secciones.preparacionEvaluacion,
          consejeria: secciones.consejeriaTutoria,
          investigacion: secciones.investigacion,
          capacitacion: secciones.capacitacion,
          gobierno: secciones.gobierno,
          administracion: secciones.administracion,
          asesoria: secciones.asesoriaTesis,
          rsu: secciones.responsabilidadSocial,
          comites: secciones.comitesTecnicos,
          total_horas: totalHoras
        };
        
    console.log('Sending to /api/carga-horaria:', JSON.stringify(bodyToSend, null, 2));

    setGuardando(true);
    try {
      const res = await fetch('/api/carga-horaria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyToSend),
      });
      
      if (!res.ok) {
        const data = await res.json();
        console.error('Error from API:', data);
        setAlertMessage('Error guardando: ' + (data.error || 'Ocurrió un error'));
        return;
      }

      setMostrarExito(true);
      setTimeout(() => {
        router.push('/carga-horaria');
      }, 2000);
    } catch (e) {
      console.error('Error guardando:', e);
      setAlertMessage('Error guardando la carga horaria');
    } finally {
      setGuardando(false);
    }
  };

  // Redirect back if no ciclo academico selected
  useEffect(() => {
    if (!cicloAcademicoSeleccionado) {
      router.push('/carga-horaria');
    }
  }, [cicloAcademicoSeleccionado, router]);

  // Helper function to remove accents and special characters
  const normalizeText = (text: string) => {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };

  // Filter docentes based on search query
  const filteredDocentes = docentes.filter(d => {
    console.log('Checking docente:', d.nombre, d.apellidos, 'activo:', d.activo, 'dni:', d.dni);
    if (!d.activo) return false;
    if (!searchQuery) return true;
    const query = normalizeText(searchQuery);
    return (
      normalizeText(d.nombre || '').includes(query) ||
      normalizeText(d.apellidos || '').includes(query) ||
      normalizeText(d.dni || '').includes(query)
    );
  });

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setSearchQuery(newQuery);
    if (!newQuery) {
      setDocenteSeleccionado(null);
    }
    setIsSearching(true);
  };

  const handleAgregarDocente = () => {
    if (docenteSeleccionado && !docentesSeleccionados.some(ds => ds.id === docenteSeleccionado.id)) {
      setDocentesSeleccionados([
        ...docentesSeleccionados,
        { ...docenteSeleccionado, modalidad: '' }
      ]);
      setDocenteSeleccionado(null);
      setSearchQuery('');
      setIsSearching(false);
    }
  };

  const handleEliminarDocente = (id: string) => {
    setDocentesSeleccionados(docentesSeleccionados.filter(ds => ds.id !== id));
  };

  const handleLimpiar = () => {
    setDocenteSeleccionado(null);
    setSearchQuery('');
    setIsSearching(false);
  };

  const handleSeleccionarCurso = (curso: any) => {
    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const tHoras = parseFloat(curso.horas_teoria || 0) * 1;
    const pHoras = parseFloat(curso.horas_practica || 0) * 1;
    const lHoras = parseFloat(curso.horas_laboratorio || 0) * 1;
    const total = (tHoras + pHoras + lHoras).toString();
    setSelectedCurso(curso);
    setNuevoCurso({
      curso_id: curso.id,
      codigo: curso.codigo,
      nombre: curso.nombre,
      seccion: 'A',
      condicionCurso: 'OB',
      curso: String(curso.ciclo_plan),
      escuela: 'Ing. Sistemas',
      anioCiclo: cicloAcademico?.nombre || '',
      numeroAlumnos: '40',
      teoriaHoras: String(curso.horas_teoria || 0),
      teoriaGrupos: '1',
      practicaHoras: String(curso.horas_practica || 0),
      practicaGrupos: '1',
      laboratorioHoras: String(curso.horas_laboratorio || 0),
      laboratorioGrupos: '1',
      totalHoras: total,
    });
  };

  const handleAgregarCurso = () => {
    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const id = Date.now().toString();
    setCursosAsignados([...cursosAsignados, { ...nuevoCurso, id }]);
    setNuevoCurso({
      curso_id: '',
      codigo: '',
      nombre: '',
      seccion: 'A',
      condicionCurso: 'OB',
      curso: '',
      escuela: 'Ing. Sistemas',
      anioCiclo: cicloAcademico?.nombre || '',
      numeroAlumnos: '40',
      teoriaHoras: '0',
      teoriaGrupos: '1',
      practicaHoras: '0',
      practicaGrupos: '1',
      laboratorioHoras: '0',
      laboratorioGrupos: '1',
      totalHoras: '0',
    });
    setShowAgregarCursoModal(false);
  };

  const handleEliminarCurso = (id: string) => {
    setCursosAsignados(cursosAsignados.filter(c => c.id !== id));
  };

  const handleUpdateCursoField = (id: string, field: keyof CursoAsignado, value: string) => {
    setCursosAsignados(cursosAsignados.map(c => {
      if (c.id !== id) return c;
      
      // If it's a numeric field, ensure it's >= 0
      let processedValue = value;
      if (['numeroAlumnos', 'teoriaHoras', 'teoriaGrupos', 'practicaHoras', 'practicaGrupos', 'laboratorioHoras', 'laboratorioGrupos'].includes(field)) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          processedValue = '0';
        }
      }
      
      // Update the field
      const updated = { ...c, [field]: processedValue };
      
      // Recalculate totalHoras
      const tHoras = parseFloat(updated.teoriaHoras || '0') * parseFloat(updated.teoriaGrupos || '0');
      const pHoras = parseFloat(updated.practicaHoras || '0') * parseFloat(updated.practicaGrupos || '0');
      const lHoras = parseFloat(updated.laboratorioHoras || '0') * parseFloat(updated.laboratorioGrupos || '0');
      updated.totalHoras = (tHoras + pHoras + lHoras).toString();
      
      return updated;
    }));
  };

  const handleAgregarItem = (seccionKey: keyof Secciones) => {
    setSecciones(prev => ({
      ...prev,
      [seccionKey]: {
        ...prev[seccionKey],
        items: [...prev[seccionKey].items, { id: Date.now().toString(), descripcion: '' }]
      }
    }));
  };

  const handleEliminarItem = (seccionKey: keyof Secciones, itemId: string) => {
    setSecciones(prev => ({
      ...prev,
      [seccionKey]: {
        ...prev[seccionKey],
        items: prev[seccionKey].items.filter(item => item.id !== itemId)
      }
    }));
  };

  const handleUpdateItemDescripcion = (seccionKey: keyof Secciones, itemId: string, value: string) => {
    setSecciones(prev => ({
      ...prev,
      [seccionKey]: {
        ...prev[seccionKey],
        items: prev[seccionKey].items.map(item => 
          item.id === itemId ? { ...item, descripcion: value } : item
        )
      }
    }));
  };

  const handleUpdateHoras = (seccionKey: keyof Secciones, value: string) => {
    // Ensure value is >= 0
    let processedValue = value;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      processedValue = '0';
    }
    
    setSecciones(prev => ({
      ...prev,
      [seccionKey]: {
        ...prev[seccionKey],
        horas: processedValue
      }
    }));
  };

  // Calculate total horas: includes Trabajo Lectivo + other sections
  const totalTrabajoLectivo = cursosAsignados.reduce((sum, curso) => {
    return sum + parseFloat(curso.totalHoras || '0');
  }, 0);
  
  const totalHoras = totalTrabajoLectivo + Object.values(secciones).reduce((sum, actividad) => {
    return sum + parseFloat(actividad.horas || '0');
  }, 0);

  if (loading) {
    return <div className="p-8 text-center">Cargando...</div>;
  }

  if (!cicloAcademicoSeleccionado) {
    return null;
  }

  return (
    <div className="page-container">
      {mostrarExito && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          transition: 'all 0.3s ease-out',
          opacity: mostrarExito ? 1 : 0
        }}>
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span style={{ fontSize: '16px', fontWeight: '600' }}>Carga horaria guardada exitosamente!</span>
        </div>
      )}
      
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Nueva Carga Horaria</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Selecciona un docente para continuar</p>
        </div>
        <button 
          onClick={() => router.push('/carga-horaria')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Volver
        </button>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Search and Select Docente */}
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
              Buscar Docente
            </label>
            <div style={{ marginBottom: '12px' }}>
              <input
                className="form-input"
                placeholder="Buscar docente por nombre, apellidos o DNI..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                style={{ width: '100%' }}
              />
            </div>
            {(isSearching || !docenteSeleccionado) && searchQuery && (
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto', 
                border: '1px solid var(--border-color)', 
                borderRadius: '8px' 
              }}>
                {filteredDocentes.map(docente => (
                  <div
                    key={docente.id}
                    onClick={() => handleSeleccionarDocenteFromList(docente)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      background: docenteSeleccionado?.id === docente.id 
                        ? 'var(--bg-secondary)' 
                        : 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>
                      {docente.apellidos || ''}, {docente.nombre || ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      DNI: {docente.dni || ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Docente Info */}
          {docenteSeleccionado && (
            <div className="card" style={{ padding: '12px', background: '#f8fafc' }}>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                  I. DATOS SOBRE LA SITUACIÓN DEL PROFESOR:
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', width: '160px' }}>
                    FACULTAD:
                  </label>
                  <input
                    className="form-input"
                    placeholder="Ingeniería"
                    value={facultad}
                    onChange={(e) => setFacultad(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', width: '160px' }}>
                    DPTO. ACADÉMICO:
                  </label>
                  <input
                    className="form-input"
                    placeholder="Dpto. de Ingeniería de Sistemas"
                    value={dptoAcademico}
                    onChange={(e) => setDptoAcademico(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div className="table-container">
                <table 
                  className="data-table" 
                  style={{ 
                    borderCollapse: 'collapse', 
                    width: '100%' 
                  }}
                >
                  <thead>
                    <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                      <th style={{ padding: '12px', border: '1px solid var(--border-color)' }}>NOMBRE COMPLETO</th>
                      <th style={{ padding: '12px', border: '1px solid var(--border-color)' }}>CONDICIÓN</th>
                      <th style={{ padding: '12px', border: '1px solid var(--border-color)' }}>CATEGORÍA</th>
                      <th style={{ padding: '12px', border: '1px solid var(--border-color)' }}>MODALIDAD</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: '600', padding: '12px', border: '1px solid var(--border-color)' }}>
                        {docenteSeleccionado.apellidos || ''}, {docenteSeleccionado.nombre || ''}
                      </td>
                      <td style={{ textTransform: 'uppercase', padding: '12px', border: '1px solid var(--border-color)' }}>
                        {docenteSeleccionado.condicion || ''}
                      </td>
                      <td style={{ textTransform: 'uppercase', padding: '12px', border: '1px solid var(--border-color)' }}>
                        {docenteSeleccionado.categoria || ''}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid var(--border-color)' }}>
                        <select
                          className="form-input"
                          value={modalidad}
                          onChange={(e) => setModalidad(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                        >
                          <option value="">Seleccionar modalidad...</option>
                          <option value="TIEMPO PARCIAL 8 H" style={{ color: '#1f2937' }}>Tiempo Parcial 8 Hr</option>
                          <option value="TIEMPO PARCIAL 10 H" style={{ color: '#1f2937' }}>Tiempo Parcial 10 Hr</option>
                          <option value="TIEMPO PARCIAL 12 H" style={{ color: '#1f2937' }}>Tiempo Parcial 12 Hr</option>
                          <option value="TIEMPO PARCIAL 16 H" style={{ color: '#1f2937' }}>Tiempo Parcial 16 Hr</option>
                          <option value="TIEMPO PARCIAL 20 H" style={{ color: '#1f2937' }}>Tiempo Parcial 20 Hr</option>
                          <option value="TIEMPO COMPLETO 40 H" style={{ color: '#1f2937' }}>Tiempo Completo 40 Hr</option>
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}



          {/* TRABAJO LECTIVO */}
          {docenteSeleccionado && (
            <div style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                  1. TRABAJO LECTIVO.- Datos completos y con claridad
                </h3>
                <button
                  className="btn-primary"
                  onClick={() => setShowAgregarCursoModal(true)}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  + Agregar Curso
                </button>
              </div>

              {/* Tabla de cursos */}
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table 
                  className="data-table" 
                  style={{ 
                    fontSize: '11px', 
                    borderCollapse: 'collapse', 
                    width: '100%'
                  }}
                >
                  <thead>
                    <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>CÓDIGO</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>NOMBRE DEL CURSO</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>SECCIÓN</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>CURSO</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Escuela Prof.</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Año o Ciclo</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Nro Tot. Alumnos</th>
                      <th colSpan={2} style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Hrs.Teo/Grupos</th>
                      <th colSpan={2} style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Hrs.Pra/Grupos</th>
                      <th colSpan={2} style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Hrs.Lab/Grupos</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Total Hrs.</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cursosAsignados.length === 0 ? (
                      <tr>
                        <td colSpan={16} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', border: '1px solid var(--border-color)' }}>
                          No hay cursos agregados
                        </td>
                      </tr>
                    ) : (
                      cursosAsignados.map(curso => (
                        <tr key={curso.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.codigo}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.nombre}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={curso.seccion}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'seccion', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '60px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <select
                              className="form-input"
                              value={curso.condicionCurso}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'condicionCurso', e.target.value as 'OB' | 'EL')}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '70px' }}
                            >
                              <option value="OB">OB</option>
                              <option value="EL">EL</option>
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={curso.escuela}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'escuela', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '180px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.anioCiclo}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.numeroAlumnos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'numeroAlumnos', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '70px' }}
                            />
                          </td>
                          {/* Teoría */}
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.teoriaHoras}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'teoriaHoras', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.teoriaGrupos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'teoriaGrupos', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          {/* Práctica */}
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.practicaHoras}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'practicaHoras', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.practicaGrupos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'practicaGrupos', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          {/* Laboratorio */}
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.laboratorioHoras}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'laboratorioHoras', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={curso.laboratorioGrupos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'laboratorioGrupos', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.totalHoras}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <button 
                              className="btn-secondary btn-crud-deactivate" 
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => handleEliminarCurso(curso.id)}
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SECCIONES 2 A 10 */}
          {docenteSeleccionado && (
            <div style={{ marginTop: '32px' }}>
              {/* 2. PREPARACIÓN Y EVALUACIÓN */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    2. PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.preparacionEvaluacion.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('preparacionEvaluacion', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.preparacionEvaluacion.horas}
                              onChange={(e) => handleUpdateHoras('preparacionEvaluacion', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. CONSEJERÍA Y TUTORÍA */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    3. CONSEJERÍA Y TUTORÍA (Como mínimo 01 hora semanal)
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.consejeriaTutoria.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('consejeriaTutoria', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.consejeriaTutoria.horas}
                              onChange={(e) => handleUpdateHoras('consejeriaTutoria', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. INVESTIGACIÓN */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    4. INVESTIGACIÓN (Como mínimo 04 y 05 horas semanales, según modalidad)
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.investigacion.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('investigacion', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.investigacion.horas}
                              onChange={(e) => handleUpdateHoras('investigacion', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. CAPACITACIÓN */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    5. CAPACITACIÓN (Como máximo 05 semanales)
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.capacitacion.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('capacitacion', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.capacitacion.horas}
                              onChange={(e) => handleUpdateHoras('capacitacion', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. ACTIVIDADES DE GOBIERNO */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    6. ACTIVIDADES DE GOBIERNO
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.gobierno.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('gobierno', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.gobierno.horas}
                              onChange={(e) => handleUpdateHoras('gobierno', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 7. ADMINISTRACIÓN */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    7. ADMINISTRACIÓN
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.administracion.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('administracion', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.administracion.horas}
                              onChange={(e) => handleUpdateHoras('administracion', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 8. ASESORÍA DE TESIS */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    8. ASESORÍA DE TESIS
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.asesoriaTesis.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('asesoriaTesis', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.asesoriaTesis.horas}
                              onChange={(e) => handleUpdateHoras('asesoriaTesis', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 9. RESPONSABILIDAD SOCIAL UNIVERSITARIA */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    9. RESPONSABILIDAD SOCIAL UNIVERSITARIA
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.responsabilidadSocial.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('responsabilidadSocial', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.responsabilidadSocial.horas}
                              onChange={(e) => handleUpdateHoras('responsabilidadSocial', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 10. COMITÉS TÉCNICOS */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    10. COMITÉS TÉCNICOS
                  </h3>
                </div>
                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '80%' }}>Descripción</th>
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)', width: '20%' }}>Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secciones.comitesTecnicos.items.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={item.descripcion}
                              onChange={(e) => handleUpdateItemDescripcion('comitesTecnicos', item.id, e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={secciones.comitesTecnicos.horas}
                              onChange={(e) => handleUpdateHoras('comitesTecnicos', e.target.value)}
                              onWheel={(e) => e.preventDefault()}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* TOTAL HORAS */}
              <div style={{ 
                background: darkMode ? '#1e293b' : '#f1f5f9', 
                padding: '16px', 
                borderRadius: '8px',
                marginTop: '32px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700' }}>TOTAL HORAS SEMANALES:</span>
                  <span style={{ fontSize: '32px', fontWeight: '700', color: '#059669' }}>
                    {totalHoras}
                  </span>
                </div>
              </div>

              {/* GUARDAR BUTTON */}
              {canWrite && (
                <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-secondary"
                    onClick={() => router.push('/carga-horaria')}
                    style={{ padding: '10px 24px' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={handleGuardar}
                    disabled={guardando}
                    style={{ padding: '10px 24px' }}
                  >
                    {guardando ? 'Guardando...' : 'Guardar Carga Horaria'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for adding courses */}
      {showAgregarCursoModal && (
        <div className="modal-overlay" onClick={() => setShowAgregarCursoModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Seleccionar Curso</h2>
              <button onClick={() => setShowAgregarCursoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <input
                  className="form-input"
                  placeholder="Buscar curso por nombre o código..."
                  value={cursoSearchQuery}
                  onChange={(e) => setCursoSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {cursos
                  .filter(c => 
                    normalizeText(c.nombre).includes(normalizeText(cursoSearchQuery)) ||
                    normalizeText(c.codigo).includes(normalizeText(cursoSearchQuery))
                  )
                  .map(curso => (
                    <div
                      key={curso.id}
                      onClick={() => handleSeleccionarCurso(curso)}
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        background: selectedCurso?.id === curso.id ? '#eff6ff' : 'transparent'
                      }}
                    >
                      <div style={{ fontWeight: '600' }}>
                        {curso.codigo} - {curso.nombre}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Ciclo: {curso.ciclo_plan} | Escuela: {curso.escuela_nombre || curso.escuela?.nombre || 'N/A'}
                      </div>
                    </div>
                  ))}
              </div>
              {selectedCurso && (
                <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Detalles del Curso</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Sección</label>
                      <input
                        className="form-input"
                        value={nuevoCurso.seccion}
                        onChange={(e) => setNuevoCurso(prev => ({ ...prev, seccion: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Número de Alumnos</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.numeroAlumnos}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          setNuevoCurso(prev => ({ ...prev, numeroAlumnos: val }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Horas Teoría</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.teoriaHoras}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          const tHoras = parseFloat(val || '0') * parseFloat(nuevoCurso.teoriaGrupos || '0');
                          const pHoras = parseFloat(nuevoCurso.practicaHoras || '0') * parseFloat(nuevoCurso.practicaGrupos || '0');
                          const lHoras = parseFloat(nuevoCurso.laboratorioHoras || '0') * parseFloat(nuevoCurso.laboratorioGrupos || '0');
                          const total = (tHoras + pHoras + lHoras).toString();
                          setNuevoCurso(prev => ({ ...prev, teoriaHoras: val, totalHoras: total }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Grupos Teoría</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.teoriaGrupos}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          const tHoras = parseFloat(nuevoCurso.teoriaHoras || '0') * parseFloat(val || '0');
                          const pHoras = parseFloat(nuevoCurso.practicaHoras || '0') * parseFloat(nuevoCurso.practicaGrupos || '0');
                          const lHoras = parseFloat(nuevoCurso.laboratorioHoras || '0') * parseFloat(nuevoCurso.laboratorioGrupos || '0');
                          const total = (tHoras + pHoras + lHoras).toString();
                          setNuevoCurso(prev => ({ ...prev, teoriaGrupos: val, totalHoras: total }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Horas Práctica</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.practicaHoras}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          const tHoras = parseFloat(nuevoCurso.teoriaHoras || '0') * parseFloat(nuevoCurso.teoriaGrupos || '0');
                          const pHoras = parseFloat(val || '0') * parseFloat(nuevoCurso.practicaGrupos || '0');
                          const lHoras = parseFloat(nuevoCurso.laboratorioHoras || '0') * parseFloat(nuevoCurso.laboratorioGrupos || '0');
                          const total = (tHoras + pHoras + lHoras).toString();
                          setNuevoCurso(prev => ({ ...prev, practicaHoras: val, totalHoras: total }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Grupos Práctica</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.practicaGrupos}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          const tHoras = parseFloat(nuevoCurso.teoriaHoras || '0') * parseFloat(nuevoCurso.teoriaGrupos || '0');
                          const pHoras = parseFloat(nuevoCurso.practicaHoras || '0') * parseFloat(val || '0');
                          const lHoras = parseFloat(nuevoCurso.laboratorioHoras || '0') * parseFloat(nuevoCurso.laboratorioGrupos || '0');
                          const total = (tHoras + pHoras + lHoras).toString();
                          setNuevoCurso(prev => ({ ...prev, practicaGrupos: val, totalHoras: total }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Horas Laboratorio</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.laboratorioHoras}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          const tHoras = parseFloat(nuevoCurso.teoriaHoras || '0') * parseFloat(nuevoCurso.teoriaGrupos || '0');
                          const pHoras = parseFloat(nuevoCurso.practicaHoras || '0') * parseFloat(nuevoCurso.practicaGrupos || '0');
                          const lHoras = parseFloat(val || '0') * parseFloat(nuevoCurso.laboratorioGrupos || '0');
                          const total = (tHoras + pHoras + lHoras).toString();
                          setNuevoCurso(prev => ({ ...prev, laboratorioHoras: val, totalHoras: total }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Grupos Laboratorio</label>
                      <input
                        className="form-input"
                        type="number"
                        min="0"
                        value={nuevoCurso.laboratorioGrupos}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (parseFloat(val) < 0) val = '0';
                          const tHoras = parseFloat(nuevoCurso.teoriaHoras || '0') * parseFloat(nuevoCurso.teoriaGrupos || '0');
                          const pHoras = parseFloat(nuevoCurso.practicaHoras || '0') * parseFloat(nuevoCurso.practicaGrupos || '0');
                          const lHoras = parseFloat(nuevoCurso.laboratorioHoras || '0') * parseFloat(val || '0');
                          const total = (tHoras + pHoras + lHoras).toString();
                          setNuevoCurso(prev => ({ ...prev, laboratorioGrupos: val, totalHoras: total }));
                        }}
                        onWheel={(e) => e.preventDefault()}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Total Horas</label>
                      <input
                        className="form-input"
                        type="number"
                        value={nuevoCurso.totalHoras}
                        disabled
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn-secondary" onClick={() => setShowAgregarCursoModal(false)}>
                      Cancelar
                    </button>
                    <button className="btn-primary" onClick={handleAgregarCurso}>
                      Agregar Curso
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertMessage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                backgroundColor: '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                !
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                Atención
              </h3>
            </div>
            <p style={{
              margin: 0,
              marginBottom: '20px',
              fontSize: '14px',
              color: '#4b5563',
              lineHeight: '1.5'
            }}>
              {alertMessage}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onClick={() => setAlertMessage(null)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botones de Guardar y Cancelar */}
      {docenteSeleccionado && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
          <button
            className="btn-secondary"
            onClick={() => router.push('/carga-horaria')}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleGuardar}
            disabled={guardando}
          >
            {guardando ? 'Guardando...' : 'Guardar Carga Horaria'}
          </button>
        </div>
      )}
    </div>
  );
}
