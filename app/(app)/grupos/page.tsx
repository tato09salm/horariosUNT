'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/theme';

interface Grupo {
  id: string;
  ciclo_id: string;
  curso_id: string;
  numero_grupo: number;
  max_alumnos: number;
  num_alumnos: number;
  ciclo_nombre?: string;
  curso_codigo?: string;
  curso_nombre?: string;
}

interface Ciclo {
  id: string;
  nombre: string;
  año: number;
  semestre: string;
}

interface Curso {
  id: string;
  codigo: string;
  nombre: string;
}

const emptyGrupo = {
  ciclo_id: '',
  curso_id: '',
  numero_grupo: 1,
  max_alumnos: 30,
  num_alumnos: 0,
};

export default function GruposPage() {
  const { darkMode } = useTheme();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCiclo, setFiltroCiclo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [grupoAEliminar, setGrupoAEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [editando, setEditando] = useState<any>(emptyGrupo);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const cargarGrupos = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroCiclo) params.set('ciclo_id', filtroCiclo);
    params.set('page', pagina.toString());
    params.set('limit', limit.toString());
    
    fetch(`/api/horarios/grupos?${params}`)
      .then(r => r.json())
      .then(data => {
        setGrupos(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(() => setMsg({ type: 'error', text: 'Error al cargar grupos' }))
      .finally(() => setLoading(false));
  }, [filtroCiclo, pagina]);

  const cargarCiclos = useCallback(() => {
    fetch('/api/ciclos')
      .then(r => r.json())
      .then(data => setCiclos(data.data || []))
      .catch(() => console.error('Error cargando ciclos'));
  }, []);

  const cargarCursos = useCallback(() => {
    fetch('/api/cursos')
      .then(r => r.json())
      .then(data => setCursos(data.data || []))
      .catch(() => console.error('Error cargando cursos'));
  }, []);

  useEffect(() => {
    cargarGrupos();
    cargarCiclos();
    cargarCursos();
  }, [cargarGrupos, cargarCiclos, cargarCursos]);

  useEffect(() => {
    setPagina(1);
  }, [filtroCiclo]);

  async function guardar() {
    setSaving(true);
    setMsg(null);
    try {
      if (!editando.ciclo_id) throw new Error('Seleccione un ciclo');
      if (!editando.curso_id) throw new Error('Seleccione un curso');
      if (!editando.numero_grupo || editando.numero_grupo < 1) throw new Error('Número de grupo inválido');
      
      const method = editando.id ? 'PUT' : 'POST';
      const url = editando.id ? `/api/horarios/grupos/${editando.id}` : '/api/horarios/grupos';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      
      setMsg({ type: 'success', text: `Grupo ${editando.id ? 'actualizado' : 'creado'} correctamente` });
      setShowModal(false);
      cargarGrupos();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function eliminarGrupo() {
    if (!grupoAEliminar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/horarios/grupos/${grupoAEliminar.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setShowConfirm(false);
      setGrupoAEliminar(null);
      cargarGrupos();
      setMsg({ type: 'success', text: 'Grupo eliminado correctamente' });
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error al eliminar grupo' });
    } finally {
      setSaving(false);
    }
  }

  function handleEliminar(grupo: Grupo) {
    const nombre = `${grupo.curso_codigo || 'Curso'} - Grupo ${grupo.numero_grupo}`;
    setGrupoAEliminar({ id: grupo.id, nombre });
    setShowConfirm(true);
  }

  function nuevo() {
    setEditando({ ...emptyGrupo });
    setShowModal(true);
    setMsg(null);
  }

  function editar(grupo: Grupo) {
    setEditando({ ...grupo });
    setShowModal(true);
    setMsg(null);
  }

  return (
    <div className="page-container">
      <div className="header-responsive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: darkMode ? '#fff' : '#1e293b', margin: '0 0 4px' }}>Grupos</h1>
          <p style={{ color: darkMode ? '#94a3b8' : '#64748b', fontSize: '14px', margin: 0 }}>Gestión de grupos por ciclo y curso</p>
        </div>
        <button className="btn-primary" onClick={nuevo}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hide-sm">Nuevo grupo</span>
          <span className="show-sm">Nuevo</span>
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div className="filters-group" style={{ gap: '12px' }}>
          <select className="form-input" style={{ width: '250px' }} value={filtroCiclo} onChange={e => setFiltroCiclo(e.target.value)}>
            <option value="">Todos los ciclos</option>
            {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
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
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Cargando...</td></tr>
              ) : grupos.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>No se encontraron grupos</td></tr>
              ) : (
                grupos.map((g, i) => (
                  <tr key={g.id}>
                    <td className="hide-sm" style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>{(pagina - 1) * limit + i + 1}</td>
                    <td>{g.ciclo_nombre || '-'}</td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{g.curso_codigo || '-'}</div>
                      <div className="hide-sm" style={{ fontSize: '12px', color: '#94a3b8' }}>{g.curso_nombre || ''}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge" style={{ background: darkMode ? 'rgba(52,211,153,0.2)' : '#d1fae5', color: darkMode ? '#34d399' : '#065f46', padding: '4px 10px', borderRadius: '50%', width: '36px', height: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{g.numero_grupo}</span></td>
                    <td className="hide-sm" style={{ textAlign: 'center' }}>{g.max_alumnos}</td>
                    <td className="hide-sm" style={{ textAlign: 'center' }}>{g.num_alumnos}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => editar(g)}>
                          <span className="hide-sm">Editar</span>
                          <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button className="btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleEliminar(g)}>
                          <span className="hide-sm">Eliminar</span>
                          <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderTop: '1px solid ' + (darkMode ? '#374151' : '#e2e8f0') }}>
            <div style={{ fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b' }}>
              Mostrando <span style={{ fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>{(pagina - 1) * limit + 1}</span> a{' '}
              <span style={{ fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>{Math.min(pagina * limit, total)}</span> de{' '}
              <span style={{ fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>{total}</span> grupos
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ padding: '6px 12px', color: darkMode ? '#00A6FF' : undefined }} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>
                Anterior
              </button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '14px', fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>
                Página {pagina} de {Math.ceil(total / limit)}
              </div>
              <button className="btn-secondary" style={{ padding: '6px 12px', color: darkMode ? '#00A6FF' : undefined }} disabled={pagina >= Math.ceil(total / limit)} onClick={() => setPagina(p => p + 1)}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{editando.id ? 'Editar grupo' : 'Nuevo grupo'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && msg.type !== 'success' && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="responsive-grid">
                <div className="form-group">
                  <label className="form-label">Ciclo *</label>
                  <select className="form-input" value={editando.ciclo_id || ''} onChange={e => setEditando({ ...editando, ciclo_id: e.target.value })}>
                    <option value="">Seleccione un ciclo</option>
                    {ciclos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Curso *</label>
                  <select className="form-input" value={editando.curso_id || ''} onChange={e => setEditando({ ...editando, curso_id: e.target.value })}>
                    <option value="">Seleccione un curso</option>
                    {cursos.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Número de grupo *</label>
                  <input type="number" min="1" className="form-input" value={editando.numero_grupo || 1} onChange={e => setEditando({ ...editando, numero_grupo: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Máx. alumnos</label>
                  <input type="number" className="form-input" value={editando.max_alumnos || 30} onChange={e => setEditando({ ...editando, max_alumnos: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Alumnos inscritos</label>
                  <input type="number" className="form-input" value={editando.num_alumnos || 0} onChange={e => setEditando({ ...editando, num_alumnos: parseInt(e.target.value) || 0 })} />
                </div>
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

      {/* Modal Confirmación Eliminar */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626' }}>
                <div style={{ background: '#fee2e2', padding: '8px', borderRadius: '50%' }}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>¿Eliminar grupo?</h2>
              </div>
            </div>
            <div className="modal-body" style={{ paddingTop: '16px' }}>
              <p style={{ margin: 0, color: '#64748b', lineHeight: '1.5' }}>
                ¿Estás seguro que deseas eliminar el grupo <strong>{grupoAEliminar?.nombre}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => { setShowConfirm(false); setGrupoAEliminar(null); }}>Cancelar</button>
              <button className="btn-danger" onClick={eliminarGrupo} disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}