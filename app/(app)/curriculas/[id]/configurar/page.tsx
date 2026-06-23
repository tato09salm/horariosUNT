'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';
import { useUser } from '../../../layout';
import { getCurriculaDisplayName } from '@/lib/curriculas';

interface Escuela {
  id: string;
  nombre: string;
  codigo: string;
}

interface Curso {
  id: string;
  codigo: string;
  nombre: string;
  ciclo_plan: number;
  escuela_id: string;
  escuela_nombre?: string;
  creditos: number;
  horas_teoria: number;
  horas_practica: number;
  horas_laboratorio: number;
}

interface Curricula {
  id: string;
  nombre_carrera: string;
  año_curricula: number;
  modalidad_estudios: string;
  estado: string;
}

export default function ConfigurarCurriculaPage() {
  const { id } = useParams();
  const router = useRouter();
  const { darkMode } = useTheme();
  const user = useUser();
  const canAccess = user?.rol.codigo === 'admin' || user?.rol.codigo === 'director_escuela';

  const [curricula, setCurricula] = useState<Curricula | null>(null);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Curso[]>([]);
  const [showNuevoCursoRow, setShowNuevoCursoRow] = useState(false);
  const [editingCursoId, setEditingCursoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Backup para Optimistic UI
  const [cursosBackup, setCursosBackup] = useState<Curso[]>([]);

  const emptyCurso = {
    codigo: '',
    nombre: '',
    ciclo_plan: 1,
    escuela_id: '',
    creditos: 0,
    horas_teoria: 0,
    horas_practica: 0,
    horas_laboratorio: 0,
  };

  const [nuevoCurso, setNuevoCurso] = useState(emptyCurso);
  const [cursoEditando, setCursoEditando] = useState<Curso | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resCurricula, resCursos, resEscuelas] = await Promise.all([
        fetch(`/api/curriculas/${id}`),
        fetch(`/api/curriculas/${id}/cursos`),
        fetch('/api/escuelas'),
      ]);

      const dataCurricula = await resCurricula.json();
      const dataCursos = await resCursos.json();
      const dataEscuelas = await resEscuelas.json();

      if (!resCurricula.ok) throw new Error(dataCurricula.error);
      if (dataCurricula.data.estado !== 'BORRADOR') {
        router.push('/curriculas');
        return;
      }

      setCurricula(dataCurricula.data);
      const fetchedCursos = dataCursos.data || [];
      setCursos(fetchedCursos);
      setCursosBackup(fetchedCursos);
      setEscuelas(dataEscuelas.data || []);
      
      if (dataEscuelas.data?.length > 0 && !nuevoCurso.escuela_id) {
        setNuevoCurso(prev => ({ ...prev, escuela_id: dataEscuelas.data[0].id }));
      }
    } catch (error: any) {
      setToast({ type: 'error', text: error.message || 'Error al cargar datos' });
    } finally {
      setLoading(false);
    }
  }, [id, router, nuevoCurso.escuela_id]);

  useEffect(() => {
    if (canAccess) fetchData();
  }, [canAccess, fetchData]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (busqueda.length >= 3) {
        setSearching(true);
        try {
          const res = await fetch(`/api/cursos?buscar=${busqueda}`);
          const data = await res.json();
          setResultadosBusqueda(data.data || []);
        } catch (error) {
          console.error('Error buscando cursos:', error);
        } finally {
          setSearching(false);
        }
      } else {
        setResultadosBusqueda([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  const agregarCursoExistente = async (curso: Curso) => {
    // Optimistic Update
    const prevCursos = [...cursos];
    const cursoOptimista = { ...curso, escuela_nombre: escuelas.find(e => e.id === curso.escuela_id)?.nombre };
    setCursos(prev => [...prev, cursoOptimista].sort((a, b) => {
      if (a.ciclo_plan !== b.ciclo_plan) return a.ciclo_plan - b.ciclo_plan;
      return a.codigo.localeCompare(b.codigo);
    }));

    try {
      const res = await fetch(`/api/curriculas/${id}/cursos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ curso_id: curso.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', text: 'Curso agregado correctamente' });
      setBusqueda('');
      setResultadosBusqueda([]);
      setCursosBackup([...cursos, cursoOptimista]);
    } catch (error: any) {
      setCursos(prevCursos); // Rollback
      setToast({ type: 'error', text: error.message });
    }
  };

  const crearYAgregarCurso = async () => {
    if (!nuevoCurso.codigo || !nuevoCurso.nombre || !nuevoCurso.escuela_id) {
      setToast({ type: 'error', text: 'Por favor complete los campos obligatorios (Código, Nombre, Escuela)' });
      return;
    }

    // Para creación es más difícil ser optimista porque no tenemos el ID generado por el server,
    // pero podemos mostrar un estado de "Cargando" en la fila o simplemente proceder con el fetch.
    // Haremos Optimistic UI para la UI de la tabla.
    
    setSaving(true);
    try {
      const res = await fetch(`/api/curriculas/${id}/cursos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCurso),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', text: 'Curso creado y agregado correctamente' });
      setShowNuevoCursoRow(false);
      setNuevoCurso({
        ...emptyCurso,
        escuela_id: escuelas[0]?.id || '',
      });
      fetchData(); // Recargamos para obtener el ID real y datos frescos
    } catch (error: any) {
      setToast({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEditCurso = (curso: Curso) => {
    setEditingCursoId(curso.id);
    setCursoEditando({ ...curso });
    setShowNuevoCursoRow(false);
  };

  const handleSaveEdit = async () => {
    if (!cursoEditando) return;
    if (!cursoEditando.codigo || !cursoEditando.nombre || !cursoEditando.escuela_id) {
      setToast({ type: 'error', text: 'Por favor complete los campos obligatorios' });
      return;
    }

    // Optimistic Update
    const prevCursos = [...cursos];
    const cursoActualizado = { 
      ...cursoEditando, 
      escuela_nombre: escuelas.find(e => e.id === cursoEditando.escuela_id)?.nombre 
    };
    
    setCursos(prev => prev.map(c => c.id === cursoEditando.id ? cursoActualizado : c).sort((a, b) => {
      if (a.ciclo_plan !== b.ciclo_plan) return a.ciclo_plan - b.ciclo_plan;
      return a.codigo.localeCompare(b.codigo);
    }));
    setEditingCursoId(null);

    try {
      const res = await fetch(`/api/cursos/${cursoEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cursoEditando),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', text: 'Curso actualizado correctamente' });
      setCursosBackup(cursos.map(c => c.id === cursoEditando.id ? cursoActualizado : c));
      setCursoEditando(null);
    } catch (error: any) {
      setCursos(prevCursos); // Rollback
      setToast({ type: 'error', text: error.message });
      setEditingCursoId(cursoEditando.id); // Reabrir edición si falló
    }
  };

  const eliminarCurso = async (cursoId: string) => {
    if (!confirm('¿Estás seguro de quitar este curso de la currícula?')) return;
    
    // Optimistic Delete
    const prevCursos = [...cursos];
    setCursos(prev => prev.filter(c => c.id !== cursoId));

    try {
      const res = await fetch(`/api/curriculas/${id}/cursos?curso_id=${cursoId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setToast({ type: 'success', text: 'Curso quitado correctamente' });
      setCursosBackup(cursos.filter(c => c.id !== cursoId));
    } catch (error: any) {
      setCursos(prevCursos); // Rollback
      setToast({ type: 'error', text: error.message });
    }
  };

  const confirmarPublicar = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/curriculas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ACTIVA' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowConfirm(false);
      setToast({ type: 'success', text: 'Currícula publicada correctamente' });
      setTimeout(() => router.push('/curriculas'), 1500);
    } catch (error: any) {
      setToast({ type: 'error', text: error.message });
      setSaving(false);
    }
  };

  const handlePublicar = async () => {
    if (cursos.length === 0) {
      setToast({ type: 'error', text: 'No puedes publicar una currícula sin cursos.' });
      return;
    }
    setShowConfirm(true);
  };

  if (loading) return <div className="page-container"><p>Cargando...</p></div>;
  if (!curricula) return <div className="page-container"><p>Currícula no encontrada</p></div>;

  return (
    <div className="page-container">
      {toast && (
        <div className={`card toast ${toast.type}`} style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200, minWidth: 260,
          borderLeft: `4px solid ${toast.type === 'success' ? '#16A34A' : '#DC2626'}`,
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
          padding: '12px 16px',
          background: 'var(--card-bg)'
        }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>{toast.type === 'success' ? 'Éxito' : 'Error'}</strong>
          <span style={{ fontSize: 14 }}>{toast.text}</span>
        </div>
      )}

      <div className="header-responsive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Configurar Cursos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            {getCurriculaDisplayName(curricula)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={handlePublicar} disabled={saving}>
            Guardar y publicar
          </button>
          <button className="btn-secondary" onClick={() => router.push('/curriculas')}>
            Guardar como borrador
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Agregar Cursos Existentes</h2>
          <div className="form-group">
            <label className="form-label">Buscar por código o nombre</label>
            <input
              className="form-input"
              type="text"
              placeholder="Ej: MAT-101 o Cálculo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          {searching && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Buscando...</p>}
          
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '12px' }}>
            {resultadosBusqueda.map(curso => (
              <div key={curso.id} style={{
                padding: '10px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{curso.codigo} - {curso.nombre}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ciclo {curso.ciclo_plan} • {curso.creditos} cred.</div>
                </div>
                <button 
                  className="btn-primary" 
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  onClick={() => agregarCursoExistente(curso)}
                  disabled={cursos.some(c => c.id === curso.id)}
                >
                  {cursos.some(c => c.id === curso.id) ? 'Agregado' : 'Agregar'}
                </button>
              </div>
            ))}
            {busqueda.length >= 3 && resultadosBusqueda.length === 0 && !searching && (
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>No se encontraron cursos.</p>
            )}
          </div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Cursos en la Currícula</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Agrega nuevos cursos directamente en la tabla inferior o busca existentes a la izquierda.</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>Cursos Registrados</h2>
          {!showNuevoCursoRow && !editingCursoId && (
            <button className="btn-primary" onClick={() => setShowNuevoCursoRow(true)}>
              Agregar
            </button>
          )}
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Código</th>
                <th style={{ width: '85px' }}>Ciclo</th>
                <th>Nombre</th>
                <th>Escuela</th>
                <th style={{ width: '75px' }}>Créd.</th>
                <th style={{ width: '65px' }}>T</th>
                <th style={{ width: '65px' }}>P</th>
                <th style={{ width: '65px' }}>L</th>
                <th style={{ width: '160px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {showNuevoCursoRow && (
                <tr style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                  <td>
                    <input
                      className="form-input"
                      placeholder="Código"
                      value={nuevoCurso.codigo}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, codigo: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '13px', width: '100%' }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input no-spinner"
                      type="number"
                      min={1}
                      max={12}
                      value={nuevoCurso.ciclo_plan}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, ciclo_plan: parseInt(e.target.value) || 1 })}
                      style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input"
                      placeholder="Nombre del curso"
                      value={nuevoCurso.nombre}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, nombre: e.target.value })}
                      style={{ padding: '4px 8px', fontSize: '13px', width: '100%' }}
                    />
                  </td>
                  <td>
                    <select
                      className="form-input"
                      value={nuevoCurso.escuela_id}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, escuela_id: e.target.value })}
                      style={{ padding: '4px 4px', fontSize: '13px', width: '100%' }}
                    >
                      {escuelas.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input no-spinner"
                      type="number"
                      min={0}
                      value={nuevoCurso.creditos}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, creditos: parseInt(e.target.value) || 0 })}
                      style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input no-spinner"
                      type="number"
                      min={0}
                      value={nuevoCurso.horas_teoria}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, horas_teoria: parseInt(e.target.value) || 0 })}
                      style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input no-spinner"
                      type="number"
                      min={0}
                      value={nuevoCurso.horas_practica}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, horas_practica: parseInt(e.target.value) || 0 })}
                      style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input no-spinner"
                      type="number"
                      min={0}
                      value={nuevoCurso.horas_laboratorio}
                      onChange={e => setNuevoCurso({ ...nuevoCurso, horas_laboratorio: parseInt(e.target.value) || 0 })}
                      style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-primary" 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={crearYAgregarCurso}
                        disabled={saving}
                      >
                        {saving ? '...' : 'Guardar'}
                      </button>
                      <button 
                        className="btn-secondary" 
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                        onClick={() => setShowNuevoCursoRow(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {cursos.length === 0 && !showNuevoCursoRow ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No hay cursos registrados en esta currícula.
                  </td>
                </tr>
              ) : (
                cursos.map(curso => (
                  <tr key={curso.id} style={editingCursoId === curso.id ? { background: 'rgba(59, 130, 246, 0.05)' } : {}}>
                    {editingCursoId === curso.id ? (
                      <>
                        <td>
                          <input
                            className="form-input"
                            value={cursoEditando?.codigo || ''}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, codigo: e.target.value } : null)}
                            style={{ padding: '4px 8px', fontSize: '13px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input no-spinner"
                            type="number"
                            min={1}
                            max={12}
                            value={cursoEditando?.ciclo_plan || 1}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, ciclo_plan: parseInt(e.target.value) || 1 } : null)}
                            style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input"
                            value={cursoEditando?.nombre || ''}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, nombre: e.target.value } : null)}
                            style={{ padding: '4px 8px', fontSize: '13px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <select
                            className="form-input"
                            value={cursoEditando?.escuela_id || ''}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, escuela_id: e.target.value } : null)}
                            style={{ padding: '4px 4px', fontSize: '13px', width: '100%' }}
                          >
                            {escuelas.map(e => (
                              <option key={e.id} value={e.id}>{e.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="form-input no-spinner"
                            type="number"
                            min={0}
                            value={cursoEditando?.creditos || 0}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, creditos: parseInt(e.target.value) || 0 } : null)}
                            style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input no-spinner"
                            type="number"
                            min={0}
                            value={cursoEditando?.horas_teoria || 0}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, horas_teoria: parseInt(e.target.value) || 0 } : null)}
                            style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input no-spinner"
                            type="number"
                            min={0}
                            value={cursoEditando?.horas_practica || 0}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, horas_practica: parseInt(e.target.value) || 0 } : null)}
                            style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <input
                            className="form-input no-spinner"
                            type="number"
                            min={0}
                            value={cursoEditando?.horas_laboratorio || 0}
                            onChange={e => setCursoEditando(prev => prev ? { ...prev, horas_laboratorio: parseInt(e.target.value) || 0 } : null)}
                            style={{ padding: '4px 2px', fontSize: '13px', width: '100%', textAlign: 'center' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn-primary" 
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={handleSaveEdit}
                              disabled={saving}
                            >
                              {saving ? '...' : 'Guardar'}
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => setEditingCursoId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{curso.codigo}</td>
                        <td>{curso.ciclo_plan}</td>
                        <td>{curso.nombre}</td>
                        <td>{curso.escuela_nombre || '-'}</td>
                        <td>{curso.creditos}</td>
                        <td>{curso.horas_teoria}</td>
                        <td>{curso.horas_practica}</td>
                        <td>{curso.horas_laboratorio}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                              onClick={() => handleEditCurso(curso)}
                            >
                              Editar
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ color: '#DC2626', padding: '4px 8px', fontSize: '12px' }} 
                              onClick={() => eliminarCurso(curso.id)}
                            >
                              Quitar
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style jsx>{`
        .form-input {
          width: 100%;
        }
        .no-spinner::-webkit-inner-spin-button,
        .no-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .no-spinner {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Modal de Confirmación Publicar */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={(e) => {
          // Prevenir cerrar al hacer click fuera
          e.stopPropagation();
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-color)',
            position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowConfirm(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                lineHeight: '1',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-card-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              ×
            </button>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(251, 191, 36, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '28px' }}>⚠️</span>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: '1.3',
                  }}>
                    ¿Estás seguro?
                  </h3>
                  <p style={{
                    margin: 0,
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                  }}>
                    ¿Estás seguro de publicar esta currícula? Pasará a ser la currícula ACTIVA y la anterior pasará a EN EXTINCIÓN.
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                marginTop: '8px',
              }}>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="btn-secondary"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                  }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarPublicar}
                  className="btn-primary"
                  style={{
                    background: '#059669',
                    borderColor: '#059669',
                    padding: '10px 20px',
                    fontSize: '14px',
                  }}
                >
                  {saving ? 'Publicando...' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
