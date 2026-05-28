'use client';
import { useState, useEffect, useCallback } from 'react';
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
    borrador: { bg: darkMode ? 'rgba(148,163,184,0.12)' : '#f1f5f9', color: darkMode ? '#cbd5e1' : '#475569' },
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
  const [msg, setMsg] = useState<any>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string|null>(null);

  const user = useUser();
  const isAdminOrSec = user?.rol === 'admin' || user?.rol === 'secretaria';
  const isDocente = user?.rol === 'docente';
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
    ]).then(([ciclosRes, docRes, ambRes, dashRes]) => {
      setCiclos(ciclosRes.data || []);
      setDocentes(docRes.data || []);
      setAmbientes(ambRes.data || []);
      setSlots(dashRes.slots || []);
      const activo = ciclosRes.data?.find((c: any) => c.activo);
      if (activo) setCicloId(activo.id);
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
  const cargarHorario = useCallback(() => {
    if (!cicloId) return;
    fetch(`/api/horarios?ciclo_id=${cicloId}`)
      .then(r => r.json())
      .then(async d => {
        let data = d.data || [];
        if (data.length === 0) {
          const progsRes = await fetch(`/api/horarios/programaciones?ciclo_id=${cicloId}`).then(r => r.json());
          const progs = progsRes.data || [];
          const selectedProg = progs.find((p: any) => p.estado === 'publicado') || progs[0];
          if (selectedProg) {
            const exportRes = await fetch(`/api/horarios/programaciones/${selectedProg.id}/exportar`);
            if (exportRes.ok) {
              const exportData = await exportRes.json();
              const slotByTime = new Map(
                (slots || []).map((s: any) => [`${s.hora_inicio}-${s.hora_fin}`, s])
              );
              const ambienteByCodigo = new Map(
                (ambientes || []).map((a: any) => [a.codigo, a])
              );
              data = (exportData.asignaciones || []).map((a: any) => ({
                id: a.id,
                dia: a.dia,
                slot_id: a.slot_id || slotByTime.get(`${a.hora_inicio}-${a.hora_fin}`)?.id || null,
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
              }));
            }
          }
        }
        setAsignaciones(data);
      });
  }, [cicloId]);

  useEffect(() => { if (vista === 'horario') cargarHorario(); }, [vista, cargarHorario]);

  // Cargar horario personal del docente si está logueado como docente
  useEffect(() => {
    if (!isDocente || !cicloId) return;
    setLoadingMiHorario(true);
    fetch(`/api/horarios?ciclo_id=${cicloId}&docente_id=${user?.id}`)
      .then(r => r.json())
      .then(d => setMiHorario(d.data || []))
      .finally(() => setLoadingMiHorario(false));
  }, [isDocente, cicloId, user?.id]);


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
      // Redirigir al wizard
      window.location.href = `/horarios/crear?id=${data.data.id}`;
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

  return (
    <div className="horarios-index-page" style={{padding:'32px', color: darkMode ? 'var(--text-primary)' : 'var(--text-primary)'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px', color:'var(--text-primary)'}}>Horarios</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Gestión de horarios académicos por fases</p>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid var(--border-color)'}}>
            {!isDocente && (
              <button
                style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',background:vista==='programaciones'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='programaciones'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                onClick={() => setVista('programaciones')}
              >📋 Programaciones</button>
            )}
            {isDocente && (
              <>
                <button
                  style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',background:vista==='programaciones'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='programaciones'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                  onClick={() => setVista('programaciones')}
                >📋 Mis Programaciones (Disponibilidad)</button>
                <button
                  style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',borderLeft:'1px solid var(--border-color)',background:vista==='mi-horario'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='mi-horario'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
                  onClick={() => setVista('mi-horario')}
                >👤 Mi Horario</button>
              </>
            )}
            <button
              style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',borderLeft:'1px solid var(--border-color)',background:vista==='horario'?(darkMode ? 'rgba(59,130,246,0.18)' : '#1a3a5c'):'var(--bg-card)',color:vista==='horario'?(darkMode ? '#bfdbfe' : 'white'):'var(--text-secondary)'}}
              onClick={() => setVista('horario')}
            >📅 Horario General</button>
          </div>
          {vista === 'programaciones' && isAdminOrSec && (
            <button className="btn-primary" onClick={() => setShowCrear(true)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Nueva programación
            </button>
          )}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Selector de ciclo */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'end'}}>
          <div className="form-group" style={{margin:0,minWidth:'200px'}}>
            <label className="form-label">Ciclo académico</label>
            <select className="form-input" value={cicloId} onChange={e => setCicloId(e.target.value)}>
              {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.activo ? '(Activo)' : ''}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ===== VISTA: PROGRAMACIONES ===== */}
      {vista === 'programaciones' && (
        <div>
          {programaciones.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:'60px 24px'}}>
              <div style={{fontSize:'48px',marginBottom:'12px',opacity:0.4}}>📋</div>
              <h3 style={{fontSize:'18px',fontWeight:'600',color:'var(--text-primary)',margin:'0 0 8px'}}>No hay programaciones para este ciclo</h3>
              <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:'0 0 20px'}}>Crea una nueva programación para comenzar el proceso de asignación de horarios.</p>
              {isAdminOrSec && (
                <button className="btn-primary" onClick={() => setShowCrear(true)}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Crear programación
                </button>
              )}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
              {programaciones.map(prog => {
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
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'16px'}}>
                        {[
                          { label: 'Cursos', value: prog.total_cursos || 0, color: darkMode ? '#93c5fd' : '#1a3a5c' },
                          { label: 'Docentes', value: prog.total_docentes || 0, color: darkMode ? '#6ee7b7' : '#065f46' },
                          { label: 'Fase actual', value: `${prog.fase}/4`, color: darkMode ? '#fcd34d' : '#92400e' },
                          { label: 'Ciclo', value: prog.ciclo_nombre, color: darkMode ? '#c4b5fd' : '#6b21a8' },
                        ].map((s, i) => (
                          <div key={i} style={{background:'var(--bg-card-hover)',borderRadius:'8px',padding:'12px',textAlign:'center',border:'1px solid var(--border-color)'}}>
                            <p style={{fontSize:'18px',fontWeight:'700',color:s.color,margin:'0 0 2px'}}>{s.value}</p>
                            <p style={{fontSize:'11px',color:'var(--text-secondary)',margin:0}}>{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Fases timeline */}
                      <div style={{display:'flex',gap:'0',marginBottom:'16px'}}>
                        {[1,2,3,4].map(f => {
                          const fi = getFaseInfo(f, darkMode);
                          const activa = f === prog.fase;
                          const completada = f < prog.fase;
                          return (
                            <div key={f} style={{flex:1,display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',borderRadius:f===1?'8px 0 0 8px':f===4?'0 8px 8px 0':'0',background:activa?fi.bg:completada?(darkMode ? 'rgba(16,185,129,0.16)' : '#f0fdf4'):'var(--bg-card-hover)',borderRight:f<4?'1px solid var(--border-color)':'none'}}>
                              <span style={{fontSize:'14px'}}>{completada ? '✅' : activa ? fi.icon : '○'}</span>
                              <span style={{fontSize:'11px',fontWeight:activa?'600':'400',color:activa?fi.color:(darkMode ? '#bbf7d0' : '#94a3b8')}}>{fi.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Acciones */}
                      <div style={{display:'flex',gap:'10px',alignItems:'center',justifyContent:'flex-end'}}>
                        {prog.estado !== 'publicado' && prog.estado !== 'cancelado' && isAdminOrSec && (
                          <button className="btn-danger" style={{padding:'6px 14px',fontSize:'13px'}} onClick={() => setShowDeleteModal(prog.id)}>
                            Cancelar
                          </button>
                        )}

                        {(prog.fase === 4 || prog.estado === 'publicado') && (
                          <>
                            <BotonExportarFormatoUNT programacionId={prog.id} />
                            <BotonExportarExcel programacionId={prog.id} variant="icon" />
                          </>
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

      {vista === 'horario' && (
        <GrillaHorarios asignaciones={asignaciones} slots={slots} />
      )}

      {/* ===== VISTA: MI HORARIO (solo docentes) ===== */}
      {vista === 'mi-horario' && isDocente && (
        <div className="card" style={{padding:'16px',overflowX:'auto'}}>
          <div style={{marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3 style={{fontSize:'18px',fontWeight:'600',color:'var(--text-primary)',margin:0}}>Mi Horario Asignado</h3>
            <span style={{background:'rgba(34,197,94,0.14)',color:'var(--text-primary)',padding:'4px 12px',borderRadius:'9999px',fontSize:'12px',fontWeight:'600',border:'1px solid var(--border-color)'}}>
              Total: {miHorario.length} horas
            </span>
          </div>
          {loadingMiHorario ? (
            <p style={{textAlign:'center',padding:'40px',color:'var(--text-secondary)'}}>Cargando mi horario...</p>
          ) : (
            <div className="horario-grid" style={{minWidth:'900px'}}>
              <div className="horario-header">Hora</div>
              {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
              {slots.map((slot: any) => (
                <div key={slot.id} style={{display:'contents'}}>
                  <div className="horario-time">{slot.hora_inicio}<br/>{slot.hora_fin}</div>
                  {DIAS.map(dia => {
                    const cells = miHorario.filter((a: any) => a.dia === dia && a.slot_id === slot.id);
                    return (
                      <div key={`${dia}-${slot.id}`} className="horario-cell">
                        {cells.map(c => (
                          <div key={c.id} className={`block-${c.tipo}`} style={{marginBottom:'2px',cursor:'pointer'}} title={`${c.curso_nombre}\nG${c.numero_grupo}\n${c.ambiente_nombre}`}>
                            <div style={{fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'11px'}}>{c.curso_codigo} - G{c.numero_grupo}</div>
                            <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'10px'}}>{c.ambiente_codigo} ({c.tipo.substring(0,3).toUpperCase()})</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {!loadingMiHorario && miHorario.length === 0 && (
            <p style={{textAlign:'center',padding:'40px',color:'#94a3b8',fontSize:'14px'}}>No tienes clases asignadas en el horario publicado de este ciclo.</p>
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
    </div>
  );
}
