'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

const FASE_INFO: Record<number, { label: string; icon: string }> = {
  1: { label: 'Carga de Información', icon: '📋' },
  2: { label: 'Disponibilidad Docente', icon: '🕐' },
  3: { label: 'Programación', icon: '⚡' },
  4: { label: 'Publicado', icon: '✅' },
};

export default function CrearHorarioPage() {
  const searchParams = useSearchParams();
  const progId = searchParams.get('id');

  const [prog, setProg] = useState<any>(null);
  const [cursos, setCursos] = useState<any[]>([]);
  const [cargaDocentes, setCargaDocentes] = useState<any[]>([]);
  const [catalogoCursos, setCatalogoCursos] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<any>({});
  const [lastSaved, setLastSaved] = useState<Date|null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout|null>(null);

  // Cargar datos
  const cargarDatos = useCallback(async () => {
    if (!progId) return;
    setLoading(true);
    try {
      const [progRes, cursosRes, catRes, docRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetch(`/api/horarios/programaciones/${progId}/cursos`).then(r => r.json()),
        fetch('/api/cursos').then(r => r.json()),
        fetch('/api/docentes').then(r => r.json()),
      ]);
      setProg(progRes.data);
      setCursos(cursosRes.data || []);
      setCargaDocentes(cursosRes.cargaDocentes || []);
      setCatalogoCursos(catRes.data || []);
      setDocentes(docRes.data || []);

      // Cargar grupos del ciclo
      if (progRes.data?.ciclo_id) {
        const grpRes = await fetch(`/api/horarios/grupos?ciclo_id=${progRes.data.ciclo_id}`).then(r => r.json());
        setGrupos(grpRes.data || []);
      }
    } finally { setLoading(false); }
  }, [progId]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // Auto-save config cada 30 segundos
  useEffect(() => {
    if (!prog || prog.fase !== 1) return;
    autoSaveRef.current = setInterval(async () => {
      try {
        await fetch(`/api/horarios/programaciones/${progId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: prog.config }),
        });
        setLastSaved(new Date());
      } catch (e) { /* silencioso */ }
    }, 30000);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [prog, progId]);

  // Agregar curso
  async function agregarCurso() {
    if (!addForm.curso_id || !addForm.grupo_id) {
      setMsg({ type: 'error', text: 'Selecciona un curso y un grupo' });
      return;
    }
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}/cursos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'Curso agregado correctamente' });
      setShowAddModal(false);
      setAddForm({});
      cargarDatos();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setSaving(false); }
  }

  // Eliminar curso
  async function eliminarCurso(pcId: string) {
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}/cursos?pc_id=${pcId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setMsg({ type: 'success', text: 'Curso removido' });
      cargarDatos();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  }

  // Importar CSV
  async function handleImportCSV(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/horarios/programaciones/${progId}/csv`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: `Importación CSV: ${data.importados} cursos importados. ${data.errores.length > 0 ? `Se encontraron ${data.errores.length} errores (ver consola).` : ''}` });
      if (data.errores.length > 0) {
        console.warn('Errores de importación CSV:', data.errores);
      }
      cargarDatos();
    } catch (error: any) {
      setMsg({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
      e.target.value = null;
    }
  }

  // Avanzar a Fase 2
  async function avanzarFase() {
    if (cursos.length === 0) {
      setMsg({ type: 'error', text: 'Agrega al menos un curso antes de avanzar a la Fase 2' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 2 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = `/horarios/${progId}/disponibilidad`;
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    finally { setSaving(false); }
  }

  // Cuando se selecciona un curso, auto-rellenar horas
  function handleCursoChange(cursoId: string) {
    const curso = catalogoCursos.find(c => c.id === cursoId);
    setAddForm((p: any) => ({
      ...p,
      curso_id: cursoId,
      horas_teoria: curso?.horas_teoria || 0,
      horas_practica: curso?.horas_practica || 0,
      horas_laboratorio: 0,
      horas_consejeria: 0,
    }));
  }

  if (loading) return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <div style={{width:'40px',height:'40px',border:'3px solid #e2e8f0',borderTop:'3px solid #1a3a5c',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 12px'}} />
      <p style={{color:'#64748b'}}>Cargando programación...</p>
    </div>
  );

  if (!prog) return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <p style={{color:'#991b1b',fontSize:'16px'}}>Programación no encontrada</p>
      <a href="/horarios" style={{color:'#1a3a5c',fontSize:'14px'}}>← Volver a Horarios</a>
    </div>
  );

  // Total de horas cargadas
  const totalHoras = cursos.reduce((s, c) => s + (c.horas_teoria||0) + (c.horas_practica||0) + (c.horas_laboratorio||0), 0);
  const totalConsejeria = cursos.reduce((s, c) => s + (c.horas_consejeria||0), 0);

  return (
    <div style={{padding:'32px'}}>
      {/* Header con breadcrumb */}
      <div style={{marginBottom:'8px'}}>
        <a href="/horarios" style={{fontSize:'13px',color:'#64748b',textDecoration:'none'}}>← Volver a Horarios</a>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>{prog.nombre}</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>
            Fase 1: Carga de Información — {prog.ciclo_nombre}
            {lastSaved && <span style={{marginLeft:'12px',fontSize:'12px',color:'#94a3b8'}}>Guardado: {lastSaved.toLocaleTimeString('es-PE')}</span>}
          </p>
        </div>
        <button className="btn-primary" onClick={avanzarFase} disabled={saving || cursos.length === 0}>
          {saving ? 'Avanzando...' : 'Avanzar a Fase 2 →'}
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Fases timeline */}
      <div style={{display:'flex',gap:'0',marginBottom:'24px',borderRadius:'10px',overflow:'hidden',border:'1px solid #e2e8f0'}}>
        {[1,2,3,4].map(f => {
          const fi = FASE_INFO[f];
          const activa = f === prog.fase;
          const completada = f < prog.fase;
          return (
            <div key={f} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',padding:'12px',background:activa?'#dbeafe':completada?'#f0fdf4':'#f8fafc',borderRight:f<4?'1px solid #e2e8f0':'none'}}>
              <span style={{fontSize:'16px'}}>{completada ? '✅' : fi.icon}</span>
              <span style={{fontSize:'12px',fontWeight:activa?'700':'400',color:activa?'#1e40af':'#94a3b8'}}>
                Fase {f}: {fi.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {[
          { label: 'Cursos cargados', value: cursos.length, color: '#1a3a5c' },
          { label: 'Horas semanales', value: `${totalHoras}h`, color: '#065f46' },
          { label: 'Hrs consejería', value: `${totalConsejeria}h`, color: '#92400e' },
          { label: 'Docentes asignados', value: cargaDocentes.length, color: '#6b21a8' },
        ].map((s, i) => (
          <div key={i} className="card" style={{padding:'16px',textAlign:'center'}}>
            <p style={{fontSize:'24px',fontWeight:'700',color:s.color,margin:'0 0 4px'}}>{s.value}</p>
            <p style={{fontSize:'12px',color:'#64748b',margin:0}}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'16px'}}>
        {/* Tabla de cursos */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:0}}>Cursos en la programación</h3>
            <div style={{display:'flex',gap:'10px'}}>
              <label className="btn-secondary" style={{padding:'6px 14px',fontSize:'13px',cursor:'pointer'}}>
                📥 Importar CSV
                <input type="file" accept=".csv" style={{display:'none'}} onChange={handleImportCSV} disabled={saving} />
              </label>
              <button className="btn-primary" style={{padding:'6px 14px',fontSize:'13px'}} onClick={() => { setAddForm({}); setShowAddModal(true); setMsg(null); }} disabled={saving}>
                + Agregar curso
              </button>
            </div>
          </div>
          <div className="card" style={{padding:0}}>
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Código</th><th>Curso</th><th>Grupo</th><th>Docente</th><th>T</th><th>P</th><th>L</th><th>C</th><th></th></tr>
                </thead>
                <tbody>
                  {cursos.length === 0 ? (
                    <tr><td colSpan={9} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No hay cursos. Agrega cursos del catálogo o importa desde CSV.</td></tr>
                  ) : cursos.map(c => (
                    <tr key={c.id}>
                      <td style={{fontWeight:'600',color:'#475569',fontFamily:'monospace',fontSize:'12px'}}>{c.curso_codigo}</td>
                      <td style={{fontWeight:'500',fontSize:'13px'}}>{c.curso_nombre}</td>
                      <td style={{textAlign:'center'}}><span style={{background:'#f1f5f9',padding:'2px 8px',borderRadius:'6px',fontSize:'12px',fontWeight:'600'}}>G{c.numero_grupo}</span></td>
                      <td>
                        {c.docente_nombre ? (
                          <div>
                            <div style={{fontSize:'13px'}}>{c.docente_nombre}</div>
                            <span className={`badge badge-${c.docente_categoria}`} style={{fontSize:'10px'}}>{c.docente_categoria?.replace('_',' ')}</span>
                          </div>
                        ) : <span style={{color:'#94a3b8',fontSize:'12px'}}>Sin asignar</span>}
                      </td>
                      <td style={{textAlign:'center',fontSize:'13px'}}><span className="badge badge-teoria">{c.horas_teoria}h</span></td>
                      <td style={{textAlign:'center',fontSize:'13px'}}>{c.horas_practica > 0 ? <span className="badge badge-practica">{c.horas_practica}h</span> : '—'}</td>
                      <td style={{textAlign:'center',fontSize:'13px'}}>{c.horas_laboratorio > 0 ? <span className="badge badge-laboratorio">{c.horas_laboratorio}h</span> : '—'}</td>
                      <td style={{textAlign:'center',fontSize:'13px',color:'#64748b'}}>{c.horas_consejeria || 0}h</td>
                      <td>
                        <button className="btn-danger" style={{padding:'4px 10px',fontSize:'11px'}} onClick={() => eliminarCurso(c.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel lateral: Carga docente */}
        <div>
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px'}}>Carga docente</h3>
          <div className="card" style={{padding:'16px'}}>
            {cargaDocentes.length === 0 ? (
              <p style={{color:'#94a3b8',fontSize:'13px',textAlign:'center',padding:'20px 0'}}>Asigna docentes a los cursos para ver la carga</p>
            ) : cargaDocentes.map((d, i) => {
              const porcentaje = d.horas_max_semana > 0 ? (parseInt(d.horas_asignadas) / d.horas_max_semana * 100) : 0;
              const excede = porcentaje > 100;
              return (
                <div key={i} style={{marginBottom:'12px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                    <span style={{fontSize:'13px',color:'#374151',fontWeight:'500',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombre}</span>
                    <span style={{fontSize:'12px',color:excede?'#dc2626':'#64748b',fontWeight:excede?'700':'400',marginLeft:'8px',flexShrink:0}}>
                      {d.horas_asignadas}/{d.horas_max_semana}h
                    </span>
                  </div>
                  <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'6px'}}>
                    <div style={{height:'100%',borderRadius:'9999px',background:excede?'#dc2626':porcentaje>80?'#f59e0b':'#10b981',width:`${Math.min(porcentaje,100)}%`,transition:'width 0.3s'}} />
                  </div>
                  {excede && <p style={{fontSize:'11px',color:'#dc2626',margin:'2px 0 0',fontWeight:'600'}}>⚠ Excede límite</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal: Agregar curso */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Agregar curso a la programación</h2>
              <button onClick={() => setShowAddModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && msg.type === 'error' && <div className="alert alert-error">{msg.text}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Curso del catálogo *</label>
                  <select className="form-input" value={addForm.curso_id || ''} onChange={e => handleCursoChange(e.target.value)}>
                    <option value="">Seleccionar curso...</option>
                    {catalogoCursos.map(c => (
                      <option key={c.id} value={c.id}>[Ciclo {c.ciclo_plan}] {c.codigo} — {c.nombre} (T:{c.horas_teoria}h P:{c.horas_practica}h)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Grupo *</label>
                  <select className="form-input" value={addForm.grupo_id || ''} onChange={e => setAddForm((p: any) => ({...p, grupo_id: e.target.value}))}>
                    <option value="">Seleccionar grupo...</option>
                    {grupos.filter(g => !addForm.curso_id || g.curso_id === addForm.curso_id).map(g => (
                      <option key={g.id} value={g.id}>G{g.numero_grupo} — {g.curso_nombre} ({g.max_alumnos} alumnos)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Docente (opcional)</label>
                  <select className="form-input" value={addForm.docente_id || ''} onChange={e => setAddForm((p: any) => ({...p, docente_id: e.target.value || null}))}>
                    <option value="">Sin asignar aún...</option>
                    {docentes.map(d => (
                      <option key={d.id} value={d.id}>[{d.categoria?.replace('_',' ')}] {d.apellidos}, {d.nombre} (máx {d.horas_max_semana}h)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hrs Teoría/semana</label>
                  <input className="form-input" type="number" min={0} max={20} value={addForm.horas_teoria ?? 0} onChange={e => setAddForm((p: any) => ({...p, horas_teoria: parseInt(e.target.value) || 0}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hrs Práctica/semana</label>
                  <input className="form-input" type="number" min={0} max={20} value={addForm.horas_practica ?? 0} onChange={e => setAddForm((p: any) => ({...p, horas_practica: parseInt(e.target.value) || 0}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hrs Laboratorio/semana</label>
                  <input className="form-input" type="number" min={0} max={20} value={addForm.horas_laboratorio ?? 0} onChange={e => setAddForm((p: any) => ({...p, horas_laboratorio: parseInt(e.target.value) || 0}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hrs Consejería/semana</label>
                  <input className="form-input" type="number" min={0} max={2} value={addForm.horas_consejeria ?? 0} onChange={e => setAddForm((p: any) => ({...p, horas_consejeria: parseInt(e.target.value) || 0}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sección</label>
                  <input className="form-input" placeholder="A, B, C..." value={addForm.seccion || ''} onChange={e => setAddForm((p: any) => ({...p, seccion: e.target.value}))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={agregarCurso} disabled={saving}>
                {saving ? 'Agregando...' : 'Agregar curso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
