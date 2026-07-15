'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { useUser } from '@/app/(app)/layout';
import { BookOpen, Building2, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Clock3, Eye, EyeOff, Filter, MapPin, RotateCcw, X } from 'lucide-react';

const DIAS_LABEL: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb' };

const normalizeDia = (dia: string | null | undefined): string => {
  if (!dia) return '';
  const map: Record<string, string> = {
    lunes: 'lunes', lun: 'lunes',
    martes: 'martes', mar: 'martes',
    miercoles: 'miercoles', miércoles: 'miercoles', mie: 'miercoles',
    jueves: 'jueves', jue: 'jueves',
    viernes: 'viernes', vie: 'viernes',
    sabado: 'sabado', sábado: 'sabado', sab: 'sabado',
  };
  const key = dia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return map[key] || key;
};

const slotKeyFrom = (dia: string, hora: number) => `${normalizeDia(dia)}-${hora}`;

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
  modalidad?: string;
  es_escuela_configurada?: boolean;
}

interface DocenteSeleccionado extends Docente {
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
  _horarioSlots?: any[];
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
    consejeriaTutoria: { items: [{ id: 'consej-1', descripcion: 'Tutoría', horas: '1' }], horas: '1' },
    investigacion: { items: [{ id: 'invest-1', descripcion: '', horas: '5' }], horas: '5' },
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
  const [ambientes, setAmbientes] = useState<any[]>([]);
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

  // Modal de selección y leyenda de horario
  const [showModalHorarioSeleccion, setShowModalHorarioSeleccion] = useState(false);
  const [showHorarioPreview, setShowHorarioPreview] = useState(false);
  const [previewCelda, setPreviewCelda] = useState<{ dia: string; hora: number }>({ dia: 'lunes', hora: 7 });
  const [previewHorarios, setPreviewHorarios] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewAmbienteId, setPreviewAmbienteId] = useState<string>('');
  const [previewHoraInicio, setPreviewHoraInicio] = useState<string>('07:00');
  const [previewHoraFin, setPreviewHoraFin] = useState<string>('20:00');
  const [previewTipoAulas, setPreviewTipoAulas] = useState(true);
  const [previewTipoLabs, setPreviewTipoLabs] = useState(true);
  const [elementoSeleccionado, setElementoSeleccionado] = useState<any>(null);
  const [elementoFiltro, setElementoFiltro] = useState<any>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, any>>({});
  // Track hours used per element
  const [horasUsadas, setHorasUsadas] = useState<Record<string, number>>({});
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [autoGuardandoHorario, setAutoGuardandoHorario] = useState(false);
  const asignacionesRef = useRef<Record<string, any>>({});
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guardandoHorarioRef = useRef(false);

  useEffect(() => {
    asignacionesRef.current = asignaciones;
  }, [asignaciones]);
  // Modal de horario no lectivo (antiguo)
  const [showModalHorario, setShowModalHorario] = useState(false);
  const [nlSection, setNlSection] = useState('preparacion');
  const [nlSlots, setNlSlots] = useState<Record<string, Set<string>>>({});
  const [nlBlocked, setNlBlocked] = useState<Set<string>>(new Set());
  const [nlSaving, setNlSaving] = useState(false);
  const [nlMsg, setNlMsg] = useState<string | null>(null);
  const nlMouseDown = useRef(false);
  const SECCIONES_NL = [
    { key: 'preparacion', num: '2', title: 'Preparación y Evaluación', color: '#3b82f6' },
    { key: 'consejeria', num: '3', title: 'Consejería y Tutoría', color: '#10b981' },
    { key: 'investigacion', num: '4', title: 'Investigación', color: '#8b5cf6' },
    { key: 'capacitacion', num: '5', title: 'Capacitación', color: '#f59e0b' },
    { key: 'gobierno', num: '6', title: 'Gobierno', color: '#ef4444' },
    { key: 'administracion', num: '7', title: 'Administración', color: '#6366f1' },
    { key: 'asesoria', num: '8', title: 'Asesoría de Tesis', color: '#ec4899' },
    { key: 'rsu', num: '9', title: 'Responsabilidad Social', color: '#14b8a6' },
    { key: 'comites', num: '10', title: 'Comités Técnicos', color: '#84cc16' },
  ];
  const NL_SLOTS = Array.from({ length: 14 }, (_, i) => ({ id: `${String(7 + i).padStart(2, '0')}:00`, label: `${String(7 + i).padStart(2, '0')}:00 - ${String(8 + i).padStart(2, '0')}:00` }));
  const NL_DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const NL_DIAS_LABEL: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb' };
  const DIAS = NL_DIAS;
  const nlSlotKey = (d: string, h: string) => `${d}|${h}`;
  const SECCION_KEY_TO_NL: Record<string, string> = {
    preparacionEvaluacion: 'preparacion', consejeriaTutoria: 'consejeria', investigacion: 'investigacion',
    capacitacion: 'capacitacion', gobierno: 'gobierno', administracion: 'administracion',
    asesoriaTesis: 'asesoria', responsabilidadSocial: 'rsu', comitesTecnicos: 'comites',
  };
  const openNlModal = (secKey: string) => {
    setNlSection(SECCION_KEY_TO_NL[secKey] || 'preparacion');
    setShowModalHorario(true);
  };
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
        const [docentesRes, cursosRes, ciclosRes, aulasRes, curriculasRes] = await Promise.all([
          fetch('/api/docentes?limit=1000'),
          fetch('/api/cursos?reporte=true'),
          fetch('/api/ciclos?reporte=true'),
          fetch('/api/aulas?limit=1000'),
          fetch('/api/curriculas?manage=true')
        ]);
        const docentesData = await docentesRes.json();
        const cursosData = await cursosRes.json();
        const ciclosData = await ciclosRes.json();
        const aulasData = await aulasRes.json();
        const curriculasData = await curriculasRes.json();
        
        setDocentes(docentesData.data || []);
        setAllCursos(cursosData.data || []);
        setCursos(cursosData.data || []);
        setCiclosAcademicos(ciclosData.data || []);
        setAmbientes(aulasData.data || []);
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

  const cargarOcupacionAmbientes = useCallback(async () => {
    if (!cicloAcademicoSeleccionado) return;

    setPreviewLoading(true);
    try {
      const excludeParam = docenteSeleccionado?.id
        ? `&exclude_docente_id=${docenteSeleccionado.id}`
        : '';
      const [horariosRes, ocupacionRes] = await Promise.all([
        fetch(`/api/horarios?ciclo_id=${cicloAcademicoSeleccionado}`),
        fetch(`/api/carga-horaria/ocupacion-ambientes?ciclo_academico_id=${cicloAcademicoSeleccionado}${excludeParam}`),
      ]);
      
      // Check response status before parsing JSON
      if (!horariosRes.ok) {
        console.error('Horarios API error:', horariosRes.status, horariosRes.statusText);
        const text = await horariosRes.text();
        console.error('Horarios response:', text.substring(0, 200));
        throw new Error(`Horarios API failed: ${horariosRes.status}`);
      }
      if (!ocupacionRes.ok) {
        console.error('Ocupacion API error:', ocupacionRes.status, ocupacionRes.statusText);
        const text = await ocupacionRes.text();
        console.error('Ocupacion response:', text.substring(0, 200));
        throw new Error(`Ocupacion API failed: ${ocupacionRes.status}`);
      }
      
      const horariosData = await horariosRes.json();
      const ocupacionData = await ocupacionRes.json();
      setPreviewHorarios([
        ...(Array.isArray(horariosData.data) ? horariosData.data : []),
        ...(Array.isArray(ocupacionData.data) ? ocupacionData.data : []),
      ]);
    } catch (error) {
      console.error('Error cargando disponibilidad del horario:', error);
      setPreviewHorarios([]);
    } finally {
      setPreviewLoading(false);
    }
  }, [cicloAcademicoSeleccionado, docenteSeleccionado?.id]);

  useEffect(() => {
    if ((!showHorarioPreview && !showModalHorarioSeleccion) || !cicloAcademicoSeleccionado) return;
    void cargarOcupacionAmbientes();
  }, [showHorarioPreview, showModalHorarioSeleccion, cicloAcademicoSeleccionado, cargarOcupacionAmbientes]);
  
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
    setModalidad(docente.modalidad || '');
    
    // First set default values from docente
    let newFacultad = docente.facultad || '';
    let newDptoAcademico = docente.dpto_academico || '';
    let newModalidad = docente.modalidad || '';
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
            
          newFacultad = docente.facultad || combinedCh.facultad || '';
          newDptoAcademico = docente.dpto_academico || combinedCh.dpto_academico || '';
          newModalidad = docente.modalidad || combinedCh.modalidad || '';
          
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
              curriculaNombre: curso.curricula_nombre || undefined,
              dia: curso.dia,
              hora_inicio: curso.hora_inicio,
              hora_fin: curso.hora_fin,
              horario_slots: curso.horario_slots,
              _horarioSlots: curso.horario_slots // Also set _horarioSlots for consistency
            };
          });
          newCursosAsignados = convertedCursos;
          
          // Helper to parse sections that come as arrays or objects with _horarioSlots
          const parseSeccion = (data: any, descField: string, defaultHoras = '0', defaultDesc = '') => {
            if (!data) {
              return { items: [{ id: `item-${Date.now()}-0`, descripcion: defaultDesc, horas: defaultHoras }], horas: defaultHoras };
            }
            // If data is an object with _horarioSlots (from new backend format)
            if (!Array.isArray(data)) {
              return {
                ...data,
                items: data.items || [{ id: `item-${Date.now()}-0`, descripcion: data[descField] || defaultDesc, horas: String(data.horas || defaultHoras) }],
                horas: data.horas || String(data.items?.reduce((sum: number, item: any) => sum + parseInt(item.horas || 0), 0) || defaultHoras)
              };
            }
            // If data is an array (legacy format)
            const totalHoras = data.reduce((sum: number, item: any) => sum + (item.horas || 0), 0);
            const items = data.map((item: any, index: number) => ({
              id: `item-${Date.now()}-${index}`,
              descripcion: item[descField] || '',
              horas: String(item.horas || 0),
              dia: item.dia || '',
              hora_inicio: item.hora_inicio || '',
              hora_fin: item.hora_fin || ''
            }));
            return { 
              items, 
              horas: String(totalHoras),
              _horarioSlots: data[0]?.horario_slots // Get _horarioSlots from first item's horario_slots
            };
          };

          // Convert secciones — preserve initial defaults when API data is empty
          newSecciones = {
            preparacionEvaluacion: parseSeccion(combinedCh.preparacion, 'descripcion', initialSecciones.preparacionEvaluacion.horas, ''),
            consejeriaTutoria: parseSeccion(combinedCh.consejeria, 'detalles', initialSecciones.consejeriaTutoria.horas, initialSecciones.consejeriaTutoria.items[0]?.descripcion || ''),
            investigacion: parseSeccion(combinedCh.investigacion, 'proyecto', initialSecciones.investigacion.horas, ''),
            capacitacion: parseSeccion(combinedCh.capacitacion, 'detalles', initialSecciones.capacitacion.horas, ''),
            gobierno: parseSeccion(combinedCh.gobierno, 'detalles', initialSecciones.gobierno.horas, ''),
            administracion: parseSeccion(combinedCh.administracion, 'detalles', initialSecciones.administracion.horas, ''),
            asesoriaTesis: parseSeccion(combinedCh.asesoria, 'detalles', initialSecciones.asesoriaTesis.horas, ''),
            responsabilidadSocial: parseSeccion(combinedCh.rsu, 'plan', initialSecciones.responsabilidadSocial.horas, ''),
            comitesTecnicos: parseSeccion(combinedCh.comites, 'detalles', initialSecciones.comitesTecnicos.horas, '')
          };
        }
      } catch (e) {
        console.error('Error loading carga horaria from server:', e);
      }
    }
    
    // Set default investigacion hours based on modalidad (TP=4, TC/DE=5)
    const reg = mapModalidad(newModalidad);
    if (reg === 'TP') {
      const investDefault = { id: 'invest-1', descripcion: '', horas: '4' };
      newSecciones.investigacion = { items: [investDefault], horas: '4' };
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

    const prepHoras = parseFloat(secciones.preparacionEvaluacion.horas || '0');
    const consejHoras = parseFloat(secciones.consejeriaTutoria.horas || '0');
    const investHoras = parseFloat(secciones.investigacion.horas || '0');
    const capacHoras = parseFloat(secciones.capacitacion.horas || '0');
    const regimen = mapModalidad(modalidad);
    const investMin = regimen === 'TC' ? 5 : 4;

    if (prepHoras > totalTrabajoLectivo * 0.5) {
      setAlertType('error'); setAlertMessage(`Preparación y Evaluación (${prepHoras}h) excede el 50% del Trabajo Lectivo (${(totalTrabajoLectivo * 0.5).toFixed(1)}h)`);
      return;
    }
    if (consejHoras < 1) {
      setAlertType('error'); setAlertMessage('Consejería y Tutoría debe tener al menos 1 hora semanal');
      return;
    }
    if (investHoras < investMin) {
      setAlertType('error'); setAlertMessage(`Investigación debe tener al menos ${investMin} horas semanales según modalidad (${modalidad.replace(/(\d+)\s*H/, '$1 Hr')})`);
      return;
    }
    if (capacHoras > 5) {
      setAlertType('error'); setAlertMessage(`Capacitación (${capacHoras}h) excede el máximo de 5 horas semanales`);
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

  const handleGuardar = async (goToMainPage = false) => {
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

    const prepHoras = parseFloat(secciones.preparacionEvaluacion.horas || '0');
    const consejHoras = parseFloat(secciones.consejeriaTutoria.horas || '0');
    const investHoras = parseFloat(secciones.investigacion.horas || '0');
    const capacHoras = parseFloat(secciones.capacitacion.horas || '0');
    const regimen = mapModalidad(modalidad);
    const investMin = regimen === 'TC' ? 5 : 4;

    if (prepHoras > totalTrabajoLectivo * 0.5) {
      setAlertType('error'); setAlertMessage(`Preparación y Evaluación (${prepHoras}h) excede el 50% del Trabajo Lectivo (${(totalTrabajoLectivo * 0.5).toFixed(1)}h)`);
      return;
    }
    if (consejHoras < 1) {
      setAlertType('error'); setAlertMessage('Consejería y Tutoría debe tener al menos 1 hora semanal');
      return;
    }
    if (investHoras < investMin) {
      setAlertType('error'); setAlertMessage(`Investigación debe tener al menos ${investMin} horas semanales según modalidad (${modalidad.replace(/(\d+)\s*H/, '$1 Hr')})`);
      return;
    }
    if (capacHoras > 5) {
      setAlertType('error'); setAlertMessage(`Capacitación (${capacHoras}h) excede el máximo de 5 horas semanales`);
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
    
    // Compute ciclo_plan from courses (minimum ciclo, or 0 if no courses)
    const computedCicloPlan = validCursos.length > 0
      ? Math.min(...validCursos.map(c => parseInt(c.curso) || 1))
      : 0;
    const bodyToSend = {
          docente_id: docenteSeleccionado.id,
          ciclo_academico_id: cicloAcademicoSeleccionado,
          ciclo_plan: computedCicloPlan,
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
      const chId = resData?.data?.[0]?.id || cargaHorariaId;
      setCargaHorariaId(chId);
      await new Promise(r => setTimeout(r, 500));
      if (goToMainPage) {
        router.push('/carga-horaria');
      } else if (docenteSeleccionado.es_escuela_configurada === false) {
        router.push('/carga-horaria');
      } else {
        router.push(`/carga-horaria/horario-no-lectiva?docenteId=${docenteSeleccionado.id}&cicloAcademico=${cicloAcademicoSeleccionado}&cargaHorariaId=${chId}`);
      }
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
      let curriculaCourseIds: any[] = [];
      
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
    // First find the course before filtering
    const curso = cursosAsignados.find(c => c.id === id);
    
    // Remove from cursosAsignados
    setCursosAsignados(cursosAsignados.filter(c => c.id !== id));
    
    // Also remove any slots assigned to this course from the modal state
    if (curso) {
      // Check for all possible course types
      const possibleKeys = [
        `curso-${id}-teoria`,
        `curso-${id}-practica`,
        `curso-${id}-laboratorio`,
        `curso-${id}-default`
      ];
      
      setAsignaciones(prev => {
        const newAsignaciones = { ...prev };
        for (const [key, element] of Object.entries(newAsignaciones)) {
          if (element.tipo === 'curso' && element.id === id) {
            delete newAsignaciones[key];
          }
        }
        return newAsignaciones;
      });
      
      setHorasUsadas(prev => {
        const newHorasUsadas = { ...prev };
        for (const key of possibleKeys) {
          delete newHorasUsadas[key];
        }
        return newHorasUsadas;
      });
    }
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

  const getSeccionLimits = (key: keyof Secciones, regimen: string, trabajoLectivo: number): { min: number; max: number } => {
    switch (key) {
      case 'preparacionEvaluacion': return { min: 0, max: Math.max(0, trabajoLectivo * 0.5) };
      case 'consejeriaTutoria': return { min: 1, max: 99 };
      case 'investigacion': return { min: regimen === 'TC' ? 5 : 4, max: 99 };
      case 'capacitacion': return { min: 0, max: 5 };
      default: return { min: 0, max: 99 };
    }
  };

  const seccionLimits = (key: keyof Secciones) => getSeccionLimits(key, mapModalidad(modalidad), totalTrabajoLectivo);

  // Modal horario no lectivo — build nlSlots from current secciones state + server data
  useEffect(() => {
    if (!showModalHorario || !docenteSeleccionado?.id || !cicloAcademicoSeleccionado) return;
    const secToNl: Record<keyof Secciones, string> = {
      preparacionEvaluacion: 'preparacion', consejeriaTutoria: 'consejeria', investigacion: 'investigacion',
      capacitacion: 'capacitacion', gobierno: 'gobierno', administracion: 'administracion',
      asesoriaTesis: 'asesoria', responsabilidadSocial: 'rsu', comitesTecnicos: 'comites',
    };
    // 1. Reconstruct from current secciones state (in-memory)
    const loaded: Record<string, Set<string>> = {};
    SECCIONES_NL.forEach(s => loaded[s.key] = new Set<string>());
    (Object.entries(secToNl) as [keyof Secciones, string][]).forEach(([secKey, nlKey]) => {
      (secciones[secKey]?.items || []).forEach((item: any) => {
        if (item.dia && item.hora_inicio) {
          const startH = parseInt(item.hora_inicio.split(':')[0]);
          const endH = item.hora_fin ? parseInt(item.hora_fin.split(':')[0]) : startH + 1;
          for (let h = startH; h < endH; h++) loaded[nlKey].add(nlSlotKey(item.dia, `${String(h).padStart(2, '0')}:00`));
        }
      });
    });
    // 2. Blocked slots from server (lectiva only)
    fetch(`/api/docentes/${docenteSeleccionado.id}/horario?ciclo_id=${cicloAcademicoSeleccionado}`)
      .then(r => r.json()).catch(() => ({})).then((hData: any) => {
        const blocked = new Set<string>();
        (hData?.data || []).filter((a: any) => a.tipo !== 'no_lectiva').forEach((a: any) => {
          if (a.dia && a.hora_inicio) blocked.add(nlSlotKey(a.dia, a.hora_inicio.slice(0, 5)));
        });
        setNlBlocked(blocked);
      });
    setNlSlots(loaded);
    setNlMsg(null);
  }, [showModalHorario]);

  // Reset drag flag on mouseup anywhere
  useEffect(() => {
    const up = () => { nlMouseDown.current = false; };
    document.addEventListener('mouseup', up);
    return () => document.removeEventListener('mouseup', up);
  }, []);

  const nlIsBlocked = (dia: string, h: string) => {
    const key = nlSlotKey(dia, h);
    if (nlBlocked.has(key)) return true;
    // Verificar si la hora está ocupada por otra sección
    for (const s of SECCIONES_NL) {
      if (s.key !== nlSection && nlSlots[s.key]?.has(key)) {
        return true;
      }
    }
    return false;
  };

  const nlToggle = (dia: string, h: string) => {
    const key = nlSlotKey(dia, h);
    // Verificar si la hora está ocupada por otra sección
    let ocupadaPor = null;
    for (const s of SECCIONES_NL) {
      if (s.key !== nlSection && nlSlots[s.key]?.has(key)) {
        ocupadaPor = s;
        break;
      }
    }
    if (ocupadaPor) {
      setNlMsg(`Horario ya ocupado por "${ocupadaPor.title}". Por favor elige otro horario.`);
      return;
    }
    if (nlBlocked.has(key)) return;
    
    setNlSlots(prev => {
      const next = { ...prev };
      const cur = next[nlSection] || new Set<string>();
      if (cur.has(key)) { 
        const s = new Set(cur); 
        s.delete(key); 
        next[nlSection] = s; 
      } else {
        const sz = cur.size;
        const seccionKeyMap: Record<string, keyof Secciones> = { preparacion: 'preparacionEvaluacion', consejeria: 'consejeriaTutoria', investigacion: 'investigacion', capacitacion: 'capacitacion', gobierno: 'gobierno', administracion: 'administracion', asesoria: 'asesoriaTesis', rsu: 'responsabilidadSocial', comites: 'comitesTecnicos' };
        const secKey = seccionKeyMap[nlSection];
        const limit = parseInt(secciones[secKey]?.horas || '0');
        if (sz < limit) { 
          const s = new Set(cur); 
          s.add(key); 
          next[nlSection] = s; 
        } else {
          setNlMsg(`Límite de ${limit}h alcanzado`);
        }
      }
      return next;
    });
  };

  const nlGuardar = (section: string) => {
    try {
      const seccionKeyMap: Record<string, keyof Secciones> = { preparacion: 'preparacionEvaluacion', consejeria: 'consejeriaTutoria', investigacion: 'investigacion', capacitacion: 'capacitacion', gobierno: 'gobierno', administracion: 'administracion', asesoria: 'asesoriaTesis', rsu: 'responsabilidadSocial', comites: 'comitesTecnicos' };
      const secKey = seccionKeyMap[section];
      if (!secKey) return;
      const selectedSlots = nlSlots[section] || new Set();
      const byDay: Record<string, number[]> = {};
      selectedSlots.forEach(slotKey => {
        const [dia, hora] = slotKey.split('|');
        const hInt = parseInt(hora.split(':')[0]);
        if (!byDay[dia]) byDay[dia] = [];
        byDay[dia].push(hInt);
      });
      const items: { id: string; descripcion: string; horas: string; dia: string; hora_inicio: string; hora_fin: string }[] = [];
      let idx = 0;
      Object.entries(byDay).forEach(([dia, hours]) => {
        hours.sort((a, b) => a - b);
        let start = hours[0], prev = hours[0];
        for (let i = 1; i <= hours.length; i++) {
          if (i < hours.length && hours[i] === prev + 1) { prev = hours[i]; continue; }
          items.push({
            id: `nl-${Date.now()}-${idx++}`,
            descripcion: secciones[secKey]?.items[0]?.descripcion || '',
            horas: String(prev - start + 1),
            dia,
            hora_inicio: `${String(start).padStart(2, '0')}:00`,
            hora_fin: `${String(prev + 1).padStart(2, '0')}:00`
          });
          if (i < hours.length) { start = hours[i]; prev = hours[i]; }
        }
      });
      const totalHoras = String(items.reduce((s, it) => s + parseInt(it.horas || '0'), 0));
      setSecciones(prev => ({ ...prev, [secKey]: { items, horas: totalHoras } }));
      setShowModalHorario(false);
      setNlMsg(null);
    } catch (e) {
      console.error('nlGuardar error:', e);
    }
  };

  const handleUpdateItemHoras = (seccionKey: keyof Secciones, itemId: string, value: string) => {
    // Permitir que el campo esté vacío mientras el usuario escribe
    // Filtrar solo dígitos
    let filteredValue = value.replace(/[^0-9]/g, '');
    // Eliminar ceros a la izquierda, pero si es solo cero, dejarlo
    if (filteredValue.length > 0) {
      filteredValue = String(parseInt(filteredValue, 10));
    }
    
    setSecciones(prev => {
      const updatedItems = prev[seccionKey].items.map(item => 
        item.id === itemId ? { ...item, horas: filteredValue } : item
      );
      // Calcular total solo con valores numéricos válidos
      const newTotalHoras = updatedItems.reduce((sum, item) => {
        const horasNum = parseInt(item.horas || '0');
        return sum + (isNaN(horasNum) ? 0 : horasNum);
      }, 0);
      return {
        ...prev,
        [seccionKey]: {
          items: updatedItems,
          horas: String(newTotalHoras)
        }
      };
    });
  };

  // Nueva función para validar cuando el usuario termine de editar
  const handleBlurItemHoras = (seccionKey: keyof Secciones, itemId: string, value: string) => {
    // Asegurarse de que solo sea un entero
    let processedValue = value;
    const numValue = parseInt(value);
    const limits = seccionLimits(seccionKey);
    
    if (value === '' || isNaN(numValue) || numValue < 0) {
      processedValue = '0';
    } else if (numValue > limits.max) {
      processedValue = String(limits.max);
    } else if (numValue >= 0 && numValue < limits.min) {
      processedValue = String(limits.min);
    } else {
      processedValue = String(numValue);
    }
    
    setSecciones(prev => {
      const updatedItems = prev[seccionKey].items.map(item => 
        item.id === itemId ? { ...item, horas: processedValue } : item
      );
      const newTotalHoras = updatedItems.reduce((sum, item) => {
        const horasNum = parseInt(item.horas || '0');
        return sum + (isNaN(horasNum) ? 0 : horasNum);
      }, 0);
      return {
        ...prev,
        [seccionKey]: {
          items: updatedItems,
          horas: String(newTotalHoras)
        }
      };
    });
  };

  // Helper function to get total hours for an element
  const getTotalHoursForElement = (element: any) => {
    if (element.tipo === 'curso') {
      // Get total hours for specific course type
      switch (element.cursoType) {
        case 'teoria': {
          const tHoras = parseInt(element.teoriaHoras) || 0;
          const tGrupos = parseInt(element.teoriaGrupos) || 1;
          return tHoras * tGrupos;
        }
        case 'practica': {
          const pHoras = parseInt(element.practicaHoras) || 0;
          const pGrupos = parseInt(element.practicaGrupos) || 1;
          return pHoras * pGrupos;
        }
        case 'laboratorio': {
          const lHoras = parseInt(element.laboratorioHoras) || 0;
          const lGrupos = parseInt(element.laboratorioGrupos) || 1;
          return lHoras * lGrupos;
        }
        default: {
          // Fallback for old course elements without type
          const tHoras = parseInt(element.teoriaHoras) || 0;
          const tGrupos = parseInt(element.teoriaGrupos) || 1;
          const pHoras = parseInt(element.practicaHoras) || 0;
          const pGrupos = parseInt(element.practicaGrupos) || 1;
          const lHoras = parseInt(element.laboratorioHoras) || 0;
          const lGrupos = parseInt(element.laboratorioGrupos) || 1;
          return (tHoras * tGrupos) + (pHoras * pGrupos) + (lHoras * lGrupos);
        }
      }
    } else {
      const keyMap: Record<string, keyof Secciones> = {
        preparacion: 'preparacionEvaluacion',
        consejeria: 'consejeriaTutoria',
        investigacion: 'investigacion',
        capacitacion: 'capacitacion',
        gobierno: 'gobierno',
        administracion: 'administracion',
        asesoria: 'asesoriaTesis',
        responsabilidad: 'responsabilidadSocial',
        comites: 'comitesTecnicos'
      };
      const seccionKey = keyMap[element.key];
      if (!seccionKey) return 0;
      return secciones[seccionKey].items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0);
    }
  };

  // Helper function to get element key
  const getElementKey = (element: any) => {
    if (element.tipo === 'curso') {
      return `curso-${element.id}-${element.cursoType || 'default'}`;
    } else {
      return `nol-${element.key}`;
    }
  };

  const ambientesDisponibles = useMemo(() => {
    return (ambientes || [])
      .filter((amb: any) => amb?.activo !== false)
      .sort((a: any, b: any) => String(a.codigo || '').localeCompare(String(b.codigo || '')));
  }, [ambientes]);

  const previewAmbienteSeleccionado = useMemo(() => {
    return ambientesDisponibles.find((amb: any) => amb.id === previewAmbienteId) || null;
  }, [ambientesDisponibles, previewAmbienteId]);

  const previewOcupacion = useMemo(() => {
    const map = new Map<string, any[]>();

    const pushOcupacion = (diaRaw: string, hora: number, item: any) => {
      const dia = normalizeDia(diaRaw);
      if (!dia || Number.isNaN(hora)) return;
      const key = slotKeyFrom(dia, hora);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    };

    for (const asignacion of previewHorarios) {
      const dia = asignacion?.dia;
      const hora = parseInt(String(asignacion?.hora_inicio || '').split(':')[0], 10);
      const ambienteId = asignacion?.ambiente_id;
      if (!dia || Number.isNaN(hora) || !ambienteId) continue;

      pushOcupacion(dia, hora, {
        ...asignacion,
        dia: normalizeDia(dia),
        ambiente_id: ambienteId,
      });
    }

    for (const [key, asignacion] of Object.entries(asignaciones)) {
      if (!asignacion?.ambienteId) continue;
      const [diaRaw, horaStr] = key.split('-');
      const hora = parseInt(horaStr, 10);
      if (!diaRaw || Number.isNaN(hora)) continue;

      pushOcupacion(diaRaw, hora, {
        dia: normalizeDia(diaRaw),
        hora_inicio: `${String(hora).padStart(2, '0')}:00`,
        ambiente_id: asignacion.ambienteId,
        ambiente_codigo: asignacion.ambienteCodigo,
        ambiente_nombre: asignacion.ambienteNombre,
        docente_nombre: docenteSeleccionado
          ? `${docenteSeleccionado.apellidos}, ${docenteSeleccionado.nombre}`
          : 'Asignación actual',
        curso_codigo: asignacion.codigo,
        curso_nombre: asignacion.nombre || asignacion.titulo,
        local: true,
      });
    }

    return map;
  }, [previewHorarios, asignaciones, docenteSeleccionado]);

  const getOcupacionEnCelda = useCallback((dia: string, hora: number) => {
    return previewOcupacion.get(slotKeyFrom(dia, hora)) || [];
  }, [previewOcupacion]);

  const ambienteEstaOcupado = useCallback((
    dia: string,
    hora: number,
    ambienteId: string,
    ignoreCellKey?: string
  ) => {
    const key = slotKeyFrom(dia, hora);
    return getOcupacionEnCelda(dia, hora).some((item: any) => {
      if (item.ambiente_id !== ambienteId) return false;
      if (ignoreCellKey && key === ignoreCellKey && item.local) return false;
      return true;
    });
  }, [getOcupacionEnCelda]);

  const getAmbientesLibresEnCelda = useCallback((
    dia: string,
    hora: number,
    ignoreCellKey?: string,
    ambienteActualId?: string
  ) => {
    const ocupados = new Set(
      getOcupacionEnCelda(dia, hora)
        .filter((item: any) => {
          if (!ignoreCellKey) return true;
          const cellKey = slotKeyFrom(dia, hora);
          return !(item.local && cellKey === ignoreCellKey);
        })
        .map((item: any) => item.ambiente_id)
    );

    return ambientesDisponibles.filter((amb: any) => {
      if (amb.id === ambienteActualId) return true;
      return !ocupados.has(amb.id);
    });
  }, [getOcupacionEnCelda, ambientesDisponibles]);

  const previewAmbientesFiltrados = useMemo(() => {
    const key = slotKeyFrom(previewCelda.dia, previewCelda.hora);
    const ocupados = new Set((previewOcupacion.get(key) || []).map((item: any) => item.ambiente_id));
    const tiposSeleccionados = [previewTipoAulas ? 'aula' : null, previewTipoLabs ? 'laboratorio' : null].filter(Boolean) as string[];

    return ambientesDisponibles
      .filter((amb: any) => tiposSeleccionados.includes(String(amb.tipo || '').toLowerCase()))
      .filter((amb: any) => !ocupados.has(amb.id))
      .sort((a: any, b: any) => String(a.codigo || '').localeCompare(String(b.codigo || '')));
  }, [previewCelda, previewOcupacion, ambientesDisponibles, previewTipoAulas, previewTipoLabs]);

  const previewOcupacionSeleccionada = useMemo(() => {
    if (!previewAmbienteId) return null;
    const key = slotKeyFrom(previewCelda.dia, previewCelda.hora);
    return (previewOcupacion.get(key) || []).find((item: any) => item.ambiente_id === previewAmbienteId) || null;
  }, [previewAmbienteId, previewCelda, previewOcupacion]);

  const previewTotalDisponibles = useMemo(() => {
    return ambientesDisponibles.filter((amb: any) => ['aula', 'laboratorio'].includes(String(amb.tipo || '').toLowerCase())).length;
  }, [ambientesDisponibles]);

  const mapSlotConAmbiente = (slot: { dia: string; hora: number; type?: string; ambienteId?: string; ambienteCodigo?: string; ambienteNombre?: string }) => {
    const base: Record<string, unknown> = { dia: slot.dia, hora: slot.hora };
    if (slot.type) base.type = slot.type;
    if (slot.ambienteId) {
      base.ambienteId = slot.ambienteId;
      base.ambienteCodigo = slot.ambienteCodigo || '';
      base.ambienteNombre = slot.ambienteNombre || '';
    }
    return base;
  };

  const buildCargaHorariaPayload = (sourceAsignaciones: Record<string, any> = asignaciones) => {
    const totalTrabajoLectivoPayload = cursosAsignados.reduce((sum, curso) => {
      return sum + parseFloat(curso.totalHoras || '0');
    }, 0);
    const totalHorasPayload = totalTrabajoLectivoPayload + Object.values(secciones).reduce((sum, actividad) => {
      return sum + parseFloat(actividad.horas || '0');
    }, 0);

    // Group asignaciones by element
    const asignacionesPorElemento: Record<string, { element: any, slots: { dia: string, hora: number, ambienteId?: string, ambienteCodigo?: string, ambienteNombre?: string }[] }> = {};

    for (const [key, element] of Object.entries(sourceAsignaciones)) {
      const [diaRaw, horaStr] = key.split('-');
      const hora = parseInt(horaStr, 10);
      const dia = normalizeDia(diaRaw);
      const elementKey = getElementKey(element);
      if (!asignacionesPorElemento[elementKey]) {
        asignacionesPorElemento[elementKey] = { element, slots: [] };
      }
      asignacionesPorElemento[elementKey].slots.push({
        dia,
        hora,
        ambienteId: element?.ambienteId || '',
        ambienteCodigo: element?.ambienteCodigo || '',
        ambienteNombre: element?.ambienteNombre || ''
      });
    }

    const newSecciones = { ...secciones };
    const sectionMap: Record<string, keyof Secciones> = {
      'preparacion': 'preparacionEvaluacion',
      'consejeria': 'consejeriaTutoria',
      'investigacion': 'investigacion',
      'capacitacion': 'capacitacion',
      'gobierno': 'gobierno',
      'administracion': 'administracion',
      'asesoria': 'asesoriaTesis',
      'responsabilidad': 'responsabilidadSocial',
      'comites': 'comitesTecnicos'
    };

    for (const [elementKey, data] of Object.entries(asignacionesPorElemento)) {
      if (elementKey.startsWith('nol-')) {
        const sectionKey = sectionMap[data.element.key];
        if (sectionKey) {
          const existingSection = secciones[sectionKey];
          const totalHoras = String(existingSection?.horas || data.slots.length);
          const items = (existingSection?.items?.length ? existingSection.items : [{
            id: `item-${Date.now()}`,
            descripcion: data.element.titulo || '',
            horas: totalHoras,
          }]).map((item, index) => (index === 0 ? { ...item, horas: totalHoras } : item));

          const _horarioSlots = data.slots.map(slot => mapSlotConAmbiente(slot));

          newSecciones[sectionKey] = {
            items,
            horas: totalHoras,
            _horarioSlots
          };
        }
      }
    }

    const newCursos = cursosAsignados.map(curso => {
      const allCourseSlots: Array<{ dia: string, hora: number, type: string, ambienteId?: string, ambienteCodigo?: string, ambienteNombre?: string }> = [];
      const types = ['teoria', 'practica', 'laboratorio'];
      for (const type of types) {
        const elementKey = `curso-${curso.id}-${type}`;
        const courseTypeData = asignacionesPorElemento[elementKey];
        if (courseTypeData) {
          for (const slot of courseTypeData.slots) {
            allCourseSlots.push({ ...slot, type });
          }
        }
      }

      if (allCourseSlots.length > 0) {
        return {
          ...curso,
          _horarioSlots: allCourseSlots.map(slot => mapSlotConAmbiente(slot)),
          dia: allCourseSlots[0]?.dia,
          hora_inicio: allCourseSlots[0] ? `${allCourseSlots[0].hora}:00` : undefined,
          hora_fin: allCourseSlots[0] ? `${allCourseSlots[0].hora + 1}:00` : undefined
        };
      }

      // Preserve existing horario_slots from API data to prevent accidental overwrite
      if ((curso as any)._horarioSlots || (curso as any).horario_slots) {
        return curso;
      }

      return curso;
    });

    const validCursos = newCursos.filter((curso: any) => curso.curso_id || curso.id);
    const validAdicionalCursos = (adicionalData.cursos || []).filter(c => c.curso && c.curso.trim().length > 0);
    const updatedAdicionalData = {
      ...adicionalData,
      cursos: validAdicionalCursos,
      total_horas_adicional: String(validAdicionalCursos.reduce((sum, c) => sum + parseFloat(c.total_horas || '0'), 0))
    };
    const computedCicloPlan = validCursos.length > 0
      ? Math.min(...validCursos.map(c => parseInt(c.curso) || 1))
      : 0;

    return {
      docente_id: docenteSeleccionado?.id,
      ciclo_academico_id: cicloAcademicoSeleccionado,
      ciclo_plan: computedCicloPlan,
      modalidad,
      facultad,
      dpto_academico: dptoAcademico,
      cursos: validCursos,
      preparacion: newSecciones.preparacionEvaluacion,
      consejeria: newSecciones.consejeriaTutoria,
      investigacion: newSecciones.investigacion,
      capacitacion: newSecciones.capacitacion,
      gobierno: newSecciones.gobierno,
      administracion: newSecciones.administracion,
      asesoria: newSecciones.asesoriaTesis,
      rsu: newSecciones.responsabilidadSocial,
      comites: newSecciones.comitesTecnicos,
      total_horas: totalHorasPayload,
      adicional: updatedAdicionalData,
      nextSecciones: newSecciones,
      nextCursos: newCursos,
    };
  };

  const guardarCargaHoraria = async ({
    sourceAsignaciones = asignaciones,
    mostrarFeedback = true,
    redirigir = false,
  }: {
    sourceAsignaciones?: Record<string, any>;
    mostrarFeedback?: boolean;
    redirigir?: boolean;
  } = {}) => {
    const payload = buildCargaHorariaPayload(sourceAsignaciones);
    if (!payload.docente_id || !payload.ciclo_academico_id) return null;

    if (guardandoHorarioRef.current) {
      if (!mostrarFeedback) {
        asignacionesRef.current = sourceAsignaciones;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => {
          void guardarCargaHoraria({
            sourceAsignaciones: asignacionesRef.current,
            mostrarFeedback: false,
            redirigir: false,
          });
        }, 450);
      }
      return null;
    }

    guardandoHorarioRef.current = true;
    if (mostrarFeedback) setGuardando(true);
    else setAutoGuardandoHorario(true);
    try {
      const res = await fetch('/api/carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docente_id: payload.docente_id,
          ciclo_academico_id: payload.ciclo_academico_id,
          ciclo_plan: payload.ciclo_plan,
          modalidad: payload.modalidad,
          facultad: payload.facultad,
          dpto_academico: payload.dpto_academico,
          cursos: payload.cursos,
          preparacion: payload.preparacion,
          consejeria: payload.consejeria,
          investigacion: payload.investigacion,
          capacitacion: payload.capacitacion,
          gobierno: payload.gobierno,
          administracion: payload.administracion,
          asesoria: payload.asesoria,
          rsu: payload.rsu,
          comites: payload.comites,
          total_horas: payload.total_horas,
          adicional: payload.adicional
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Error from API:', data);
        if (mostrarFeedback) {
          setAlertType('error');
          setAlertMessage('Error guardando: ' + (data.error || 'Ocurrió un error'));
        }
        return null;
      }

      const resData = await res.json();
      const chId = resData?.data?.[0]?.id || cargaHorariaId;
      if (chId) setCargaHorariaId(chId);

      setSecciones(payload.nextSecciones);
      setCursosAsignados(payload.nextCursos);
      void cargarOcupacionAmbientes();

      if (mostrarFeedback) {
        setShowModalHorarioSeleccion(false);
        setAlertType('success');
        setAlertMessage('Horario guardado correctamente');
        setTimeout(() => setAlertMessage(null), 3000);
      }

      if (redirigir) {
        await new Promise(r => setTimeout(r, 500));
        if (docenteSeleccionado?.es_escuela_configurada === false) {
          router.push('/carga-horaria');
        } else if (docenteSeleccionado?.id) {
          router.push(`/carga-horaria/horario-no-lectiva?docenteId=${docenteSeleccionado.id}&cicloAcademico=${cicloAcademicoSeleccionado}&cargaHorariaId=${chId}`);
        }
      }

      return chId;
    } catch (e) {
      console.error('Error guardando:', e);
      if (mostrarFeedback) {
        setAlertType('error');
        setAlertMessage('Error guardando la carga horaria');
      }
      return null;
    } finally {
      guardandoHorarioRef.current = false;
      if (mostrarFeedback) setGuardando(false);
      else setAutoGuardandoHorario(false);
    }
  };

  const scheduleAutoGuardar = useCallback((sourceAsignaciones: Record<string, any>) => {
    asignacionesRef.current = sourceAsignaciones;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void guardarCargaHoraria({
        sourceAsignaciones: asignacionesRef.current,
        mostrarFeedback: false,
        redirigir: false,
      });
    }, 450);
  }, [cicloAcademicoSeleccionado, docenteSeleccionado, secciones, cursosAsignados, modalidad, facultad, dptoAcademico, adicionalData]);

  const handleGuardarHorario = () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    void guardarCargaHoraria({ sourceAsignaciones: asignacionesRef.current, mostrarFeedback: true, redirigir: false });
  };

  const handleAutoGuardarHorario = (sourceAsignaciones: Record<string, any>) => {
    scheduleAutoGuardar(sourceAsignaciones);
  };

  const handleAutoGuardarAmbiente = (sourceAsignaciones: Record<string, any>) => {
    scheduleAutoGuardar(sourceAsignaciones);
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
          {step === 1 && !isDocente && (
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
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                    {facultad || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', width: '160px' }}>
                    DPTO. ACADÉMICO:
                  </label>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                    {dptoAcademico || '—'}
                  </span>
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
                      <td style={{ textTransform: 'uppercase', padding: '12px', border: '1px solid var(--border-color)' }}>
                        {modalidad ? modalidad.replace(/(\d+)\s*H/, '$1 Hr') : 'No definido'}
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
                          <td style={{ padding: '6px 8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                            {curso.seccion ? (
                              <input
                                className="form-input"
                                value={curso.seccion}
                                onChange={(e) => handleUpdateCursoField(curso.id, 'seccion', e.target.value)}
                                disabled={lectivaBloqueada}
                                style={{ padding: '4px 6px', fontSize: '11px', width: '60px', textAlign: 'center' }}
                              />
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                            )}
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
              {/* {(esPropiaVistaDocente || canEditForm) && cursosAsignados.length > 0 && (
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
                              El o la docente NO ha registrado observaciones
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
              )}*/}
            </div>
          )}

          {/* SECCIONES 2 A 10 */}
          {step === 1 && docenteSeleccionado && (
            <div style={{ marginTop: '32px' }}>
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', width: '100%', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                  II. CARGA HORARIA NO LECTIVA (CHNL)
                </h3>
                {!campoBloqueado && (
                  <button 
                    className="btn-primary"
                    onClick={() => {
                      // Initialize asignaciones and horasUsadas from current secciones and cursos
                      const initialAsignaciones: Record<string, any> = {};
                      const initialHorasUsadas: Record<string, number> = {};
                      
                      // Map section key to element info
                      const sectionElementMap: Record<string, { key: string, tipo: string, titulo: string, color: string }> = {
                        preparacionEvaluacion: { key: 'preparacion', tipo: 'no-lectiva', titulo: '2. Preparación y Evaluación', color: '#3b82f6' },
                        consejeriaTutoria: { key: 'consejeria', tipo: 'no-lectiva', titulo: '3. Consejería y Tutoría', color: '#10b981' },
                        investigacion: { key: 'investigacion', tipo: 'no-lectiva', titulo: '4. Investigación', color: '#8b5cf6' },
                        capacitacion: { key: 'capacitacion', tipo: 'no-lectiva', titulo: '5. Capacitación', color: '#f59e0b' },
                        gobierno: { key: 'gobierno', tipo: 'no-lectiva', titulo: '6. Gobierno', color: '#ef4444' },
                        administracion: { key: 'administracion', tipo: 'no-lectiva', titulo: '7. Administración', color: '#6366f1' },
                        asesoriaTesis: { key: 'asesoria', tipo: 'no-lectiva', titulo: '8. Asesoría de Tesis', color: '#ec4899' },
                        responsabilidadSocial: { key: 'responsabilidad', tipo: 'no-lectiva', titulo: '9. Responsabilidad Social', color: '#14b8a6' },
                        comitesTecnicos: { key: 'comites', tipo: 'no-lectiva', titulo: '10. Comités Técnicos', color: '#84cc16' },
                      };
                      
                      // Process each section
                      for (const [secKey, secData] of Object.entries(secciones)) {
                        const elementInfo = sectionElementMap[secKey];
                        if (elementInfo) {
                          // First check for _horarioSlots array (better)
                          let horarioSlots = (secData as any)._horarioSlots;
                          if (typeof horarioSlots === 'string') {
                            try { horarioSlots = JSON.parse(horarioSlots); } catch { horarioSlots = null; }
                          }
                          if (horarioSlots && Array.isArray(horarioSlots)) {
                            for (const slot of horarioSlots) {
                              const key = slotKeyFrom(slot.dia, slot.hora);
                              const ambienteId = slot.ambiente_id || slot.ambienteId || '';
                              const ambienteCodigo = slot.ambiente_codigo || slot.ambienteCodigo || '';
                              const ambienteNombre = slot.ambiente_nombre || slot.ambienteNombre || '';
                              initialAsignaciones[key] = {
                                ...elementInfo,
                                ...(ambienteId ? { ambienteId, ambienteCodigo, ambienteNombre } : {}),
                              };
                              const elKey = getElementKey(elementInfo);
                              initialHorasUsadas[elKey] = (initialHorasUsadas[elKey] || 0) + 1;
                            }
                          }
                          // Fallback to items array
                          else if (secData.items) {
                            for (const item of secData.items) {
                              if (item.dia && item.hora_inicio) {
                                const hora = parseInt(item.hora_inicio.split(':')[0], 10);
                                const key = slotKeyFrom(item.dia, hora);
                                initialAsignaciones[key] = elementInfo;
                                const elKey = getElementKey(elementInfo);
                                initialHorasUsadas[elKey] = (initialHorasUsadas[elKey] || 0) + 1;
                              }
                            }
                          }
                        }
                      }
                      
                      // Process each curso
                      for (const curso of cursosAsignados) {
                        // Check if curso has horario_slots array
                        let horarioSlots = (curso as any).horario_slots || (curso as any)._horarioSlots;
                        if (typeof horarioSlots === 'string') {
                          try { horarioSlots = JSON.parse(horarioSlots); } catch { horarioSlots = null; }
                        }
                        if (horarioSlots && Array.isArray(horarioSlots)) {
                          for (const slot of horarioSlots) {
                            // Determine course type color
                            let color = '#2563eb';
                            let label = '';
                            switch (slot.type) {
                              case 'teoria':
                                color = '#1d4ed8';
                                label = 'Teoría';
                                break;
                              case 'practica':
                                color = '#16a34a';
                                label = 'Práctica';
                                break;
                              case 'laboratorio':
                                color = '#d97706';
                                label = 'Laboratorio';
                                break;
                            }
                            
                            const cursoElement = { 
                              ...curso, 
                              tipo: 'curso',
                              cursoType: slot.type,
                              nombre: `${curso.codigo} - ${curso.nombre} - ${label}`,
                              color 
                            };

                            const ambienteId = slot.ambiente_id || slot.ambienteId || '';
                            const ambienteCodigo = slot.ambiente_codigo || slot.ambienteCodigo || '';
                            const ambienteNombre = slot.ambiente_nombre || slot.ambienteNombre || '';
                            
                            const slotHora = typeof slot.hora === 'string' ? parseInt((slot.hora as string).split('-')[0].split(':')[0], 10) || 0 : slot.hora;
                            const key = slotKeyFrom(slot.dia, slotHora);
                            initialAsignaciones[key] = {
                              ...cursoElement,
                              ambienteId,
                              ambienteCodigo,
                              ambienteNombre
                            };
                            const elementKey = getElementKey(cursoElement);
                            initialHorasUsadas[elementKey] = (initialHorasUsadas[elementKey] || 0) + 1;
                          }
                        } 
                        // Fallback to single dia/hora_inicio if no horario_slots
                        else if ((curso as any).dia && (curso as any).hora_inicio) {
                          const cursoElement = { ...curso, tipo: 'curso', cursoType: 'teoria', nombre: `${curso.codigo} - ${curso.nombre} - Teoría`, color: '#1d4ed8' };
                          const hora = parseInt((curso as any).hora_inicio.split(':')[0], 10);
                          const key = slotKeyFrom((curso as any).dia, hora);
                          initialAsignaciones[key] = {
                            ...cursoElement,
                            ambienteId: (curso as any).ambiente_id || (curso as any).ambienteId || '',
                            ambienteCodigo: (curso as any).ambiente_codigo || (curso as any).ambienteCodigo || '',
                            ambienteNombre: (curso as any).ambiente_nombre || (curso as any).ambienteNombre || ''
                          };
                          const elementKey = getElementKey(cursoElement);
                          initialHorasUsadas[elementKey] = (initialHorasUsadas[elementKey] || 0) + 1;
                        }
                      }
                      
                      setAsignaciones(initialAsignaciones);
                      setHorasUsadas(initialHorasUsadas);
                      setElementoSeleccionado(null);
                      setWarningMessage(null);
                      
                      console.log('[DEBUG] asignaciones:', Object.keys(initialAsignaciones).length, 'keys:', Object.keys(initialAsignaciones));
                      console.log('[DEBUG] horasUsadas:', Object.keys(initialHorasUsadas).length, 'keys:', Object.keys(initialHorasUsadas));
                      setShowModalHorarioSeleccion(true);
                    }}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    🕐 Horario
                  </button>
                )}
                <div></div>
              </div>
              {/* 2. PREPARACIÓN Y EVALUACIÓN */}

              <div style={{ marginBottom: '24px' }}>
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    2. PREPARACIÓN Y EVALUACIÓN (Max 50% de Trabajo Lectivo)
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('preparacionEvaluacion')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.preparacionEvaluacion.items.length > 1 || secciones.preparacionEvaluacion.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('preparacionEvaluacion')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('preparacionEvaluacion', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('preparacionEvaluacion', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    3. CONSEJERÍA Y TUTORÍA (Como mínimo 01 hora semanal)
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('consejeriaTutoria')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.consejeriaTutoria.items.length > 1 || secciones.consejeriaTutoria.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('consejeriaTutoria')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('consejeriaTutoria', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('consejeriaTutoria', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    4. INVESTIGACIÓN (Como mínimo 04 y 05 horas semanales, según modalidad)
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('investigacion')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.investigacion.items.length > 1 || secciones.investigacion.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('investigacion')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('investigacion', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('investigacion', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    5. CAPACITACIÓN (Como máximo 05 semanales)
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('capacitacion')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.capacitacion.items.length > 1 || secciones.capacitacion.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('capacitacion')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('capacitacion', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('capacitacion', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    6. ACTIVIDADES DE GOBIERNO
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('gobierno')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.gobierno.items.length > 1 || secciones.gobierno.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('gobierno')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('gobierno', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('gobierno', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    7. ADMINISTRACIÓN
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('administracion')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.administracion.items.length > 1 || secciones.administracion.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('administracion')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('administracion', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('administracion', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    8. ASESORÍA DE TESIS
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('asesoriaTesis')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.asesoriaTesis.items.length > 1 || secciones.asesoriaTesis.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('asesoriaTesis')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('asesoriaTesis', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('asesoriaTesis', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    9. RESPONSABILIDAD SOCIAL UNIVERSITARIA
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('responsabilidadSocial')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.responsabilidadSocial.items.length > 1 || secciones.responsabilidadSocial.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('responsabilidadSocial')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('responsabilidadSocial', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('responsabilidadSocial', item.id, e.target.value)}
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
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: 'var(--text-secondary)' }}>
                    10. COMITÉS TÉCNICOS
                  </h3>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {/* {!campoBloqueado && (
                      <button onClick={() => openNlModal('comitesTecnicos')} style={{
                        background: 'none', border: '1px solid #3b82f6', borderRadius: '4px',
                        color: '#3b82f6', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Programar horario no lectivo">🕐 Horario</button>
                    )}*/}
                    {(secciones.comitesTecnicos.items.length > 1 || secciones.comitesTecnicos.items.some(i => i.dia)) && !campoBloqueado && (
                      <button onClick={() => handleResetSeccion('comitesTecnicos')} style={{
                        background: 'none', border: '1px solid #fca5a5', borderRadius: '4px',
                        color: '#dc2626', cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                        whiteSpace: 'nowrap'
                      }} title="Reiniciar sección">↺ Reset</button>
                    )}
                  </div>
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
                              type="text"
                              value={item.horas || ''}
                              onChange={(e) => handleUpdateItemHoras('comitesTecnicos', item.id, e.target.value)}
                              onBlur={(e) => handleBlurItemHoras('comitesTecnicos', item.id, e.target.value)}
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
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.facultad || '—'}</span>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>DEPARTAMENTO ACADÉMICO</label>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.dpto_academico || '—'}</span>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>APELLIDOS Y NOMBRES</label>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.nombre_docente || '—'}</span>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CONDICIÓN</label>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.condicion || '—'}</span>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CATEGORÍA</label>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.categoria || '—'}</span>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>RÉGIMEN DE DEDICACIÓN</label>
          <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>
            {adicionalData.regimen_dedicacion === 'DE' ? 'Dedicación Exclusiva' :
             adicionalData.regimen_dedicacion === 'TC' ? 'Tiempo Completo' :
             adicionalData.regimen_dedicacion === 'TP' ? `Tiempo Parcial${getTPHours(modalidad) ? ' ' + getTPHours(modalidad) : ''}` : '—'}
          </span>
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
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>FACULTAD</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.facultad || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>DEPARTAMENTO ACADÉMICO</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.dpto_academico || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>APELLIDOS Y NOMBRES</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.nombre_docente || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CÓDIGO</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.codigo_docente || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>D.N.I.</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.dni_docente || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CONDICIÓN</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.condicion || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CATEGORÍA</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>{adicionalData.categoria || '—'}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>RÉGIMEN DE DEDICACIÓN</label>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', padding: '6px 8px', background: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: '4px' }}>
                      {adicionalData.regimen_dedicacion === 'DE' ? 'D.E.' :
                       adicionalData.regimen_dedicacion === 'TC' ? 'T.C.' :
                       adicionalData.regimen_dedicacion === 'TP' ? `T.P.${getTPHours(modalidad) ? ' (' + getTPHours(modalidad) + ')' : ''}` : '—'}
                    </span>
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
                      disabled
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
                      disabled
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
                      disabled
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
                    className="btn-primary"
                    onClick={() => handleGuardar(true)}
                    disabled={guardando || (formatosGenerados && isDocente && !canWrite)}
                    style={{ padding: '10px 24px' }}
                  >
                    {guardando ? 'Guardando...' : (formatosGenerados && isDocente && !canWrite) ? 'Bloqueado' : 'Guardar'}
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



      {/* Modal de horario con grid y leyenda */}
      {showModalHorarioSeleccion && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '1400px', width: '98%', maxHeight: '95vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{gap:'12px',alignItems:'center',position:'relative'}}>
              <div style={{display:'flex',flexDirection:'column',gap:'4px',justifyContent:'center',flex:1}}>
                <h2 style={{fontSize:'18px',fontWeight:700,margin:0}}>Programar Horario</h2>
                <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>
                  Asigna bloques y define el ambiente por cada espacio
                  {autoGuardandoHorario && <span style={{marginLeft:'8px',color:'#2563eb',fontWeight:600}}>· Guardando...</span>}
                </span>
              </div>
              <div style={{position:'absolute',left:'50%',transform:'translateX(-50%)',display:'flex',alignItems:'center'}}>
                <button
                  onClick={() => {
                    setPreviewAmbienteId('');
                    setPreviewCelda({ dia: 'lunes', hora: 7 });
                    setShowHorarioPreview(true);
                  }}
                  style={{
                    display:'inline-flex',
                    alignItems:'center',
                    gap:'8px',
                    background:'linear-gradient(135deg, #eff6ff, #dbeafe)',
                    border:'1px solid #93c5fd',
                    padding:'8px 14px',
                    borderRadius:'999px',
                    fontSize:'13px',
                    cursor:'pointer',
                    color:'#1d4ed8',
                    fontWeight:'600'
                  }}
                >
                  <Eye size={16} />
                  Ver horario
                </button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',justifyContent:'flex-end',marginLeft:'auto',alignSelf:'center'}}>
                <button
                  onClick={() => {
                    setAsignaciones({});
                    setHorasUsadas({});
                    setElementoSeleccionado(null);
                    setElementoFiltro(null);
                    setWarningMessage(null);
                    setShowHorarioPreview(false);

                    const resetSecciones: Secciones = {
                      preparacionEvaluacion: { items: [], horas: '0' },
                      consejeriaTutoria: { items: [], horas: '0' },
                      investigacion: { items: [], horas: '0' },
                      capacitacion: { items: [], horas: '0' },
                      gobierno: { items: [], horas: '0' },
                      administracion: { items: [], horas: '0' },
                      asesoriaTesis: { items: [], horas: '0' },
                      responsabilidadSocial: { items: [], horas: '0' },
                      comitesTecnicos: { items: [], horas: '0' }
                    };
                    setSecciones(resetSecciones);

                    const resetCursos = cursosAsignados.map(curso => ({
                      ...curso,
                      dia: undefined,
                      hora_inicio: undefined,
                      hora_fin: undefined
                    }));
                    setCursosAsignados(resetCursos);
                  }}
                  style={{
                    background:'none',
                    border:'1px solid var(--border-color)',
                    padding:'6px 12px',
                    borderRadius:'6px',
                    fontSize:'13px',
                    cursor:'pointer',
                    color:'var(--text-secondary)',
                    fontWeight:'500',
                    display:'inline-flex',
                    alignItems:'center',
                    gap:'8px'
                  }}
                >
                  <CalendarDays size={15} />
                  Limpiar
                </button>
                <button onClick={() => { setShowHorarioPreview(false); setShowModalHorarioSeleccion(false); }} style={{background:'none',border:'none',fontSize:'24px',cursor:'pointer',color:'var(--text-secondary)',display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                  <X size={22} />
                </button>
              </div>
            </div>

            {warningMessage && (
              <div style={{ padding: '12px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                <p style={{ color: '#dc2626', margin: 0, fontSize: '14px', fontWeight: 500 }}>
                  ⚠️ {warningMessage}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '20px', padding: '20px', flex: 1, minHeight: '500px' }}>
              {/* Columna Izquierda: Leyenda/Opciones */}
              <div style={{ width: '300px', flexShrink: 0, overflowY: 'auto' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                  Elementos para Asignar
                </h3>

                {/* Cursos lectivos */}
                {cursosAsignados.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '500', margin: '0 0 8px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BookOpen size={14} />
                        Cursos Lectivos
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {cursosAsignados.map((curso) => {
                        const courseTypes = [];
                        // Teoría
                        const horasTeo = parseInt(curso.teoriaHoras) || 0;
                        const gruposTeo = parseInt(curso.teoriaGrupos) || 1;
                        const totalTeo = horasTeo * gruposTeo;
                        if (totalTeo > 0) {
                          courseTypes.push({
                            type: 'teoria',
                            label: 'Teoría',
                            color: '#1d4ed8',
                            totalHours: totalTeo
                          });
                        }
                        // Práctica
                        const horasPra = parseInt(curso.practicaHoras) || 0;
                        const gruposPra = parseInt(curso.practicaGrupos) || 1;
                        const totalPra = horasPra * gruposPra;
                        if (totalPra > 0) {
                          courseTypes.push({
                            type: 'practica',
                            label: 'Práctica',
                            color: '#16a34a',
                            totalHours: totalPra
                          });
                        }
                        // Laboratorio
                        const horasLab = parseInt(curso.laboratorioHoras) || 0;
                        const gruposLab = parseInt(curso.laboratorioGrupos) || 1;
                        const totalLab = horasLab * gruposLab;
                        if (totalLab > 0) {
                          courseTypes.push({
                            type: 'laboratorio',
                            label: 'Laboratorio',
                            color: '#d97706',
                            totalHours: totalLab
                          });
                        }

                        return (
                          <div key={curso.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {/* Course header */}
                            <div style={{ 
                              fontSize: '12px', 
                              fontWeight: '600', 
                              color: 'var(--text-secondary)', 
                              marginBottom: '2px',
                              marginLeft: '4px'
                            }}>
                              {curso.codigo} - {curso.nombre}{['EI-901', 'EI-X01'].includes(curso.codigo) ? ` (Sección ${curso.seccion})` : ''}
                            </div>
                            
                            {/* Course types */}
                            {courseTypes.map((courseType) => {
                              const cursoElement = { 
                                ...curso, 
                                tipo: 'curso',
                                cursoType: courseType.type, 
                                nombre: `${curso.codigo} - ${curso.nombre} - ${courseType.label}`,
                                color: courseType.color 
                              };
                              const elementKey = getElementKey(cursoElement);
                              const totalHours = courseType.totalHours;
                              const usedHours = horasUsadas[elementKey] || 0;
                              const isSelected = elementoSeleccionado && getElementKey(elementoSeleccionado) === elementKey;
                              
                              const isFiltered = elementoFiltro && getElementKey(elementoFiltro) === elementKey;
                              return (
                                <div
                                  key={`${curso.id}-${courseType.type}`}
                                  style={{
                                    padding: '8px 12px',
                                    borderTopWidth: '2px',
                                    borderRightWidth: '2px',
                                    borderBottomWidth: '2px',
                                    borderLeftWidth: '4px',
                                    borderStyle: 'solid',
                                    borderTopColor: isSelected ? courseType.color : 'var(--border-color)',
                                    borderRightColor: isSelected ? courseType.color : 'var(--border-color)',
                                    borderBottomColor: isSelected ? courseType.color : 'var(--border-color)',
                                    borderLeftColor: courseType.color,
                                    borderRadius: '6px',
                                    background: isSelected ? `${courseType.color}15` : 'var(--card-bg)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    marginLeft: '8px',
                                    position: 'relative'
                                  }}
                                  onClick={() => {
                                    if (isSelected) {
                                      setElementoSeleccionado(null);
                                    } else {
                                      setElementoSeleccionado(cursoElement);
                                    }
                                    setWarningMessage(null);
                                  }}
                                >
                                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                    <div style={{fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)'}}>
                                      {courseType.label}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setElementoFiltro(isFiltered ? null : cursoElement);
                                      }}
                                      style={{
                                        background: isFiltered ? `${courseType.color}30` : 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        color: isFiltered ? courseType.color : 'var(--text-muted)'
                                      }}
                                      title={isFiltered ? "Quitar filtro" : "Filtrar solo este elemento"}
                                    >
                                      {isFiltered ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {usedHours}/{totalHours} horas
                                  </div>
                                  <div style={{ marginTop: '4px', height: '4px', background: darkMode ? '#374151' : '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${(usedHours / totalHours) * 100}%`,
                                      height: '100%',
                                      background: courseType.color,
                                      borderRadius: '2px'
                                    }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actividades no lectivas con horas > 0 */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '500', margin: '0 0 8px 0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ClipboardList size={14} />
                    Actividades No Lectivas
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      {
                        key: 'preparacion',
                        titulo: '2. Preparación y Evaluación',
                        color: '#3b82f6',
                        horas: secciones.preparacionEvaluacion.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'consejeria',
                        titulo: '3. Consejería y Tutoría',
                        color: '#10b981',
                        horas: secciones.consejeriaTutoria.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'investigacion',
                        titulo: '4. Investigación',
                        color: '#8b5cf6',
                        horas: secciones.investigacion.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'capacitacion',
                        titulo: '5. Capacitación',
                        color: '#f59e0b',
                        horas: secciones.capacitacion.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'gobierno',
                        titulo: '6. Gobierno',
                        color: '#ef4444',
                        horas: secciones.gobierno.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'administracion',
                        titulo: '7. Administración',
                        color: '#6366f1',
                        horas: secciones.administracion.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'asesoria',
                        titulo: '8. Asesoría de Tesis',
                        color: '#ec4899',
                        horas: secciones.asesoriaTesis.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'responsabilidad',
                        titulo: '9. Responsabilidad Social',
                        color: '#14b8a6',
                        horas: secciones.responsabilidadSocial.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      },
                      {
                        key: 'comites',
                        titulo: '10. Comités Técnicos',
                        color: '#84cc16',
                        horas: secciones.comitesTecnicos.items.reduce((sum, i) => sum + (parseInt(i.horas || '0') || 0), 0)
                      }
                    ]
                    .filter(act => act.horas > 0)
                    .map((act) => {
                      const actElement = { key: act.key, tipo: 'no-lectiva', titulo: act.titulo, color: act.color };
                      const elementKey = getElementKey(actElement);
                      const usedHours = horasUsadas[elementKey] || 0;
                      const isSelected = elementoSeleccionado && getElementKey(elementoSeleccionado) === elementKey;
                      
                      const isFiltered = elementoFiltro && getElementKey(elementoFiltro) === elementKey;
                      return (
                        <div
                          key={act.key}
                          style={{
                            padding: '10px 12px',
                            borderWidth: '2px',
                            borderStyle: 'solid',
                            borderTopColor: isSelected ? act.color : 'var(--border-color)',
                            borderRightColor: isSelected ? act.color : 'var(--border-color)',
                            borderBottomColor: isSelected ? act.color : 'var(--border-color)',
                            borderRadius: '6px',
                            background: isSelected ? `${act.color}20` : 'var(--card-bg)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            borderLeftWidth: '4px',
                            borderLeftColor: act.color,
                            position: 'relative'
                          }}
                          onClick={() => {
                            // Toggle selection
                            if (isSelected) {
                              setElementoSeleccionado(null);
                            } else {
                              setElementoSeleccionado(actElement);
                            }
                            setWarningMessage(null);
                          }}
                        >
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                              {act.titulo}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setElementoFiltro(isFiltered ? null : actElement);
                              }}
                              style={{
                                background: isFiltered ? `${act.color}30` : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                color: isFiltered ? act.color : 'var(--text-muted)'
                              }}
                              title={isFiltered ? "Quitar filtro" : "Filtrar solo este elemento"}
                            >
                              {isFiltered ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {usedHours}/{act.horas} horas
                          </div>
                          <div style={{ marginTop: '4px', height: '4px', background: darkMode ? '#374151' : '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${(usedHours / act.horas) * 100}%`,
                              height: '100%',
                              background: act.color,
                              borderRadius: '2px'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Grid Horario Horas vs Días */}
              <div style={{ flex: 1, overflowX: 'auto' }}>
                <div style={{ display: 'inline-block', minWidth: '100%' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                        <th style={{ border: '1px solid var(--border-color)', padding: '8px', width: '80px' }}>Hora</th>
                        {DIAS.map(dia => (
                          <th key={dia} style={{ border: '1px solid var(--border-color)', padding: '8px', minWidth: '120px' }}>{DIAS_LABEL[dia]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 14 }, (_, i) => 7 + i).map(hora => (
                        <tr key={hora}>
                          <td style={{ border: '1px solid var(--border-color)', padding: '8px', fontWeight: '500', background: darkMode ? '#1e293b' : '#f1f5f9' }}>
                            {`${hora}:00 - ${hora + 1}:00`}
                          </td>
                          {DIAS.map(dia => {
                            const key = slotKeyFrom(dia, hora);
                            const asignacion = asignaciones[key];
                            const ambientesLibres = getAmbientesLibresEnCelda(dia, hora, key, asignacion?.ambienteId);
                            
                            // Check if we should gray out this cell
                            const shouldGrayOut = elementoFiltro && asignacion && getElementKey(asignacion) !== getElementKey(elementoFiltro);
                            
                            return (
                              <td
                                key={key}
                                style={{
                                  border: '1px solid var(--border-color)',
                                  padding: '4px',
                                  minHeight: '60px',
                                  height: '60px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  background: shouldGrayOut ? (darkMode ? '#1f2937' : '#e5e7eb') : (asignacion ? `${asignacion.color}30` : 'transparent'),
                                  filter: shouldGrayOut ? 'grayscale(0.8) opacity(0.5)' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if (!asignacion) {
                                    e.currentTarget.style.background = shouldGrayOut ? (darkMode ? '#1f2937' : '#e5e7eb') : (elementoSeleccionado ? `${elementoSeleccionado.color || '#3b82f6'}20` : darkMode ? '#334155' : '#f8fafc');
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = shouldGrayOut ? (darkMode ? '#1f2937' : '#e5e7eb') : (asignacion ? `${asignacion.color}30` : 'transparent');
                                }}
                                onClick={() => {
                                  if (shouldGrayOut) return;
                                  if (asignacion?.tipo === 'curso') {
                                    setWarningMessage('Los horarios de carga lectiva no pueden modificarse manualmente');
                                    return;
                                  }
                                  if (elementoSeleccionado) {
                                    // Case 1: We have a selected element
                                    const selectedKey = getElementKey(elementoSeleccionado);
                                    const totalHours = getTotalHoursForElement(elementoSeleccionado);
                                    const usedHours = horasUsadas[selectedKey] || 0;
                                    
                                    if (asignacion) {
                                      // Check if the existing assignment is our selected element
                                      const existingKey = getElementKey(asignacion);
                                      if (existingKey === selectedKey) {
                                        const newAsignaciones = { ...asignaciones };
                                        delete newAsignaciones[key];
                                        setAsignaciones(newAsignaciones);
                                        setHorasUsadas(prev => ({
                                          ...prev,
                                          [selectedKey]: Math.max(0, (prev[selectedKey] || 0) - 1)
                                        }));
                                        setWarningMessage(null);
                                        handleAutoGuardarHorario(newAsignaciones);
                                      } else {
                                        // Slot is occupied by another element!
                                        setWarningMessage(`Este horario ya está ocupado por "${asignacion.nombre || asignacion.titulo}"`);
                                      }
                                    } else {
                                      // Slot is empty
                                      if (usedHours >= totalHours) {
                                        setWarningMessage(`Ya has asignado todas las horas para "${elementoSeleccionado.nombre || elementoSeleccionado.titulo}"`);
                                      } else {
                                        const newAsignaciones = {
                                          ...asignaciones,
                                          [key]: elementoSeleccionado
                                        };
                                        setAsignaciones(newAsignaciones);
                                        setHorasUsadas(prev => ({
                                          ...prev,
                                          [selectedKey]: (prev[selectedKey] || 0) + 1
                                        }));
                                        setWarningMessage(null);
                                        handleAutoGuardarHorario(newAsignaciones);
                                      }
                                    }
                                  }
                                }}
                              >
                                {asignacion && (
                                  <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                                    <div style={{
                                      background: shouldGrayOut ? (darkMode ? '#4b5563' : '#9ca3af') : asignacion.color,
                                      color: 'white',
                                      padding: '4px 6px',
                                      borderRadius: '4px',
                                      fontSize: '10px',
                                      fontWeight: '500',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px'
                                    }}>
                                      <MapPin size={11} />
                                      <span>{asignacion.nombre || asignacion.titulo}</span>
                                    </div>
                                    {asignacion.ambienteId ? (
                                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',border:'1px solid var(--border-color)',borderRadius:'999px',padding:'4px 8px',background:darkMode ? '#0f172a' : '#fff',fontSize:'10px',color:'var(--text-secondary)'}}>
                                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asignacion.ambienteCodigo || asignacion.ambienteNombre || 'Ambiente seleccionado'}</span>
                                        {asignacion.tipo !== 'curso' && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const nextAsignaciones = {
                                                ...asignaciones,
                                                [key]: {
                                                  ...asignaciones[key],
                                                  ambienteId: '',
                                                  ambienteCodigo: '',
                                                  ambienteNombre: ''
                                                }
                                              };
                                              setAsignaciones(nextAsignaciones);
                                              handleAutoGuardarAmbiente(nextAsignaciones);
                                            }}
                                            style={{
                                              display:'inline-flex',
                                              alignItems:'center',
                                              justifyContent:'center',
                                              width:'16px',
                                              height:'16px',
                                              border:'none',
                                              borderRadius:'999px',
                                              background:'rgba(185,28,28,0.12)',
                                              color:'#b91c1c',
                                              cursor:'pointer',
                                              flex:'0 0 auto',
                                              padding:0
                                            }}
                                            title="Quitar ambiente"
                                          >
                                            <X size={10} />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <div style={{position:'relative'}}>
                                        <select
                                          value={asignacion.ambienteId || ''}
                                          disabled={asignacion.tipo === 'curso'}
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            const ambienteId = e.target.value;
                                            if (ambienteId && ambienteEstaOcupado(dia, hora, ambienteId, key)) {
                                              const conflicto = getOcupacionEnCelda(dia, hora).find((item: any) => item.ambiente_id === ambienteId);
                                              const detalle = conflicto?.curso_codigo
                                                ? `${conflicto.curso_codigo} (${conflicto.docente_nombre || 'otro docente'})`
                                                : (conflicto?.docente_nombre || 'otra actividad');
                                              setWarningMessage(`El ambiente ya está ocupado en ${DIAS_LABEL[dia]} ${hora}:00 por ${detalle}`);
                                              return;
                                            }
                                            const ambiente = ambientesDisponibles.find((item: any) => item.id === ambienteId);
                                            const nextAsignaciones = {
                                              ...asignaciones,
                                              [key]: {
                                                ...asignaciones[key],
                                                ambienteId,
                                                ambienteCodigo: ambiente?.codigo || '',
                                                ambienteNombre: ambiente ? `${ambiente.codigo} - ${ambiente.nombre}` : ''
                                              }
                                            };
                                            setAsignaciones(nextAsignaciones);
                                            setWarningMessage(null);
                                            handleAutoGuardarAmbiente(nextAsignaciones);
                                          }}
                                          style={{
                                            width: '100%',
                                            appearance: 'none',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            padding: '4px 28px 4px 8px',
                                            fontSize: '10px',
                                            color: 'var(--text-secondary)',
                                            background: darkMode ? '#0f172a' : '#fff',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          <option value="">Seleccione ambiente</option>
                                          {ambientesLibres.map((amb: any) => (
                                            <option key={amb.id} value={amb.id}>
                                              {amb.codigo} - {amb.nombre}
                                            </option>
                                          ))}
                                        </select>
                                        <ChevronDown size={12} style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-muted)' }} />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Botones al final */}
            <div style={{display:'flex',justifyContent:'flex-end',gap:'10px',padding:'0 20px 20px 20px'}}>
              <button
                className="btn-secondary"
                onClick={() => { setShowHorarioPreview(false); setShowModalHorarioSeleccion(false); }}
              >
                Cerrar
              </button>
              <button className="btn-primary" onClick={handleGuardarHorario}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showHorarioPreview && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '1460px', width: '98%', maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ alignItems: 'center' }}>
              <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                <h2 style={{fontSize:'18px',fontWeight:700,margin:0}}>Disponibilidad de horario</h2>
                <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>Primero elige un bloque arriba, luego revisa las aulas y laboratorios libres abajo</span>
              </div>
              <button onClick={() => setShowHorarioPreview(false)} style={{background:'none',border:'none',fontSize:'22px',cursor:'pointer',color:'var(--text-secondary)'}}>
                <X size={20} />
              </button>
            </div>

            <div style={{padding:'14px 16px 16px', display:'grid', gap:'14px'}}>
              <div style={{display:'grid',gridTemplateColumns:'280px minmax(0,1fr)',gap:'14px',alignItems:'start'}}>
                <aside style={{border:'1px solid var(--border-color)',borderRadius:'16px',padding:'14px',background:'var(--bg-card)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px',fontSize:'14px',fontWeight:700,color:'var(--text-primary)'}}>
                    <Filter size={16} />
                    Filtros de búsqueda
                  </div>
                  <div style={{display:'grid',gap:'12px'}}>
                    <div>
                      <label style={{display:'block',fontSize:'12px',color:'var(--text-secondary)',marginBottom:'6px'}}>Ver disponibilidad de:</label>
                      <select
                        value={previewAmbienteId}
                        onChange={(e) => setPreviewAmbienteId(e.target.value)}
                        className="form-input"
                        style={{width:'100%'}}
                      >
                        <option value="">Seleccionar ambiente</option>
                        {ambientesDisponibles.map((amb: any) => (
                          <option key={amb.id} value={amb.id}>{amb.codigo} - {amb.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <div>
                        <label style={{display:'block',fontSize:'12px',color:'var(--text-secondary)',marginBottom:'6px'}}>Hora inicio</label>
                        <select
                          value={previewHoraInicio}
                          onChange={(e) => {
                            const nextHoraInicio = e.target.value;
                            const horaInicio = parseInt(nextHoraInicio.split(':')[0] || '7');
                            setPreviewHoraInicio(nextHoraInicio);
                            setPreviewCelda(prev => ({ dia: prev.dia, hora: Number.isNaN(horaInicio) ? 7 : horaInicio }));
                          }}
                          className="form-input"
                          style={{width:'100%'}}
                        >
                          {Array.from({length:14},(_,i) => `${String(7 + i).padStart(2,'0')}:00`).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:'12px',color:'var(--text-secondary)',marginBottom:'6px'}}>Hora fin</label>
                        <select value={previewHoraFin} onChange={(e) => setPreviewHoraFin(e.target.value)} className="form-input" style={{width:'100%'}}>
                          {Array.from({length:14},(_,i) => `${String(8 + i).padStart(2,'0')}:00`).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'12px',color:'var(--text-secondary)',marginBottom:'6px'}}>Tipo de ambiente</label>
                      <div style={{display:'grid',gap:'8px'}}>
                        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)'}}>
                          <input type="checkbox" checked={previewTipoAulas} onChange={(e) => setPreviewTipoAulas(e.target.checked)} />
                          Aulas
                        </label>
                        <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',color:'var(--text-primary)'}}>
                          <input type="checkbox" checked={previewTipoLabs} onChange={(e) => setPreviewTipoLabs(e.target.checked)} />
                          Laboratorios
                        </label>
                      </div>
                    </div>
                    <button className="btn-secondary" onClick={() => { setPreviewAmbienteId(''); setPreviewHoraInicio('07:00'); setPreviewHoraFin('20:00'); setPreviewTipoAulas(true); setPreviewTipoLabs(true); setPreviewCelda({ dia: 'lunes', hora: 7 }); }} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
                      <RotateCcw size={16} />
                      Limpiar filtros
                    </button>

                    <div style={{borderTop:'1px solid var(--border-color)',paddingTop:'12px'}}>
                      <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-primary)',marginBottom:'8px'}}>Leyenda</div>
                      <div style={{display:'grid',gap:'8px',fontSize:'12px',color:'var(--text-secondary)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{width:12,height:12,borderRadius:'4px',background:'#dcfce7',border:'1px solid #a7f3d0'}} />Disponible</div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{width:12,height:12,borderRadius:'4px',background:'#fee2e2',border:'1px solid #fecaca'}} />Ocupado</div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}><span style={{width:12,height:12,borderRadius:'4px',background:'var(--bg-card)',border:'1px solid var(--border-color)'}} />Sin programación</div>
                      </div>
                    </div>
                  </div>
                </aside>

                <section style={{display:'grid',gap:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                    <div>
                      <h3 style={{margin:'0 0 4px',fontSize:'15px',fontWeight:700,color:'var(--text-primary)',display:'flex',alignItems:'center',gap:'8px'}}>
                        <CalendarDays size={16} />
                        Horario de Disponibilidad (Horas vs Días)
                      </h3>
                      <p style={{margin:0,fontSize:'12px',color:'var(--text-secondary)'}}>
                        {previewAmbienteId
                          ? 'Revisa si el ambiente seleccionado está libre u ocupado en cada bloque.'
                          : 'Selecciona un ambiente en el filtro o haz clic en un bloque para ver aulas disponibles.'}
                      </p>
                    </div>
                  </div>

                  {previewLoading ? (
                    <div style={{padding:'24px',textAlign:'center',border:'1px dashed var(--border-color)',borderRadius:'12px',color:'var(--text-secondary)'}}>Cargando disponibilidad...</div>
                  ) : (
                    <div style={{overflowX:'auto',border:'1px solid var(--border-color)',borderRadius:'14px',background:'var(--bg-card)'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',minWidth:'900px',fontSize:'12px'}}>
                        <thead>
                          <tr style={{background: darkMode ? '#223b5c' : '#1f3d63', color: 'white'}}>
                            <th style={{padding:'10px 12px',textAlign:'center',fontWeight:700}}>Horas</th>
                            {DIAS.map(dia => <th key={dia} style={{padding:'10px 12px',textAlign:'center',fontWeight:700}}>{DIAS_LABEL[dia]}<div style={{fontSize:'10px',opacity:.9,marginTop:'2px'}}>11/7</div></th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: 14 }, (_, i) => 7 + i).map(hora => (
                            <tr key={hora}>
                              <td style={{padding:'10px 12px',borderBottom:'1px solid var(--border-color)',background:'var(--bg-card)',fontWeight:700,color:'var(--text-secondary)',whiteSpace:'nowrap'}}>
                                {String(hora).padStart(2, '0')}:00 - {String(hora + 1).padStart(2, '0')}:00
                              </td>
                              {DIAS.map(dia => {
                                const key = slotKeyFrom(dia, hora);
                                const ocupacionesCelda = previewOcupacion.get(key) || [];
                                const isSelected = previewCelda.dia === dia && previewCelda.hora === hora;
                                const isOccupied = previewAmbienteId
                                  ? ocupacionesCelda.some((item: any) => item.ambiente_id === previewAmbienteId)
                                  : false;
                                const ocupacionDetalle = previewAmbienteId
                                  ? ocupacionesCelda.find((item: any) => item.ambiente_id === previewAmbienteId)
                                  : null;

                                let bg = darkMode ? '#1f2937' : '#f8fafc';
                                if (previewAmbienteId) {
                                  bg = isOccupied
                                    ? (darkMode ? 'rgba(239,68,68,0.18)' : '#fee2e2')
                                    : (darkMode ? 'rgba(34,197,94,0.14)' : '#dcfce7');
                                } else if (isSelected) {
                                  bg = darkMode ? 'rgba(59,130,246,0.22)' : '#dbeafe';
                                }

                                return (
                                  <td
                                    key={key}
                                    onClick={() => setPreviewCelda({ dia, hora })}
                                    title={previewAmbienteId && isOccupied && ocupacionDetalle
                                      ? `Ocupado por ${ocupacionDetalle.docente_nombre || '—'}${ocupacionDetalle.curso_codigo ? ` · ${ocupacionDetalle.curso_codigo}` : ''}`
                                      : undefined}
                                    style={{
                                      padding:'8px 8px',
                                      borderBottom:'1px solid var(--border-color)',
                                      borderLeft:'1px solid var(--border-color)',
                                      textAlign:'center',
                                      cursor:'pointer',
                                      background: isSelected && previewAmbienteId ? bg : isSelected ? bg : bg,
                                      boxShadow: isSelected ? 'inset 0 0 0 2px #3b82f6' : 'none'
                                    }}
                                  >
                                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
                                      {!previewAmbienteId ? (
                                        <>
                                          <Building2 size={14} color="var(--text-muted)" />
                                          <div style={{fontSize:'10px',fontWeight:600,color:'var(--text-secondary)',lineHeight:1.2}}>
                                            {isSelected ? 'Bloque seleccionado' : 'Seleccione un ambiente'}
                                          </div>
                                        </>
                                      ) : isOccupied ? (
                                        <>
                                          <Building2 size={14} color="#dc2626" />
                                          <div style={{fontSize:'10px',fontWeight:700,color:'#dc2626'}}>Ocupado</div>
                                          {ocupacionDetalle?.ambiente_codigo && (
                                            <div style={{fontSize:'9px',color:'var(--text-secondary)',maxWidth:'90px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                              {ocupacionDetalle.ambiente_codigo}
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 size={14} color="#16a34a" />
                                          <div style={{fontSize:'10px',fontWeight:700,color:'#16a34a'}}>Disponible</div>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{display:'grid',gridTemplateColumns:'1.15fr 0.85fr',gap:'14px',alignItems:'start'}}>
                    <div style={{border:'1px solid var(--border-color)',borderRadius:'16px',padding:'14px',background:'var(--bg-card)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',marginBottom:'10px',flexWrap:'wrap'}}>
                        <div>
                          <h3 style={{margin:'0 0 4px',fontSize:'15px',fontWeight:700,color:'var(--text-primary)'}}>Aulas y laboratorios disponibles</h3>
                          <p style={{margin:0,fontSize:'12px',color:'var(--text-secondary)'}}>
                            Bloque seleccionado: {DIAS_LABEL[previewCelda.dia]} {String(previewCelda.hora).padStart(2, '0')}:00 - {String(previewCelda.hora + 1).padStart(2, '0')}:00
                          </p>
                        </div>
                        <div style={{fontSize:'12px',fontWeight:700,color:'#16a34a',background:'rgba(22,163,74,0.10)',padding:'8px 10px',borderRadius:'999px'}}>
                          {previewAmbientesFiltrados.length} disponibles
                        </div>
                      </div>

                      {previewAmbientesFiltrados.length === 0 ? (
                        <div style={{padding:'18px',textAlign:'center',border:'1px dashed var(--border-color)',borderRadius:'12px',color:'var(--text-secondary)'}}>
                          No hay ambientes disponibles para este bloque con los filtros actuales.
                        </div>
                      ) : (
                        <div style={{display:'grid',gap:'8px'}}>
                          {previewAmbientesFiltrados.map((amb: any) => (
                            <div key={amb.id} style={{display:'flex',justifyContent:'space-between',gap:'12px',padding:'10px 12px',border:'1px solid #a7f3d0',borderRadius:'12px',background: darkMode ? 'rgba(34,197,94,0.08)' : '#f0fdf4',alignItems:'center'}}>
                              <div style={{display:'flex',alignItems:'center',gap:'10px',minWidth:0}}>
                                <div style={{width:'34px',height:'34px',borderRadius:'10px',background:'rgba(22,163,74,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                  <CheckCircle2 size={16} color="#16a34a" />
                                </div>
                                <div style={{minWidth:0}}>
                                  <div style={{fontSize:'13px',fontWeight:700,color:'var(--text-primary)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{amb.codigo} - {amb.nombre}</div>
                                  <div style={{fontSize:'12px',color:'var(--text-secondary)',display:'flex',gap:'8px',flexWrap:'wrap',marginTop:'2px'}}>
                                    <span>{String(amb.tipo || '').toUpperCase()}</span>
                                    <span>Cap. {amb.capacidad ?? '—'}</span>
                                    <span style={{color:'#16a34a',fontWeight:600}}>Disponible</span>
                                  </div>
                                </div>
                              </div>
                              <button className="btn-secondary" style={{padding:'7px 10px',fontSize:'12px'}} onClick={() => setPreviewAmbienteId(amb.id)}>
                                Ver en grilla
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{border:'1px solid var(--border-color)',borderRadius:'16px',padding:'14px',background:'var(--bg-card)'}}>
                      <h3 style={{margin:'0 0 10px',fontSize:'15px',fontWeight:700,color:'var(--text-primary)'}}>Detalle del bloque</h3>
                      <div style={{display:'grid',gap:'10px'}}>
                        <div style={{padding:'12px',borderRadius:'12px',background:'var(--card-bg)',border:'1px solid var(--border-color)'}}>
                          <div style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'4px'}}>Ambiente elegido</div>
                          <div style={{fontSize:'13px',fontWeight:700,color:'var(--text-primary)'}}>{previewAmbienteSeleccionado ? `${previewAmbienteSeleccionado.codigo} - ${previewAmbienteSeleccionado.nombre}` : 'Seleccionar ambiente'}</div>
                        </div>
                        <div style={{padding:'12px',borderRadius:'12px',background:'var(--card-bg)',border:'1px solid var(--border-color)'}}>
                          <div style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'4px'}}>Hora</div>
                          <div style={{fontSize:'13px',fontWeight:700,color:'var(--text-primary)'}}>{previewHoraInicio} - {previewHoraFin}</div>
                        </div>
                        <div style={{padding:'12px',borderRadius:'12px',background:'var(--card-bg)',border:'1px solid var(--border-color)'}}>
                          <div style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'4px'}}>Estado del bloque</div>
                          <div style={{fontSize:'13px',fontWeight:700,color: previewOcupacionSeleccionada ? '#dc2626' : '#16a34a'}}>
                            {previewAmbienteId
                              ? (previewOcupacionSeleccionada ? 'Ocupado' : 'Disponible')
                              : 'Seleccione ambiente'}
                          </div>
                          {previewOcupacionSeleccionada && (
                            <div style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'6px',lineHeight:1.45}}>
                              {previewOcupacionSeleccionada.docente_nombre && (
                                <div>Docente: {previewOcupacionSeleccionada.docente_nombre}</div>
                              )}
                              {(previewOcupacionSeleccionada.curso_codigo || previewOcupacionSeleccionada.curso_nombre) && (
                                <div>Curso: {previewOcupacionSeleccionada.curso_codigo || previewOcupacionSeleccionada.curso_nombre}</div>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{padding:'12px',borderRadius:'12px',background:'rgba(59,130,246,0.08)',border:'1px solid rgba(59,130,246,0.18)',color:'#1d4ed8',fontSize:'12px',lineHeight:1.45}}>
                          <Clock3 size={14} style={{verticalAlign:'text-bottom',marginRight:'6px'}} />
                          Usa los filtros para compactar la búsqueda y hacerla más rápida.
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="modal-footer" style={{display:'flex',justifyContent:'flex-end',padding:'12px 18px',borderTop:'1px solid var(--border-color)'}}>
              <button className="btn-secondary" onClick={() => setShowHorarioPreview(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal horario no lectivo */}
      {showModalHorario && (
        <div className="modal-overlay" onClick={() => setShowModalHorario(false)}>
          <div className="modal" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{fontSize:'16px',fontWeight:700,margin:0}}>Programar Horario No Lectivo</h2>
              <button onClick={() => setShowModalHorario(false)} style={{background:'none',border:'none',fontSize:'22px',cursor:'pointer',color:'var(--text-secondary)'}}>×</button>
            </div>
            <div style={{padding:'16px'}}>
              <p style={{fontSize:'13px',color:'var(--text-secondary)',marginBottom:'12px'}}>
                {docenteSeleccionado?.apellidos}, {docenteSeleccionado?.nombre}
              </p>

              {/* Current section info — only the section being edited */}
              {(() => {
                const s = SECCIONES_NL.find(x => x.key === nlSection);
                if (!s) return null;
                const secKey = ({preparacion:'preparacionEvaluacion',consejeria:'consejeriaTutoria',investigacion:'investigacion',capacitacion:'capacitacion',gobierno:'gobierno',administracion:'administracion',asesoria:'asesoriaTesis',rsu:'responsabilidadSocial',comites:'comitesTecnicos'} as Record<string,keyof Secciones>)[nlSection];
                const maxH = parseInt(secciones[secKey]?.horas || '0');
                return (
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',padding:'8px 12px',borderRadius:'8px',background:s.color+'15',border:`1px solid ${s.color}30`}}>
                    <span style={{width:'10px',height:'10px',borderRadius:'50%',background:s.color,display:'inline-block'}} />
                    <span style={{fontSize:'14px',fontWeight:700,color:s.color}}>{s.num}. {s.title}</span>
                    <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>
                      — {(nlSlots[nlSection]||new Set()).size}/{maxH}h
                    </span>
                  </div>
                );
              })()}

              {/* Grid */}
              <div style={{display:'grid',gridTemplateColumns:'80px repeat(6,1fr)',border:'1px solid var(--border-color)',borderRadius:'8px',overflow:'hidden',fontSize:'11px',userSelect:'none'}}
                onMouseUp={() => { nlMouseDown.current = false; }}
                onMouseLeave={() => { nlMouseDown.current = false; }}>
                <div style={{background:'linear-gradient(135deg,#1a3a5c,#1e3a5f)',color:'white',padding:'8px 4px',fontWeight:700,textAlign:'center'}}>Hora</div>
                {NL_DIAS.map(d => (
                  <div key={d} style={{background:'linear-gradient(135deg,#1a3a5c,#1e3a5f)',color:'white',padding:'8px 4px',fontWeight:700,textAlign:'center',borderLeft:'1px solid rgba(255,255,255,0.1)'}}>{NL_DIAS_LABEL[d]}</div>
                ))}
                {NL_SLOTS.map((slot, si) => (
                  <React.Fragment key={`row-${slot.id}`}>
                    <div style={{background:'var(--bg-card-hover)',color:'var(--text-secondary)',padding:'6px 4px',fontSize:'10px',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',borderRight:'1px solid var(--border-color)',borderBottom:'1px solid var(--border-color)',minHeight:'36px',fontWeight:600}}>{slot.label}</div>
                    {NL_DIAS.map(d => {
                      const key = nlSlotKey(d, slot.id);
                      const blocked = nlIsBlocked(d, slot.id);
                      const occSec = SECCIONES_NL.find(s => nlSlots[s.key]?.has(key));
                      const isCur = occSec?.key === nlSection;
                      const esOcupadaPorOtra = occSec && !isCur;
                      return (
                        <div key={key}
                          onMouseDown={() => { if (!blocked) { nlMouseDown.current = true; nlToggle(d, slot.id); } }}
                          onMouseEnter={() => { if (nlMouseDown.current && !blocked) nlToggle(d, slot.id); }}
                          style={{
                            minHeight:'36px',borderBottom:'1px solid var(--border-color)',
                            borderLeft: si === 0 ? 'none' : '1px solid var(--border-color)',
                            cursor:blocked?'not-allowed':'pointer',
                            background:blocked?(darkMode?'#450a0a':'#fef2f2'):occSec?occSec.color:'var(--bg-card)',
                            opacity:blocked?1:(occSec && !isCur)?0.9:1,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            fontSize:'9px',color:blocked?(darkMode?'#fecaca':'#991b1b'):(occSec?'#fff':'var(--text-muted)'),
                            fontWeight:blocked?600:(occSec?600:400),
                            transition:'all 0.1s',
                          }}
                        >
                          {blocked && !esOcupadaPorOtra?'No disponible':
                           esOcupadaPorOtra?`${occSec?.num}`:
                           occSec?'✓':''}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              <p style={{fontSize:'11px',color:'var(--text-secondary)',marginTop:'12px',marginBottom:0}}>
                Haz clic o arrastra sobre la cuadrícula para marcar/desmarcar horas. Celdas rojas = ocupadas por otras actividades.
              </p>
            </div>
            <div className="modal-footer" style={{display:'flex',justifyContent:'flex-end',gap:'8px',padding:'12px 16px',borderTop:'1px solid var(--border-color)'}}>
              <button className="btn-secondary" onClick={() => setShowModalHorario(false)} style={{padding:'8px 16px',fontSize:'13px'}}>Cancelar</button>
              <button className="btn-primary" onClick={() => nlGuardar(nlSection)} style={{padding:'8px 16px',fontSize:'13px'}}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
