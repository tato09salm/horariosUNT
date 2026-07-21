'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';

interface Ciclo {
  id: string;
  nombre: string;
  año: number;
  semestre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  estado: string;
  created_at: string;
}

const emptyCiclo: Partial<Ciclo> = {
  nombre: '',
  año: new Date().getFullYear(),
  semestre: 'I',
  tipo: 'regular',
  fecha_inicio: '',
  fecha_fin: '',
  activo: false,
};

export default function CiclosPage() {
  const { darkMode } = useTheme();
  const user = useUser();
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const canWrite = isAdmin || isDirector; // Director puede escribir

  // ── Persistir filtros en URL ──────────────────────────────────────────────
  const getParam = (key: string) =>
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get(key) || ''
      : '';

  const [buscar,          setBuscar]          = useState(() => getParam('buscar'));
  const [filtroAnio,      setFiltroAnio]      = useState(() => getParam('anio'));
  const [filtroSemestre,  setFiltroSemestre]  = useState(() => getParam('semestre'));

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscar)         params.set('buscar',   buscar);
    if (filtroAnio)     params.set('anio',     filtroAnio);
    if (filtroSemestre) params.set('semestre', filtroSemestre);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [buscar, filtroAnio, filtroSemestre]);

  const hayFiltrosActivos = !!(buscar || filtroAnio || filtroSemestre);

  function limpiarFiltros() {
    setBuscar('');
    setFiltroAnio('');
    setFiltroSemestre('');
    setPagina(1);
  }

  const [ciclos,      setCiclos]      = useState<Ciclo[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingPDF,  setLoadingPDF]  = useState(false);
  const [pagina,      setPagina]      = useState(1);
  const [total,       setTotal]       = useState(0);
  const limit = 10;

  const [showModal,        setShowModal]        = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showActualConfirm, setShowActualConfirm] = useState(false);
  const [cicloAEliminar,   setCicloAEliminar]   = useState<{ id: string; nombre: string } | null>(null);
  const [cicloActual,      setCicloActual]      = useState<{ id: string; nombre: string } | null>(null);
  const [editando,         setEditando]         = useState<Partial<Ciclo>>(emptyCiclo);
  const editandoOriginal                        = useRef<Partial<Ciclo>>(emptyCiclo);
  const [saving,           setSaving]           = useState(false);
  const [toast,            setToast]            = useState<{ type: string; text: string } | null>(null);

  // ── Auto-dismiss toast ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (buscar)         params.set('buscar',   buscar);
    if (filtroAnio)     params.set('anio',     filtroAnio);
    if (filtroSemestre) params.set('semestre', filtroSemestre);
    params.set('page',  pagina.toString());
    params.set('limit', limit.toString());

    fetch(`/api/ciclos?${params}`)
      .then(r => r.json())
      .then(data => { setCiclos(data.data || []); setTotal(data.total || 0); })
      .catch(() => setToast({ type: 'error', text: 'Error al cargar ciclos. Verifica tu conexión.' }))
      .finally(() => setLoading(false));
  }, [buscar, filtroAnio, filtroSemestre, pagina]);

  // ── Debounce 400 ms ───────────────────────────────────────────────────────
  useEffect(() => { const t = setTimeout(cargar, 400); return () => clearTimeout(t); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroAnio, filtroSemestre]);

  // ── Detectar cambios en modal ─────────────────────────────────────────────
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
      if (!editando.nombre || !editando.año)
        throw new Error('Nombre y año son requeridos');
      
      if (editando.tipo === 'regular' && !editando.semestre)
        throw new Error('Semestre es requerido para ciclos regulares');

      const { activo: _activo, ...payload } = editando;
      const method = editando.id ? 'PUT' : 'POST';
      const url    = editando.id ? `/api/ciclos/${editando.id}` : '/api/ciclos';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');

      setShowModal(false);
      setToast({ type: 'success', text: `Ciclo ${editando.id ? 'actualizado' : 'creado'} correctamente` });
      cargar();
    } catch (e: any) {
      setToast({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCiclo() {
    if (!cicloAEliminar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ciclos/${cicloAEliminar.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setShowConfirm(false);
      setCicloAEliminar(null);
      setToast({ type: 'success', text: 'Ciclo eliminado correctamente' });
      cargar();
    } catch {
      setToast({ type: 'error', text: 'Error al eliminar ciclo' });
    } finally {
      setSaving(false);
    }
  }

  function handleEliminar(ciclo: Ciclo) {
    setCicloAEliminar({ id: ciclo.id, nombre: ciclo.nombre });
    setShowConfirm(true);
  }

  function activarCiclo(ciclo: Ciclo) {
    setCicloActual({ id: ciclo.id, nombre: ciclo.nombre });
    setShowActualConfirm(true);
  }

  async function confirmarCicloActual() {
    if (!cicloActual) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ciclos/${cicloActual.id}/actual`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al establecer el ciclo actual');

      setShowActualConfirm(false);
      setCicloActual(null);
      setToast({ type: 'success', text: `Ciclo ${cicloActual.nombre} establecido como actual` });
      cargar();
    } catch (e: any) {
      setToast({ type: 'error', text: e.message || 'Error al cambiar el ciclo actual' });
    } finally {
      setSaving(false);
    }
  }

  function nuevo() {
    const base = { ...emptyCiclo, año: new Date().getFullYear() };
    setEditando(base);
    editandoOriginal.current = base;
    setShowModal(true);
  }

  function editar(ciclo: Ciclo) {
    const base = { ...ciclo };
    setEditando(base);
    editandoOriginal.current = base;
    setShowModal(true);
  }

  // ── Reporte PDF (loadingPDF separado, no bloquea la tabla) ────────────────
  async function generarReporte() {
    setLoadingPDF(true);
    try {
      const params = new URLSearchParams();
      if (buscar)         params.set('buscar',   buscar);
      if (filtroAnio)     params.set('anio',     filtroAnio);
      if (filtroSemestre) params.set('semestre', filtroSemestre);
      params.set('reporte', 'true');

      const res = await fetch(`/api/ciclos?${params}`);
      const data = await res.json();
      const ciclosFull: Ciclo[] = data.data || [];

      if (ciclosFull.length === 0) {
        setToast({ type: 'error', text: 'No hay ciclos para generar el reporte' });
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Escuela de Ingeniería de Sistemas', 105, 28, { align: 'center' });
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 35, 196, 35);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE DE CICLOS ACADÉMICOS', 14, 45);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);

      let filtrosTexto = '';
      if (buscar)         filtrosTexto += ` | Búsqueda: "${buscar}"`;
      if (filtroAnio)     filtrosTexto += ` | Año: ${filtroAnio}`;
      if (filtroSemestre) filtrosTexto += ` | Semestre: ${filtroSemestre}`;
      doc.text(`Total de registros: ${ciclosFull.length}${filtrosTexto}`, 14, 57);

      const tableData = ciclosFull.map((c, i) => [
        i + 1,
        c.nombre,
        c.año.toString(),
        c.semestre,
        c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString('es-PE') : '-',
        c.fecha_fin    ? new Date(c.fecha_fin).toLocaleDateString('es-PE')    : '-',
        c.estado ? c.estado.toUpperCase() : 'PENDIENTE',
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['#', 'NOMBRE', 'AÑO', 'SEMESTRE', 'INICIO', 'FIN', 'ESTADO']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 40 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 25 },
          5: { halign: 'center', cellWidth: 25 },
          6: { halign: 'center', cellWidth: 20 },
        },
        didDrawPage: (data) => {
          const str = 'Página ' + (doc.internal as any).getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        },
      });

      doc.save(`reporte_ciclos_${new Date().getTime()}.pdf`);
      setToast({ type: 'success', text: 'Reporte generado correctamente' });
    } catch {
      setToast({ type: 'error', text: 'Error al generar el reporte' });
    } finally {
      setLoadingPDF(false);
    }
  }

  const aniosDisponibles = [...new Set(ciclos.map(c => c.año))].sort((a, b) => b - a);
  const totalPaginas = Math.ceil(total / limit);

  return (
    <div className="page-container">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 18px', borderRadius: 12,
          background: toast.type === 'success' ? '#f0fdf4' : '#fff5f5',
          border: `1px solid ${toast.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: toast.type === 'success' ? '#166534' : '#991b1b',
          fontSize: 14, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
          animation: 'slideIn 0.2s ease',
        }}>
          {toast.type === 'success'
            ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          }
          {toast.text}
        </div>
      )}

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Ciclos Académicos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Gestión de períodos académicos</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={generarReporte} disabled={loadingPDF}>
            {loadingPDF
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ animation: 'spin 1s linear infinite' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v4m0 8v4M4 12h4m8 0h4"/></svg>
              : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            }
            <span className="hide-sm">{loadingPDF ? 'Generando...' : 'Reporte'}</span>
          </button>
          {canWrite && (
            <button className="btn-primary" onClick={nuevo}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              <span className="hide-sm">Nuevo ciclo</span>
              <span className="show-sm">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '16px', padding: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Buscar</label>
            <input
              className="form-input"
              style={{ width: '100%', textTransform: 'uppercase', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px' }}
              placeholder="Nombre del ciclo..."
              value={buscar}
              onChange={e => setBuscar(e.target.value.toUpperCase())}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Año</label>
            <select
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer' }}
              value={filtroAnio}
              onChange={e => setFiltroAnio(e.target.value)}
            >
              <option value="">Todos los años</option>
              {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Semestre</label>
            <select
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '14px', cursor: 'pointer' }}
              value={filtroSemestre}
              onChange={e => setFiltroSemestre(e.target.value)}
            >
              <option value="">Todos los semestres</option>
              <option value="I">I</option>
              <option value="II">II</option>
              <option value="EXT">EXT</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '2px' }}>Acciones</label>
            <button
              onClick={limpiarFiltros}
              title="Limpiar filtros"
              disabled={!hayFiltrosActivos}
              style={{
                width: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1.5px solid ' + (hayFiltrosActivos ? (darkMode ? 'rgba(239,68,68,0.4)' : '#fca5a5') : (darkMode ? 'rgba(148,163,184,0.2)' : '#e2e8f0')),
                background: hayFiltrosActivos ? (darkMode ? 'rgba(239,68,68,0.15)' : '#fff5f5') : (darkMode ? 'rgba(148,163,184,0.08)' : '#f8fafc'),
                color: hayFiltrosActivos ? (darkMode ? '#fca5a5' : '#991b1b') : (darkMode ? '#94a3b8' : '#94a3b8'),
                cursor: hayFiltrosActivos ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                opacity: hayFiltrosActivos ? 1 : 0.6,
              }}
              onMouseEnter={e => {
                if (hayFiltrosActivos) {
                  e.currentTarget.style.background = darkMode ? 'rgba(239,68,68,0.25)' : '#fee2e2';
                }
              }}
              onMouseLeave={e => {
                if (hayFiltrosActivos) {
                  e.currentTarget.style.background = darkMode ? 'rgba(239,68,68,0.15)' : '#fff5f5';
                }
              }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Limpiar
            </button>
          </div>
        </div>

        {/* Contador resultados */}
        {!loading && hayFiltrosActivos && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              {total === 0
                ? 'Sin resultados para los filtros aplicados'
                : <><strong style={{ color: 'var(--text-primary)' }}>{total}</strong> ciclo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</>
              }
            </p>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="hide-sm">#</th>
                <th>Nombre</th>
                <th>Año</th>
                <th>Semestre</th>
                <th className="hide-sm">Inicio</th>
                <th className="hide-sm">Fin</th>
                <th>Estado</th>
                {canWrite && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Cargando...</td></tr>
              ) : ciclos.length === 0 ? (
                <tr><td colSpan={canWrite ? 8 : 7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  {hayFiltrosActivos ? 'No se encontraron ciclos con esos filtros' : 'No hay ciclos registrados'}
                </td></tr>
              ) : ciclos.map((c, i) => (
                <tr key={c.id}>
                  <td className="hide-sm" style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>{(pagina - 1) * limit + i + 1}</td>
                  <td style={{ fontWeight: '500' }}>{c.nombre}</td>
                  <td>{c.año}</td>
                  <td>{c.semestre}</td>
                  <td className="hide-sm" style={{ fontSize: '12px', color: '#64748b' }}>{c.fecha_inicio?.split('T')[0] || '-'}</td>
                  <td className="hide-sm" style={{ fontSize: '12px', color: '#64748b' }}>{c.fecha_fin?.split('T')[0] || '-'}</td>
                  <td>
                    <span className={`docentes-status-badge ${
                      c.activo ? 'docentes-status-badge--activo' :
                      'docentes-status-badge--inactivo'
                    }`}>
                      {c.activo ? '● Activo' :
                       '○ Inactivo'}
                    </span>
                  </td>
                  {canWrite && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!c.activo && (
                          <button
                            className="btn-primary"
                            style={{ padding: '5px 10px', fontSize: '12px' }}
                            onClick={() => activarCiclo(c)}
                            disabled={saving}
                          >
                            <span className="hide-sm">Establecer como actual</span>
                            <span className="show-sm">Actual</span>
                          </button>
                        )}

                        <button
                          className="btn-secondary btn-crud-edit"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => editar(c)}
                        >
                          <span className="hide-sm">Editar</span>
                        </button>

                        <button
                          className="btn-secondary btn-crud-deactivate"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleEliminar(c)}
                        >
                          <span className="hide-sm">Desactivar</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderTop: '1px solid ' + (darkMode ? '#374151' : '#e2e8f0') }}>
            <div style={{ fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b' }}>
              Mostrando{' '}
              <strong style={{ color: darkMode ? '#00A6FF' : '#1e293b' }}>{(pagina - 1) * limit + 1}</strong> a{' '}
              <strong style={{ color: darkMode ? '#00A6FF' : '#1e293b' }}>{Math.min(pagina * limit, total)}</strong> de{' '}
              <strong style={{ color: darkMode ? '#00A6FF' : '#1e293b' }}>{total}</strong> ciclos
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button className="btn-secondary" style={{ padding: '6px 12px' }} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <span style={{ fontSize: '14px', fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b', padding: '0 8px' }}>{pagina} / {totalPaginas}</span>
              <button className="btn-secondary" style={{ padding: '6px 12px' }} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{editando.id ? 'Editar ciclo' : 'Nuevo ciclo'}</h2>
              <button onClick={intentarCerrarModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="responsive-grid">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" placeholder="Ej: 2026-I" value={editando.nombre || ''} onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Año *</label>
                  <input type="number" className="form-input" value={editando.año || ''} onChange={e => setEditando(p => ({ ...p, año: parseInt(e.target.value) || 0 }))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo ciclo *</label>
                  <select className="form-input" value={editando.tipo || 'regular'} onChange={e => {
                    const tipo = e.target.value;
                    setEditando(p => ({ 
                      ...p, 
                      tipo, 
                      semestre: tipo === 'extraordinario' ? 'EXT' : 'I' 
                    }));
                  }}>
                    <option value="regular">Regular</option>
                    <option value="extraordinario">Extraordinario</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Semestre {editando.tipo === 'regular' ? '*' : ''}</label>
                  <select 
                    className="form-input" 
                    value={editando.semestre || (editando.tipo === 'extraordinario' ? 'EXT' : 'I')} 
                    onChange={e => setEditando(p => ({ ...p, semestre: e.target.value }))}
                    disabled={editando.tipo === 'extraordinario'}
                    style={{ opacity: editando.tipo === 'extraordinario' ? 0.6 : 1, cursor: editando.tipo === 'extraordinario' ? 'not-allowed' : 'pointer' }}
                  >
                    {editando.tipo === 'regular' ? (
                      <>
                        <option value="I">I</option>
                        <option value="II">II</option>
                      </>
                    ) : (
                      <option value="EXT">EXT</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha inicio</label>
                  <input type="date" className="form-input" value={editando.fecha_inicio?.split('T')[0] || ''} onChange={e => setEditando(p => ({ ...p, fecha_inicio: e.target.value }))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha fin</label>
                  <input type="date" className="form-input" value={editando.fecha_fin?.split('T')[0] || ''} onChange={e => setEditando(p => ({ ...p, fecha_fin: e.target.value }))}/>
                </div>
              </div>
              <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#dc2626', fontWeight: 600 }}>*</span> Campo obligatorio. El ciclo actual se define con el botón de la tabla.
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
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d97706' }}>
                <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '50%' }}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>¿Descartar cambios?</h2>
              </div>
            </div>
            <div className="modal-body" style={{ paddingTop: '16px' }}>
              <p style={{ margin: 0, color: '#64748b', lineHeight: '1.5' }}>
                Tienes cambios sin guardar. Si cierras ahora, se perderán. ¿Estás seguro?
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => setShowCloseConfirm(false)}>Seguir editando</button>
              <button className="btn-danger" onClick={() => { setShowCloseConfirm(false); setShowModal(false); }}>Sí, descartar</button>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>¿Eliminar ciclo?</h2>
              </div>
            </div>
            <div className="modal-body" style={{ paddingTop: '16px' }}>
              <p style={{ margin: 0, color: '#64748b', lineHeight: '1.5' }}>
                ¿Estás seguro que deseas eliminar el ciclo <strong>{cicloAEliminar?.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => { setShowConfirm(false); setCicloAEliminar(null); }}>Cancelar</button>
              <button className="btn-danger" onClick={eliminarCiclo} disabled={saving}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Establecer actual */}
      {showActualConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#2563eb' }}>
                <div style={{ background: darkMode ? 'rgba(59,130,246,0.18)' : '#dbeafe', padding: '8px', borderRadius: '50%' }}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>¿Establecer como actual?</h2>
              </div>
            </div>
            <div className="modal-body" style={{ paddingTop: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                El ciclo <strong>{cicloActual?.nombre}</strong> pasará a ser el ciclo académico actual y el resto quedará inactivo.
              </p>
              <div style={{ marginTop: '12px', padding: '12px', background: darkMode ? 'rgba(234, 179, 8, 0.1)' : '#fef9c3', borderRadius: '8px', border: `1px solid ${darkMode ? 'rgba(234, 179, 8, 0.3)' : '#fde047'}` }}>
                <p style={{ margin: 0, color: darkMode ? '#fde047' : '#854d0e', fontSize: '13px', fontWeight: '500', lineHeight: '1.4' }}>
                  ⚠️ Antes de establecer este ciclo como actual, asegúrate de haber asignado la carga horaria de los docentes en el módulo "Carga horaria".
                </p>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => { setShowActualConfirm(false); setCicloActual(null); }}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarCicloActual} disabled={saving}>{saving ? 'Cambiando...' : 'Sí, establecer'}</button>
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