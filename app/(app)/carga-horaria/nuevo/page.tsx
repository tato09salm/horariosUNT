'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { useUser } from '@/app/(app)/layout';

const DIAS_LABEL: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb' };

const SECCION_RESET_MAP: Record<string, string> = {
  preparacionEvaluacion: 'preparacion',
  consejeriaTutoria: 'consejeria',
  investigacion: 'investigacion',
  capacitacion: 'capacitacion',
  gobierno: 'gobierno',
  administracion: 'administracion',
  asesoriaTesis: 'asesoria',
  responsabilidadSocial: 'rsu',
  comitesTecnicos: 'comites',
};

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
  es_escuela_configurada?: boolean;
}

interface DocenteSeleccionado extends Docente {
  modalidad: string;
}

interface CursoAsignado {
  id: string;
  curso_id: string;
  codigo: string;
  nombre: string;
  seccion: string;
  condicionCurso: 'OB' | 'EL';
  curso: string;
  escuela: string;
  anioCiclo: string;
  numeroAlumnos: string;
  teoriaHoras: string;
  teoriaGrupos: string;
  practicaHoras: string;
  practicaGrupos: string;
  laboratorioHoras: string;
  laboratorioGrupos: string;
  totalHoras: string;
  observaciones?: string;
  estado_observaciones?: string;
  curriculaId?: string;
  curriculaNombre?: string;
}

interface ItemActividad {
  id: string;
  descripcion: string;
  horas?: string;
  dia?: string;
  hora_inicio?: string;
  hora_fin?: string;
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

interface AdicionalCurso {
  id: string;
  curso: string;
  dependencia: string;
  fecha_inicio: string;
  fecha_termino: string;
  horario_semanal: string;
  total_horas: string;
}

interface AdicionalData {
  facultad: string;
  dpto_academico: string;
  nombre_docente: string;
  codigo_docente: string;
  dni_docente: string;
  condicion: string;
  categoria: string;
  regimen_dedicacion: 'DE' | 'TC' | 'TP' | '';
  periodo_academico: string;
  fecha_inicio_periodo: string;
  fecha_termino_periodo: string;
  cursos: AdicionalCurso[];
  total_horas_adicional: string;
}

export default function NuevaCargaHorariaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { darkMode } = useTheme();
  const user = useUser();
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const isSecretaria = user?.rol.codigo === 'secretaria';
  const isDocente = user?.rol.codigo === 'docente';
  const canWrite = isAdmin || isDirector;
  const canEditForm = isAdmin || isDirector || isSecretaria;

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const mapModalidad = (mod: string): 'DE' | 'TC' | 'TP' | '' => {
    if (!mod) return 'DE';
    const normalized = mod.toUpperCase();
    if (normalized.includes('COMPLETO') || normalized.includes('TC') || normalized.includes('40')) return 'TC';
    if (normalized.includes('PARCIAL') || normalized.includes('TP')) return 'TP';
    return 'DE';
  };

  const getTPHours = (mod: string): string => {
    if (!mod) return '';
    const normalized = mod.toUpperCase();
    if (normalized.includes('PARCIAL') || normalized.includes('TP')) {
      const match = mod.match(/(\d+\s*H[RS]?|\d+\s*horas?|\d+\s*hr?s?)/i);
      if (match) {
        return match[0].toUpperCase();
      }
    }
    return '';
  };

  const initialCicloAcademico = searchParams.get('cicloAcademico');
  const initialDocenteId = searchParams.get('docenteId');
  const [cicloAcademicoSeleccionado, setCicloAcademicoSeleccionado] = useState<string>(initialCicloAcademico || '');
  const [declaracionJuradaOpcion, setDeclaracionJuradaOpcion] = useState<string>('');
  const [ciclosAcademicos, setCiclosAcademicos] = useState<any[]>([]);
  
  // Initial state for secciones (each with 1 default item)
  const initialSecciones: Secciones = {
    preparacionEvaluacion: { items: [{ id: 'prep-1', descripcion: '', horas: '0' }], horas: '0' },
    consejeriaTutoria: { items: [{ id: 'consej-1', descripcion: '', horas: '0' }], horas: '0' },
    investigacion: { items: [{ id: 'invest-1', descripcion: '', horas: '0' }], horas: '0' },
    capacitacion: { items: [{ id: 'cap-1', descripcion: '', horas: '0' }], horas: '0' },
    gobierno: { items: [{ id: 'gob-1', descripcion: '', horas: '0' }], horas: '0' },
    administracion: { items: [{ id: 'admin-1', descripcion: '', horas: '0' }], horas: '0' },
    asesoriaTesis: { items: [{ id: 'tesis-1', descripcion: '', horas: '0' }], horas: '0' },
    responsabilidadSocial: { items: [{ id: 'rs-1', descripcion: '', horas: '0' }], horas: '0' },
    comitesTecnicos: { items: [{ id: 'comites-1', descripcion: '', horas: '0' }], horas: '0' },
  };
  
  // State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [adicionalData, setAdicionalData] = useState<AdicionalData>({
    facultad: '',
    dpto_academico: '',
    nombre_docente: '',
    codigo_docente: '',
    dni_docente: '',
    condicion: '',
    categoria: '',
    regimen_dedicacion: '',
    periodo_academico: '',
    fecha_inicio_periodo: '',
    fecha_termino_periodo: '',
    cursos: [],
    total_horas_adicional: '0'
  });

  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [docenteSeleccionado, setDocenteSeleccionado] = useState<Docente | null>(null);
  const [facultad, setFacultad] = useState('');
  const [dptoAcademico, setDptoAcademico] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [cursosAsignados, setCursosAsignados] = useState<CursoAsignado[]>([]);
  const [secciones, setSecciones] = useState<Secciones>(initialSecciones);
  const [guardando, setGuardando] = useState(false);
  const [mostrarExito, setMostrarExito] = useState(false);
  const [cargaHorariaId, setCargaHorariaId] = useState<string | null>(null);
  const [formatosGenerados, setFormatosGenerados] = useState<boolean>(false);
  const campoBloqueado = (formatosGenerados && isDocente && !canWrite);
  const esPropiaVistaDocente = isDocente && initialDocenteId === user?.docente_id;
  const lectivaBloqueada = campoBloqueado || isDocente;
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [confirmCambioOpcion, setConfirmCambioOpcion] = useState<string | null>(null);
  
  // Curriculas for course selection
  const [curriculas, setCurriculas] = useState<any[]>([]);
  const [selectedCurricula, setSelectedCurricula] = useState<string>('');
  const [curriculaHistory, setCurriculaHistory] = useState<string[]>([]);
  
  // Alert state for duplicate course
  const [showCursoDuplicadoAlert, setShowCursoDuplicadoAlert] = useState(false);
  const [mensajeCursoDuplicado, setMensajeCursoDuplicado] = useState('');
  
  // Acordeón state
  const [detallesCursoAbierto, setDetallesCursoAbierto] = useState(true);
  
  // Cursos for search/select modal
  const [cursos, setCursos] = useState<any[]>([]);
  const [allCursos, setAllCursos] = useState<any[]>([]);
  const [showAgregarCursoModal, setShowAgregarCursoModal] = useState(false);
  const [cursoSearchQuery, setCursoSearchQuery] = useState('');
  const [selectedCurso, setSelectedCurso] = useState<any>(null);
  const [nuevoCurso, setNuevoCurso] = useState<Omit<CursoAsignado, 'id'> & { curriculaId?: string, curriculaNombre?: string }>({
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
  const [alertType, setAlertType] = useState<'success' | 'error'>('error');
  
  // Load docentes and cursos and curriculas
  useEffect(() => {
    const loadData = async () => {
      try {
        const [docentesRes, cursosRes, ciclosRes, curriculasRes] = await Promise.all([
          fetch('/api/docentes?limit=1000'),
          fetch('/api/cursos?reporte=true'),
          fetch('/api/ciclos?reporte=true'),
          fetch('/api/curriculas?manage=true')
        ]);
        const docentesData = await docentesRes.json();
        const cursosData = await cursosRes.json();
        const ciclosData = await ciclosRes.json();
        const curriculasData = await curriculasRes.json();
        
        setDocentes(docentesData.data || []);
        setAllCursos(cursosData.data || []);
        setCursos(cursosData.data || []);
        setCiclosAcademicos(ciclosData.data || []);
        setCurriculas(curriculasData.data || []);
        
        // Load curricula history from localStorage
        const savedHistory = localStorage.getItem('curriculaHistory');
        if (savedHistory) {
          setCurriculaHistory(JSON.parse(savedHistory));
        }
        
        // Set default selected curricula to first one available
        if (curriculasData.data && curriculasData.data.length > 0) {
          setSelectedCurricula(curriculasData.data[0].id);
        }
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

    
    // Now set new docente
    setDocenteSeleccionado(docente);
    
    // First set default values from docente
    let newFacultad = docente.facultad || '';
    let newDptoAcademico = docente.dpto_academico || '';
    let newModalidad = '';
    let newCursosAsignados: CursoAsignado[] = [];
    let newSecciones = initialSecciones;
    let loadedChId: string | null = null;
    let parsedAdicional: any = null;
    
    // Check server first for existing carga horaria
    if (cicloAcademicoSeleccionado) {
      try {
        const params = new URLSearchParams();
        params.set('ciclo_academico_id', cicloAcademicoSeleccionado);
        params.set('docente_id', docente.id);
        
        const res = await fetch(`/api/carga-horaria?${params}`);
        const data = await res.json();
          if (data.data && data.data.length > 0) {
            // Combine all carga horaria entries into one
            const allCursos: any[] = [];
            let combinedCh: any = null;
            
            for (const ch of data.data) {
              if (!combinedCh) {
                combinedCh = ch;
                loadedChId = ch.id;
              }
              if (ch.cursos) {
                allCursos.push(...ch.cursos);
              }
            }
            setFormatosGenerados(!!combinedCh?.formatos_generados);
            
          newFacultad = combinedCh.facultad || docente.facultad || '';
          newDptoAcademico = combinedCh.dpto_academico || docente.dpto_academico || '';
          newModalidad = combinedCh.modalidad || '';
          
          if (combinedCh.adicional) {
            try {
              parsedAdicional = typeof combinedCh.adicional === 'string'
                ? JSON.parse(combinedCh.adicional)
                : combinedCh.adicional;
            } catch (err) {
              console.error('Error parsing adicional from DB:', err);
            }
          }
          
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
              id: curso.id,
              curso_id: curso.curso_id,
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
              totalHoras: String(total),
              observaciones: curso.observaciones || '',
              estado_observaciones: curso.estado_observaciones || 'pendiente',
              curriculaId: curso.curricula_id || undefined,
              curriculaNombre: curso.curricula_nombre || undefined
            };
          });
          newCursosAsignados = convertedCursos;
          
          // Helper to parse sections that come as arrays
          const parseSeccion = (data: any, descField: string) => {
            if (!data || !Array.isArray(data) || data.length === 0) {
              // Legacy object fallback
              if (data && !Array.isArray(data)) {
                return {
                  items: [{ id: `item-${Date.now()}-0`, descripcion: data[descField] || '', horas: String(data.horas || 0) }],
                  horas: String(data.horas || 0)
                };
              }
              return { items: [{ id: `item-${Date.now()}-0`, descripcion: '', horas: '0' }], horas: '0' };
            }
            const totalHoras = data.reduce((sum: number, item: any) => sum + (item.horas || 0), 0);
            const items = data.map((item: any, index: number) => ({
              id: `item-${Date.now()}-${index}`,
              descripcion: item[descField] || '',
              horas: String(item.horas || 0),
              dia: item.dia || '',
              hora_inicio: item.hora_inicio || '',
              hora_fin: item.hora_fin || ''
            }));
            return { items, horas: String(totalHoras) };
          };

          // Convert secciones
          newSecciones = {
            preparacionEvaluacion: parseSeccion(combinedCh.preparacion, 'descripcion'),
            consejeriaTutoria: parseSeccion(combinedCh.consejeria, 'detalles'),
            investigacion: parseSeccion(combinedCh.investigacion, 'proyecto'),
            capacitacion: parseSeccion(combinedCh.capacitacion, 'detalles'),
            gobierno: parseSeccion(combinedCh.gobierno, 'detalles'),
            administracion: parseSeccion(combinedCh.administracion, 'detalles'),
            asesoriaTesis: parseSeccion(combinedCh.asesoria, 'detalles'),
            responsabilidadSocial: parseSeccion(combinedCh.rsu, 'plan'),
            comitesTecnicos: parseSeccion(combinedCh.comites, 'detalles')
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
    setCargaHorariaId(loadedChId);
    
    // Set up or load adicionalData
    let initialAdicional: AdicionalData = {
      facultad: newFacultad,
      dpto_academico: newDptoAcademico,
      nombre_docente: `${docente.apellidos || ''}, ${docente.nombre || ''}`,
      codigo_docente: docente.codigo || '',
      dni_docente: docente.dni || '',
      condicion: (docente.condicion || '').toUpperCase(),
      categoria: (docente.categoria || '').toUpperCase(),
      regimen_dedicacion: mapModalidad(newModalidad),
      periodo_academico: '',
      fecha_inicio_periodo: '',
      fecha_termino_periodo: '',
      cursos: [],
      total_horas_adicional: '0'
    };

    if (cicloAcademicoSeleccionado || initialCicloAcademico) {
      const cycle = ciclosAcademicos.find(c => c.id === (cicloAcademicoSeleccionado || initialCicloAcademico));
      if (cycle) {
        initialAdicional.periodo_academico = cycle.nombre || '';
        initialAdicional.fecha_inicio_periodo = formatDate(cycle.fecha_inicio);
        initialAdicional.fecha_termino_periodo = formatDate(cycle.fecha_fin);
      }
    }

    if (parsedAdicional) {
      initialAdicional = {
        ...initialAdicional,
        ...parsedAdicional,
        condicion: (parsedAdicional.condicion || initialAdicional.condicion || '').toUpperCase(),
        categoria: (parsedAdicional.categoria || initialAdicional.categoria || '').toUpperCase(),
        cursos: parsedAdicional.cursos || []
      };
    }
    // Auto-sugerir la opción de declaración jurada según condición + régimen
const condicionUpper = (docente.condicion || '').toUpperCase();
const regimenCalc = mapModalidad(newModalidad);
let opcionSugerida = '';
if (condicionUpper === 'NOMBRADO' && regimenCalc === 'DE') opcionSugerida = 'opcion1';
else if (condicionUpper === 'NOMBRADO' && regimenCalc === 'TC') opcionSugerida = 'opcion2';
else if (condicionUpper === 'NOMBRADO' && regimenCalc === 'TP') opcionSugerida = 'opcion3';
else if (condicionUpper === 'CONTRATADO' && regimenCalc === 'TC') opcionSugerida = 'opcion5';
else if (condicionUpper === 'CONTRATADO' && regimenCalc === 'TP') opcionSugerida = 'opcion6';
setDeclaracionJuradaOpcion(opcionSugerida);

    setAdicionalData(initialAdicional);
    setStep(1); // Always reset to step 1 when selecting a new docente
    
    setSearchQuery(`${docente.apellidos || ''}, ${docente.nombre || ''}`);
    setIsSearching(false);
  };
  
  const handleContinuar = () => {
    if (!docenteSeleccionado || !cicloAcademicoSeleccionado) {
      setAlertType('error'); setAlertMessage('Por favor seleccione un docente y ciclo académico');
      return;
    }

    if (isDocente && user?.docente_id && docenteSeleccionado.id !== user.docente_id) {
      setAlertType('error'); setAlertMessage('Solo puedes continuar con tu propia carga horaria');
      return;
    }

    if (!modalidad) {
      setAlertType('error'); setAlertMessage('Por favor seleccione una modalidad');
      return;
    }
    
    const validCursos = cursosAsignados.filter(curso => curso.curso_id && curso.curso_id.length > 0);
    
    if (parseFloat(totalHoras) <= 0) {
      setAlertType('error'); setAlertMessage('El total de horas debe ser mayor a 0');
      return;
    }

    if (horasEsperadas > 0 && diffHoras !== 0) {
      setAlertType('error');
      setAlertMessage(`Las horas totales (${totalHoras}h) no coinciden con las horas establecidas para la modalidad ${modalidad} (${horasEsperadas}h). ${diffHoras > 0 ? `Excede por ${diffHoras}h.` : `Faltan ${Math.abs(diffHoras)}h.`} Ajuste las horas lectivas o no lectivas.`);
      return;
    }
    
    const cursosSinAlumnos = validCursos.filter(c => parseFloat(c.numeroAlumnos) <= 0);
    if (cursosSinAlumnos.length > 0) {
      setAlertType('error'); setAlertMessage('Todos los cursos deben tener al menos 1 alumno');
      return;
    }

    // Auto-fill or sync the general fields from Form 1 into Form 2
    const cycle = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const cycleFi = formatDate(cycle?.fecha_inicio);
    const cycleFt = formatDate(cycle?.fecha_fin);

    setAdicionalData(prev => {
      const finalFi = prev.fecha_inicio_periodo || cycleFi || '';
      const finalFt = prev.fecha_termino_periodo || cycleFt || '';

      return {
        ...prev,
        facultad: prev.facultad || facultad,
        dpto_academico: prev.dpto_academico || dptoAcademico,
        regimen_dedicacion: mapModalidad(modalidad),
        nombre_docente: prev.nombre_docente || `${docenteSeleccionado.apellidos || ''}, ${docenteSeleccionado.nombre || ''}`,
        codigo_docente: prev.codigo_docente || docenteSeleccionado.codigo || '',
        dni_docente: prev.dni_docente || docenteSeleccionado.dni || '',
        condicion: (prev.condicion || docenteSeleccionado.condicion || '').toUpperCase(),
        categoria: (prev.categoria || docenteSeleccionado.categoria || '').toUpperCase(),
periodo_academico: prev.periodo_academico || cycle?.nombre || '',
        fecha_inicio_periodo: finalFi,
        fecha_termino_periodo: finalFt,
      };
    });

    // RF-10: docentes externos (no de la escuela configurada) solo asignan cursos,
    // no necesitan declaración jurada ni carga adicional
    if (docenteSeleccionado.es_escuela_configurada === false) {
      handleGuardar();
      return;
    }

    setStep(2);
  };

  const handlePeriodoInicioChange = (newDate: string) => {
    setAdicionalData(prev => {
      const oldDate = prev.fecha_inicio_periodo;
      const updatedCursos = (prev.cursos || []).map(c => {
        if (!c.fecha_inicio || c.fecha_inicio === oldDate) {
          return { ...c, fecha_inicio: newDate };
        }
        return c;
      });
      return {
        ...prev,
        fecha_inicio_periodo: newDate,
        cursos: updatedCursos
      };
    });
  };

  const handlePeriodoTerminoChange = (newDate: string) => {
    setAdicionalData(prev => {
      const oldDate = prev.fecha_termino_periodo;
      const updatedCursos = (prev.cursos || []).map(c => {
        if (!c.fecha_termino || c.fecha_termino === oldDate) {
          return { ...c, fecha_termino: newDate };
        }
        return c;
      });
      return {
        ...prev,
        fecha_termino_periodo: newDate,
        cursos: updatedCursos
      };
    });
  };

  const handleAddAdicionalCurso = () => {
    const defaultFi = adicionalData.fecha_inicio_periodo || '';
    const defaultFt = adicionalData.fecha_termino_periodo || '';
    setAdicionalData(prev => {
      const updatedCursos = [
        ...(prev.cursos || []),
        {
          id: Date.now().toString(),
          curso: '',
          dependencia: '',
          fecha_inicio: defaultFi,
          fecha_termino: defaultFt,
          horario_semanal: '',
          total_horas: '0'
        }
      ];
      const newTotal = updatedCursos.reduce((sum, c) => sum + parseFloat(c.total_horas || '0'), 0);
      return {
        ...prev,
        cursos: updatedCursos,
        total_horas_adicional: String(newTotal)
      };
    });
  };

  const handleRemoveAdicionalCurso = (id: string) => {
    setAdicionalData(prev => {
      const updatedCursos = (prev.cursos || []).filter(c => c.id !== id);
      const newTotal = updatedCursos.reduce((sum, c) => sum + parseFloat(c.total_horas || '0'), 0);
      return {
        ...prev,
        cursos: updatedCursos,
        total_horas_adicional: String(newTotal)
      };
    });
  };

  const handleUpdateAdicionalCursoField = (id: string, field: keyof AdicionalCurso, value: string) => {
    setAdicionalData(prev => {
      const updatedCursos = (prev.cursos || []).map(c => {
        if (c.id !== id) return c;
        let processedValue = value;
        if (field === 'total_horas') {
          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue < 0) {
            processedValue = '0';
          }
        }
        return { ...c, [field]: processedValue };
      });
      const newTotal = updatedCursos.reduce((sum, c) => sum + parseFloat(c.total_horas || '0'), 0);
      return {
        ...prev,
        cursos: updatedCursos,
        total_horas_adicional: String(newTotal)
      };
    });
  };

  const handleGuardar = async () => {
    if (!docenteSeleccionado || !cicloAcademicoSeleccionado) {
      setAlertType('error'); setAlertMessage('Por favor seleccione un docente y ciclo académico');
      return;
    }

    if (isDocente && user?.docente_id && docenteSeleccionado.id !== user.docente_id) {
      setAlertType('error'); setAlertMessage('Solo puedes guardar tu propia carga horaria');
      return;
    }

    if (!modalidad) {
      setAlertType('error'); setAlertMessage('Por favor seleccione una modalidad');
      return;
    }
    
    // Filter out any courses that don't have curso_id!
    const validCursos = cursosAsignados.filter(curso => curso.curso_id && curso.curso_id.length > 0);
    
    if (parseFloat(totalHoras) <= 0) {
      setAlertType('error'); setAlertMessage('El total de horas debe ser mayor a 0');
      return;
    }

    if (horasEsperadas > 0 && diffHoras !== 0) {
      setAlertType('error');
      setAlertMessage(`Las horas totales (${totalHoras}h) no coinciden con las horas establecidas para la modalidad ${modalidad} (${horasEsperadas}h). ${diffHoras > 0 ? `Excede por ${diffHoras}h.` : `Faltan ${Math.abs(diffHoras)}h.`} Ajuste las horas lectivas o no lectivas.`);
      return;
    }
    
    // Check that all cursos have numeroAlumnos > 0
    const cursosSinAlumnos = validCursos.filter(c => parseFloat(c.numeroAlumnos) <= 0);
    if (cursosSinAlumnos.length > 0) {
      setAlertType('error'); setAlertMessage('Todos los cursos deben tener al menos 1 alumno');
      return;
    }
    
    // Sanitize adicionalData cursos
    const validAdicionalCursos = (adicionalData.cursos || []).filter(c => c.curso && c.curso.trim().length > 0);
    const updatedAdicionalData = {
      ...adicionalData,
      cursos: validAdicionalCursos,
      total_horas_adicional: String(validAdicionalCursos.reduce((sum, c) => sum + parseFloat(c.total_horas || '0'), 0))
    };
    
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
          total_horas: totalHoras,
          adicional: updatedAdicionalData
        };
        
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
        setAlertType('error'); setAlertMessage('Error guardando: ' + (data.error || 'Ocurrió un error'));
        return;
      }

const resData = await res.json();
      setMostrarExito(true);
      setTimeout(() => {
        const chId = resData?.data?.[0]?.id || cargaHorariaId;
        if (docenteSeleccionado.es_escuela_configurada === false) {
          // RF-10: docente externo, solo se le asignan cursos, no necesita horario no lectivo
          router.push('/carga-horaria');
        } else {
          router.push(`/carga-horaria/horario-no-lectiva?docenteId=${docenteSeleccionado.id}&cicloAcademico=${cicloAcademicoSeleccionado}&cargaHorariaId=${chId}`);
        }
      }, 2000);
    } catch (e) {
      console.error('Error guardando:', e);
      setAlertType('error'); setAlertMessage('Error guardando la carga horaria');
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

  // Function to add curricula to history stack
  const addToHistory = (curriculaId: string) => {
    setCurriculaHistory(prev => {
      // Remove if it already exists to bring to top
      const filtered = prev.filter(id => id !== curriculaId);
      const newHistory = [curriculaId, ...filtered];
      // Save to localStorage
      localStorage.setItem('curriculaHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };
  
  // Function to remove curricula from history
  const removeFromHistory = (curriculaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurriculaHistory(prev => {
      const newHistory = prev.filter(id => id !== curriculaId);
      localStorage.setItem('curriculaHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };
  
  const handleSeleccionarCurso = (curso: any) => {
    const cicloAcademico = ciclosAcademicos.find(c => c.id === cicloAcademicoSeleccionado);
    const tHoras = parseFloat(curso.horas_teoria || 0) * 1;
    const pHoras = parseFloat(curso.horas_practica || 0) * 1;
    const lHoras = parseFloat(curso.horas_laboratorio || 0) * 1;
    const total = (tHoras + pHoras + lHoras).toString();
    
    // Obtener nombre de la currícula
    const curricula = curriculas.find(c => c.id === selectedCurricula);
    const curriculaNombre = curricula 
      ? `${curricula.nombre_carrera} - ${curricula.año_curricula} - ${curricula.modalidad_estudios}`
      : '';
    
    // Add the selected curricula to history when selecting a course
    if (selectedCurricula) {
      addToHistory(selectedCurricula);
    }
    
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
      curriculaId: selectedCurricula,
      curriculaNombre: curriculaNombre,
    });
  };
  
  // Auto-complete curricula for existing courses when curriculas or cursosAsignados change
  useEffect(() => {
    if (curriculas.length > 0 && cursosAsignados.length > 0) {
      let hasUpdates = false;
      const updatedCursos = cursosAsignados.map(curso => {
        // Skip if already has curriculaId
        if (curso.curriculaId) return curso;
        
        // Try to find which curricula this course belongs to
        for (const curricula of curriculas) {
          let isInCurricula = false;
          
          // Check direct cursos relation (from API)
          if (curricula.cursos && Array.isArray(curricula.cursos)) {
            isInCurricula = curricula.cursos.some((c: any) => {
              const matches = 
                (c.id && curso.curso_id && c.id === curso.curso_id) || 
                (c.codigo && curso.codigo && c.codigo === curso.codigo) ||
                (c.nombre && curso.nombre && c.nombre.toLowerCase() === curso.nombre.toLowerCase());
              return matches;
            });
          }
          
          // Also check through mallas relation if available
          if (!isInCurricula && curricula.mallas && Array.isArray(curricula.mallas)) {
            isInCurricula = curricula.mallas.some((malla: any) => {
              const cursoFromMalla = malla.curso;
              return cursoFromMalla && 
                ((cursoFromMalla.id && curso.curso_id && cursoFromMalla.id === curso.curso_id) || 
                 (cursoFromMalla.codigo && curso.codigo && cursoFromMalla.codigo === curso.codigo));
            });
          }
          
          if (isInCurricula) {
            hasUpdates = true;
            return {
              ...curso,
              curriculaId: curricula.id,
              curriculaNombre: `${curricula.nombre_carrera} - ${curricula.año_curricula} - ${curricula.modalidad_estudios}`
            };
          }
        }
        
        return curso;
      });
      
      if (hasUpdates) {
        setCursosAsignados(updatedCursos);
      }
    }
  }, [curriculas, cursosAsignados]);
  
  // Filter courses based on selected curricula and search query
  useEffect(() => {
    let filteredCursos = [...allCursos];
    
    // If a curricula is selected, filter by that curricula's courses
    if (selectedCurricula) {
      // Get the curricula object
      const curricula = curriculas.find(c => c.id === selectedCurricula);
      let curriculaCourseIds = [];
      
      if (curricula) {
        // First try the direct many-to-many relation
        if (curricula.cursos && curricula.cursos.length > 0) {
          curriculaCourseIds = curricula.cursos.map((c: any) => c.id);
        } 
        // If not, try through mallas relation
        else if (curricula.mallas && curricula.mallas.length > 0) {
          curriculaCourseIds = curricula.mallas.map((malla: any) => malla.curso?.id || malla.curso_id);
        }
        
        if (curriculaCourseIds.length > 0) {
          filteredCursos = allCursos.filter((c: any) => 
            curriculaCourseIds.includes(c.id)
          );
        }
      }
    }
    
    // Apply search filter
    if (cursoSearchQuery) {
      filteredCursos = filteredCursos.filter(c => 
        normalizeText(c.nombre).includes(normalizeText(cursoSearchQuery)) ||
        normalizeText(c.codigo).includes(normalizeText(cursoSearchQuery))
      );
    }
    
    setCursos(filteredCursos);
  }, [selectedCurricula, cursoSearchQuery, allCursos, curriculas]);

  const handleAgregarCurso = () => {
    // Verificar si el curso con la misma currícula ya está agregado
    const cursoYaAgregado = cursosAsignados.some(
      curso => 
        curso.curso_id === nuevoCurso.curso_id && 
        curso.curriculaId === nuevoCurso.curriculaId
    );
    
    if (cursoYaAgregado) {
      setMensajeCursoDuplicado(`El curso "${nuevoCurso.nombre}" de la currícula "${nuevoCurso.curriculaNombre}" ya está agregado a la carga horaria.`);
      setShowCursoDuplicadoAlert(true);
      return;
    }
    
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
      curriculaId: undefined,
      curriculaNombre: '',
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
      
      // If docente edits observaciones, reset estado to pendiente
      if (field === 'observaciones') {
        updated.estado_observaciones = 'pendiente';
      }
      
      // Recalculate totalHoras
      const tHoras = parseFloat(updated.teoriaHoras || '0') * parseFloat(updated.teoriaGrupos || '0');
      const pHoras = parseFloat(updated.practicaHoras || '0') * parseFloat(updated.practicaGrupos || '0');
      const lHoras = parseFloat(updated.laboratorioHoras || '0') * parseFloat(updated.laboratorioGrupos || '0');
      updated.totalHoras = (tHoras + pHoras + lHoras).toString();
      
      return updated;
    }));
  };

  const handleGuardarObservaciones = async (curso: CursoAsignado) => {
    try {
      setGuardando(true);
      const res = await fetch(`/api/carga-horaria/cursos/${curso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observaciones: curso.observaciones || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al guardar');
      const result = await res.json();
      const updated = result.data;
      if (updated) {
        setCursosAsignados(cursosAsignados.map(c =>
          c.id === curso.id ? { ...c, estado_observaciones: updated.estado_observaciones || 'pendiente' } : c
        ));
      }
      setAlertType('success');
      setAlertMessage('Observaciones guardadas correctamente');
      setTimeout(() => setAlertMessage(''), 3000);
    } catch (e: any) {
      setAlertType('error');
      setAlertMessage('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleCambiarEstadoObservaciones = async (curso: CursoAsignado, nuevoEstado: string) => {
    try {
      setGuardando(true);
      const res = await fetch(`/api/carga-horaria/cursos/${curso.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado_observaciones: nuevoEstado }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al actualizar');
      setCursosAsignados(cursosAsignados.map(c =>
        c.id === curso.id ? { ...c, estado_observaciones: nuevoEstado } : c
      ));
      setAlertType('success');
      setAlertMessage(`Observaciones ${nuevoEstado === 'validada' ? 'validadas' : 'rechazadas'} correctamente`);
      setTimeout(() => setAlertMessage(''), 3000);
    } catch (e: any) {
      setAlertType('error');
      setAlertMessage('Error: ' + e.message);
    } finally {
      setGuardando(false);
    }
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

  const handleResetSeccion = async (seccionKey: keyof Secciones) => {
    if (!cargaHorariaId) {
      setAlertType('error');
      setAlertMessage('No hay carga horaria guardada aún. Guarda primero para usar esta opción.');
      return;
    }
    const sectionName = seccionKey.replace(/([A-Z])/g, ' $1').trim();
    if (!window.confirm(`¿Reiniciar "${sectionName}"? Se eliminarán todos los horarios asignados y deberás volver a programarlos.`)) return;

    try {
      const apiKey = SECCION_RESET_MAP[seccionKey];
      const body: any = {
        carga_horaria_id: cargaHorariaId,
        docente_id: docenteSeleccionado?.id,
      };
      body[apiKey] = { items: [] };

      const res = await fetch('/api/carga-horaria/no-lectiva', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al reiniciar');
      }

      const defaultId = `${seccionKey}-${Date.now()}`;
      setSecciones(prev => ({
        ...prev,
        [seccionKey]: {
          items: [{ id: defaultId, descripcion: '', horas: '0' }],
          horas: '0',
        },
      }));
      setAlertType('success');
      setAlertMessage(`${sectionName} reiniciada correctamente`);
    } catch (e: any) {
      setAlertType('error');
      setAlertMessage('Error: ' + e.message);
    }
  };

  const handleUpdateItemHoras = (seccionKey: keyof Secciones, itemId: string, value: string) => {
    let processedValue = value;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      processedValue = '0';
    }
    
    setSecciones(prev => {
      const updatedItems = prev[seccionKey].items.map(item => 
        item.id === itemId ? { ...item, horas: processedValue } : item
      );
      const newTotalHoras = updatedItems.reduce((sum, item) => sum + parseFloat(item.horas || '0'), 0);
      return {
        ...prev,
        [seccionKey]: {
          items: updatedItems,
          horas: String(newTotalHoras)
        }
      };
    });
  };

  // Calculate total horas: includes Trabajo Lectivo + other sections
  const totalTrabajoLectivo = cursosAsignados.reduce((sum, curso) => {
    return sum + parseFloat(curso.totalHoras || '0');
  }, 0);
  
  const totalHoras = totalTrabajoLectivo + Object.values(secciones).reduce((sum, actividad) => {
    return sum + parseFloat(actividad.horas || '0');
  }, 0);

  const getModalidadHorasEsperadas = (mod: string): number => {
    if (!mod) return 0;
    const match = mod.match(/(\d+)\s*H/i);
    return match ? parseInt(match[1], 10) : 0;
  };
  const horasEsperadas = getModalidadHorasEsperadas(modalidad);
  const diffHoras = horasEsperadas > 0 ? totalHoras - horasEsperadas : 0;

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
{formatosGenerados && isDocente && !canWrite && (
        <div style={{
          background: '#fef9c3',
          border: '1px solid #facc15',
          color: '#854d0e',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          🔒 Ya generaste tus formatos. Tu carga horaria está bloqueada para edición. Si necesitas hacer cambios, contacta a Secretaría para que la desbloquee.
        </div>
      )}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
<h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>
            {campoBloqueado
              ? 'Visualización de Carga Horaria'
              : step === 1 ? 'Nueva Carga Horaria' : step === 2 ? 'Declaración Jurada (F02-CAD)' : 'Carga Horaria Adicional'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            {campoBloqueado
              ? 'Estás visualizando tu carga horaria. Esta información es de solo lectura.'
              : step === 1 
              ? 'Paso 1 de 3: Rellene la carga horaria general' 
              : step === 2
              ? 'Paso 2 de 3: Declaración Jurada de Incompatibilidad'
              : 'Paso 3 de 3: Rellene la declaración de carga horaria lectiva adicional'}
          </p>
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
          {step === 1 && (
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
                  disabled={campoBloqueado}
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
          )}

          {/* Docente Info */}
          {step === 1 && docenteSeleccionado && (
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
                    disabled={campoBloqueado}
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
                    disabled={campoBloqueado}
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
                          disabled={campoBloqueado}
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
          {step === 1 && docenteSeleccionado && (
            <div style={{ marginTop: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                  1. TRABAJO LECTIVO.- Datos completos y con claridad
                </h3>
                {(canEditForm || isDocente) && !lectivaBloqueada && (
                  <button
                    className="btn-primary"
                    onClick={() => {
                      // Reset states when opening modal
                      setCursoSearchQuery('');
                      setSelectedCurso(null);
                      setShowAgregarCursoModal(true);
                    }}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    + Agregar Curso
                  </button>
                )}
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
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>CURRÍCULA</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>SECCIÓN</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>CURSO</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Escuela Prof.</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Año o Ciclo</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Nro Tot. Alumnos</th>
                      <th colSpan={2} style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Hrs.Teo/Grupos</th>
                      <th colSpan={2} style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Hrs.Pra/Grupos</th>
                      <th colSpan={2} style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Hrs.Lab/Grupos</th>
                      <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Total Hrs.</th>
                      {!lectivaBloqueada && (
                        <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Accion</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {cursosAsignados.length === 0 ? (
                      <tr>
                        <td colSpan={lectivaBloqueada ? 15 : 16} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', border: '1px solid var(--border-color)' }}>
                          No hay cursos agregados
                        </td>
                      </tr>
                    ) : (
                      cursosAsignados.map(curso => (
                        <tr key={curso.id}>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.codigo}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.nombre}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)', fontSize: '10px' }}>{curso.curriculaNombre || '-'}</td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              value={curso.seccion}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'seccion', e.target.value)}
                              disabled={lectivaBloqueada}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '60px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <select
                              className="form-input"
                              value={curso.condicionCurso}
                              onChange={(e) => handleUpdateCursoField(curso.id, 'condicionCurso', e.target.value as 'OB' | 'EL')}
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
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
                              disabled={lectivaBloqueada}
                              style={{ padding: '4px 6px', fontSize: '11px', width: '50px' }}
                            />
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>{curso.totalHoras}</td>
                          {!lectivaBloqueada && (
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <button 
                                className="btn-secondary btn-crud-deactivate" 
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => handleEliminarCurso(curso.id)}
                              >
                                Eliminar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* OBSERVACIONES POR CURSO */}
              {(esPropiaVistaDocente || canEditForm) && cursosAsignados.length > 0 && (
                <div style={{ marginTop: '20px', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>
                    Observaciones por Curso
                  </h3>
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                          <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Curso</th>
                          <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Observaciones</th>
                          <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Estado</th>
                          <th style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cursosAsignados
                          .filter(c => c.observaciones && c.observaciones.trim())
                          .length === 0 && !esPropiaVistaDocente ? (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                              Ningún docente ha agregado observaciones
                            </td>
                          </tr>
                        ) : (
                          cursosAsignados.map(curso => (
                            <tr key={`obs-${curso.id}`}>
                              <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                                {curso.codigo} - {curso.nombre}
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                                <textarea
                                  className="form-input"
                                  value={curso.observaciones || ''}
                                  onChange={(e) => handleUpdateCursoField(curso.id, 'observaciones', e.target.value)}
                                  disabled={!esPropiaVistaDocente}
                                  rows={2}
                                  style={{ width: '100%', minWidth: '300px', padding: '4px 6px', fontSize: '11px', resize: 'vertical' }}
                                  placeholder="Agregar observaciones..."
                                />
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)', textAlign: 'center', verticalAlign: 'middle' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: curso.estado_observaciones === 'validada' ? '#dcfce7' : curso.estado_observaciones === 'rechazada' ? '#fef2f2' : '#fef9c3',
                                  color: curso.estado_observaciones === 'validada' ? '#166534' : curso.estado_observaciones === 'rechazada' ? '#991b1b' : '#854d0e'
                                }}>
                                  {curso.estado_observaciones === 'validada' ? 'Validada' : curso.estado_observaciones === 'rechazada' ? 'Rechazada' : 'Pendiente'}
                                </span>
                              </td>
                              <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                                {esPropiaVistaDocente ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      className="btn-primary"
                                      onClick={() => handleGuardarObservaciones(curso)}
                                      style={{ padding: '4px 10px', fontSize: '11px' }}
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                ) : isSecretaria ? (
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      className="btn-primary"
                                      onClick={() => handleCambiarEstadoObservaciones(curso, 'validada')}
                                      disabled={curso.estado_observaciones === 'validada' || !curso.observaciones?.trim()}
                                      style={{ padding: '4px 10px', fontSize: '11px', background: '#16a34a', borderColor: '#16a34a' }}
                                    >
                                      Validar
                                    </button>
                                    <button
                                      className="btn-secondary btn-crud-deactivate"
                                      onClick={() => handleCambiarEstadoObservaciones(curso, 'rechazada')}
                                      disabled={curso.estado_observaciones === 'rechazada' || !curso.observaciones?.trim()}
                                      style={{ padding: '4px 10px', fontSize: '11px' }}
                                    >
                                      Rechazar
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECCIONES 2 A 10 */}
          {step === 1 && docenteSeleccionado && (
            <div style={{ marginTop: '32px' }}>
              {/* 2. PREPARACIÓN Y EVALUACIÓN */}

              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    2. PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)
                  </h3>
                  {(secciones.preparacionEvaluacion.items.length > 1 || secciones.preparacionEvaluacion.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('preparacionEvaluacion')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('preparacionEvaluacion', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('preparacionEvaluacion', item.id, e.target.value)}
                             disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    3. CONSEJERÍA Y TUTORÍA (Como mínimo 01 hora semanal)
                  </h3>
                  {(secciones.consejeriaTutoria.items.length > 1 || secciones.consejeriaTutoria.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('consejeriaTutoria')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('consejeriaTutoria', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('consejeriaTutoria', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    4. INVESTIGACIÓN (Como mínimo 04 y 05 horas semanales, según modalidad)
                  </h3>
                  {(secciones.investigacion.items.length > 1 || secciones.investigacion.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('investigacion')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('investigacion', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('investigacion', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    5. CAPACITACIÓN (Como máximo 05 semanales)
                  </h3>
                  {(secciones.capacitacion.items.length > 1 || secciones.capacitacion.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('capacitacion')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('capacitacion', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('capacitacion', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    6. ACTIVIDADES DE GOBIERNO
                  </h3>
                  {(secciones.gobierno.items.length > 1 || secciones.gobierno.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('gobierno')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('gobierno', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('gobierno', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    7. ADMINISTRACIÓN
                  </h3>
                  {(secciones.administracion.items.length > 1 || secciones.administracion.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('administracion')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('administracion', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('administracion', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    8. ASESORÍA DE TESIS
                  </h3>
                  {(secciones.asesoriaTesis.items.length > 1 || secciones.asesoriaTesis.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('asesoriaTesis')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('asesoriaTesis', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('asesoriaTesis', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    9. RESPONSABILIDAD SOCIAL UNIVERSITARIA
                  </h3>
                  {(secciones.responsabilidadSocial.items.length > 1 || secciones.responsabilidadSocial.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('responsabilidadSocial')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('responsabilidadSocial', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('responsabilidadSocial', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    10. COMITÉS TÉCNICOS
                  </h3>
                  {(secciones.comitesTecnicos.items.length > 1 || secciones.comitesTecnicos.items.some(i => i.dia)) && !campoBloqueado && (
                    <button onClick={() => handleResetSeccion('comitesTecnicos')} style={{
                      background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                      color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                      whiteSpace: 'nowrap'
                    }} title="Reiniciar sección">↺ Reset</button>
                  )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                className="form-input"
                                value={item.descripcion}
                                onChange={(e) => handleUpdateItemDescripcion('comitesTecnicos', item.id, e.target.value)}
                                disabled={!!item.dia || campoBloqueado}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                              {item.dia && (
                                <span style={{ 
                                  fontSize: '10px', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: '#e0f2fe', 
                                  color: '#0369a1',
                                  whiteSpace: 'nowrap',
                                  fontWeight: '600'
                                }}>
                                  {DIAS_LABEL[item.dia]} {item.hora_inicio?.slice(0, 5)}-{item.hora_fin?.slice(0, 5)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              value={item.horas || '0'}
                              onChange={(e) => handleUpdateItemHoras('comitesTecnicos', item.id, e.target.value)}
                              disabled={!!item.dia || campoBloqueado}
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
                {horasEsperadas > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Horas lectivas: <strong>{totalTrabajoLectivo}</strong> | No lectivas: <strong>{totalHoras - totalTrabajoLectivo}</strong>
                    </span>
                    <span style={{ color: diffHoras === 0 ? '#059669' : diffHoras > 0 ? '#ef4444' : '#f59e0b', fontWeight: '600' }}>
                      {diffHoras === 0 ? `✓ ${horasEsperadas}h exactas` : diffHoras > 0 ? `✗ Excede por ${diffHoras}h (máx ${horasEsperadas}h)` : `⚠ Faltan ${Math.abs(diffHoras)}h (mín ${horasEsperadas}h)`}
                    </span>
                  </div>
                )}
              </div>

{/* CONTINUAR BUTTON */}
              {(canEditForm || isDocente) && (
                <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-secondary"
                    onClick={() => router.push('/carga-horaria')}
                    style={{ padding: '10px 24px' }}
                  >
                    Cancelar
                  </button>
                  {!(formatosGenerados && isDocente && !canWrite) && (
                    <button 
                      className="btn-primary"
                      onClick={handleContinuar}
                      style={{ padding: '10px 24px' }}
                    >
                      Continuar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
 {/* Form 2 - F02-CAD: Declaración Jurada */}
{step === 2 && docenteSeleccionado && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

    {/* Título oficial */}
    <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '8px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: '800', textAlign: 'center', lineHeight: '1.4', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
        DECLARACIÓN JURADA DE NO ESTAR INCURSO EN CAUSALES<br/>
        DE INCOMPATIBILIDAD O IMPEDIMENTO LABORAL (F02-CAD)
      </h2>
    </div>

    {/* I. Datos del docente */}
    <div className="card" style={{ padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        I. DATOS DEL DOCENTE
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>FACULTAD</label>
          <input className="form-input" value={adicionalData.facultad} disabled style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: darkMode ? '#0f172a' : '#f1f5f9' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>DEPARTAMENTO ACADÉMICO</label>
          <input className="form-input" value={adicionalData.dpto_academico} disabled style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: darkMode ? '#0f172a' : '#f1f5f9' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>APELLIDOS Y NOMBRES</label>
          <input className="form-input" value={adicionalData.nombre_docente} disabled style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: darkMode ? '#0f172a' : '#f1f5f9' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CONDICIÓN</label>
          <input className="form-input" value={adicionalData.condicion} disabled style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: darkMode ? '#0f172a' : '#f1f5f9' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CATEGORÍA</label>
          <input className="form-input" value={adicionalData.categoria} disabled style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: darkMode ? '#0f172a' : '#f1f5f9' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>RÉGIMEN DE DEDICACIÓN</label>
          <input
            className="form-input"
            value={
              adicionalData.regimen_dedicacion === 'DE' ? 'Dedicación Exclusiva' :
              adicionalData.regimen_dedicacion === 'TC' ? 'Tiempo Completo' :
              adicionalData.regimen_dedicacion === 'TP' ? `Tiempo Parcial${getTPHours(modalidad) ? ' ' + getTPHours(modalidad) : ''}` : ''
            }
            disabled
            style={{ width: '100%', padding: '6px 8px', fontSize: '12px', background: darkMode ? '#0f172a' : '#f1f5f9' }}
          />
        </div>
      </div>
    </div>

    {/* II. Declaración */}
    <div className="card" style={{ padding: '20px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        II. DECLARACIÓN
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: '1.8', color: 'var(--text-primary)' }}>
        Yo, <strong>{adicionalData.nombre_docente}</strong>, adscrito al Departamento Académico de <strong>{adicionalData.dpto_academico}</strong> de la Facultad de <strong>{adicionalData.facultad}</strong>, en el marco de la Ley Universitaria 30220, D.S. N° 418-2017-EF, Estatuto Reformado 2021 y el reglamento de asignación de la Carga Académica de los Docentes de la UNT, <strong>DECLARO BAJO JURAMENTO Y EN HONOR A LA VERDAD</strong>, que:
      </p>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.8', color: 'var(--text-primary)' }}>
        <strong>NO ESTOY INCURSO</strong> en causales de incompatibilidad laboral y <strong>NO TENGO</strong> impedimento para ejercer la docencia en la Universidad Nacional de Trujillo, de conformidad con lo previsto en el Capítulo VIII de las Incompatibilidades, Impedimentos y sanciones, del Título XII: de los docentes, del Estatuto institucional vigente, según la especificación siguiente:
      </p>
    </div>

    {/* III. Especificación */}
    <div className="card" style={{ padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
        III. ESPECIFICACIÓN
      </h3>
      <div className="table-container">
        <table className="data-table" style={{ fontSize: '12px', borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {[
              { key: 'opcion1', num: '1', texto: 'Soy docente, ordinario a Dedicación Exclusiva y NO EJERZO cualquier otra actividad o cargo remunerado en otra universidad, entidad pública o privada, fuera de la Universidad Nacional de Trujillo (De conformidad con el Artículo 225° del Estatuto Institucional vigente).', condicion: 'NOMBRADO', regimen: 'DE' },
              { key: 'opcion2', num: '2', texto: 'Soy docente, ordinario a Tiempo Completo y NO ejerzo cualquier otra actividad o cargo remunerado en otra universidad, entidad pública o privada, fuera de la Universidad Nacional de Trujillo (De conformidad con el Artículo 225° del Estatuto Institucional vigente), así mismo en caso de incumplimiento, me someto a las sanciones dispuestas en el Reglamento del Docente Investigador y Promoción de la Investigación, aprobado por R.C.U. N°281-2021/UNT.', condicion: 'NOMBRADO', regimen: 'TC' },
              { key: 'opcion3', num: '3', texto: 'Soy docente, ordinario a Tiempo Parcial y NO TENGO incompatibilidad horaria con mi carga académica en la Universidad Nacional de Trujillo y otra institución donde laboro.', condicion: 'NOMBRADO', regimen: 'TP' },
              { key: 'opcion4', num: '4', texto: 'Soy docente, Investigador de la UNT acreditado con Resolución Vicerrectoral y NO ejerzo cualquier otra actividad o cargo remunerado en otra universidad, entidad pública o privada, fuera de la Universidad Nacional de Trujillo (De conformidad con el Artículo 225° del Estatuto Institucional vigente), así mismo en caso de incumplimiento, me someto a las sanciones dispuestas en el Reglamento del Docente Investigador y Promoción de la Investigación, aprobado por R.C.U. N°281-2021/UNT.', condicion: '', regimen: '' },
              { key: 'opcion5', num: '5', texto: 'Soy docente, contratado a Tiempo Completo y NO EJERZO la misma modalidad en otra entidad pública o privada, así mismo, no tengo otra responsabilidad remunerada en alguna institución pública o privada más de diez (10 horas) semanales, excepto ley expresa que lo permita.', condicion: 'CONTRATADO', regimen: 'TC' },
              { key: 'opcion6', num: '6', texto: 'Soy docente, contratado a Tiempo Parcial y NO TENGO incompatibilidad horaria con mi carga académica en la Universidad Nacional de Trujillo y otra institución donde laboro.', condicion: 'CONTRATADO', regimen: 'TP' },
            ].map((opcion) => {
              const isSelected = declaracionJuradaOpcion === opcion.key;

              const handleClickOpcion = () => {
                if (opcion.key === 'opcion4') {
                  // Opción 4: sin confirmación, directo
                  setDeclaracionJuradaOpcion(opcion.key);
                } else if (declaracionJuradaOpcion && declaracionJuradaOpcion !== opcion.key) {
                  // Ya hay una seleccionada distinta → pedir confirmación
                  setConfirmCambioOpcion(opcion.key);
                } else {
                  setDeclaracionJuradaOpcion(opcion.key);
                }
              };

              return (
                <tr key={opcion.key} style={{ background: isSelected ? (darkMode ? '#1e3a5f' : '#eff6ff') : 'transparent' }}>
                  <td style={{ padding: '10px 12px', border: '1px solid var(--border-color)', width: '40px', textAlign: 'center', verticalAlign: 'top' }}>
                    <div
                      onClick={handleClickOpcion}
                      style={{
                        width: '22px', height: '22px', borderRadius: '4px', margin: '0 auto',
                        border: `2px solid ${isSelected ? '#3b82f6' : '#94a3b8'}`,
                        background: isSelected ? '#3b82f6' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      {isSelected && (
                        <svg width="13" height="13" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td
                    onClick={handleClickOpcion}
                    style={{ padding: '10px 12px', border: '1px solid var(--border-color)', fontSize: '12px', lineHeight: '1.7', color: isSelected ? (darkMode ? '#93c5fd' : '#1d4ed8') : 'var(--text-primary)', fontWeight: isSelected ? '500' : '400', cursor: 'pointer' }}
                  >
                    <strong>{opcion.num}.</strong> {opcion.texto}
                    {opcion.key === 'opcion4' && (
                      <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                        * Aplica solo si cuenta con Resolución Vicerrectoral de Docente Investigador
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Párrafo final de compromiso */}
    <div className="card" style={{ padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
      <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.7', color: 'var(--text-primary)' }}>
        EN CASO DE FALTAR A LA VERDAD ME SOMETO A LAS SANCIONES QUE SEAN APLICABLES DE ACUERDO A LEY; ASIMISMO, DE ENCONTRARME INCURSO EN SITUACIÓN DE INCOMPATIBILIDAD O IMPEDIMENTO PARA EJERCER LA DOCENCIA EN LA U.N.T., ME SOMETO A LAS SANCIONES PREVISTAS POR SU ESTATUTO,{' '}
        <strong><u>Y AUTORIZO AL FUNCIONARIO COMPETENTE DISPONGA EL DESCUENTO DE MI PLANILLA DE HABERES, DEL MONTO QUE LA UNIDAD DE REMUNERACIONES LIQUIDE COMO PAGOS INDEBIDOS POR EL LAPSO DE TIEMPO LABORADO ILEGALMENTE.</u></strong>
      </p>
    </div>

    {/* Botones */}
    {(canEditForm || isDocente) && (
      <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn-secondary" onClick={() => setStep(1)} style={{ padding: '10px 24px' }}>
          Atrás
        </button>
        <button className="btn-secondary" onClick={() => router.push('/carga-horaria')} style={{ padding: '10px 24px' }}>
          Cancelar
        </button>
<button
          className="btn-primary"
          onClick={() => {
            if (!declaracionJuradaOpcion) {
              setAlertType('error'); setAlertMessage('Debe seleccionar una opción de la Declaración Jurada');
              return;
            }
            setAdicionalData(prev => ({ ...prev, declaracion_jurada_opcion: declaracionJuradaOpcion }));
            setStep(3);
          }}
          style={{ padding: '10px 24px' }}
        >
          Continuar
        </button>
      </div>
    )}

    {/* Modal confirmación cambio de opción */}
    {confirmCambioOpcion && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: darkMode ? '#1e293b' : 'white',
          padding: '24px', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          maxWidth: '400px', width: '90%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px', backgroundColor: '#fef3c7',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#d97706', fontSize: '20px', fontWeight: 'bold'
            }}>
              ?
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: darkMode ? '#f1f5f9' : '#111827' }}>
              Cambiar selección
            </h3>
          </div>
          <p style={{ margin: 0, marginBottom: '20px', fontSize: '14px', color: darkMode ? '#94a3b8' : '#4b5563', lineHeight: '1.5' }}>
            ¿Está seguro que desea cambiar la opción seleccionada en la Declaración Jurada? Esta acción modificará el formato.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              style={{
                padding: '8px 16px', borderRadius: '6px',
                border: '1px solid #d1d5db',
                background: darkMode ? '#334155' : 'white',
                color: darkMode ? '#f1f5f9' : '#111827',
                cursor: 'pointer', fontSize: '14px'
              }}
              onClick={() => setConfirmCambioOpcion(null)}
            >
              Cancelar
            </button>
            <button
              style={{
                backgroundColor: '#3b82f6', color: 'white', padding: '8px 16px',
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: '500'
              }}
              onClick={() => {
                setDeclaracionJuradaOpcion(confirmCambioOpcion);
                setConfirmCambioOpcion(null);
              }}
            >
              Sí, cambiar
            </button>
          </div>
        </div>
      </div>
    )}

  </div>
)}
          {/* Form 3 */}
            {step === 3 && docenteSeleccionado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header */}
              <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: '800', textAlign: 'center', lineHeight: '1.4', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  DECLARACIÓN DE CARGA HORARIA LECTIVA ADICIONAL ASIGNADA EN FILIALES, POSGRADO, SEGUNDAS ESPECIALIDADES Y CENTROS DE PRODUCCIÓN Y EXTENSIÓN UNIVERSITARIA
                </h2>
              </div>

              {/* Section 1: Datos Generales */}
              <div className="card" style={{ padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  I. DATOS GENERALES DEL DOCENTE
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      FACULTAD
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.facultad}
                      onChange={e => setAdicionalData(prev => ({ ...prev, facultad: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      DEPARTAMENTO ACADÉMICO
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.dpto_academico}
                      onChange={e => setAdicionalData(prev => ({ ...prev, dpto_academico: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      APELLIDOS Y NOMBRES
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.nombre_docente}
                      onChange={e => setAdicionalData(prev => ({ ...prev, nombre_docente: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      CÓDIGO
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.codigo_docente}
                      onChange={e => setAdicionalData(prev => ({ ...prev, codigo_docente: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      D.N.I.
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.dni_docente}
                      onChange={e => setAdicionalData(prev => ({ ...prev, dni_docente: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      CONDICIÓN
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.condicion.toUpperCase()}
                      onChange={e => setAdicionalData(prev => ({ ...prev, condicion: e.target.value.toUpperCase() }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      CATEGORÍA
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.categoria.toUpperCase()}
                      onChange={e => setAdicionalData(prev => ({ ...prev, categoria: e.target.value.toUpperCase() }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      RÉGIMEN DE DEDICACIÓN
                    </label>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="regimen"
                          checked={adicionalData.regimen_dedicacion === 'DE'}
                          onChange={() => setAdicionalData(prev => ({ ...prev, regimen_dedicacion: 'DE' }))}
                        />
                        D.E.
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="regimen"
                          checked={adicionalData.regimen_dedicacion === 'TC'}
                          onChange={() => setAdicionalData(prev => ({ ...prev, regimen_dedicacion: 'TC' }))}
                        />
                        T.C.
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="regimen"
                          checked={adicionalData.regimen_dedicacion === 'TP'}
                          onChange={() => setAdicionalData(prev => ({ ...prev, regimen_dedicacion: 'TP' }))}
                        />
                        T.P. {getTPHours(modalidad) && `(${getTPHours(modalidad)})`}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Datos del Periodo */}
              <div className="card" style={{ padding: '16px', background: darkMode ? '#1e293b' : '#f8fafc' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  II. DATOS DEL PERÍODO ACADÉMICO
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      SEMESTRE ACADÉMICO
                    </label>
                    <input
                      className="form-input"
                      value={adicionalData.periodo_academico}
                      onChange={e => setAdicionalData(prev => ({ ...prev, periodo_academico: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      FECHA DE INICIO DEL PERÍODO
                    </label>
                    <input
                      className="form-input"
                      type="date"
                      value={adicionalData.fecha_inicio_periodo}
                      onChange={e => handlePeriodoInicioChange(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      FECHA DE TÉRMINO DEL PERÍODO
                    </label>
                    <input
                      className="form-input"
                      type="date"
                      value={adicionalData.fecha_termino_periodo}
                      onChange={e => handlePeriodoTerminoChange(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Tabla Cursos Adicionales */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    III. CARGA HORARIA LECTIVA ADICIONAL ASIGNADA
                  </h3>
                  <button
                    className="btn-primary"
                    onClick={handleAddAdicionalCurso}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    + Agregar
                  </button>
                </div>

                <div className="table-container" style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '11px', borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '25%' }}>CURSO / ASIGNATURA</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '20%' }}>DEPENDENCIA / FILIAL / POSGRADO</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '13%' }}>FECHA INICIO</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '13%' }}>FECHA TÉRMINO</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '17%' }}>HORARIO SEMANAL</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '8%' }}>TOTAL HORAS</th>
                        <th style={{ padding: '8px', border: '1px solid var(--border-color)', width: '4%' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {!adicionalData.cursos || adicionalData.cursos.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', border: '1px solid var(--border-color)' }}>
                            No se ha registrado carga lectiva adicional
                          </td>
                        </tr>
                      ) : (
                        adicionalData.cursos.map((c: AdicionalCurso) => (
                          <tr key={c.id}>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <input
                                className="form-input"
                                value={c.curso}
                                onChange={e => handleUpdateAdicionalCursoField(c.id, 'curso', e.target.value)}
                                placeholder="Nombre del curso"
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <input
                                className="form-input"
                                value={c.dependencia}
                                onChange={e => handleUpdateAdicionalCursoField(c.id, 'dependencia', e.target.value)}
                                placeholder="Ej. Filial Valle Jequetepeque / Posgrado"
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <input
                                className="form-input"
                                type="date"
                                value={c.fecha_inicio}
                                onChange={e => handleUpdateAdicionalCursoField(c.id, 'fecha_inicio', e.target.value)}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <input
                                className="form-input"
                                type="date"
                                value={c.fecha_termino}
                                onChange={e => handleUpdateAdicionalCursoField(c.id, 'fecha_termino', e.target.value)}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <input
                                className="form-input"
                                value={c.horario_semanal}
                                onChange={e => handleUpdateAdicionalCursoField(c.id, 'horario_semanal', e.target.value)}
                                placeholder="Ej. Sáb 8:00 - 12:00"
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)' }}>
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                value={c.total_horas}
                                onChange={e => handleUpdateAdicionalCursoField(c.id, 'total_horas', e.target.value)}
                                onWheel={(e) => e.preventDefault()}
                                style={{ width: '100%', padding: '4px 6px', fontSize: '11px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                              <button
                                className="btn-secondary btn-crud-deactivate"
                                style={{ padding: '4px 6px', fontSize: '10px' }}
                                onClick={() => handleRemoveAdicionalCurso(c.id)}
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

                {/* Sum of additional hours */}
                <div style={{ 
                  background: darkMode ? '#1e293b' : '#f1f5f9', 
                  padding: '12px 16px', 
                  borderRadius: '8px',
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '700' }}>TOTAL HORAS ADICIONALES SEMANALES:</span>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
                    {adicionalData.total_horas_adicional || '0'}
                  </span>
                </div>
              </div>

              {/* Buttons Inside Card */}
              {(canEditForm || isDocente) && (
                <div style={{ marginTop: '32px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button 
                    className="btn-secondary"
                    onClick={() => setStep(2)}
                    style={{ padding: '10px 24px' }}
                  >
                    Atrás
                  </button>
                  <button 
                    className="btn-secondary"
                    onClick={() => router.push('/carga-horaria')}
                    style={{ padding: '10px 24px' }}
                  >
                    Cancelar
                  </button>
                  {cargaHorariaId && (
                    <button
                      className="btn-secondary"
                      onClick={() => router.push(`/carga-horaria/horario-no-lectiva?docenteId=${docenteSeleccionado.id}&cicloAcademico=${cicloAcademicoSeleccionado}&cargaHorariaId=${cargaHorariaId}`)}
                      style={{ padding: '10px 24px', backgroundColor: '#e2e8f0', color: '#334155' }}
                    >
                      Programar Horario No Lectivo
                    </button>
                  )}
                  <button 
                    className="btn-primary"
                    onClick={handleGuardar}
                    disabled={guardando || (formatosGenerados && isDocente && !canWrite)}
                    style={{ padding: '10px 24px' }}
                  >
                    {guardando ? 'Guardando...' : (formatosGenerados && isDocente && !canWrite) ? 'Bloqueado' : 'Guardar y Programar Horario'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for adding courses */}
      {showAgregarCursoModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px', maxHeight: '85vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Seleccionar Curso</h2>
              <button onClick={() => setShowAgregarCursoModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-body">
              {/* Curricula Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Currícula
                </label>
                <select
                  className="form-input"
                  value={selectedCurricula}
                  onChange={(e) => setSelectedCurricula(e.target.value)}
                >
                  <option value="">Todas las currículas</option>
                  {curriculas.map(curricula => (
                    <option key={curricula.id} value={curricula.id}>
                      {curricula.nombre_carrera} - {curricula.año_curricula} - {curricula.modalidad_estudios} ({curricula.estado})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Search Input */}
              <div style={{ marginBottom: '16px' }}>
                <input
                  className="form-input"
                  placeholder="Buscar curso por nombre o código..."
                  value={cursoSearchQuery}
                  onChange={(e) => setCursoSearchQuery(e.target.value)}
                />
              </div>
              
              {/* Course List */}
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '16px' }}>
                {cursos.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No se encontraron cursos
                  </div>
                ) : (
                  cursos.map(curso => (
                    <div
                      key={curso.id}
                      onClick={() => handleSeleccionarCurso(curso)}
                      style={{
                        padding: '14px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        background: selectedCurso?.id === curso.id ? '#eff6ff' : 'transparent'
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {curso.codigo} - {curso.nombre}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Ciclo: {curso.ciclo_plan} | Escuela: {curso.escuela_nombre || curso.escuela?.nombre || 'N/A'}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {selectedCurso && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <div
                    onClick={() => setDetallesCursoAbierto(!detallesCursoAbierto)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '8px 0',
                      userSelect: 'none'
                    }}
                  >
                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Detalles del Curso</h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      transition: 'transform 0.2s ease',
                      transform: detallesCursoAbierto ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {detallesCursoAbierto && (
                    <div style={{ marginTop: '16px' }}>
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
                backgroundColor: alertType === 'success' ? '#dcfce7' : '#fee2e2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: alertType === 'success' ? '#16a34a' : '#dc2626',
                fontSize: '20px',
                fontWeight: 'bold'
              }}>
                {alertType === 'success' ? '✓' : '!'}
              </div>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827'
              }}>
                {alertType === 'success' ? 'Éxito' : 'Atención'}
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
      
      {/* Alert for duplicate course */}
      {showCursoDuplicadoAlert && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                  fontSize: '20px'
                }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                  Atención
                </h3>
              </div>
              <button onClick={() => setShowCursoDuplicadoAlert(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p style={{
              margin: 0,
              marginBottom: '20px',
              fontSize: '14px',
              color: '#4b5563',
              lineHeight: '1.5'
            }}>
              {mensajeCursoDuplicado}
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
                onClick={() => setShowCursoDuplicadoAlert(false)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botones de Guardar y Cancelar */}
{/* Botones de Guardar y Cancelar */}
      {step === 1 && docenteSeleccionado && (canEditForm || isDocente) && !campoBloqueado && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
          <button
            className="btn-secondary"
            onClick={() => router.push('/carga-horaria')}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleContinuar}
          >
            Continuar
          </button>
        </div>
      )}
    </div>
  );
}
