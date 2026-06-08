'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';
import {
  CARRERA_CURRICULA_FIJA,
  CURRICULA_ESTADO_LABELS,
  ESTADOS_CURRICULA,
  MODALIDADES_CURRICULA,
  getCurriculaDisplayName,
  type EstadoCurricula,
  type ModalidadCurricula,
} from '@/lib/curriculas';

interface Curricula {
  id: string;
  nombre_carrera: string;
  año_curricula: number;
  modalidad_estudios: ModalidadCurricula;
  creditos_totales: number;
  estado: EstadoCurricula;
  createdAt?: string;
  updatedAt?: string;
}

interface CurriculaForm {
  id?: string;
  nombre_carrera: string;
  año_curricula: number;
  modalidad_estudios: ModalidadCurricula;
  creditos_totales: number;
  estado: EstadoCurricula;
}

type ToastType = 'success' | 'error';

const MODALIDAD_STYLES: Record<ModalidadCurricula, { bg: string; color: string }> = {
  PRESENCIAL: { bg: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' },
  SEMIPRESENCIAL: { bg: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' },
  VIRTUAL: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981' },
  MULTIPLE: { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' },
};

const ESTADO_STYLES: Record<EstadoCurricula, { bg: string; color: string }> = {
  ACTIVA: { bg: 'rgba(34, 197, 94, 0.12)', color: '#16A34A' },
  EN_EXTINCION: { bg: 'rgba(249, 115, 22, 0.12)', color: '#EA580C' },
  TERMINADA: { bg: 'rgba(148, 163, 184, 0.16)', color: '#64748B' },
  BORRADOR: { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563EB' },
  INACTIVO: { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748B' },
  ELIMINADA: { bg: 'rgba(239, 68, 68, 0.12)', color: '#DC2626' },
};

function buildEmptyForm(): CurriculaForm {
  return {
    nombre_carrera: CARRERA_CURRICULA_FIJA,
    año_curricula: new Date().getFullYear(),
    modalidad_estudios: MODALIDADES_CURRICULA[0],
    creditos_totales: 0,
    estado: 'BORRADOR',
  };
}

function formatEnumLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function getEstadoLabel(estado: EstadoCurricula) {
  return CURRICULA_ESTADO_LABELS[estado];
}

export default function CurriculasPage() {
  const { darkMode } = useTheme();
  const user = useUser();
  const canAccess = user?.rol.codigo === 'admin' || user?.rol.codigo === 'director_escuela';

  const [curriculas, setCurriculas] = useState<Curricula[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todas' | EstadoCurricula>('todas');
  const [toast, setToast] = useState<{ type: ToastType; text: string } | null>(null);
  const [form, setForm] = useState<CurriculaForm>(buildEmptyForm());
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    curricula: Curricula | null;
    requiresDouble: boolean;
    scheduleCount: number;
    step: 1 | 2;
    deleting: boolean;
  }>({
    show: false,
    curricula: null,
    requiresDouble: false,
    scheduleCount: 0,
    step: 1,
    deleting: false,
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const recargarCurriculas = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);
    try {
      const res = await fetch('/api/curriculas?manage=true');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar currículas');
      setCurriculas(data.data || []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar currículas';
      setToast({ type: 'error', text: message });
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;

    let cancelled = false;

    fetch('/api/curriculas?manage=true')
      .then((res) => res.json().then((data) => ({ res, data })))
      .then(({ res, data }) => {
        if (!res.ok) throw new Error(data.error || 'Error al cargar currículas');
        if (!cancelled) setCurriculas(data.data || []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Error al cargar currículas';
        setToast({ type: 'error', text: message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canAccess]);

  const curriculasFiltradas = useMemo(() => {
    const termino = buscar.trim().toLowerCase();

    return curriculas.filter((curricula) => {
      const nombreDisplay = getCurriculaDisplayName(curricula).toLowerCase();
      const coincideTexto =
        !termino ||
        [
          nombreDisplay,
          curricula.nombre_carrera,
          String(curricula.año_curricula),
          curricula.modalidad_estudios,
          curricula.estado,
          getEstadoLabel(curricula.estado),
          String(curricula.creditos_totales),
        ].some((value) => value.toLowerCase().includes(termino));

      const coincideEstado = filtroEstado === 'todas' || curricula.estado === filtroEstado;

      return coincideTexto && coincideEstado;
    });
  }, [buscar, curriculas, filtroEstado]);

  function nuevo() {
    setForm(buildEmptyForm());
    setShowModal(true);
  }

  function editar(curricula: Curricula) {
    setForm({
      id: curricula.id,
      nombre_carrera: CARRERA_CURRICULA_FIJA,
      año_curricula: curricula.año_curricula,
      modalidad_estudios: curricula.modalidad_estudios,
      creditos_totales: curricula.creditos_totales,
      estado: curricula.estado,
    });
    setShowModal(true);
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const añoCurricula = Number(form.año_curricula);
      const creditosTotales = Number(form.creditos_totales);

      if (!Number.isInteger(añoCurricula) || añoCurricula < 1900) {
        throw new Error('Ingresa un año de currícula válido');
      }

      if (!MODALIDADES_CURRICULA.includes(form.modalidad_estudios)) {
        throw new Error('Selecciona una modalidad válida');
      }

      if (form.id && !ESTADOS_CURRICULA.includes(form.estado as any)) {
        throw new Error('Selecciona un estado válido');
      }

      if (!Number.isInteger(creditosTotales) || creditosTotales <= 0) {
        throw new Error('Los créditos totales deben ser mayores a cero');
      }

      const method = form.id ? 'PUT' : 'POST';
      const url = form.id ? `/api/curriculas/${form.id}` : '/api/curriculas';
      const estado = form.id ? form.estado : 'BORRADOR';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          año_curricula: añoCurricula,
          modalidad_estudios: form.modalidad_estudios,
          creditos_totales: creditosTotales,
          estado,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar la currícula');

      setShowModal(false);
      setToast({
        type: 'success',
        text: `Currícula ${form.id ? 'actualizada' : 'creada'} correctamente`,
      });
      await recargarCurriculas();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar la currícula';
      setToast({ type: 'error', text: message });
    } finally {
      setSaving(false);
    }
  }

  async function darPorConcluido(curricula: Curricula) {
    if (!confirm(`¿Está seguro de dar por concluida la currícula "${getCurriculaDisplayName(curricula)}"? Su estado cambiará a Inactivo.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/curriculas/${curricula.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'INACTIVO',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al dar por concluida la currícula');

      setToast({
        type: 'success',
        text: 'Currícula dada por concluida correctamente',
      });
      await recargarCurriculas();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al dar por concluida la currícula';
      setToast({ type: 'error', text: message });
    }
  }

  async function iniciarEliminar(curricula: Curricula) {
    try {
      const checkRes = await fetch(`/api/curriculas/${curricula.id}?checkOnly=true`, {
        method: 'DELETE',
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok) throw new Error(checkData.error || 'Error al verificar horarios vinculados');

      setDeleteModal({
        show: true,
        curricula,
        requiresDouble: checkData.hasSchedules,
        scheduleCount: checkData.count || 0,
        step: 1,
        deleting: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al iniciar la eliminación';
      setToast({ type: 'error', text: message });
    }
  }

  async function ejecutarEliminar() {
    const { curricula, requiresDouble, step } = deleteModal;
    if (!curricula) return;

    if (requiresDouble && step === 1) {
      setDeleteModal(prev => ({ ...prev, step: 2 }));
      return;
    }

    setDeleteModal(prev => ({ ...prev, deleting: true }));
    try {
      const res = await fetch(`/api/curriculas/${curricula.id}${requiresDouble ? '?confirmAll=true' : ''}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar la currícula');

      setToast({
        type: 'success',
        text: `Currícula eliminada correctamente. ${requiresDouble && data.schedulesDeleted ? `Se eliminaron ${data.schedulesDeleted} horarios.` : ''}`,
      });
      setDeleteModal({
        show: false,
        curricula: null,
        requiresDouble: false,
        scheduleCount: 0,
        step: 1,
        deleting: false,
      });
      await recargarCurriculas();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al eliminar la currícula';
      setToast({ type: 'error', text: message });
      setDeleteModal(prev => ({ ...prev, deleting: false }));
    }
  }

  if (!canAccess) {
    return (
      <div className="page-container">
        <div className="card" style={{ maxWidth: 720, margin: '48px auto', textAlign: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              margin: '0 auto 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#DC2626',
            }}
          >
            <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.72 3h16.92a2 2 0 001.72-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h1 style={{ fontSize: 26, margin: '0 0 10px', color: 'var(--text-primary)' }}>Acceso restringido</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.6 }}>
            El módulo de currículas solo está disponible para administradores del sistema y directores de escuela.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid #e2e8f0',
                borderTop: '3px solid #1a3a5c',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
                margin: '0 auto 12px',
              }}
            />
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>Cargando currículas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {toast && (
        <div
          className="card"
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 200,
            minWidth: 260,
            borderLeft: `4px solid ${toast.type === 'success' ? '#16A34A' : '#DC2626'}`,
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.18)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 4, color: 'var(--text-primary)' }}>
            {toast.type === 'success' ? 'Operación completada' : 'Atención'}
          </strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{toast.text}</span>
        </div>
      )}

      <div className="header-responsive" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color: darkMode ? '#fff' : '#1e293b',margin:'0 0 4px'}}>Currículas</h1>
          <p style={{color: darkMode ? '#94a3b8' : '#64748b',fontSize:'14px',margin:0}}>Gestión de planes de estudio por año, modalidad y estado</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={nuevo}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            <span className="hide-sm">Nueva currícula</span>
            <span className="show-sm">Nueva</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="responsive-grid">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Buscar</label>
            <input
              className="form-input"
              type="text"
              placeholder="Nombre, año, modalidad, estado o créditos"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Estado</label>
            <select
              className="form-input"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as 'todas' | EstadoCurricula)}
            >
              <option value="todas">Todas</option>
              {ESTADOS_CURRICULA.map((estado) => (
                <option key={estado} value={estado}>
                  {getEstadoLabel(estado)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(buscar || filtroEstado !== 'todas') && (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setBuscar('');
                setFiltroEstado('todas');
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th style={{ width: 170 }}>Estado</th>
              <th style={{ width: 140 }}>Créditos</th>
              <th style={{ width: 340 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {curriculasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '34px 16px', color: 'var(--text-secondary)' }}>
                  No hay currículas para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              curriculasFiltradas.map((curricula) => {
                const estadoStyle = ESTADO_STYLES[curricula.estado];
                const modalidadStyle = MODALIDAD_STYLES[curricula.modalidad_estudios];

                return (
                  <tr key={curricula.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {getCurriculaDisplayName(curricula)}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {CARRERA_CURRICULA_FIJA}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span className="badge" style={{ background: estadoStyle.bg, color: estadoStyle.color, width: 'fit-content' }}>
                          {getEstadoLabel(curricula.estado)}
                        </span>
                        <span className="badge" style={{ background: modalidadStyle.bg, color: modalidadStyle.color, width: 'fit-content' }}>
                          {formatEnumLabel(curricula.modalidad_estudios)}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{curricula.creditos_totales}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {curricula.estado === 'BORRADOR' && (
                          <a 
                            href={`/curriculas/${curricula.id}/configurar`}
                            className="btn-secondary"
                            style={{ 
                              textDecoration: 'none', 
                              display: 'inline-flex', 
                              alignItems: 'center',
                              padding: '10px 20px',
                              fontSize: '14px'
                            }}
                          >
                            Configurar
                          </a>
                        )}
                        <button className="btn-primary btn-crud-edit" onClick={() => editar(curricula)}>
                          Editar
                        </button>
                        {curricula.estado === 'EN_EXTINCION' && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => darPorConcluido(curricula)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '14px'
                            }}
                          >
                            Dar por concluido
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-danger-minimal"
                          onClick={() => iniciarEliminar(curricula)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: 0.8,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Eliminar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={guardar}>
              <div className="modal-header">
                <div>
                  <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>
                    {form.id ? 'Editar currícula' : 'Nueva currícula'}
                  </h2>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                    La carrera se mantiene fija y el nombre visible se arma automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                  aria-label="Cerrar modal"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre de la Carrera</label>
                  <input className="form-input" type="text" value={form.nombre_carrera} readOnly />
                </div>

                <div className="responsive-grid">
                  <div className="form-group">
                    <label className="form-label">Año de currícula</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1900}
                      step={1}
                      value={form.año_curricula}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          año_curricula: Number(e.target.value),
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Modalidad de estudios</label>
                    <select
                      className="form-input"
                      value={form.modalidad_estudios}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          modalidad_estudios: e.target.value as ModalidadCurricula,
                        }))
                      }
                    >
                      {MODALIDADES_CURRICULA.map((modalidad) => (
                        <option key={modalidad} value={modalidad}>
                          {formatEnumLabel(modalidad)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.id ? (
                    <div className="form-group">
                      <label className="form-label">Estado</label>
                      <input className="form-input" type="text" value={getEstadoLabel(form.estado)} readOnly />
                      <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                        El estado de la currícula no se puede editar manualmente.
                      </p>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Estado</label>
                      <input className="form-input" type="text" value="Borrador" readOnly />
                      <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                        Las currículas nuevas se crean como Borrador.
                      </p>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Créditos totales</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      step={1}
                      value={form.creditos_totales}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          creditos_totales: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : form.id ? 'Actualizar currícula' : 'Crear currícula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.show && deleteModal.curricula && (
        <div className="modal-overlay" onClick={() => setDeleteModal(prev => ({ ...prev, show: false }))}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.72 3h16.92a2 2 0 001.72-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  {deleteModal.step === 1 ? 'Confirmar Eliminación' : '¡Confirmación Requerida!'}
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {deleteModal.step === 1 ? 'Paso 1 de 2' : 'Paso 2 de 2 - Acción Irreversible'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModal(prev => ({ ...prev, show: false }))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 20,
                  lineHeight: 1,
                }}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {deleteModal.step === 1 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.5 }}>
                    ¿Está seguro de que desea eliminar la currícula <strong>{getCurriculaDisplayName(deleteModal.curricula)}</strong>?
                  </p>
                  
                  <div style={{ 
                    background: darkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)', 
                    borderLeft: '4px solid #EF4444', 
                    padding: '12px', 
                    borderRadius: '4px',
                    fontSize: 14,
                    color: darkMode ? '#FCA5A5' : '#B91C1C',
                    lineHeight: 1.5
                  }}>
                    <strong>Advertencia:</strong> Esta acción marcará como inactivos todos los cursos vinculados a esta currícula y la eliminará lógicamente de la lista.
                  </div>

                  {deleteModal.requiresDouble && (
                    <div style={{ 
                      background: darkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.05)', 
                      borderLeft: '4px solid #F59E0B', 
                      padding: '12px', 
                      borderRadius: '4px',
                      fontSize: 14,
                      color: darkMode ? '#FDE68A' : '#B45309',
                      lineHeight: 1.5
                    }}>
                      <strong>Atención:</strong> Esta currícula tiene actualmente <strong>{deleteModal.scheduleCount}</strong> horario(s) / asignaciones activas vinculadas.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ margin: 0, color: darkMode ? '#FCA5A5' : '#B91C1C', fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>
                    ¡Alerta de Eliminación de Horarios!
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.5 }}>
                    Estás a punto de eliminar la currícula y <strong>TODOS</strong> sus {deleteModal.scheduleCount} horario(s) vinculados permanentemente.
                  </p>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                    Esta acción es irreversible y liberará los bloques de horario asignados en la cuadrícula general.
                  </p>
                  <div style={{ 
                    background: darkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)', 
                    border: '1px dashed #EF4444', 
                    padding: '12px', 
                    borderRadius: '4px',
                    fontSize: 13,
                    color: darkMode ? '#FCA5A5' : '#EF4444',
                    textAlign: 'center',
                    fontWeight: 600
                  }}>
                    ¿Desea proceder a eliminar todo de forma definitiva?
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setDeleteModal(prev => ({ ...prev, show: false }))}
                disabled={deleteModal.deleting}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ 
                  backgroundColor: '#DC2626', 
                  borderColor: '#DC2626',
                  color: '#fff' 
                }} 
                onClick={ejecutarEliminar}
                disabled={deleteModal.deleting}
              >
                {deleteModal.deleting 
                  ? 'Eliminando...' 
                  : deleteModal.step === 1 && deleteModal.requiresDouble 
                    ? 'Entendido, continuar' 
                    : 'Sí, eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}