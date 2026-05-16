'use client';
import { useState, useEffect, useCallback } from 'react';

const categorias = ['principal', 'asociado', 'auxiliar', 'jefe_practica'];
const condiciones = ['nombrado', 'contratado'];
const grados = ['bachiller', 'licenciado', 'magister', 'doctor'];

interface Docente {
  id: string; codigo: string; nombre: string; apellidos: string;
  dni: string; email: string; telefono: string; categoria: string;
  condicion: string; fecha_ingreso: string; grado_academico: string;
  horas_max_semana: number; activo: boolean;
}

const emptyDocente: Partial<Docente> = {
  codigo: '', nombre: '', apellidos: '', dni: '', email: '', telefono: '',
  categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '',
  grado_academico: 'licenciado', horas_max_semana: 20, activo: true,
};

export default function DocentesPage() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroCondicion, setFiltroCondicion] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Partial<Docente>>(emptyDocente);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:string;text:string}|null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (buscar) q.set('buscar', buscar);
    if (filtroCategoria) q.set('categoria', filtroCategoria);
    if (filtroCondicion) q.set('condicion', filtroCondicion);
    fetch(`/api/docentes?${q}`).then(r => r.json()).then(d => setDocentes(d.data || [])).finally(() => setLoading(false));
  }, [buscar, filtroCategoria, filtroCondicion]);

  useEffect(() => { const t = setTimeout(cargar, 300); return () => clearTimeout(t); }, [cargar]);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      const method = editando.id ? 'PUT' : 'POST';
      const url = editando.id ? `/api/docentes/${editando.id}` : '/api/docentes';
      const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(editando) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:`Docente ${editando.id ? 'actualizado' : 'creado'} correctamente`});
      setShowModal(false);
      cargar();
    } catch (e: any) {
      setMsg({type:'error',text:e.message});
    } finally { setSaving(false); }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Desactivar este docente?')) return;
    await fetch(`/api/docentes/${id}`, {method:'DELETE'});
    cargar();
  }

  function nuevo() { setEditando({...emptyDocente}); setShowModal(true); setMsg(null); }
  function editar(d: Docente) { setEditando({...d}); setShowModal(true); setMsg(null); }

  return (
    <div style={{padding:'32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Docentes</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Gestión del cuerpo docente — ordenado por jerarquía</p>
        </div>
        <button className="btn-primary" onClick={nuevo}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo docente
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:'12px',alignItems:'end'}}>
          <input className="form-input" placeholder="Buscar por nombre, código o DNI..." value={buscar} onChange={e => setBuscar(e.target.value)} />
          <select className="form-input" style={{width:'auto'}} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
          </select>
          <select className="form-input" style={{width:'auto'}} value={filtroCondicion} onChange={e => setFiltroCondicion(e.target.value)}>
            <option value="">Todas las condiciones</option>
            {condiciones.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Orden</th><th>Código</th><th>Docente</th><th>DNI</th>
                <th>Categoría</th><th>Condición</th><th>Grado</th>
                <th>Ingreso</th><th>Horas</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : docentes.length === 0 ? (
                <tr><td colSpan={11} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No se encontraron docentes</td></tr>
              ) : docentes.map((d, i) => (
                <tr key={d.id}>
                  <td style={{color:'#94a3b8',fontSize:'12px',fontWeight:'600'}}>{i+1}</td>
                  <td style={{fontWeight:'600',color:'#475569'}}>{d.codigo}</td>
                  <td>
                    <div style={{fontWeight:'500'}}>{d.apellidos}, {d.nombre}</div>
                    <div style={{fontSize:'12px',color:'#94a3b8'}}>{d.email}</div>
                  </td>
                  <td style={{fontFamily:'monospace'}}>{d.dni}</td>
                  <td><span className={`badge badge-${d.categoria}`}>{d.categoria.replace('_',' ')}</span></td>
                  <td><span className={`badge badge-${d.condicion}`}>{d.condicion}</span></td>
                  <td style={{fontSize:'12px',color:'#64748b'}}>{d.grado_academico}</td>
                  <td style={{fontSize:'12px',color:'#64748b'}}>{d.fecha_ingreso?.split('T')[0]}</td>
                  <td style={{textAlign:'center',fontWeight:'600'}}>{d.horas_max_semana}h</td>
                  <td>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:d.activo?'#dcfce7':'#fee2e2',color:d.activo?'#166534':'#991b1b'}}>
                      {d.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn-secondary" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => editar(d)}>Editar</button>
                      {d.activo && <button className="btn-danger" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => eliminar(d.id)}>Desactivar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>{editando.id ? 'Editar docente' : 'Nuevo docente'}</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input className="form-input" value={editando.codigo||''} onChange={e => setEditando(p => ({...p,codigo:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">DNI *</label>
                  <input className="form-input" value={editando.dni||''} onChange={e => setEditando(p => ({...p,dni:e.target.value}))} maxLength={8} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" value={editando.nombre||''} onChange={e => setEditando(p => ({...p,nombre:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellidos *</label>
                  <input className="form-input" value={editando.apellidos||''} onChange={e => setEditando(p => ({...p,apellidos:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={editando.email||''} onChange={e => setEditando(p => ({...p,email:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={editando.telefono||''} onChange={e => setEditando(p => ({...p,telefono:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select className="form-input" value={editando.categoria||'auxiliar'} onChange={e => setEditando(p => ({...p,categoria:e.target.value}))}>
                    {categorias.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Condición *</label>
                  <select className="form-input" value={editando.condicion||'contratado'} onChange={e => setEditando(p => ({...p,condicion:e.target.value}))}>
                    {condiciones.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Grado académico</label>
                  <select className="form-input" value={editando.grado_academico||'licenciado'} onChange={e => setEditando(p => ({...p,grado_academico:e.target.value}))}>
                    {grados.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de ingreso *</label>
                  <input className="form-input" type="date" value={editando.fecha_ingreso?.split('T')[0]||''} onChange={e => setEditando(p => ({...p,fecha_ingreso:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Horas máx/semana</label>
                  <input className="form-input" type="number" min={1} max={40} value={editando.horas_max_semana||20} onChange={e => setEditando(p => ({...p,horas_max_semana:parseInt(e.target.value)}))} />
                </div>
                {editando.id && (
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={editando.activo?'true':'false'} onChange={e => setEditando(p => ({...p,activo:e.target.value==='true'}))}>
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
