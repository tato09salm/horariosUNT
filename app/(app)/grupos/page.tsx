'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@/lib/theme';

interface Grupo {
  id: string; ciclo_id: string; curso_id: string;
  numero_grupo: number; max_alumnos: number; num_alumnos: number;
  ciclo_nombre?: string; curso_codigo?: string; curso_nombre?: string;
}
interface Ciclo { id: string; nombre: string; año: number; semestre: string; }
interface Curso { id: string; codigo: string; nombre: string; }

const emptyGrupo = { ciclo_id:'', curso_id:'', numero_grupo:1, max_alumnos:30, num_alumnos:0 };

export default function GruposPage() {
  const { darkMode } = useTheme();

  // ── Persistir filtro en URL ───────────────────────────────────────────────
  const getParam = (key: string) => typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(key) || '' : '';

  const [filtroCiclo, setFiltroCiclo] = useState(() => getParam('ciclo'));

  useEffect(() => {
    const params = new URLSearchParams();
    if (filtroCiclo) params.set('ciclo', filtroCiclo);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filtroCiclo]);

  const hayFiltrosActivos = !!filtroCiclo;

  function limpiarFiltros() {
    setFiltroCiclo('');
    setPagina(1);
  }

  const [grupos,   setGrupos]   = useState<Grupo[]>([]);
  const [ciclos,   setCiclos]   = useState<Ciclo[]>([]);
  const [cursos,   setCursos]   = useState<Curso[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [pagina,   setPagina]   = useState(1);
  const [total,    setTotal]    = useState(0);
  const limit = 10;

  const [showModal,        setShowModal]        = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [grupoAEliminar,   setGrupoAEliminar]   = useState<{id:string; nombre:string}|null>(null);
  const [editando,         setEditando]         = useState<any>(emptyGrupo);
  const editandoOriginal                        = useRef<any>(emptyGrupo);
  const [saving,           setSaving]           = useState(false);
  const [toast,            setToast]            = useState<{type:string; text:string}|null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const cargarGrupos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroCiclo) params.set('ciclo_id', filtroCiclo);
    params.set('page',  pagina.toString());
    params.set('limit', limit.toString());
    fetch(`/api/horarios/grupos?${params}`)
      .then(r => r.json())
      .then(data => { setGrupos(data.data||[]); setTotal(data.total||0); })
      .catch(() => setToast({ type:'error', text:'Error al cargar grupos. Verifica tu conexión.' }))
      .finally(() => setLoading(false));
  }, [filtroCiclo, pagina]);

  // ── Debounce en carga ─────────────────────────────────────────────────────
  useEffect(() => { const t = setTimeout(cargarGrupos, 400); return () => clearTimeout(t); }, [cargarGrupos]);
  useEffect(() => { setPagina(1); }, [filtroCiclo]);

  useEffect(() => {
    fetch('/api/ciclos').then(r=>r.json()).then(d => setCiclos(d.data||[])).catch(()=>{});
    fetch('/api/cursos').then(r=>r.json()).then(d => setCursos(d.data||[])).catch(()=>{});
  }, []);

  function hayChangios(): boolean {
    return JSON.stringify(editando) !== JSON.stringify(editandoOriginal.current);
  }

  function intentarCerrarModal() {
    if (hayChangios()) setShowCloseConfirm(true);
    else setShowModal(false);
  }

  async function guardar() {
    setSaving(true);
    try {
      if (!editando.ciclo_id) throw new Error('Seleccione un ciclo');
      if (!editando.curso_id) throw new Error('Seleccione un curso');
      if (!editando.numero_grupo || editando.numero_grupo < 1) throw new Error('Número de grupo inválido');
      const method = editando.id ? 'PUT' : 'POST';
      const url    = editando.id ? `/api/horarios/grupos/${editando.id}` : '/api/horarios/grupos';
      const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(editando) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setShowModal(false);
      setToast({ type:'success', text:`Grupo ${editando.id ? 'actualizado' : 'creado'} correctamente` });
      cargarGrupos();
    } catch(e:any) {
      setToast({ type:'error', text: e.message });
    } finally { setSaving(false); }
  }

  async function eliminarGrupo() {
    if (!grupoAEliminar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/horarios/grupos/${grupoAEliminar.id}`, { method:'DELETE' });
      if (!res.ok) throw new Error();
      setShowConfirm(false);
      setGrupoAEliminar(null);
      setToast({ type:'success', text:'Grupo eliminado correctamente' });
      cargarGrupos();
    } catch {
      setToast({ type:'error', text:'Error al eliminar grupo' });
    } finally { setSaving(false); }
  }

  function handleEliminar(grupo: Grupo) {
    setGrupoAEliminar({ id:grupo.id, nombre:`${grupo.curso_codigo||'Curso'} - Grupo ${grupo.numero_grupo}` });
    setShowConfirm(true);
  }

  function nuevo() {
    const base = { ...emptyGrupo };
    setEditando(base);
    editandoOriginal.current = base;
    setShowModal(true);
  }

  function editar(grupo: Grupo) {
    const base = { ...grupo };
    setEditando(base);
    editandoOriginal.current = base;
    setShowModal(true);
  }

  const totalPaginas = Math.ceil(total / limit);

  return (
    <div className="page-container">

      {/* Toast */}
      {toast && (
        <div style={{
          position:'fixed', top:20, right:24, zIndex:9999,
          display:'flex', alignItems:'center', gap:10,
          padding:'12px 18px', borderRadius:12,
          background: toast.type === 'success' ? '#f0fdf4' : '#fff5f5',
          border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: toast.type === 'success' ? '#166534' : '#991b1b',
          fontSize:14, fontWeight:500,
          boxShadow:'0 4px 20px rgba(0,0,0,0.10)',
          animation:'slideIn 0.2s ease',
        }}>
          {toast.type === 'success'
            ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          }
          {toast.text}
        </div>
      )}

      {/* Encabezado */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px'}}>Grupos</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Gestión de grupos por ciclo y curso</p>
        </div>
        <button className="btn-primary" onClick={nuevo}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          <span className="hide-sm">Nuevo grupo</span>
          <span className="show-sm">Nuevo</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
          <select
            className="form-input"
            style={{flex:'0 0 250px'}}
            value={filtroCiclo}
            onChange={e => setFiltroCiclo(e.target.value)}
          >
            <option value="">Todos los ciclos</option>
            {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>

          {/* Botón limpiar */}
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              title="Limpiar filtros"
              style={{
                flexShrink:0, display:'flex', alignItems:'center', gap:6,
                padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight:500,
                border:'1.5px solid #fca5a5', background:'#fff5f5', color:'#991b1b',
                cursor:'pointer', whiteSpace:'nowrap',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Contador resultados */}
        {!loading && hayFiltrosActivos && (
          <p style={{margin:'10px 0 0',fontSize:'13px',color:'var(--text-secondary)'}}>
            {total === 0
              ? 'Sin resultados para los filtros aplicados'
              : <><strong style={{color:'var(--text-primary)'}}>{total}</strong> grupo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</>
            }
          </p>
        )}
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="hide-sm">#</th>
                <th>Ciclo</th>
                <th>Curso</th>
                <th>Grupo</th>
                <th className="hide-sm">Capacidad</th>
                <th className="hide-sm">Matriculados</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : grupos.length === 0 ? (
                <tr><td colSpan={7} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No se encontraron grupos</td></tr>
              ) : grupos.map((g, i) => (
                <tr key={g.id}>
                  <td className="hide-sm" style={{color:'#94a3b8',fontSize:'12px',fontWeight:'600'}}>{(pagina-1)*limit + i+1}</td>
                  <td>{g.ciclo_nombre || '-'}</td>
                  <td>
                    <div style={{fontWeight:'500'}}>{g.curso_codigo || '-'}</div>
                    <div className="hide-sm" style={{fontSize:'12px',color:'#94a3b8'}}>{g.curso_nombre || ''}</div>
                  </td>
                  <td style={{textAlign:'center'}}>
                    <span className="badge" style={{background:darkMode?'rgba(52,211,153,0.2)':'#d1fae5',color:darkMode?'#34d399':'#065f46',padding:'4px 10px',borderRadius:'50%',width:'36px',height:'36px',display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:'700'}}>
                      {g.numero_grupo}
                    </span>
                  </td>
                  <td className="hide-sm" style={{textAlign:'center'}}>{g.max_alumnos}</td>
                  <td className="hide-sm" style={{textAlign:'center'}}>{g.num_alumnos}</td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn-secondary" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => editar(g)}>
                        <span className="hide-sm">Editar</span>
                        <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                      </button>
                      <button className="btn-danger" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => handleEliminar(g)}>
                        <span className="hide-sm">Eliminar</span>
                        <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && total > 0 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderTop:'1px solid '+(darkMode?'#374151':'#e2e8f0')}}>
            <div style={{fontSize:'14px',color:darkMode?'#94a3b8':'#64748b'}}>
              Mostrando{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{(pagina-1)*limit+1}</strong> a{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{Math.min(pagina*limit,total)}</strong> de{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{total}</strong> grupos
            </div>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <button className="btn-secondary" style={{padding:'6px 12px'}} disabled={pagina===1} onClick={() => setPagina(p=>p-1)}>Anterior</button>
              <span style={{fontSize:'14px',fontWeight:'600',color:darkMode?'#00A6FF':'#1e293b',padding:'0 8px'}}>{pagina} / {totalPaginas}</span>
              <button className="btn-secondary" style={{padding:'6px 12px'}} disabled={pagina>=totalPaginas} onClick={() => setPagina(p=>p+1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>{editando.id ? 'Editar grupo' : 'Nuevo grupo'}</h2>
              <button onClick={intentarCerrarModal} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="responsive-grid">
                <div className="form-group">
                  <label className="form-label">Ciclo *</label>
                  <select className="form-input" value={editando.ciclo_id||''} onChange={e => setEditando({...editando, ciclo_id:e.target.value})}>
                    <option value="">Seleccione un ciclo</option>
                    {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Curso *</label>
                  <select className="form-input" value={editando.curso_id||''} onChange={e => setEditando({...editando, curso_id:e.target.value})}>
                    <option value="">Seleccione un curso</option>
                    {cursos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Número de grupo *</label>
                  <input type="number" min="1" className="form-input" value={editando.numero_grupo||1} onChange={e => setEditando({...editando, numero_grupo:parseInt(e.target.value)||1})}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Máx. alumnos</label>
                  <input type="number" className="form-input" value={editando.max_alumnos||30} onChange={e => setEditando({...editando, max_alumnos:parseInt(e.target.value)||0})}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Alumnos inscritos</label>
                  <input type="number" className="form-input" value={editando.num_alumnos||0} onChange={e => setEditando({...editando, num_alumnos:parseInt(e.target.value)||0})}/>
                </div>
              </div>
              <p style={{margin:'16px 0 0',fontSize:'12px',color:'var(--text-secondary)'}}>
                <span style={{color:'#dc2626',fontWeight:600}}>*</span> Campo obligatorio
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={intentarCerrarModal}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación cerrar con cambios */}
      {showCloseConfirm && (
        <div className="modal-overlay" style={{zIndex:1100}}>
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header" style={{borderBottom:'none',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',color:'#d97706'}}>
                <div style={{background:'#fef3c7',padding:'8px',borderRadius:'50%'}}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </div>
                <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>¿Descartar cambios?</h2>
              </div>
            </div>
            <div className="modal-body" style={{paddingTop:'16px'}}>
              <p style={{margin:0,color:'#64748b',lineHeight:'1.5'}}>
                Tienes cambios sin guardar. Si cierras ahora, se perderán. ¿Estás seguro?
              </p>
            </div>
            <div className="modal-footer" style={{borderTop:'none',paddingTop:0,marginTop:'8px'}}>
              <button className="btn-secondary" onClick={() => setShowCloseConfirm(false)}>Seguir editando</button>
              <button className="btn-danger" onClick={() => { setShowCloseConfirm(false); setShowModal(false); }}>Sí, descartar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header" style={{borderBottom:'none',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',color:'#dc2626'}}>
                <div style={{background:'#fee2e2',padding:'8px',borderRadius:'50%'}}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </div>
                <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>¿Eliminar grupo?</h2>
              </div>
            </div>
            <div className="modal-body" style={{paddingTop:'16px'}}>
              <p style={{margin:0,color:'#64748b',lineHeight:'1.5'}}>
                ¿Estás seguro que deseas eliminar el grupo <strong>{grupoAEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer" style={{borderTop:'none',paddingTop:0,marginTop:'8px'}}>
              <button className="btn-secondary" onClick={() => { setShowConfirm(false); setGrupoAEliminar(null); }}>Cancelar</button>
              <button className="btn-danger" onClick={eliminarGrupo} disabled={saving}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform: translateX(12px); } to { opacity:1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}