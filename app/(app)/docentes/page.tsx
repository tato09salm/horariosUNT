'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/lib/theme';

const categorias = ['principal', 'asociado', 'auxiliar', 'jefe_practica'];
const condiciones = ['nombrado', 'contratado'];
const grados = ['bachiller', 'licenciado', 'magister', 'doctor'];

interface Docente {
  id: string; nombre: string; apellidos: string;
  dni: string; email: string; telefono: string; categoria: string;
  condicion: string; fecha_ingreso: string; grado_academico: string;
  horas_max_semana: number; activo: boolean;
}

const emptyDocente: Partial<Docente> = {
  nombre: '', apellidos: '', dni: '', email: '', telefono: '',
  categoria: 'auxiliar', condicion: 'contratado', fecha_ingreso: '',
  grado_academico: 'licenciado', horas_max_semana: 20, activo: true,
};

interface FormErrors {
  dni?: string; nombre?: string; apellidos?: string;
  email?: string; horas_max_semana?: string; fecha_ingreso?: string;
}

function validarForm(d: Partial<Docente>): FormErrors {
  const e: FormErrors = {};
  if (!d.dni || d.dni.length !== 8)        e.dni           = 'El DNI debe tener exactamente 8 dígitos';
  if (!d.nombre?.trim())                   e.nombre        = 'El nombre es obligatorio';
  if (!d.apellidos?.trim())                e.apellidos     = 'Los apellidos son obligatorios';
  if (!d.fecha_ingreso)                    e.fecha_ingreso = 'La fecha de ingreso es obligatoria';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
                                           e.email         = 'Formato de email inválido';
  const h = d.horas_max_semana;
  if (h === undefined || h === null || isNaN(Number(h)) || Number(h) < 1 || Number(h) > 40)
                                           e.horas_max_semana = 'Debe ser un número entre 1 y 40';
  return e;
}

export default function DocentesPage() {
  const { darkMode } = useTheme();

  // ── Persistir filtros en URL ──────────────────────────────────────────────
  const getParam = (key: string) => typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(key) || '' : '';

  const [buscar,          setBuscar]          = useState(() => getParam('buscar'));
  const [filtroCategoria, setFiltroCategoria] = useState(() => getParam('categoria'));
  const [filtroCondicion, setFiltroCondicion] = useState(() => getParam('condicion'));

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscar)          params.set('buscar',    buscar);
    if (filtroCategoria) params.set('categoria', filtroCategoria);
    if (filtroCondicion) params.set('condicion', filtroCondicion);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [buscar, filtroCategoria, filtroCondicion]);

  const hayFiltrosActivos = !!(buscar || filtroCategoria || filtroCondicion);

  function limpiarFiltros() {
    setBuscar('');
    setFiltroCategoria('');
    setFiltroCondicion('');
    setPagina(1);
  }

  const [docentes,         setDocentes]         = useState<Docente[]>([]);
  const [loadingTabla,     setLoadingTabla]     = useState(true);
  const [loadingPDF,       setLoadingPDF]       = useState(false);
  const [pagina,           setPagina]           = useState(1);
  const [total,            setTotal]            = useState(0);
  const limit = 10;

  const [showModal,        setShowModal]        = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [docenteAToggle,   setDocenteAToggle]   = useState<{id:string; nombre:string; activo:boolean}|null>(null);
  const [editando,         setEditando]         = useState<Partial<Docente>>(emptyDocente);
  const editandoOriginal                        = useRef<Partial<Docente>>(emptyDocente);
  const [formErrors,       setFormErrors]       = useState<FormErrors>({});
  const [touched,          setTouched]          = useState<Record<string,boolean>>({});
  const [saving,           setSaving]           = useState(false);
  const [toast,            setToast]            = useState<{type:string; text:string}|null>(null);
  const [modalError,       setModalError]       = useState<string|null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const cargar = useCallback(() => {
    setLoadingTabla(true);
    const q = new URLSearchParams();
    if (buscar)          q.set('buscar',    buscar);
    if (filtroCategoria) q.set('categoria', filtroCategoria);
    if (filtroCondicion) q.set('condicion', filtroCondicion);
    q.set('page',              pagina.toString());
    q.set('limit',             limit.toString());
    q.set('verificarUsuarios', 'true');
    fetch(`/api/docentes?${q}`)
      .then(r => r.json())
      .then(d => { setDocentes(d.data || []); setTotal(d.total || 0); })
      .catch(() => setToast({ type: 'error', text: 'Error al cargar docentes. Verifica tu conexión.' }))
      .finally(() => setLoadingTabla(false));
  }, [buscar, filtroCategoria, filtroCondicion, pagina]);

  useEffect(() => { const t = setTimeout(cargar, 400); return () => clearTimeout(t); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroCategoria, filtroCondicion]);

  useEffect(() => {
    if (showModal) setFormErrors(validarForm(editando));
  }, [editando, showModal]);

  function campo<K extends keyof Docente>(key: K, value: Docente[K]) {
    setEditando(p => ({ ...p, [key]: value }));
    setTouched(p => ({ ...p, [key]: true }));
  }

  function errorDe(key: keyof FormErrors) {
    return touched[key] ? formErrors[key] : undefined;
  }

  function hayChangios(): boolean {
    return JSON.stringify(editando) !== JSON.stringify(editandoOriginal.current);
  }

  function intentarCerrarModal() {
    if (hayChangios()) {
      setShowCloseConfirm(true);
    } else {
      setShowModal(false);
    }
  }

  async function guardar() {
    setTouched({ dni:true, nombre:true, apellidos:true, email:true, horas_max_semana:true, fecha_ingreso:true });
    const errors = validarForm(editando);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setModalError(null);
    try {
      const method = editando.id ? 'PUT' : 'POST';
      const url    = editando.id ? `/api/docentes/${editando.id}` : '/api/docentes';
      const payload = { ...editando, horas_max_semana: Number(editando.horas_max_semana) || 20 };
      const res  = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      setShowModal(false);
      setToast({ type: 'success', text: `Docente ${editando.id ? 'actualizado' : 'creado'} correctamente` });
      cargar();
    } catch (e: any) {
      setModalError(e.message);
    } finally { setSaving(false); }
  }

  async function confirmarToggle() {
    if (!docenteAToggle) return;
    setSaving(true);
    try {
      const resDoc = await fetch(`/api/docentes/${docenteAToggle.id}`);
      const { data: d } = await resDoc.json();
      const res = await fetch(`/api/docentes/${docenteAToggle.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, activo: !docenteAToggle.activo }),
      });
      if (!res.ok) throw new Error();
      setShowConfirm(false);
      setDocenteAToggle(null);
      setToast({ type: 'success', text: `Docente ${docenteAToggle.activo ? 'desactivado' : 'activado'} correctamente` });
      cargar();
    } catch {
      setToast({ type: 'error', text: 'Error al cambiar estado del docente' });
    } finally { setSaving(false); }
  }

  function toggleEstado(d: Docente) {
    setDocenteAToggle({ id: d.id, nombre: `${d.apellidos.toUpperCase()} ${d.nombre.toUpperCase()}`, activo: d.activo });
    setShowConfirm(true);
  }

  function nuevo() {
    const base = { ...emptyDocente };
    setEditando(base);
    editandoOriginal.current = base;
    setFormErrors({});
    setTouched({});
    setModalError(null);
    setShowModal(true);
  }

  function editar(d: Docente) {
    const base = { ...d, nombre: d.nombre.toUpperCase(), apellidos: d.apellidos.toUpperCase() };
    setEditando(base);
    editandoOriginal.current = base;
    setFormErrors(validarForm(d));
    setTouched({});
    setModalError(null);
    setShowModal(true);
  }

  async function generarReporte() {
    setLoadingPDF(true);
    try {
      const q = new URLSearchParams();
      if (buscar)          q.set('buscar',    buscar);
      if (filtroCategoria) q.set('categoria', filtroCategoria);
      if (filtroCondicion) q.set('condicion', filtroCondicion);
      q.set('reporte', 'true');
      const res  = await fetch(`/api/docentes?${q}`);
      const data = await res.json();
      const todos = data.data || [];
      const doc = new jsPDF();
      doc.setFontSize(16); doc.setTextColor(30, 41, 59);
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 105, 28, { align: 'center' });
      doc.setDrawColor(226, 232, 240); doc.line(14, 35, 196, 35);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('REPORTE OFICIAL DE CUERPO DOCENTE', 14, 45);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);
      doc.text(`Total de registros: ${todos.length}`, 14, 57);
      autoTable(doc, {
        startY: 65,
        head: [['ORD.', 'APELLIDOS Y NOMBRES', 'DNI', 'CATEGORÍA', 'CONDICIÓN', 'GRADO', 'HRS', 'ESTADO']],
        body: todos.map((d: Docente, i: number) => [
          i + 1,
          `${d.apellidos.toUpperCase()} ${d.nombre.toUpperCase()}`,
          d.dni || '—', d.categoria.replace('_', ' ').toUpperCase(),
          d.condicion.toUpperCase(), d.grado_academico.toUpperCase(),
          d.horas_max_semana + 'h', d.activo ? 'ACTIVO' : 'INACTIVO',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30,41,59], textColor: [255,255,255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [51,65,85] },
        columnStyles: {
          0: { halign:'center', cellWidth:12 }, 2: { halign:'center', cellWidth:20 },
          3: { halign:'center' }, 4: { halign:'center' }, 5: { halign:'center' },
          6: { halign:'center', cellWidth:15 }, 7: { halign:'center' },
        },
        didDrawPage: () => {
          doc.setFontSize(8); doc.setTextColor(148, 163, 184);
          doc.text('Página ' + doc.internal.getNumberOfPages(), 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        },
      });
      doc.save(`reporte_docentes_${new Date().getTime()}.pdf`);
    } catch {
      setToast({ type: 'error', text: 'Error al generar el reporte' });
    } finally { setLoadingPDF(false); }
  }

  const formValido    = Object.keys(validarForm(editando)).length === 0;
  const totalPaginas  = Math.ceil(total / limit);

  const inputStyle = (err?: string): React.CSSProperties => ({
    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 14,
    border: `1.5px solid ${err ? '#fca5a5' : 'var(--border-color)'}`,
    background: err ? (darkMode ? 'rgba(239,68,68,0.08)' : '#fff5f5') : 'var(--bg-card)',
    color: 'var(--text-primary)', outline: 'none',
  });

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
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px'}}>Docentes</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Gestión del cuerpo docente</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={generarReporte} disabled={loadingPDF}>
            {loadingPDF
              ? <span style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',display:'inline-block',animation:'spin 0.7s linear infinite'}} />
              : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            }
            <span className="hide-sm">{loadingPDF ? 'Generando...' : 'Reporte'}</span>
          </button>
          <button className="btn-primary" onClick={nuevo}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            <span className="hide-sm">Nuevo docente</span>
            <span className="show-sm">Nuevo</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'flex', gap:'12px', alignItems:'center', width:'100%'}}>

          {/* Buscador */}
          <div style={{position:'relative', flex:'1 1 0', minWidth:0}}>
            <input
              className="form-input"
              placeholder="Buscar por nombre o DNI..."
              value={buscar}
              onChange={e => setBuscar(e.target.value.toUpperCase())}
              style={{width:'100%', paddingRight: loadingTabla && buscar ? 36 : undefined, textTransform:'uppercase'}}
            />
            {loadingTabla && buscar && (
              <span style={{
                position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                width:14, height:14, borderRadius:'50%',
                border:'2px solid var(--border-color)', borderTopColor:'#1a3a5c',
                display:'inline-block', animation:'spin 0.7s linear infinite',
              }} />
            )}
          </div>

          {/* Select categoría */}
          <select
            className="form-input"
            style={{flex:'0 0 200px'}}
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
          </select>

          {/* Select condición */}
          <select
            className="form-input"
            style={{flex:'0 0 200px'}}
            value={filtroCondicion}
            onChange={e => setFiltroCondicion(e.target.value)}
          >
            <option value="">Todas las condiciones</option>
            {condiciones.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* ── MEJORA: Botón limpiar filtros ── */}
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              title="Limpiar filtros"
              style={{
                flexShrink:0, display:'flex', alignItems:'center', gap:6,
                padding:'8px 14px', borderRadius:8, fontSize:13, fontWeight:500,
                border:'1.5px solid #fca5a5', background:'#fff5f5', color:'#991b1b',
                cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Contador de resultados */}
        {!loadingTabla && hayFiltrosActivos && (
          <p style={{margin:'10px 0 0', fontSize:'13px', color:'var(--text-secondary)'}}>
            {total === 0
              ? 'Sin resultados para los filtros aplicados'
              : <><strong style={{color:'var(--text-primary)'}}>{total}</strong> docente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</>
            }
          </p>
        )}
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="hide-sm">Orden</th>
                <th>Docente</th>
                <th>DNI</th>
                <th className="hide-sm">Categoría</th>
                <th className="hide-sm">Condición</th>
                <th className="hide-sm">Grado</th>
                <th className="hide-sm">Ingreso</th>
                <th className="hide-sm">Horas</th>
                <th className="hide-sm">Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loadingTabla ? (
                <tr><td colSpan={10} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : docentes.length === 0 ? (
                <tr><td colSpan={10} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No se encontraron docentes</td></tr>
              ) : docentes.map((d, i) => (
                <tr key={d.id}>
                  <td className="hide-sm" style={{color:'#94a3b8',fontSize:'12px',fontWeight:'600'}}>{(pagina-1)*limit + i+1}</td>
                  <td>
                    <div style={{fontWeight:'500'}}>{d.apellidos.toUpperCase()} {d.nombre.toUpperCase()}</div>
                    <div className="hide-sm" style={{fontSize:'12px',color:'#94a3b8'}}>{d.email || '—'}</div>
                  </td>
                  <td style={{fontFamily:'monospace'}}>{d.dni}</td>
                  <td className="hide-sm"><span className={`badge badge-${d.categoria}`}>{d.categoria.replace('_',' ')}</span></td>
                  <td className="hide-sm"><span className={`badge badge-${d.condicion}`}>{d.condicion}</span></td>
                  <td className="hide-sm" style={{fontSize:'12px',color:'#64748b'}}>{d.grado_academico}</td>
                  <td className="hide-sm" style={{fontSize:'12px',color:'#64748b'}}>{d.fecha_ingreso?.split('T')[0]}</td>
                  <td className="hide-sm" style={{textAlign:'center',fontWeight:'600'}}>{d.horas_max_semana}h</td>
                  <td className="hide-sm">
                    <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:d.activo?'#dcfce7':'#fee2e2',color:d.activo?'#166534':'#991b1b'}}>
                      {d.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button className="btn-secondary" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => editar(d)}>
                        <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        <span className="hide-sm">Editar</span>
                      </button>
                      <button
                        className={d.activo ? 'btn-danger' : 'btn-primary'}
                        style={{padding:'5px 10px',fontSize:'12px',minWidth:d.activo?'80px':'60px'}}
                        onClick={() => toggleEstado(d)}
                      >
                        <span className="hide-sm">{d.activo ? 'Desactivar' : 'Activar'}</span>
                        <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d.activo ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loadingTabla && total > 0 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderTop:'1px solid '+(darkMode?'#374151':'#e2e8f0')}}>
            <div style={{fontSize:'14px',color:darkMode?'#94a3b8':'#64748b'}}>
              Mostrando{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{(pagina-1)*limit+1}</strong> a{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{Math.min(pagina*limit,total)}</strong> de{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{total}</strong> docentes
            </div>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <button className="btn-secondary" style={{padding:'6px 12px'}} disabled={pagina===1} onClick={() => setPagina(p=>p-1)}>Anterior</button>
              <span style={{fontSize:'14px',fontWeight:'600',color:darkMode?'#00A6FF':'#1e293b',padding:'0 8px'}}>
                {pagina} / {totalPaginas}
              </span>
              <button className="btn-secondary" style={{padding:'6px 12px'}} disabled={pagina>=totalPaginas} onClick={() => setPagina(p=>p+1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal nuevo / editar ──────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>{editando.id ? 'Editar docente' : 'Nuevo docente'}</h2>
              <button onClick={intentarCerrarModal} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {modalError && (
                <div style={{padding:'10px 14px',borderRadius:8,background:'#fff5f5',border:'1px solid #fca5a5',color:'#991b1b',fontSize:'13px',marginBottom:12}}>
                  {modalError}
                </div>
              )}
              <div className="responsive-grid">

                <div className="form-group">
                  <label className="form-label">DNI *</label>
                  <input
                    style={inputStyle(errorDe('dni'))}
                    value={editando.dni||''}
                    onChange={e => { const val = e.target.value.replace(/\D/g,''); if (val.length <= 8) campo('dni', val as any); }}
                    placeholder="8 dígitos" maxLength={8}
                  />
                  {errorDe('dni') && <span style={{fontSize:'11px',color:'#dc2626',marginTop:3,display:'block'}}>{errorDe('dni')}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    style={{...inputStyle(errorDe('nombre')), textTransform:'uppercase'}}
                    value={editando.nombre||''}
                    onChange={e => campo('nombre', e.target.value.toUpperCase() as any)}
                  />
                  {errorDe('nombre') && <span style={{fontSize:'11px',color:'#dc2626',marginTop:3,display:'block'}}>{errorDe('nombre')}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Apellidos *</label>
                  <input
                    style={{...inputStyle(errorDe('apellidos')), textTransform:'uppercase'}}
                    value={editando.apellidos||''}
                    onChange={e => campo('apellidos', e.target.value.toUpperCase() as any)}
                  />
                  {errorDe('apellidos') && <span style={{fontSize:'11px',color:'#dc2626',marginTop:3,display:'block'}}>{errorDe('apellidos')}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    style={inputStyle(errorDe('email'))}
                    type="email" value={editando.email||''}
                    onChange={e => campo('email', e.target.value as any)}
                  />
                  {errorDe('email') && <span style={{fontSize:'11px',color:'#dc2626',marginTop:3,display:'block'}}>{errorDe('email')}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    style={inputStyle()}
                    value={editando.telefono||''}
                    onChange={e => campo('telefono', e.target.value.replace(/\D/g,'') as any)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría *</label>
                  <select style={inputStyle()} value={editando.categoria||'auxiliar'} onChange={e => campo('categoria', e.target.value as any)}>
                    {categorias.map(c => <option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Condición *</label>
                  <select style={inputStyle()} value={editando.condicion||'contratado'} onChange={e => campo('condicion', e.target.value as any)}>
                    {condiciones.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Grado académico</label>
                  <select style={inputStyle()} value={editando.grado_academico||'licenciado'} onChange={e => campo('grado_academico', e.target.value as any)}>
                    {grados.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de ingreso *</label>
                  <input
                    style={inputStyle(errorDe('fecha_ingreso'))}
                    type="date" value={editando.fecha_ingreso?.split('T')[0]||''}
                    onChange={e => campo('fecha_ingreso', e.target.value as any)}
                  />
                  {errorDe('fecha_ingreso') && <span style={{fontSize:'11px',color:'#dc2626',marginTop:3,display:'block'}}>{errorDe('fecha_ingreso')}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Horas máx/semana</label>
                  <input
                    style={inputStyle(errorDe('horas_max_semana'))}
                    type="number" min={1} max={40}
                    value={editando.horas_max_semana ?? ''}
                    onChange={e => { const val = e.target.value; campo('horas_max_semana', (val === '' ? '' : parseInt(val)) as any); }}
                  />
                  {errorDe('horas_max_semana') && <span style={{fontSize:'11px',color:'#dc2626',marginTop:3,display:'block'}}>{errorDe('horas_max_semana')}</span>}
                </div>

              </div>

              {/* ── MEJORA: Leyenda campos obligatorios ── */}
              <p style={{margin:'16px 0 0', fontSize:'12px', color:'var(--text-secondary)'}}>
                <span style={{color:'#dc2626', fontWeight:600}}>*</span> Campo obligatorio
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={intentarCerrarModal}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={guardar}
                disabled={saving || (Object.keys(touched).length > 0 && !formValido)}
                title={!formValido ? 'Completa los campos requeridos' : undefined}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MEJORA: Modal confirmación cerrar con cambios ─────────────────── */}
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
              <button className="btn-secondary" onClick={() => setShowCloseConfirm(false)}>
                Seguir editando
              </button>
              <button className="btn-danger" onClick={() => { setShowCloseConfirm(false); setShowModal(false); }}>
                Sí, descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmación toggle ─────────────────────────────────────── */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header" style={{borderBottom:'none',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',color:docenteAToggle?.activo?'#dc2626':'#2563eb'}}>
                <div style={{background:docenteAToggle?.activo?'#fee2e2':'#dbeafe',padding:'8px',borderRadius:'50%'}}>
                  {docenteAToggle?.activo
                    ? <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    : <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  }
                </div>
                <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>
                  ¿{docenteAToggle?.activo ? 'Desactivar' : 'Activar'} docente?
                </h2>
              </div>
            </div>
            <div className="modal-body" style={{paddingTop:'16px'}}>
              <p style={{margin:0,color:'#64748b',lineHeight:'1.5'}}>
                ¿Estás seguro que deseas {docenteAToggle?.activo ? 'desactivar' : 'activar'} a{' '}
                <strong>{docenteAToggle?.nombre}</strong>?{' '}
                {docenteAToggle?.activo
                  ? 'Este docente ya no aparecerá en las listas activas.'
                  : 'El docente volverá a estar disponible en el sistema.'}
              </p>
            </div>
            <div className="modal-footer" style={{borderTop:'none',paddingTop:0,marginTop:'8px'}}>
              <button className="btn-secondary" onClick={() => { setShowConfirm(false); setDocenteAToggle(null); }}>Cancelar</button>
              <button className={docenteAToggle?.activo?'btn-danger':'btn-primary'} onClick={confirmarToggle} disabled={saving}>
                {saving ? 'Procesando...' : `Sí, ${docenteAToggle?.activo?'desactivar':'activar'}`}
              </button>
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