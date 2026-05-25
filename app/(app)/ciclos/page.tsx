'use client';

import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/lib/theme';

interface Ciclo {
  id: string;
  nombre: string;
  año: number;
  semestre: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  created_at: string;
}

const emptyCiclo: Partial<Ciclo> = {
  nombre: '',
  año: new Date().getFullYear(),
  semestre: 'I',
  fecha_inicio: '',
  fecha_fin: '',
  activo: false,
};

export default function CiclosPage() {
  const { darkMode } = useTheme();
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroAnio, setFiltroAnio] = useState('');
  const [filtroSemestre, setFiltroSemestre] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cicloAEliminar, setCicloAEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [editando, setEditando] = useState<Partial<Ciclo>>(emptyCiclo);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (buscar) params.set('buscar', buscar);
    if (filtroAnio) params.set('anio', filtroAnio);
    if (filtroSemestre) params.set('semestre', filtroSemestre);
    params.set('page', pagina.toString());
    params.set('limit', limit.toString());
    
    fetch(`/api/ciclos?${params}`)
      .then(r => r.json())
      .then(data => {
        setCiclos(data.data || []);
        setTotal(data.total || 0);
      })
      .catch(() => setMsg({ type: 'error', text: 'Error al cargar ciclos' }))
      .finally(() => setLoading(false));
  }, [buscar, filtroAnio, filtroSemestre, pagina]);

  useEffect(() => {
    const timer = setTimeout(cargar, 300);
    return () => clearTimeout(timer);
  }, [cargar]);

  useEffect(() => {
    setPagina(1);
  }, [buscar, filtroAnio, filtroSemestre]);

  async function guardar() {
    setSaving(true);
    setMsg(null);
    try {
      if (!editando.nombre || !editando.año || !editando.semestre) {
        throw new Error('Nombre, año y semestre son requeridos');
      }
      
      const method = editando.id ? 'PUT' : 'POST';
      const url = editando.id ? `/api/ciclos/${editando.id}` : '/api/ciclos';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editando),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      
      setMsg({ type: 'success', text: `Ciclo ${editando.id ? 'actualizado' : 'creado'} correctamente` });
      setShowModal(false);
      cargar();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function eliminarCiclo() {
    if (!cicloAEliminar) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ciclos/${cicloAEliminar.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setShowConfirm(false);
      setCicloAEliminar(null);
      cargar();
      setMsg({ type: 'success', text: 'Ciclo eliminado correctamente' });
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Error al eliminar ciclo' });
    } finally {
      setSaving(false);
    }
  }

  function handleEliminar(ciclo: Ciclo) {
    setCicloAEliminar({ id: ciclo.id, nombre: ciclo.nombre });
    setShowConfirm(true);
  }

  function nuevo() {
    setEditando({ ...emptyCiclo, año: new Date().getFullYear() });
    setShowModal(true);
    setMsg(null);
  }

  function editar(ciclo: Ciclo) {
    setEditando({ ...ciclo });
    setShowModal(true);
    setMsg(null);
  }

  async function generarReporte() {
    try {
      const params = new URLSearchParams();
      if (buscar) params.set('buscar', buscar);
      if (filtroAnio) params.set('anio', filtroAnio);
      if (filtroSemestre) params.set('semestre', filtroSemestre);
      params.set('reporte', 'true');
      
      const res = await fetch(`/api/ciclos?${params}`);
      const data = await res.json();
      const ciclosFull = data.data || [];
      
      if (ciclosFull.length === 0) {
        setMsg({ type: 'warning', text: 'No hay ciclos para generar el reporte' });
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
      if (buscar) filtrosTexto += ` | Búsqueda: "${buscar}"`;
      if (filtroAnio) filtrosTexto += ` | Año: ${filtroAnio}`;
      if (filtroSemestre) filtrosTexto += ` | Semestre: ${filtroSemestre}`;
      doc.text(`Total de registros: ${ciclosFull.length}${filtrosTexto}`, 14, 57);

      const tableData = ciclosFull.map((c: Ciclo, i: number) => [
        i + 1,
        c.nombre,
        c.año.toString(),
        c.semestre,
        c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString('es-PE') : '-',
        c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-PE') : '-',
        c.activo ? 'ACTIVO' : 'INACTIVO'
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['#', 'NOMBRE', 'AÑO', 'SEMESTRE', 'INICIO', 'FIN', 'ESTADO']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { cellWidth: 40 }, 2: { halign: 'center', cellWidth: 15 }, 3: { halign: 'center', cellWidth: 20 }, 4: { halign: 'center', cellWidth: 25 }, 5: { halign: 'center', cellWidth: 25 }, 6: { halign: 'center', cellWidth: 20 } },
        didDrawPage: (data) => {
          const str = 'Página ' + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        }
      });
      doc.save(`reporte_ciclos_${new Date().getTime()}.pdf`);
    } catch (error) {
      setMsg({ type: 'error', text: 'Error al generar el reporte' });
    }
  }

  const aniosDisponibles = [...new Set(ciclos.map(c => c.año))].sort((a, b) => b - a);

  return (
    <div className="page-container">
      <div className="header-responsive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>Ciclos Académicos</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Gestión de períodos académicos</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={generarReporte}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span className="hide-sm">Reporte</span>
          </button>
          <button className="btn-primary" onClick={nuevo}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hide-sm">Nuevo ciclo</span>
            <span className="show-sm">Nuevo</span>
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div className="filters-grid">
          <input
            className="form-input"
            placeholder="Buscar por nombre..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
          />
          <div className="filters-group">
            <select className="form-input" style={{ width: 'auto' }} value={filtroAnio} onChange={e => setFiltroAnio(e.target.value)}>
              <option value="">Todos los años</option>
              {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className="form-input" style={{ width: 'auto' }} value={filtroSemestre} onChange={e => setFiltroSemestre(e.target.value)}>
              <option value="">Todos los semestres</option>
              <option value="I">I</option>
              <option value="II">II</option>
            </select>
          </div>
        </div>
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
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Cargando...</td></tr>
              ) : ciclos.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  {buscar || filtroAnio || filtroSemestre ? 'No se encontraron ciclos con esos filtros' : 'No hay ciclos registrados'}
                </td></tr>
              ) : (
                ciclos.map((c, i) => (
                  <tr key={c.id}>
                    <td className="hide-sm" style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>{(pagina - 1) * limit + i + 1}</td>
                    <td style={{ fontWeight: '500' }}>{c.nombre}</td>
                    <td>{c.año}</td>
                    <td>{c.semestre}</td>
                    <td className="hide-sm" style={{ fontSize: '12px', color: '#64748b' }}>{c.fecha_inicio?.split('T')[0] || '-'}</td>
                    <td className="hide-sm" style={{ fontSize: '12px', color: '#64748b' }}>{c.fecha_fin?.split('T')[0] || '-'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', background: c.activo ? '#dcfce7' : '#fee2e2', color: c.activo ? '#166534' : '#991b1b' }}>
                        {c.activo ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => editar(c)}>
                          <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          <span className="hide-sm">Editar</span>
                        </button>
                        <button className="btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleEliminar(c)}>
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
        {!loading && total > limit && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderTop: '1px solid ' + (darkMode ? '#374151' : '#e2e8f0') }}>
            <div style={{ fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b' }}>
              Mostrando <span style={{ fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>{(pagina - 1) * limit + 1}</span> a{' '}
              <span style={{ fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>{Math.min(pagina * limit, total)}</span> de{' '}
              <span style={{ fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>{total}</span> ciclos
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ padding: '6px 12px', color: darkMode ? '#00A6FF' : undefined }} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '14px', fontWeight: '600', color: darkMode ? '#00A6FF' : '#1e293b' }}>Página {pagina} de {Math.ceil(total / limit)}</div>
              <button className="btn-secondary" style={{ padding: '6px 12px', color: darkMode ? '#00A6FF' : undefined }} disabled={pagina >= Math.ceil(total / limit)} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
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
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="responsive-grid">
                <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" placeholder="Ej: 2026-I" value={editando.nombre || ''} onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Año *</label><input type="number" className="form-input" value={editando.año || ''} onChange={e => setEditando(p => ({ ...p, año: parseInt(e.target.value) || 0 }))} /></div>
                <div className="form-group"><label className="form-label">Semestre *</label><select className="form-input" value={editando.semestre || 'I'} onChange={e => setEditando(p => ({ ...p, semestre: e.target.value }))}><option value="I">I</option><option value="II">II</option></select></div>
                <div className="form-group"><label className="form-label">Fecha inicio</label><input type="date" className="form-input" value={editando.fecha_inicio?.split('T')[0] || ''} onChange={e => setEditando(p => ({ ...p, fecha_inicio: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Fecha fin</label><input type="date" className="form-input" value={editando.fecha_fin?.split('T')[0] || ''} onChange={e => setEditando(p => ({ ...p, fecha_fin: e.target.value }))} /></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="activo" checked={editando.activo || false} onChange={e => setEditando(p => ({ ...p, activo: e.target.checked }))} />
                  <label htmlFor="activo" className="form-label" style={{ margin: 0 }}>Activo (solo un ciclo puede estar activo)</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
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
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>¿Eliminar ciclo?</h2>
              </div>
            </div>
            <div className="modal-body" style={{ paddingTop: '16px' }}>
              <p style={{ margin: 0, color: '#64748b', lineHeight: '1.5' }}>¿Estás seguro que deseas eliminar el ciclo <strong>{cicloAEliminar?.nombre}</strong>? Esta acción no se puede deshacer.</p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0, marginTop: '8px' }}>
              <button className="btn-secondary" onClick={() => { setShowConfirm(false); setCicloAEliminar(null); }}>Cancelar</button>
              <button className="btn-danger" onClick={eliminarCiclo} disabled={saving}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}