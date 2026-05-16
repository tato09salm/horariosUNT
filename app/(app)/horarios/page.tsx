'use client';
import { useState, useEffect, useCallback } from 'react';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_LABEL: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miérc.',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

export default function HorariosPage() {
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [cursos, setCursos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [vista, setVista] = useState<'grid'|'lista'>('grid');
  const [filtroDocente, setFiltroDocente] = useState('');
  const [filtroAmbiente, setFiltroAmbiente] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [form, setForm] = useState<any>({});
  const [autoForm, setAutoForm] = useState<any>({tipo_ambiente_teoria:'aula',tipo_ambiente_lab:'laboratorio'});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/ciclos').then(r=>r.json()).then(d => {
      setCiclos(d.data||[]);
      const activo = d.data?.find((c:any) => c.activo);
      if (activo) setCicloId(activo.id);
    });
    fetch('/api/docentes').then(r=>r.json()).then(d => setDocentes(d.data||[]));
    fetch('/api/aulas').then(r=>r.json()).then(d => setAmbientes(d.data||[]));
    fetch('/api/cursos').then(r=>r.json()).then(d => setCursos(d.data||[]));
    fetch('/api/dashboard').then(r=>r.json()).then(d => setSlots(d.slots||[]));
  }, []);

  const cargarAsignaciones = useCallback(() => {
    if (!cicloId) return;
    setLoading(true);
    const q = new URLSearchParams({ciclo_id:cicloId});
    if (filtroDocente) q.set('docente_id', filtroDocente);
    if (filtroAmbiente) q.set('ambiente_id', filtroAmbiente);
    fetch(`/api/horarios?${q}`).then(r=>r.json()).then(d => setAsignaciones(d.data||[])).finally(() => setLoading(false));
  }, [cicloId, filtroDocente, filtroAmbiente]);

  useEffect(() => { cargarAsignaciones(); }, [cargarAsignaciones]);

  useEffect(() => {
    if (cicloId) {
      fetch(`/api/horarios/grupos?ciclo_id=${cicloId}`).then(r=>r.json()).then(d => setGrupos(d.data||[]));
    }
  }, [cicloId]);

  function getCell(dia: string, slotId: string) {
    return asignaciones.filter(a => a.dia === dia && a.slot_id === slotId);
  }

  async function guardarManual() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/horarios', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...form, ciclo_id: cicloId}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:'Asignación creada correctamente'});
      setShowModal(false);
      cargarAsignaciones();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  async function generarAuto() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/horarios/generar', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({...autoForm, ciclo_id: cicloId}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:`Generación automática: ${data.asignaciones?.length || 0} asignaciones creadas`});
      setShowAutoModal(false);
      cargarAsignaciones();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta asignación?')) return;
    await fetch(`/api/horarios/${id}`, {method:'DELETE'});
    cargarAsignaciones();
  }

  return (
    <div style={{padding:'32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Horarios</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Gestión y visualización de asignaciones</p>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button className="btn-secondary" onClick={() => setShowAutoModal(true)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Generar automático
          </button>
          <button className="btn-primary" onClick={() => { setForm({}); setShowModal(true); setMsg(null); }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Nueva asignación
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr auto',gap:'12px',alignItems:'end'}}>
          <select className="form-input" style={{minWidth:'160px'}} value={cicloId} onChange={e => setCicloId(e.target.value)}>
            {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select className="form-input" value={filtroDocente} onChange={e => setFiltroDocente(e.target.value)}>
            <option value="">Todos los docentes</option>
            {docentes.map(d => <option key={d.id} value={d.id}>{d.apellidos}, {d.nombre}</option>)}
          </select>
          <select className="form-input" value={filtroAmbiente} onChange={e => setFiltroAmbiente(e.target.value)}>
            <option value="">Todos los ambientes</option>
            {ambientes.map(a => <option key={a.id} value={a.id}>{a.codigo} - {a.nombre}</option>)}
          </select>
          <div style={{display:'flex',gap:'6px'}}>
            <button className={vista==='grid'?'btn-primary':'btn-secondary'} style={{padding:'8px 12px'}} onClick={() => setVista('grid')}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
            </button>
            <button className={vista==='lista'?'btn-primary':'btn-secondary'} style={{padding:'8px 12px'}} onClick={() => setVista('lista')}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
      </div>

      {loading && <div style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando horarios...</div>}

      {/* Grid View */}
      {!loading && vista === 'grid' && (
        <div className="card" style={{padding:'16px',overflowX:'auto'}}>
          <div className="horario-grid" style={{minWidth:'900px'}}>
            <div className="horario-header">Hora</div>
            {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
            {slots.map((slot: any) => (
              <>
                <div key={`t-${slot.id}`} className="horario-time">{slot.hora_inicio}<br/>{slot.hora_fin}</div>
                {DIAS.map(dia => {
                  const cells = getCell(dia, slot.id);
                  return (
                    <div key={`${dia}-${slot.id}`} className="horario-cell">
                      {cells.map(c => (
                        <div key={c.id} className={`block-${c.tipo}`} style={{marginBottom:'2px',cursor:'pointer'}} title={`${c.curso_nombre}\n${c.docente_nombre}\n${c.ambiente_nombre}`} onClick={() => eliminar(c.id)}>
                          <div style={{fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.curso_codigo}</div>
                          <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.ambiente_codigo}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
          <p style={{fontSize:'11px',color:'#94a3b8',marginTop:'8px'}}>* Haz clic en un bloque para eliminar la asignación</p>
        </div>
      )}

      {/* Lista View */}
      {!loading && vista === 'lista' && (
        <div className="card" style={{padding:0}}>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Día</th><th>Hora</th><th>Curso</th><th>Docente</th><th>Ambiente</th><th>Tipo</th><th>Grupo</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {asignaciones.length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No hay asignaciones</td></tr>
                ) : asignaciones.map(a => (
                  <tr key={a.id}>
                    <td style={{fontWeight:'500',textTransform:'capitalize'}}>{a.dia}</td>
                    <td style={{fontSize:'12px',color:'#64748b'}}>{a.hora_inicio} - {a.hora_fin}</td>
                    <td>
                      <div style={{fontWeight:'500'}}>{a.curso_nombre}</div>
                      <div style={{fontSize:'11px',color:'#94a3b8'}}>{a.curso_codigo}</div>
                    </td>
                    <td>
                      <div>{a.docente_nombre}</div>
                      <div style={{fontSize:'11px'}}><span className={`badge badge-${a.docente_categoria}`}>{a.docente_categoria}</span></div>
                    </td>
                    <td>
                      <div style={{fontWeight:'500'}}>{a.ambiente_nombre}</div>
                      <div style={{fontSize:'11px'}}><span className={`badge badge-${a.ambiente_tipo}`}>{a.ambiente_tipo}</span></div>
                    </td>
                    <td><span className={`badge badge-${a.tipo}`}>{a.tipo}</span></td>
                    <td style={{textAlign:'center'}}>G{a.numero_grupo}</td>
                    <td>
                      <button className="btn-danger" style={{padding:'4px 10px',fontSize:'12px'}} onClick={() => eliminar(a.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Manual */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Nueva asignación manual</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group">
                  <label className="form-label">Grupo (curso) *</label>
                  <select className="form-input" value={form.grupo_id||''} onChange={e => setForm((p:any) => ({...p,grupo_id:e.target.value}))}>
                    <option value="">Seleccionar grupo...</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>{g.curso_nombre} — G{g.numero_grupo}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Docente *</label>
                  <select className="form-input" value={form.docente_id||''} onChange={e => setForm((p:any) => ({...p,docente_id:e.target.value}))}>
                    <option value="">Seleccionar docente...</option>
                    {docentes.map(d => <option key={d.id} value={d.id}>[{d.categoria}] {d.apellidos}, {d.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ambiente *</label>
                  <select className="form-input" value={form.ambiente_id||''} onChange={e => setForm((p:any) => ({...p,ambiente_id:e.target.value}))}>
                    <option value="">Seleccionar ambiente...</option>
                    {ambientes.map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.nombre} ({a.tipo})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de sesión *</label>
                  <select className="form-input" value={form.tipo||'teoria'} onChange={e => setForm((p:any) => ({...p,tipo:e.target.value}))}>
                    <option value="teoria">Teoría</option>
                    <option value="practica">Práctica</option>
                    <option value="laboratorio">Laboratorio</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Día *</label>
                  <select className="form-input" value={form.dia||''} onChange={e => setForm((p:any) => ({...p,dia:e.target.value}))}>
                    <option value="">Seleccionar día...</option>
                    {DIAS.map(d => <option key={d} value={d}>{DIAS_LABEL[d]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Slot horario *</label>
                  <select className="form-input" value={form.slot_id||''} onChange={e => setForm((p:any) => ({...p,slot_id:e.target.value}))}>
                    <option value="">Seleccionar hora...</option>
                    {slots.map((s:any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarManual} disabled={saving}>{saving?'Guardando...':'Asignar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Auto */}
      {showAutoModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowAutoModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Generación automática por jerarquía</h2>
              <button onClick={() => setShowAutoModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="alert alert-info">
                El sistema asignará automáticamente siguiendo la jerarquía: Nombrados (Principal → Asociado → Auxiliar → Jefe de Práctica) luego Contratados, ordenados por antigüedad dentro de cada categoría.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginTop:'12px'}}>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Grupo (curso) *</label>
                  <select className="form-input" value={autoForm.grupo_id||''} onChange={e => setAutoForm((p:any) => ({...p,grupo_id:e.target.value}))}>
                    <option value="">Seleccionar grupo...</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>{g.curso_nombre} — G{g.numero_grupo} (T:{g.horas_teoria}h P:{g.horas_practica}h)</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo ambiente teoría</label>
                  <select className="form-input" value={autoForm.tipo_ambiente_teoria||'aula'} onChange={e => setAutoForm((p:any) => ({...p,tipo_ambiente_teoria:e.target.value}))}>
                    <option value="aula">Aula</option>
                    <option value="laboratorio">Laboratorio</option>
                    <option value="auditorio">Auditorio</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo ambiente laboratorio</label>
                  <select className="form-input" value={autoForm.tipo_ambiente_lab||'laboratorio'} onChange={e => setAutoForm((p:any) => ({...p,tipo_ambiente_lab:e.target.value}))}>
                    <option value="laboratorio">Laboratorio</option>
                    <option value="aula">Aula</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAutoModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={generarAuto} disabled={saving || !autoForm.grupo_id}>
                {saving ? 'Generando...' : '⚡ Generar automáticamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
