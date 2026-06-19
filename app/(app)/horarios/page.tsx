'use client';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useUser } from '@/app/(app)/layout';
import { useTheme } from '@/lib/theme';
import GrillaHorarios from '@/components/horarios/GrillaHorarios';
import { BotonExportarExcel } from '@/components/exportar/BotonExportarExcel';
import { BotonExportarFormatoUNT } from '@/components/exportar/BotonExportarFormatoUNT';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_LABEL: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miérc.',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

function getFaseInfo(fase: number, darkMode: boolean) {
  const palette: Record<number, { label: string; color: string; bg: string; icon: string }> = {
    1: { label: 'Carga de Información', color: darkMode ? '#93c5fd' : '#1e40af', bg: darkMode ? 'rgba(59,130,246,0.14)' : '#dbeafe', icon: '📋' },
    2: { label: 'Disponibilidad Docente', color: darkMode ? '#6ee7b7' : '#065f46', bg: darkMode ? 'rgba(16,185,129,0.14)' : '#d1fae5', icon: '🕐' },
    3: { label: 'Programación', color: darkMode ? '#fcd34d' : '#92400e', bg: darkMode ? 'rgba(245,158,11,0.14)' : '#fef3c7', icon: '⚡' },
    4: { label: 'Publicado', color: darkMode ? '#86efac' : '#166534', bg: darkMode ? 'rgba(34,197,94,0.14)' : '#dcfce7', icon: '✅' },
  };
  return palette[fase] || palette[1];
}

function getEstadoStyle(estado: string, darkMode: boolean) {
  const palette: Record<string, { bg: string; color: string }> = {
    borrador: { bg: darkMode ? 'rgba(245,158,11,0.16)' : '#fef3c7', color: darkMode ? '#fcd34d' : '#92400e' },
    en_disponibilidad: { bg: darkMode ? 'rgba(59,130,246,0.14)' : '#dbeafe', color: darkMode ? '#93c5fd' : '#1e40af' },
    en_programacion: { bg: darkMode ? 'rgba(245,158,11,0.14)' : '#fef3c7', color: darkMode ? '#fcd34d' : '#92400e' },
    publicado: { bg: darkMode ? 'rgba(34,197,94,0.14)' : '#dcfce7', color: darkMode ? '#86efac' : '#166534' },
    cancelado: { bg: darkMode ? 'rgba(239,68,68,0.14)' : '#fee2e2', color: darkMode ? '#fca5a5' : '#991b1b' },
  };
  return palette[estado] || palette.borrador;
}

export default function HorariosPage() {
  const { darkMode } = useTheme();
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [programaciones, setProgramaciones] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'programaciones'|'horario'|'mi-horario'>('programaciones');
  const [subVista, setSubVista] = useState<'activas'|'canceladas'>('activas');
  const [msg, setMsg] = useState<any>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string|null>(null);
  const [restaurandoId, setRestaurandoId] = useState<string|null>(null);

  const [curriculas, setCurriculas] = useState<any[]>([]);
  const [loadedCurriculas, setLoadedCurriculas] = useState(false);
  const [showConfigRestringidos, setShowConfigRestringidos] = useState(false);
  const [restringidosConfig, setRestringidosConfig] = useState<Record<string, string>>({});
  const [tempRestringidos, setTempRestringidos] = useState<Record<string, string>>({});
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingCards, setImportingCards] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<any>(null);
  const [importProgId, setImportProgId] = useState('');
  const [importSourceCicloId, setImportSourceCicloId] = useState('');
  const [cargaHorariaResumen, setCargaHorariaResumen] = useState<Record<number, number>>({});
  const [selectedCiclosPlan, setSelectedCiclosPlan] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (showConfigRestringidos) {
      setTempRestringidos(restringidosConfig);
    }
  }, [showConfigRestringidos, restringidosConfig]);

  // Fetch carga horaria summary when import modal opens
  useEffect(() => {
    if (showImportModal && importSourceCicloId) {
      setCargaHorariaResumen({});
      setSelectedCiclosPlan(new Set());
      setImportProgId('');
      fetch(`/api/carga-horaria?ciclo_academico_id=${importSourceCicloId}&solo_sin_asignacion=false`)
        .then(r => r.json())
        .then(data => {
          const ch = data.data || [];
          const ciclosConCarga = new Set<number>();
          ch.forEach((entry: any) => {
            if (entry.ciclo_plan) ciclosConCarga.add(entry.ciclo_plan);
          });
          const sorted = Array.from(ciclosConCarga).sort((a, b) => a - b);
          setCargaHorariaResumen(
            ch.reduce((acc: Record<number, number>, entry: any) => {
              const cp = entry.ciclo_plan || 1;
              acc[cp] = (acc[cp] || 0) + 1;
              return acc;
            }, {})
          );
          setSelectedCiclosPlan(new Set(sorted));
        })
        .catch(() => setCargaHorariaResumen({}));
    }
  }, [showImportModal, importSourceCicloId]);

  const user = useUser();
  const isAdminOrSec = user?.rol.codigo === 'admin' || user?.rol.codigo === 'secretaria';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const isDocente = user?.rol.codigo === 'docente';
  const canEdit = isAdminOrSec; // Director solo lectura
  const [miHorario, setMiHorario] = useState<any[]>([]);
  const [loadingMiHorario, setLoadingMiHorario] = useState(false);

  // Cargar parámetro de vista desde URL si existe
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('vista');
      if (v === 'programaciones' || v === 'horario' || v === 'mi-horario') {
        setVista(v as any);
      }
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    Promise.all([
      fetch('/api/ciclos').then(r => r.json()),
      fetch('/api/docentes').then(r => r.json()),
      fetch('/api/aulas').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/curriculas?manage=true').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/configuracion?clave=HORARIOS_RESTRINGIDOS').then(r => r.json()).catch(() => ({ data: null })),
    ]).then(([ciclosRes, docRes, ambRes, dashRes, currRes, configRes]) => {
      setCiclos(ciclosRes.data || []);
      setDocentes(docRes.data || []);
      setAmbientes(ambRes.data || []);
      const activeSlots = dashRes.slots || [];
      setSlots(activeSlots);
      const activo = ciclosRes.data?.find((c: any) => c.activo);
      if (activo) setCicloId(activo.id);

      const allCurriculas = currRes.data || [];
      const filtered = allCurriculas.filter((c: any) => c.estado === 'ACTIVA' || c.estado === 'EN_EXTINCION');
      setCurriculas(filtered);
      setLoadedCurriculas(true);

      let restDict: Record<string, string> = {};
      if (configRes.data && configRes.data.valor) {
        try {
          const parsed = JSON.parse(configRes.data.valor);
          if (Array.isArray(parsed)) {
            parsed.forEach(id => {
              restDict[id] = 'HORA LIBRE (REFRIGERIO)';
            });
          } else if (parsed && typeof parsed === 'object') {
            restDict = parsed;
          }
        } catch(e) {}
      } else {
        const foodSlot = activeSlots.find((s: any) => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
        if (foodSlot) {
          restDict[foodSlot.id] = 'HORA LIBRE (REFRIGERIO)';
        }
      }
      setRestringidosConfig(restDict);
    }).catch(err => {
      console.error('Error al cargar datos iniciales/currículas:', err);
      setLoadedCurriculas(true);
    }).finally(() => setLoading(false));
  }, []);

  // Cargar programaciones cuando cambia el ciclo
  const cargarProgramaciones = useCallback(() => {
    if (!cicloId) return;
    fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`)
      .then(r => r.json())
      .then(d => setProgramaciones(d.data || []));
  }, [cicloId]);

  useEffect(() => { cargarProgramaciones(); }, [cargarProgramaciones]);

  // Cargar asignaciones para vista de horario publicado
  const cargarHorario = useCallback(async () => {
    if (!cicloId || !slots.length || !ambientes.length) {
      console.log('cargarHorario waiting for slots or ambientes...');
      return;
    }
    console.log('cargarHorario called with cicloId:', cicloId);
    console.log('slots in cargarHorario:', slots);
    console.log('ambientes in cargarHorario:', ambientes);
    try {
      let data: any[] = [];
      
      // First try to get published programaciones
      const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`);
      if (!progsRes.ok) throw new Error('Failed to fetch programaciones');
      const progsJson = await progsRes.json();
      console.log('programaciones response:', progsJson);
      const progs = progsJson.data || [];
      const selectedProg = progs.find((p: any) => p.estado === 'publicado') || progs[0];
      console.log('selectedProg:', selectedProg);
      
      if (selectedProg && selectedProg.config && selectedProg.config.horarios_restringidos) {
        setRestringidosConfig(selectedProg.config.horarios_restringidos);
      }

      // If there's a selected program, use its export data
      if (selectedProg) {
        const exportRes = await fetch(`/api/horarios/programaciones/${selectedProg.id}/exportar`);
        console.log('exportRes ok:', exportRes.ok);
        if (exportRes.ok) {
          const exportData = await exportRes.json();
          console.log('exportData:', exportData);
          const slotByTime = new Map(
            (slots || []).map((s: any) => [
              `${(s.hora_inicio || '').substring(0, 5)}-${(s.hora_fin || '').substring(0, 5)}`, 
              s
            ])
          );
          console.log('slotByTime:', slotByTime);
          const ambienteByCodigo = new Map(
            (ambientes || []).map((a: any) => [a.codigo, a])
          );
          const exported = (exportData.asignaciones || []).map((a: any) => {
            const timeKey = `${(a.hora_inicio || '').substring(0, 5)}-${(a.hora_fin || '').substring(0, 5)}`;
            return {
              id: a.id,
              dia: a.dia,
              slot_id: a.slot_id || slotByTime.get(timeKey)?.id || null,
              hora_inicio: a.hora_inicio,
              hora_fin: a.hora_fin,
              curso_nombre: a.curso_nombre,
              curso_codigo: a.curso_codigo,
              ciclo_plan: a.ciclo,
              numero_grupo: parseInt(String(a.grupo || '').replace('G', ''), 10) || 1,
              tipo: a.tipo_sesion || a.tipo,
              docente_id: a.docente_id || null,
              docente_nombre: a.docente_nombre || '',
              ambiente_id: ambienteByCodigo.get(a.aula || '')?.id || null,
              ambiente_nombre: ambienteByCodigo.get(a.aula || '')?.nombre || a.aula || '',
              ambiente_codigo: ambienteByCodigo.get(a.aula || '')?.codigo || a.aula || '',
              ambiente_tipo: ambienteByCodigo.get(a.aula || '')?.tipo || '',
            };
          });
          console.log('exported asignaciones:', exported);
          data = exported;
        }
      }

      // Try to get database asignaciones to add no lectivas
      try {
        const horariosRes = await fetch(`/api/horarios?ciclo_id=${cicloId}`);
        if (horariosRes.ok) {
          const d = await horariosRes.json();
          console.log('API horarios response:', d);
          const dbData = d.data || [];
          const hasAcademic = dbData.some((a: any) => a.tipo !== 'no_lectiva');
          const noLectivaData = dbData.filter((a: any) => a.tipo === 'no_lectiva');
          if (!hasAcademic) {
            data = [...data, ...noLectivaData];
          } else {
            data = dbData;
          }
        }
      } catch (horariosErr) {
        console.warn('Failed to fetch horarios:', horariosErr);
      }
      
      console.log('Final data to setAsignaciones:', data);
      setAsignaciones(data);
    } catch (err) {
      console.error('Error in cargarHorario:', err);
    }
  }, [cicloId, slots, ambientes]);

  useEffect(() => { if (vista === 'horario') cargarHorario(); }, [vista, cargarHorario]);

  // Cargar horario personal del docente si está logueado como docente
  const cargarMiHorario = useCallback(async () => {
    if (!isDocente || !cicloId || !user?.docente_id || !slots.length || !ambientes.length) return;
    setLoadingMiHorario(true);
    try {
      let data: any[] = [];
      
      // Try to get programaciones
      const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`);
      const progsJson = await progsRes.json();
      const progs = progsJson.data || [];
      const selectedProg = progs.find((p: any) => p.estado === 'publicado') || progs[0];
      
      const noLectivaData: any[] = [];
      
      // Try to get horarios for no lectivas first
      try {
        const horariosRes = await fetch(`/api/horarios?ciclo_id=${cicloId}&docente_id=${user.docente_id}`);
        if (horariosRes.ok) {
          const d = await horariosRes.json();
          const dbData = d.data || [];
          const hasAcademic = dbData.some((a: any) => a.tipo !== 'no_lectiva');
          if (hasAcademic) {
            data = dbData;
          } else {
            noLectivaData.push(...dbData.filter((a: any) => a.tipo === 'no_lectiva'));
          }
        }
      } catch (horariosErr) {
        console.warn('Failed to fetch mi horario:', horariosErr);
      }
      
      // If no academic data, use program export
      if (data.length === 0 && selectedProg) {
        const exportRes = await fetch(`/api/horarios/programaciones/${selectedProg.id}/exportar`);
        if (exportRes.ok) {
          const exportData = await exportRes.json();
          const slotByTime = new Map(
            (slots || []).map((s: any) => [
              `${(s.hora_inicio || '').substring(0, 5)}-${(s.hora_fin || '').substring(0, 5)}`, 
              s
            ])
          );
          const ambienteByCodigo = new Map(
            (ambientes || []).map((a: any) => [a.codigo, a])
          );
          const exported = (exportData.asignaciones || []).filter((a: any) => a.docente_id === user.docente_id).map((a: any) => {
            const timeKey = `${(a.hora_inicio || '').substring(0, 5)}-${(a.hora_fin || '').substring(0, 5)}`;
            return {
              id: a.id,
              dia: a.dia,
              slot_id: a.slot_id || slotByTime.get(timeKey)?.id || null,
              hora_inicio: a.hora_inicio,
              hora_fin: a.hora_fin,
              curso_nombre: a.curso_nombre,
              curso_codigo: a.curso_codigo,
              ciclo_plan: a.ciclo,
              numero_grupo: parseInt(String(a.grupo || '').replace('G', ''), 10) || 1,
              tipo: a.tipo_sesion || a.tipo,
              docente_id: a.docente_id || null,
              docente_nombre: a.docente_nombre || '',
              ambiente_id: ambienteByCodigo.get(a.aula || '')?.id || null,
              ambiente_nombre: ambienteByCodigo.get(a.aula || '')?.nombre || a.aula || '',
              ambiente_codigo: ambienteByCodigo.get(a.aula || '')?.codigo || a.aula || '',
              ambiente_tipo: ambienteByCodigo.get(a.aula || '')?.tipo || '',
            };
          });
          data = [...exported, ...noLectivaData];
        }
      }
      
      setMiHorario(data);
      setLoadingMiHorario(false);
    } catch (err) {
      console.error('Error in cargarMiHorario:', err);
      setMiHorario([]);
      setLoadingMiHorario(false);
    }
  }, [isDocente, cicloId, user?.docente_id, slots, ambientes]);

  useEffect(() => { cargarMiHorario(); }, [cargarMiHorario]);


  // Crear programación
  async function crearProgramacion() {
    setCreando(true); setMsg(null);
    try {
      const res = await fetch('/api/horarios/programaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ciclo_id: cicloId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: `Programación "${data.data.nombre}" creada correctamente` });
      setShowCrear(false);
      cargarProgramaciones();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setCreando(false); }
  }

  // Cancelar programación
  async function cancelarProgramacion() {
    if (!showDeleteModal) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${showDeleteModal}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'Programación cancelada' });
      setShowDeleteModal(null);
      cargarProgramaciones();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  }

  // Restaurar programación
  async function restaurarProgramacion() {
    if (!restaurandoId) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${restaurandoId}`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'Programación restaurada' });
      setRestaurandoId(null);
      cargarProgramaciones();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  }

  async function importarCargaHoraria(programacionId: string) {
    setImporting(true);
    setImportResult(null);
    try {
      const cicloPlans = Array.from(selectedCiclosPlan).sort((a, b) => a - b);
      const res = await fetch('/api/horarios/importar-carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programacion_id: programacionId,
          ciclo_academico_id: importSourceCicloId,
          ciclo_plans: cicloPlans,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportResult({ type: 'success', text: data.message });
      setMsg({ type: 'success', text: data.message });
      setShowImportModal(false);
      cargarProgramaciones();
    } catch (e: any) {
      setImportResult({ type: 'error', text: e.message });
      setMsg({ type: 'error', text: e.message });
    } finally {
      setImporting(false);
    }
  }

  async function importarCargaDirecta(prog: any) {
    const progId = prog.id;
    const cicloId = prog.ciclo_id;
    if (!cicloId) {
      setMsg({ type: 'error', text: 'La programación no tiene ciclo asignado' });
      return;
    }
    setImportingCards(prev => new Set(prev).add(progId));
    try {
      const res = await fetch('/api/horarios/importar-carga-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programacion_id: progId, ciclo_academico_id: cicloId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: `✅ ${prog.nombre}: ${data.message}` });
      cargarProgramaciones();
    } catch (e: any) {
      setMsg({ type: 'error', text: `Error en ${prog.nombre}: ${e.message}` });
    } finally {
      setImportingCards(prev => { const next = new Set(prev); next.delete(progId); return next; });
    }
  }

  function getCell(dia: string, slotId: string) {
    return asignaciones.filter(a => a.dia === dia && a.slot_id === slotId);
  }

  function getFaseUrl(prog: any) {
    switch (prog.fase) {
      case 1: return `/horarios/crear?id=${prog.id}`;
      case 2: return `/horarios/${prog.id}/disponibilidad`;
      case 3: return `/horarios/${prog.id}/programar`;
      case 4: return `/horarios/${prog.id}/publicar`;
      default: return `/horarios/${prog.id}`;
    }
  }

  if (loading) return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <div style={{width:'40px',height:'40px',border:'3px solid #e2e8f0',borderTop:'3px solid #1a3a5c',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 12px'}} />
      <p style={{color:'#64748b'}}>Cargando...</p>
    </div>
  );
  if (loadedCurriculas && curriculas.length === 0 && !isDocente) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#ef4444', margin: '0 0 8px' }}>Inaccesible</h1>
        <p style={{ fontSize: '18px', color: 'var(--text-secondary)', margin: 0 }}>No hay una currícula configurada</p>
      </div>
    );
  }

  return (
    <div className="horarios-index-page" style={{padding:'32px', color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px', color:'var(--text-primary)'}}>Horarios</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Gestión de horarios académicos por fases</p>
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
          {!isDocente && (
            <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid var(--border-color)'}}>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',background:vista==='programaciones'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='programaciones'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                onClick={() => setVista('programaciones')}
              >📋 Programaciones</button>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',borderLeft:'1px solid var(--border-color)',background:vista==='horario'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='horario'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                onClick={() => setVista('horario')}
              >📅 Horario General</button>
            </div>
          )}
          {isDocente && (
            <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid var(--border-color)'}}>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',background:vista==='programaciones'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='programaciones'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                onClick={() => setVista('programaciones')}
              >📋 Mis Programaciones</button>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',borderLeft:'1px solid var(--border-color)',background:vista==='mi-horario'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='mi-horario'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                onClick={() => setVista('mi-horario')}
              >👤 Mi Horario</button>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',borderLeft:'1px solid var(--border-color)',background:vista==='horario'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='horario'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                onClick={() => setVista('horario')}
              >📅 Horario General</button>
            </div>
          )}
          {vista === 'programaciones' && canEdit && (
            <>
              <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                Importar
              </button>
              <button className="btn-primary" onClick={() => setShowCrear(true)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Nueva programación
              </button>
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{position:'relative',paddingRight:'40px'}}>
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'18px',color:'inherit',lineHeight:'1',padding:'0'}}>×</button>
        </div>
      )}

      {/* Selector de ciclo */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'end',justifyContent:'space-between',width:'100%',flexWrap:'wrap'}}>
          <div className="form-group" style={{margin:0,minWidth:'200px'}}>
            <label className="form-label">Ciclo académico</label>
            <select className="form-input" value={cicloId} onChange={e => setCicloId(e.target.value)}>
              {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.activo ? '(Activo)' : ''}</option>)}
            </select>
          </div>
          {canEdit && (
            <button 
              className="btn-secondary" 
              style={{height:'40px', display:'flex', alignItems:'center', gap:'6px'}}
              onClick={() => setShowConfigRestringidos(true)}
            >
              🔒 Configurar Horarios Restringidos
            </button>
          )}
        </div>
      </div>

      {/* ===== VISTA: PROGRAMACIONES ===== */}
      {vista === 'programaciones' && (
        <div>
          {/* Subvista selector (Activas / Canceladas) */}
          {canEdit && (
            <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'600',border:'none',cursor:'pointer',borderRadius:'8px',background:subVista==='activas'?'#1a3a5c':'var(--bg-card)',color:subVista==='activas'?'white':'var(--text-secondary)'}}
                onClick={() => setSubVista('activas')}
              >
                📋 Programaciones Activas
              </button>
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'600',border:'none',cursor:'pointer',borderRadius:'8px',background:subVista==='canceladas'?'#1a3a5c':'var(--bg-card)',color:subVista==='canceladas'?'white':'var(--text-secondary)'}}
                onClick={() => setSubVista('canceladas')}
              >
                🗑️ Programaciones Canceladas
              </button>
            </div>
          )}

          {subVista === 'activas' && (
            <div>
              {programaciones.filter(p => p.estado !== 'cancelado').length === 0 ? (
                <div className="card" style={{textAlign:'center',padding:'60px 24px'}}>
                  <div style={{fontSize:'48px',marginBottom:'12px',opacity:0.4}}>📋</div>
                  <h3 style={{fontSize:'18px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 8px'}}>No hay programaciones activas para este ciclo</h3>
                  <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:'0 0 20px'}}>Crea una nueva programación para comenzar el proceso de asignación de horarios.</p>
                  {canEdit && (
                    <button className="btn-primary" onClick={() => setShowCrear(true)}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Crear programación
                    </button>
                  )}
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  {programaciones.filter(p => p.estado !== 'cancelado').map(prog => {
                    const faseInfo = getFaseInfo(prog.fase, darkMode);
                    const estadoStyle = getEstadoStyle(prog.estado, darkMode);
                    return (
                      <div key={prog.id} className="card" style={{padding:0,overflow:'hidden'}}>
                        {/* Barra de progreso de fases */}
                        <div style={{display:'flex',height:'4px'}}>
                          {[1,2,3,4].map(f => (
                            <div key={f} style={{flex:1,background:f <= prog.fase ? '#1a3a5c' : 'var(--border-color)',transition:'background 0.3s'}} />
                          ))}
                        </div>
                        <div style={{padding:'20px 24px'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                              <div style={{fontSize:'24px'}}>{faseInfo.icon}</div>
                              <div>
                                <h3 style={{fontSize:'18px',fontWeight:'700',color:'var(--text-primary)',margin:'0 0 2px'}}>{prog.nombre}</h3>
                                <p style={{fontSize:'13px',color:'var(--text-secondary)',margin:0}}>
                                  Creado por {prog.creador_nombre} • {new Date(prog.created_at).toLocaleDateString('es-PE')}
                                </p>
                              </div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                              <span style={{
                                padding:'4px 12px',borderRadius:'9999px',fontSize:'12px',fontWeight:'600',
                                background:estadoStyle.bg, color:estadoStyle.color
                              }}>{prog.estado.replace('_',' ')}</span>
                              <span style={{
                                padding:'4px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',
                                background:faseInfo.bg, color:faseInfo.color
                              }}>Fase {prog.fase}: {faseInfo.label}</span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'16px'}}>
                            {[
                              { label: 'Cursos', value: prog.total_cursos || 0 },
                              { label: 'Docentes', value: prog.total_docentes || 0 },
                              { label: 'Ciclo', value: prog.ciclo_nombre },
                            ].map((s, i) => (
                              <div key={i} style={{background:'var(--bg-card-hover)',borderRadius:'8px',padding:'12px',textAlign:'center',border:'1px solid var(--border-color)'}}>
                                <p style={{fontSize:'18px',fontWeight:'700',color:'var(--text-primary)',margin:'0 0 2px'}}>{s.value}</p>
                                <p style={{fontSize:'11px',color:'var(--text-secondary)',margin:0}}>{s.label}</p>
                              </div>
                            ))}
                          </div>

                          {/* Fases timeline — stepper con líneas conectoras */}
                          <div style={{display:'flex',alignItems:'center',marginBottom:'16px',padding:'8px 0'}}>
                            {[1,2,3,4].map((f, idx) => {
                              const fi = getFaseInfo(f, darkMode);
                              const activa = f === prog.fase;
                              const completada = f < prog.fase;
                              return (
                                <Fragment key={f}>
                                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px',flex:1,minWidth:0}}>
                                    <div style={{
                                      width:'36px',height:'36px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'700',
                                      background: completada ? '#059669' : activa ? fi.bg : 'var(--bg-card-hover)',
                                      color: completada ? 'white' : activa ? fi.color : 'var(--text-secondary)',
                                      border: completada ? 'none' : `2px solid ${activa ? fi.color : 'var(--border-color)'}`,
                                      transition:'all 0.3s',boxShadow: activa ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none'
                                    }}>
                                      {completada ? '✓' : activa ? fi.icon : f}
                                    </div>
                                    <span style={{fontSize:'11px',fontWeight:activa?'600':'400',color:activa?fi.color:'var(--text-secondary)',textAlign:'center',whiteSpace:'nowrap'}}>
                                      {fi.label}
                                    </span>
                                  </div>
                                  {idx < 3 && (
                                    <div style={{
                                      flex:'0 0 24px',height:'2px',alignSelf:'center',marginBottom:'20px',
                                      background: f < prog.fase ? '#059669' : 'var(--border-color)',transition:'background 0.3s'
                                    }} />
                                  )}
                                </Fragment>
                              );
                            })}
                          </div>

                          {/* Acciones */}
                          <div style={{display:'flex',gap:'10px',alignItems:'center',justifyContent:'flex-end'}}>
                            {prog.estado !== 'publicado' && prog.estado !== 'cancelado' && canEdit && (
                              <button style={{padding:'6px 14px',fontSize:'13px',borderRadius:'6px',cursor:'pointer',background:'transparent',color:'#ef4444',border:'1px solid #ef4444',fontWeight:'500'}} onClick={() => setShowDeleteModal(prog.id)}>
                                Cancelar
                              </button>
                            )}

                            {(prog.fase === 4 || prog.estado === 'publicado') && (
                              <BotonExportarFormatoUNT programacionId={prog.id} />
                            )}

                            {prog.estado !== 'publicado' && prog.estado !== 'cancelado' && canEdit && (
                              <button style={{padding:'4px 10px',fontSize:'12px',background:'transparent',border:'none',cursor:importingCards.has(prog.id)?'wait':'pointer',color:'var(--text-secondary)',textDecoration:'underline',textUnderlineOffset:'2px'}}
                                disabled={importingCards.has(prog.id)}
                                onClick={() => importarCargaDirecta(prog)}>
                                {importingCards.has(prog.id) ? 'Importando...' : '📥 Carga Horaria'}
                              </button>
                            )}

                            <a href={isDocente ? `/horarios/${prog.id}/disponibilidad` : getFaseUrl(prog)} style={{textDecoration:'none'}}>
                              <button className="btn-primary" style={{padding:'6px 14px',fontSize:'13px'}}>
                                {isDocente ? 'Marcar Disponibilidad' : (prog.estado === 'publicado' ? 'Ver horario' : `Continuar Fase ${prog.fase}`)} →
                              </button>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Subvista Canceladas */}
          {subVista === 'canceladas' && (
            <div>
              {programaciones.filter(p => p.estado === 'cancelado').length === 0 ? (
                <div className="card" style={{textAlign:'center',padding:'60px 24px'}}>
                  <div style={{fontSize:'48px',marginBottom:'12px',opacity:0.4}}>🗑️</div>
                  <h3 style={{fontSize:'18px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 8px'}}>No hay programaciones canceladas</h3>
                  <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Todas las programaciones están activas.</p>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  {programaciones.filter(p => p.estado === 'cancelado').map(prog => {
                    const faseInfo = getFaseInfo(prog.fase, darkMode);
                    const estadoStyle = getEstadoStyle(prog.estado, darkMode);
                    return (
                      <div key={prog.id} className="card" style={{padding:0,overflow:'hidden',opacity:0.85}}>
                        <div style={{display:'flex',height:'4px',background:'#fca5a5'}} />
                        <div style={{padding:'20px 24px'}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                              <div style={{fontSize:'24px'}}>🗑️</div>
                              <div>
                                <h3 style={{fontSize:'18px',fontWeight:'700',color:'var(--text-primary)',margin:'0 0 2px'}}>{prog.nombre}</h3>
                                <p style={{fontSize:'13px',color:'var(--text-secondary)',margin:0}}>
                                  Creado por {prog.creador_nombre} • {new Date(prog.created_at).toLocaleDateString('es-PE')}
                                </p>
                              </div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                              <span style={{
                                padding:'4px 12px',borderRadius:'9999px',fontSize:'12px',fontWeight:'600',
                                background:estadoStyle.bg, color:estadoStyle.color
                              }}>{prog.estado.replace('_',' ')}</span>
                              <span style={{
                                padding:'4px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:'600',
                                background:faseInfo.bg, color:faseInfo.color
                              }}>Fase {prog.fase}: {faseInfo.label}</span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'16px'}}>
                            {[
                              { label: 'Cursos', value: prog.total_cursos || 0 },
                              { label: 'Docentes', value: prog.total_docentes || 0 },
                              { label: 'Ciclo', value: prog.ciclo_nombre },
                            ].map((s, i) => (
                              <div key={i} style={{background:'var(--bg-card-hover)',borderRadius:'8px',padding:'12px',textAlign:'center',border:'1px solid var(--border-color)'}}>
                                <p style={{fontSize:'18px',fontWeight:'700',color:'var(--text-primary)',margin:'0 0 2px'}}>{s.value}</p>
                                <p style={{fontSize:'11px',color:'var(--text-secondary)',margin:0}}>{s.label}</p>
                              </div>
                            ))}
                          </div>

                          {/* Acciones (solo Restaurar) */}
                          <div style={{display:'flex',gap:'10px',alignItems:'center',justifyContent:'flex-end'}}>
                            {canEdit && (
                              <button className="btn-primary" style={{padding:'6px 14px',fontSize:'13px'}} onClick={() => setRestaurandoId(prog.id)}>
                                🔄 Restaurar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {vista === 'horario' && (
        <GrillaHorarios asignaciones={asignaciones} slots={slots} restringidosConfig={restringidosConfig} hideDocenteFilter={isDocente} />
      )}

      {/* ===== VISTA: MI HORARIO (solo docentes) ===== */}
      {vista === 'mi-horario' && isDocente && (
        <div>
          {loadingMiHorario ? (
            <p style={{textAlign:'center',padding:'40px',color:'var(--text-secondary)'}}>Cargando mi horario...</p>
          ) : miHorario.length === 0 ? (
            <div className="card" style={{padding:'32px',textAlign:'center'}}>
              <p style={{color:'#94a3b8',fontSize:'14px'}}>No tienes clases asignadas en el horario publicado de este ciclo.</p>
            </div>
          ) : (
            <GrillaHorarios asignaciones={miHorario} slots={slots} restringidosConfig={restringidosConfig} hideDocenteFilter />
          )}
        </div>
      )}

      {/* Modal: Crear programación */}
      {showCrear && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCrear(false)}>
          <div className="modal" style={{maxWidth:'480px'}}>
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Nueva programación de horario</h2>
              <button onClick={() => setShowCrear(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && msg.type === 'error' && <div className="alert alert-error">{msg.text}</div>}
              <div className="alert alert-info">
                Se creará una nueva programación para el ciclo seleccionado. El nombre se generará automáticamente (ej: "HORARIO 2024-II").
              </div>
              <div className="form-group">
                <label className="form-label">Ciclo académico</label>
                <select className="form-input" value={cicloId} onChange={e => setCicloId(e.target.value)}>
                  {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.activo ? '(Activo)' : ''}</option>)}
                </select>
              </div>
              <div style={{background:'var(--bg-card-hover)',borderRadius:'8px',padding:'16px',border:'1px solid var(--border-color)'}}>
                <h4 style={{fontSize:'14px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 8px'}}>Flujo de trabajo:</h4>
                {[1,2,3,4].map(f => {
                  const fi = getFaseInfo(f, darkMode);
                  return (
                    <div key={f} style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0'}}>
                      <span style={{fontSize:'14px'}}>{fi.icon}</span>
                      <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Fase {f}: {fi.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCrear(false)}>Cancelar</button>
              <button className="btn-primary" onClick={crearProgramacion} disabled={creando}>
                {creando ? 'Creando...' : '📋 Crear programación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar cancelación */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDeleteModal(null)}>
          <div className="modal" style={{maxWidth:'420px'}}>
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>¿Cancelar programación?</h2>
              <button onClick={() => setShowDeleteModal(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                Esta acción cancelará la programación. Los datos no se eliminarán pero no podrá continuar el flujo de creación.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(null)}>Volver</button>
              <button className="btn-danger" onClick={cancelarProgramacion}>Sí, cancelar programación</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar restauración */}
      {restaurandoId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setRestaurandoId(null)}>
          <div className="modal" style={{maxWidth:'420px'}}>
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>¿Restaurar programación?</h2>
              <button onClick={() => setRestaurandoId(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                Esta acción restaurará la programación, permitiendo continuar con el flujo de creación.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setRestaurandoId(null)}>Volver</button>
              <button className="btn-primary" onClick={restaurarProgramacion}>Sí, restaurar programación</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Configurar Horarios Restringidos */}
      {showConfigRestringidos && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConfigRestringidos(false)}>
          <div className="modal" style={{maxWidth:'500px', width:'90%'}}>
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Configurar Horarios Restringidos</h2>
              <button onClick={() => setShowConfigRestringidos(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:'13px', color:'var(--text-secondary)', marginBottom:'16px'}}>
                Seleccione los bloques horarios en los que <strong style={{color:'var(--text-primary)'}}>no se podrán</strong> programar clases (ej. refrigerio o almuerzo).
              </p>
              
              <div style={{display:'flex', flexDirection:'column', gap:'12px', maxHeight:'300px', overflowY:'auto', paddingRight:'6px'}}>
                {slots.map(s => {
                  const isChecked = tempRestringidos[s.id] !== undefined;
                  const msgValue = tempRestringidos[s.id] ?? 'HORA LIBRE (REFRIGERIO)';
                  return (
                    <div key={s.id} style={{
                      display:'flex', flexDirection:'column', gap:'8px',
                      padding:'10px 12px', border:'1px solid var(--border-color)',
                      borderRadius:'8px', background: isChecked ? 'rgba(239, 68, 68, 0.02)' : 'var(--bg-card)',
                      transition:'all 0.2s', borderLeft: isChecked ? '4px solid #ef4444' : '1px solid var(--border-color)'
                    }}>
                      <div style={{display:'flex', alignItems:'center', justifyContent: 'space-between', width:'100%'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}} onClick={() => {
                          if (isChecked) {
                            setTempRestringidos(prev => {
                              const next = { ...prev };
                              delete next[s.id];
                              return next;
                            });
                          } else {
                            setTempRestringidos(prev => ({ ...prev, [s.id]: 'HORA LIBRE (REFRIGERIO)' }));
                          }
                        }}>
                          <span style={{fontSize:'16px'}}>{isChecked ? '🚫' : '🕒'}</span>
                          <div>
                            <p style={{margin:0, fontWeight:'600', fontSize:'14px', color:'var(--text-primary)'}}>{s.nombre}</p>
                            <p style={{margin:0, fontSize:'12px', color:'var(--text-secondary)'}}>{s.hora_inicio.substring(0,5)} - {s.hora_fin.substring(0,5)}</p>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          style={{width:'18px', height:'18px', cursor:'pointer'}}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempRestringidos(prev => ({ ...prev, [s.id]: 'HORA LIBRE (REFRIGERIO)' }));
                            } else {
                              setTempRestringidos(prev => {
                                const next = { ...prev };
                                delete next[s.id];
                                return next;
                              });
                            }
                          }}
                        />
                      </div>
                      {isChecked && (
                        <div style={{marginTop:'4px'}}>
                          <label style={{fontSize:'11px', color:'var(--text-secondary)', display:'block', marginBottom:'4px'}}>Mensaje personalizado:</label>
                          <input 
                            type="text"
                            className="form-input"
                            style={{width:'100%', padding:'6px 10px', fontSize:'13px', borderRadius:'6px'}}
                            value={msgValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTempRestringidos(prev => ({ ...prev, [s.id]: val }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer" style={{display:'flex', justifyContent:'flex-end', gap:'10px'}}>
              <button className="btn-secondary" onClick={() => setShowConfigRestringidos(false)}>
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                disabled={guardandoConfig}
                onClick={async () => {
                  setGuardandoConfig(true);
                  try {
                    const res = await fetch('/api/configuracion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        clave: 'HORARIOS_RESTRINGIDOS',
                        valor: JSON.stringify(tempRestringidos)
                      })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    
                    setRestringidosConfig(tempRestringidos);
                    setMsg({ type: 'success', text: 'Horarios restringidos actualizados correctamente' });
                    setShowConfigRestringidos(false);
                    window.location.reload();
                  } catch (e: any) {
                    alert(e.message || 'Error al guardar la configuración');
                  } finally {
                    setGuardandoConfig(false);
                  }
                }}
              >
                {guardandoConfig ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Modal: Importar de Carga Horaria */}
      {showImportModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowImportModal(false), setImportResult(null))}>
          <div className="modal" style={{maxWidth:'520px'}}>
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Importar de Carga Horaria</h2>
              <button onClick={() => { setShowImportModal(false); setImportResult(null); }} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {importResult?.type === 'success' ? (
                <div className="alert alert-success" style={{marginBottom:'0'}}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  <span>{importResult.text}</span>
                </div>
              ) : (
                <>
                  <div className="alert alert-info" style={{marginBottom:'16px'}}>
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Se importarán los datos de Carga Horaria a la programación seleccionada.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Período origen (Carga Horaria)</label>
                    <select className="form-input" value={importSourceCicloId} onChange={e => setImportSourceCicloId(e.target.value)}>
                      <option value="">Seleccione un período...</option>
                      {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  {importSourceCicloId && (
                    <div className="form-group">
                      <label className="form-label">Ciclos de estudio a importar</label>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
                        {Array.from({length:10}, (_, i) => i + 1).map(cp => {
                          const roman = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][cp - 1];
                          const count = cargaHorariaResumen[cp] || 0;
                          const checked = selectedCiclosPlan.has(cp);
                          return (
                            <label key={cp} style={{
                              display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',
                              borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'500',
                              background:checked?'#1a3a5c':'var(--bg-secondary)',
                              color:checked?'white':'var(--text-primary)',
                              border:'1px solid',borderColor:checked?'#1a3a5c':'var(--border-color)',
                              opacity:count === 0 ? 0.4 : 1,
                              pointerEvents: count === 0 ? 'none' as const : undefined,
                            }}>
                              <input type="checkbox" checked={checked}
                                onChange={() => {
                                  const next = new Set(selectedCiclosPlan);
                                  if (next.has(cp)) next.delete(cp); else next.add(cp);
                                  setSelectedCiclosPlan(next);
                                }}
                                style={{accentColor:'#2563eb',display:'none'}} />
                              {roman} {count > 0 && <span style={{fontSize:'11px',opacity:0.7}}>({count})</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Programación destino</label>
                    <select className="form-input" value={importProgId} onChange={e => setImportProgId(e.target.value)}>
                      <option value="" disabled>Seleccione una programación...</option>
                      {programaciones.filter(p => p.estado !== 'cancelado' && p.estado !== 'publicado').map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} — Fase {p.fase} ({p.ciclo_nombre})</option>
                      ))}
                    </select>
                  </div>
                  {programaciones.filter(p => p.estado !== 'cancelado' && p.estado !== 'publicado').length === 0 && (
                    <div className="alert alert-warning">
                      No hay programaciones activas disponibles para importar. Cree una nueva programación primero.
                    </div>
                  )}
                  {importResult?.type === 'error' && (
                    <div className="alert alert-error" style={{marginTop:'12px'}}>{importResult.text}</div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {importResult?.type === 'success' ? (
                <button className="btn-primary" onClick={() => { setShowImportModal(false); setImportResult(null); }}>Cerrar</button>
              ) : (
                <>
                  <button className="btn-secondary" onClick={() => { setShowImportModal(false); setImportResult(null); }}>Cancelar</button>
                  <button className="btn-primary" style={{background:'#059669',borderColor:'#047857'}}
                    disabled={importing || !importProgId || !importSourceCicloId || selectedCiclosPlan.size === 0}
                    onClick={() => {
                      if (!importSourceCicloId) setImportResult({ type: 'error', text: 'Seleccione un período origen' });
                      else if (!importProgId) setImportResult({ type: 'error', text: 'Seleccione una programación destino' });
                      else if (selectedCiclosPlan.size === 0) setImportResult({ type: 'error', text: 'Seleccione al menos un ciclo de estudio' });
                      else importarCargaHoraria(importProgId);
                    }}>
                    {importing ? (
                      <><span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 0.6s linear infinite'}}></span> Importando...</>
                    ) : (
                      <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg> Importar</>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
