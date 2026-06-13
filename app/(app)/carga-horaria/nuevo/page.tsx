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
  const shouldReset = searchParams.get('reset') === 'true';
  const [cicloAcademicoSeleccionado, setCicloAcademicoSeleccionado] = useState<string>(initialCicloAcademico || '');
  
  // Saved state interface
  interface SavedDocenteData {
    docenteSeleccionado: Docente | null;
    facultad: string;
    dptoAcademico: string;
    modalidad: string;
    cursosAsignados: CursoAsignado[];
    secciones: Secciones;
  }
  
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
  
  // LocalStorage keys
  const STORAGE_PREFIX = 'cargaHoraria';
  const getStorageKey = (cicloId: string, docenteId?: string) => {
    if (!docenteId) return `${STORAGE_PREFIX}-ciclo-${cicloId}`;
    return `${STORAGE_PREFIX}-ciclo-${cicloId}-docente-${docenteId}`;
  };
  
  // Load saved data on mount
  useEffect(() => {
    if (!initialCicloAcademico) return;
    
    // If shouldReset, clear all saved data and reset state
    if (shouldReset) {
      // Clear any saved data for this ciclo
      localStorage.removeItem(getStorageKey(initialCicloAcademico));
      
      // Reset state
      setDocenteSeleccionado(null);
      setFacultad('');
      setDptoAcademico('');
      setModalidad('');
      setCursosAsignados([]);
      setSecciones(initialSecciones);
      setSearchQuery('');
      
      return;
    }
    
    // Check if we have a saved docente for this ciclo
    const savedCicloData = localStorage.getItem(getStorageKey(initialCicloAcademico));
    if (savedCicloData) {
      try {
        const parsed = JSON.parse(savedCicloData);
        if (parsed.lastDocenteId) {
          const savedDocenteData = localStorage.getItem(getStorageKey(initialCicloAcademico, parsed.lastDocenteId));
          if (savedDocenteData) {
            const docData: SavedDocenteData = JSON.parse(savedDocenteData);
            setDocenteSeleccionado(docData.docenteSeleccionado);
            setFacultad(docData.facultad);
            setDptoAcademico(docData.dptoAcademico);
            setModalidad(docData.modalidad || '');
            setCursosAsignados(docData.cursosAsignados);
            setSecciones(docData.secciones || initialSecciones);
            if (docData.docenteSeleccionado) {
              setSearchQuery(`${docData.docenteSeleccionado.apellidos || ''}, ${docData.docenteSeleccionado.nombre || ''}`);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load saved data', e);
      }
    }
  }, [initialCicloAcademico, shouldReset]);
  
  // Auto-save current docente data whenever it changes
  useEffect(() => {
    if (!cicloAcademicoSeleccionado) return;
    
    // Save which docente was last active for this ciclo
    if (docenteSeleccionado) {
      localStorage.setItem(getStorageKey(cicloAcademicoSeleccionado), JSON.stringify({
        lastDocenteId: docenteSeleccionado.id
      }));
      
      // Save docente-specific data
      const docenteData: SavedDocenteData = {
        docenteSeleccionado,
        facultad,
        dptoAcademico,
        modalidad,
        cursosAsignados,
        secciones
      };
      localStorage.setItem(getStorageKey(cicloAcademicoSeleccionado, docenteSeleccionado.id), JSON.stringify(docenteData));
    }
  }, [cicloAcademicoSeleccionado, docenteSeleccionado, facultad, dptoAcademico, modalidad, cursosAsignados, secciones]);
  
  // Handle docente selection and load saved data if available
  const handleSeleccionarDocenteFromList = async (docente: Docente) => {
    console.log('🎯 Selected docente:', docente);
    console.log('🎯 docente.facultad:', docente.facultad);
    console.log('🎯 docente.dpto_academico:', docente.dpto_academico);
    // Save current docente first before switching
    if (docenteSeleccionado && cicloAcademicoSeleccionado) {
      const currentDocData: SavedDocenteData = {
        docenteSeleccionado,
        facultad,
        dptoAcademico,
        modalidad,
        cursosAsignados,
        secciones
      };
      localStorage.setItem(getStorageKey(cicloAcademicoSeleccionado, docenteSeleccionado.id), JSON.stringify(currentDocData));
    }
    
    // Now set new docente
    setDocenteSeleccionado(docente);
    
    // First set default values from docente
    let newFacultad = docente.facultad || '';
    let newDptoAcademico = docente.dpto_academico || '';
    let newModalidad = '';
    let newCursosAsignados: CursoAsignado[] = [];
    let newSecciones = initialSecciones;
    
    // Check server first for existing carga horaria
    let loadedFromServer = false;
    if (cicloAcademicoSeleccionado) {
      try {
        const params = new URLSearchParams();
        params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
        params.set('docente_id', docente.id);
        
        const res = await fetch(`/api/carga-horaria?${params}`);
        const data = await res.json();
        console.log('📄 Carga horaria from server:', data);
        if (data.data && data.data.length > 0) {
          const ch = data.data[0];
          
          // Convert server data to our state structure
          console.log('📄 ch.facultad:', ch.facultad, 'docente.facultad:', docente.facultad);
          console.log('📄 ch.dpto_academico:', ch.dpto_academico, 'docente.dpto_academico:', docente.dpto_academico);
          newFacultad = ch.facultad || docente.facultad || '';
          newDptoAcademico = ch.dpto_academico || docente.dpto_academico || '';
          newModalidad = ch.modalidad || '';
          
          // Convert cursos
          const convertedCursos: CursoAsignado[] = (ch.cursos || []).map((curso: any) => ({
            id: curso.curso_id, // or Date.now().toString(), but use curso_id
            curso_id: curso.curso_id, // NEW!
            curso: String(curso.ciclo_plan),
            codigo: curso.curso_codigo,
            nombre: curso.curso_nombre,
            seccion: curso.seccion,
            escuela: curso.escuela,
            condicionCurso: 'OB',
            anioCiclo: '',
            numeroAlumnos: String(curso.num_alumnos),
            teoriaHoras: String(curso.horas_teoria),
            teoriaGrupos: '1',
            practicaHoras: String(curso.horas_practica),
            practicaGrupos: '1',
            laboratorioHoras: String(curso.horas_laboratorio),
            laboratorioGrupos: '1',
            totalHoras: String(curso.total_horas)
          }));
          newCursosAsignados = convertedCursos;
          
          // Convert secciones
          newSecciones = {
            preparacionEvaluacion: { 
              items: [{ id: 'prep-1', descripcion: ch.preparacion?.descripcion || '' }], 
              horas: String(ch.preparacion?.horas || 0) 
            },
            consejeriaTutoria: { 
              items: [{ id: 'consej-1', descripcion: ch.consejeria?.detalles || '' }], 
              horas: String(ch.consejeria?.horas || 0) 
            },
            investigacion: { 
              items: [{ id: 'invest-1', descripcion: ch.investigacion?.proyecto || '' }], 
              horas: String(ch.investigacion?.horas || 0) 
            },
            capacitacion: { 
              items: [{ id: 'cap-1', descripcion: ch.capacitacion?.detalles || '' }], 
              horas: String(ch.capacitacion?.horas || 0) 
            },
            gobierno: { 
              items: [{ id: 'gob-1', descripcion: ch.gobierno?.detalles || '' }], 
              horas: String(ch.gobierno?.horas || 0) 
            },
            administracion: { 
              items: [{ id: 'admin-1', descripcion: ch.administracion?.detalles || '' }], 
              horas: String(ch.administracion?.horas || 0) 
            },
            asesoriaTesis: { 
              items: [{ id: 'tesis-1', descripcion: ch.asesoria?.detalles || '' }], 
              horas: String(ch.asesoria?.horas || 0) 
            },
            responsabilidadSocial: { 
              items: [{ id: 'rs-1', descripcion: ch.rsu?.plan || '' }], 
              horas: String(ch.rsu?.horas || 0) 
            },
            comitesTecnicos: { 
              items: [{ id: 'comites-1', descripcion: ch.comites?.detalles || '' }], 
              horas: String(ch.comites?.horas || 0) 
            }
          };
          
          loadedFromServer = true;
        }
      } catch (e) {
        console.error('Error loading carga horaria from server:', e);
      }
    }
    
    // If not loaded from server, check localStorage
    if (!loadedFromServer && cicloAcademicoSeleccionado) {
      const savedDocData = localStorage.getItem(getStorageKey(cicloAcademicoSeleccionado, docente.id));
      if (savedDocData) {
        try {
          const docData: SavedDocenteData = JSON.parse(savedDocData);
          console.log('📦 Using saved doc data:', docData);
          newFacultad = docData.facultad;
          newDptoAcademico = docData.dptoAcademico;
          newModalidad = docData.modalidad || '';
          newCursosAsignados = docData.cursosAsignados;
          newSecciones = docData.secciones || initialSecciones;
        } catch (e) {
          // If parse fails, keep the docente defaults
          console.log('📦 Saved data failed, using docente defaults');
        }
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
    if (!docenteSeleccionado || !cicloAcademicoSeleccionado) return;
    
    // Filter out any courses that don't have curso_id!
    const validCursos = cursosAsignados.filter(curso => curso.curso_id && curso.curso_id.length > 0);
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
        alert('Error guardando: ' + (data.error || 'Ocurrió un error'));
        return;
      }

      setMostrarExito(true);
      setTimeout(() => {
        router.push('/carga-horaria');
      }, 2000);
    } catch (e) {
      console.error('Error guardando:', e);
      alert('Error guardando la carga horaria');
    } finally {
      setGuardando(false);
    }
  };

  // Load all docentes initially - no pagination!
  useEffect(() => {
    fetch('/api/docentes?limit=1000')
      .then(r => r.json())
      .then(data => {
        console.log('✅ Docentes loaded from API:', data.data);
        data.data.forEach((doc: any) => {
          console.log(`👨‍🏫 Docente ${doc.nombre} ${doc.apellidos}:`, {
            facultad: doc.facultad,
            dpto_academico: doc.dpto_academico
          });
        });
        setDocentes(data.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);
  
  // Load all cursos for search/select
  useEffect(() => {
    const fetchCursos = async () => {
      try {
        const res = await fetch('/api/cursos?reporte=true');
        const data = await res.json();
        setCursos(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCursos();
  }, []);

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
    console.log('Checking docente:', d.nombre, d.apellidos, 'activo:', d.activo, 'dni:', d.dni, 'codigo:', d.codigo);
    console.log('Checking docente fields:', {
      facultad: d.facultad,
      dpto_academico: d.dpto_academico,
      ...d
    });
    if (!d.activo) return false;
    if (!searchQuery) return true;
    const query = normalizeText(searchQuery);
    const matches = (
      normalizeText(d.nombre || '').includes(query) ||
      normalizeText(d.apellidos || '').includes(query) ||
      normalizeText(d.codigo || d.dni || '').includes(query)
    );
    console.log(`Does "${d.apellidos}, ${d.nombre}" match "${searchQuery}" (${query})?`, matches);
    return matches;
  });
  console.log('🔍 Filtered docentes count:', filteredDocentes.length, filteredDocentes);

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

  const handleAgregarCurso = () => {
    const id = Date.now().toString();
    setCursosAsignados([...cursosAsignados, { ...nuevoCurso, id }]);
    setNuevoCurso({
      codigo: '',
      nombre: '',
      seccion: '',
      tipo: '',
      escuela: '',
      ciclo: '',
      numeroAlumnos: '',
      horasTeoria: '',
      horasPractica: '',
      horasLaboratorio: '',
      totalHoras: '',
    });
    setShowAgregarCurso(false);
  };

  const handleEliminarCurso = (id: string) => {
    setCursosAsignados(cursosAsignados.filter(c => c.id !== id));
  };

  const handleUpdateCursoField = (id: string, field: keyof CursoAsignado, value: string) => {
    setCursosAsignados(cursosAsignados.map(c => {
      if (c.id !== id) return c;
      
      // Update the field
      const updated = { ...c, [field]: value };
      
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
    setSecciones(prev => ({
      ...prev,
      [seccionKey]: {
        ...prev[seccionKey],
        horas: value
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
      
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Nueva Carga Horaria</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Selecciona docentes para continuar</p>
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
                placeholder="Buscar docente por nombre, apellidos o código..."
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
                        ? '#eff6ff' 
                        : 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: '600' }}>
                      {docente.apellidos || ''}, {docente.nombre || ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      DNI: {docente.dni || docente.codigo || ''}
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
                          <option value="TIEMPO COMPLETO 40 H" style={{ color: '#1f2937' }}>Tiempo Completo 40 H</option>
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
                              value={curso.numeroAlumnos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'numeroAlumnos', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '70px' }}
                            />
                          </td>
                          {/* Teoría */}
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              value={curso.teoriaHoras}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'teoriaHoras', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              value={curso.teoriaGrupos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'teoriaGrupos', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          {/* Práctica */}
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              value={curso.practicaHoras}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'practicaHoras', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              value={curso.practicaGrupos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'practicaGrupos', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          {/* Laboratorio */}
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              value={curso.laboratorioHoras}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'laboratorioHoras', e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              value={curso.laboratorioGrupos}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'laboratorioGrupos', e.target.value)}
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
                              value={secciones.preparacionEvaluacion.horas}
                              onChange={(e) => handleUpdateHoras('preparacionEvaluacion', e.target.value)}
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
                              value={secciones.consejeriaTutoria.horas}
                              onChange={(e) => handleUpdateHoras('consejeriaTutoria', e.target.value)}
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
                              value={secciones.investigacion.horas}
                              onChange={(e) => handleUpdateHoras('investigacion', e.target.value)}
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
                              value={secciones.capacitacion.horas}
                              onChange={(e) => handleUpdateHoras('capacitacion', e.target.value)}
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
                              value={secciones.gobierno.horas}
                              onChange={(e) => handleUpdateHoras('gobierno', e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 7. ACTIVIDADES DE ADMINISTRACIÓN */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    7. ACTIVIDADES DE ADMINISTRACIÓN
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
                              value={secciones.administracion.horas}
                              onChange={(e) => handleUpdateHoras('administracion', e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    8. ASESORÍA DE TESIS, EXÁMENES PROFESIONALES Y EXPERIENCIA PROFESIONAL
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
                              value={secciones.asesoriaTesis.horas}
                              onChange={(e) => handleUpdateHoras('asesoriaTesis', e.target.value)}
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
                    9. RESPONSABILIDAD SOCIAL UNIVERSITARIA (Como máximo 02 horas semanales)
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
                              value={secciones.responsabilidadSocial.horas}
                              onChange={(e) => handleUpdateHoras('responsabilidadSocial', e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 10. COMITÉS TÉCNICOS Y COMISIONES */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    10. COMITÉS TÉCNICOS Y COMISIONES
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
                              value={secciones.comitesTecnicos.horas}
                              onChange={(e) => handleUpdateHoras('comitesTecnicos', e.target.value)}
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
              <div style={{ marginTop: '24px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Total Horas:</span>
                  <input
                    className="form-input"
                    type="number"
                    value={totalHoras}
                    readOnly
                    style={{ width: '100px', padding: '8px 12px', fontSize: '14px', fontWeight: '600' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal para buscar/seleccionar curso */}
          {showAgregarCursoModal && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '100px'
            }} onClick={() => setShowAgregarCursoModal(false)}>
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '450px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)',
                animation: 'slideUp 0.3s ease'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                    Seleccionar Curso
                  </h2>
                  <button onClick={() => setShowAgregarCursoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div style={{ padding: '0 16px 16px' }}>
                  {/* Search input */}
                  <div style={{ marginBottom: '10px' }}>
                    <input
                      className="form-input"
                      placeholder="Buscar curso por código o nombre..."
                      value={cursoSearchQuery}
                      onChange={(e) => setCursoSearchQuery(e.target.value)}
                      style={{ width: '100%', fontSize: '13px', padding: '8px 12px' }}
                    />
                  </div>
                  
                  {/* Cursos list */}
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                    {cursos.filter(c => 
                      c.nombre?.toLowerCase().includes(cursoSearchQuery.toLowerCase()) || 
                      c.codigo?.toLowerCase().includes(cursoSearchQuery.toLowerCase())
                    ).map(curso => (
                      <div
                        key={curso.id}
                        onClick={() => setSelectedCurso(curso)}
                        style={{
                          padding: '9px 12px',
                          borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          background: selectedCurso?.id === curso.id ? 'rgba(37, 99, 235, 0.1)' : 'transparent'
                        }}
                      >
                        <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {curso.codigo} - {curso.nombre}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Ciclo {curso.ciclo_plan} • {curso.escuela_nombre || ''} • {curso.horas_teoria}h T / {curso.horas_practica}h P / {curso.horas_laboratorio}h L
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setShowAgregarCursoModal(false);
                      setSelectedCurso(null);
                      setCursoSearchQuery('');
                    }}
                    style={{ fontSize: '12px', padding: '7px 14px' }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn-primary"
                    disabled={!selectedCurso}
                    onClick={() => {
                      console.log('Adding course:', selectedCurso);
                      console.log('selectedCurso.id:', selectedCurso.id);
                      setCursosAsignados([
                        ...cursosAsignados,
                        {
                          id: Date.now().toString(),
                          curso_id: selectedCurso.id, // NEW - store curso.id
                          codigo: selectedCurso.codigo || '',
                          nombre: selectedCurso.nombre || '',
                          seccion: 'A', // Default A
                          condicionCurso: 'OB', // Default OB
                          curso: selectedCurso.ciclo_plan?.toString() || '',
                          escuela: 'Ingeniería de Sistemas', // Default
                          anioCiclo: selectedCurso.ciclo_plan?.toString() || '',
                          numeroAlumnos: '40', // Default 40
                          teoriaHoras: selectedCurso.horas_teoria?.toString() || '0',
                          teoriaGrupos: '0',
                          practicaHoras: selectedCurso.horas_practica?.toString() || '0',
                          practicaGrupos: '0',
                          laboratorioHoras: selectedCurso.horas_laboratorio?.toString() || '0',
                          laboratorioGrupos: '0',
                          totalHoras: '0'
                        }
                      ]);
                      setShowAgregarCursoModal(false);
                      setSelectedCurso(null);
                      setCursoSearchQuery('');
                    }}
                    style={{ fontSize: '12px', padding: '7px 14px' }}
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                // Clear saved data for current docente before canceling
                if (cicloAcademicoSeleccionado && docenteSeleccionado) {
                  localStorage.removeItem(getStorageKey(cicloAcademicoSeleccionado, docenteSeleccionado.id));
                }
                router.push('/carga-horaria');
              }}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleGuardar}
              disabled={!docenteSeleccionado || guardando}
            >
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
