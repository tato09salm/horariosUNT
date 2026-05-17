'use client';
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/app/(app)/layout';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_LABEL: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miérc.',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

const FASE_INFO: Record<number, { label: string; color: string; bg: string; icon: string }> = {
  1: { label: 'Carga de Información', color: '#1e40af', bg: '#dbeafe', icon: '📋' },
  2: { label: 'Disponibilidad Docente', color: '#065f46', bg: '#d1fae5', icon: '🕐' },
  3: { label: 'Programación', color: '#92400e', bg: '#fef3c7', icon: '⚡' },
  4: { label: 'Publicado', color: '#166534', bg: '#dcfce7', icon: '✅' },
};

const ESTADO_STYLES: Record<string, { bg: string; color: string }> = {
  borrador: { bg: '#f1f5f9', color: '#475569' },
  en_disponibilidad: { bg: '#dbeafe', color: '#1e40af' },
  en_programacion: { bg: '#fef3c7', color: '#92400e' },
  publicado: { bg: '#dcfce7', color: '#166534' },
  cancelado: { bg: '#fee2e2', color: '#991b1b' },
};

export default function HorariosPage() {
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [programaciones, setProgramaciones] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<'programaciones'|'horario'>('programaciones');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroAmbiente, setFiltroAmbiente] = useState('');
  const [msg, setMsg] = useState<any>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [creando, setCreando] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string|null>(null);

  const user = useUser();
  const isAdminOrSec = user?.rol === 'admin' || user?.rol === 'secretaria';

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
    const q = new URLSearchParams({ ciclo_id: cicloId });
    if (filtroDocente) q.set('docente_id', filtroDocente);
    if (filtroAmbiente) q.set('ambiente_id', filtroAmbiente);
    fetch(`/api/horarios?${q}`).then(r => r.json()).then(d => setAsignaciones(d.data || []));
  }, [cicloId, filtroDocente, filtroAmbiente]);

  useEffect(() => { if (vista === 'horario') cargarHorario(); }, [vista, cargarHorario]);

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
    <div style={{padding:'32px'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Horarios</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Gestión de horarios académicos por fases</p>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #e2e8f0'}}>
            <button
              style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',background:vista==='programaciones'?'#1a3a5c':'white',color:vista==='programaciones'?'white':'#475569'}}
              onClick={() => setVista('programaciones')}
            >📋 Programaciones</button>
            <button
              style={{padding:'8px 16px',fontSize:'13px',fontWeight:'500',border:'none',cursor:'pointer',borderLeft:'1px solid #e2e8f0',background:vista==='horario'?'#1a3a5c':'white',color:vista==='horario'?'white':'#475569'}}
              onClick={() => setVista('horario')}
            >📅 Horario Publicado</button>
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
          {vista === 'horario' && (
            <>
              <div className="form-group" style={{margin:0,flex:1}}>
                <label className="form-label">Filtrar docente</label>
                <select className="form-input" value={filtroDocente} onChange={e => setFiltroDocente(e.target.value)}>
                  <option value="">Todos los docentes</option>
                  {docentes.map(d => <option key={d.id} value={d.id}>{d.apellidos}, {d.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{margin:0,flex:1}}>
                <label className="form-label">Filtrar ambiente</label>
                <select className="form-input" value={filtroAmbiente} onChange={e => setFiltroAmbiente(e.target.value)}>
                  <option value="">Todos los ambientes</option>
                  {ambientes.map(a => <option key={a.id} value={a.id}>{a.codigo} - {a.nombre}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== VISTA: PROGRAMACIONES ===== */}
      {vista === 'programaciones' && (
        <div>
          {programaciones.length === 0 ? (
            <div className="card" style={{textAlign:'center',padding:'60px 24px'}}>
              <div style={{fontSize:'48px',marginBottom:'12px',opacity:0.4}}>📋</div>
              <h3 style={{fontSize:'18px',fontWeight:'600',color:'#475569',margin:'0 0 8px'}}>No hay programaciones para este ciclo</h3>
              <p style={{color:'#94a3b8',fontSize:'14px',margin:'0 0 20px'}}>Crea una nueva programación para comenzar el proceso de asignación de horarios.</p>
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
                const faseInfo = FASE_INFO[prog.fase] || FASE_INFO[1];
                const estadoStyle = ESTADO_STYLES[prog.estado] || ESTADO_STYLES.borrador;
                return (
                  <div key={prog.id} className="card" style={{padding:0,overflow:'hidden'}}>
                    {/* Barra de progreso de fases */}
                    <div style={{display:'flex',height:'4px'}}>
                      {[1,2,3,4].map(f => (
                        <div key={f} style={{flex:1,background:f <= prog.fase ? '#1a3a5c' : '#e2e8f0',transition:'background 0.3s'}} />
                      ))}
                    </div>
                    <div style={{padding:'20px 24px'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                          <div style={{fontSize:'24px'}}>{faseInfo.icon}</div>
                          <div>
                            <h3 style={{fontSize:'18px',fontWeight:'700',color:'#1e293b',margin:'0 0 2px'}}>{prog.nombre}</h3>
                            <p style={{fontSize:'13px',color:'#64748b',margin:0}}>
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
                          { label: 'Cursos', value: prog.total_cursos || 0, color: '#1a3a5c' },
                          { label: 'Docentes', value: prog.total_docentes || 0, color: '#065f46' },
                          { label: 'Fase actual', value: `${prog.fase}/4`, color: '#92400e' },
                          { label: 'Ciclo', value: prog.ciclo_nombre, color: '#6b21a8' },
                        ].map((s, i) => (
                          <div key={i} style={{background:'#f8fafc',borderRadius:'8px',padding:'12px',textAlign:'center'}}>
                            <p style={{fontSize:'18px',fontWeight:'700',color:s.color,margin:'0 0 2px'}}>{s.value}</p>
                            <p style={{fontSize:'11px',color:'#64748b',margin:0}}>{s.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Fases timeline */}
                      <div style={{display:'flex',gap:'0',marginBottom:'16px'}}>
                        {[1,2,3,4].map(f => {
                          const fi = FASE_INFO[f];
                          const activa = f === prog.fase;
                          const completada = f < prog.fase;
                          return (
                            <div key={f} style={{flex:1,display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px',borderRadius:f===1?'8px 0 0 8px':f===4?'0 8px 8px 0':'0',background:activa?fi.bg:completada?'#f0fdf4':'#f8fafc',borderRight:f<4?'1px solid #e2e8f0':'none'}}>
                              <span style={{fontSize:'14px'}}>{completada ? '✅' : activa ? fi.icon : '○'}</span>
                              <span style={{fontSize:'11px',fontWeight:activa?'600':'400',color:activa?fi.color:'#94a3b8'}}>{fi.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Acciones */}
                      <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                        {prog.estado !== 'publicado' && prog.estado !== 'cancelado' && isAdminOrSec && (
                          <button className="btn-danger" style={{padding:'6px 14px',fontSize:'13px'}} onClick={() => setShowDeleteModal(prog.id)}>
                            Cancelar
                          </button>
                        )}
                        <a href={getFaseUrl(prog)} style={{textDecoration:'none'}}>
                          <button className="btn-primary" style={{padding:'6px 14px',fontSize:'13px'}}>
                            {prog.estado === 'publicado' ? 'Ver horario' : `Continuar Fase ${prog.fase}`} →
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

      {/* ===== VISTA: HORARIO PUBLICADO (grid) ===== */}
      {vista === 'horario' && (
        <div className="card" style={{padding:'16px',overflowX:'auto'}}>
          <div className="horario-grid" style={{minWidth:'900px'}}>
            <div className="horario-header">Hora</div>
            {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
            {slots.map((slot: any) => (
              <div key={slot.id} style={{display:'contents'}}>
                <div className="horario-time">{slot.hora_inicio}<br/>{slot.hora_fin}</div>
                {DIAS.map(dia => {
                  const cells = getCell(dia, slot.id);
                  return (
                    <div key={`${dia}-${slot.id}`} className="horario-cell">
                      {cells.map(c => (
                        <div key={c.id} className={`block-${c.tipo}`} style={{marginBottom:'2px',cursor:'pointer'}} title={`${c.curso_nombre}\n${c.docente_nombre}\n${c.ambiente_nombre}`}>
                          <div style={{fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.curso_codigo}</div>
                          <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.ambiente_codigo}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {asignaciones.length === 0 && (
            <p style={{textAlign:'center',padding:'40px',color:'#94a3b8',fontSize:'14px'}}>No hay asignaciones publicadas para este ciclo. Completa el flujo de programación primero.</p>
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
              <div style={{background:'#f8fafc',borderRadius:'8px',padding:'16px'}}>
                <h4 style={{fontSize:'14px',fontWeight:'600',color:'#475569',margin:'0 0 8px'}}>Flujo de trabajo:</h4>
                {[1,2,3,4].map(f => {
                  const fi = FASE_INFO[f];
                  return (
                    <div key={f} style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0'}}>
                      <span style={{fontSize:'14px'}}>{fi.icon}</span>
                      <span style={{fontSize:'13px',color:'#475569'}}>Fase {f}: {fi.label}</span>
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
