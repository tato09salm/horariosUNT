'use client';
import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function DocentesPage() {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroCondicion, setFiltroCondicion] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [docenteAToggle, setDocenteAToggle] = useState<{id:string, nombre:string, activo:boolean}|null>(null);
  const [editando, setEditando] = useState<Partial<Docente>>(emptyDocente);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{type:string;text:string}|null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (buscar) q.set('buscar', buscar);
    if (filtroCategoria) q.set('categoria', filtroCategoria);
    if (filtroCondicion) q.set('condicion', filtroCondicion);
    q.set('page', pagina.toString());
    q.set('limit', limit.toString());
    q.set('verificarUsuarios', 'true'); // Activar verificación automática
    fetch(`/api/docentes?${q}`).then(r => r.json()).then(d => {
      setDocentes(d.data || []);
      setTotal(d.total || 0);
    }).finally(() => setLoading(false));
  }, [buscar, filtroCategoria, filtroCondicion, pagina]);

  useEffect(() => { const t = setTimeout(cargar, 300); return () => clearTimeout(t); }, [cargar]);

  // Reset page when filters change
  useEffect(() => { setPagina(1); }, [buscar, filtroCategoria, filtroCondicion]);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      if (editando.dni && editando.dni.length !== 8) {
        throw new Error('El DNI debe tener exactamente 8 dígitos');
      }
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

  async function confirmarToggle() {
    if (!docenteAToggle) return;
    setSaving(true);
    try {
      const nuevoEstado = !docenteAToggle.activo;
      // Usamos el mismo endpoint PUT pero solo actualizamos el estado
      // Primero obtenemos los datos actuales del docente para no perder nada
      const resDoc = await fetch(`/api/docentes/${docenteAToggle.id}`);
      const { data: d } = await resDoc.json();
      
      const res = await fetch(`/api/docentes/${docenteAToggle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...d, activo: nuevoEstado })
      });
      
      if (!res.ok) throw new Error();
      
      setShowConfirm(false);
      setDocenteAToggle(null);
      cargar();
    } catch (e: any) {
      setMsg({type:'error',text:'Error al cambiar estado del docente'});
    } finally {
      setSaving(false);
    }
  }

  function toggleEstado(d: Docente) {
    setDocenteAToggle({id: d.id, nombre: `${d.apellidos}, ${d.nombre}`, activo: d.activo});
    setShowConfirm(true);
  }

  function nuevo() { setEditando({...emptyDocente}); setShowModal(true); setMsg(null); }
  function editar(d: Docente) { setEditando({...d}); setShowModal(true); setMsg(null); }

  async function generarReporte() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (buscar) q.set('buscar', buscar);
      if (filtroCategoria) q.set('categoria', filtroCategoria);
      if (filtroCondicion) q.set('condicion', filtroCondicion);
      q.set('reporte', 'true');
      
      const res = await fetch(`/api/docentes?${q}`);
      const data = await res.json();
      const todosLosDocentes = data.data || [];

      const doc = new jsPDF();
      
      // Encabezado Formal
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 105, 28, { align: 'center' });
      
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(14, 35, 196, 35);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE OFICIAL DE CUERPO DOCENTE', 14, 45);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);
      doc.text(`Total de registros: ${todosLosDocentes.length}`, 14, 57);

      const tableData = todosLosDocentes.map((d: Docente, i: number) => [
        i + 1,
        `${d.apellidos.toUpperCase()}, ${d.nombre}`,
        d.dni,
        d.categoria.replace('_', ' ').toUpperCase(),
        d.condicion.toUpperCase(),
        d.grado_academico.toUpperCase(),
        d.horas_max_semana + 'h',
        d.activo ? 'ACTIVO' : 'INACTIVO'
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['ORD.', 'APELLIDOS Y NOMBRES', 'DNI', 'CATEGORÍA', 'CONDICIÓN', 'GRADO', 'HRS', 'ESTADO']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [30, 41, 59], 
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center', cellWidth: 15 },
          7: { halign: 'center' }
        },
        didDrawPage: (data) => {
          // Pie de página
          const str = 'Página ' + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`reporte_docentes_${new Date().getTime()}.pdf`);
    } catch (error) {
      setMsg({type:'error', text:'Error al generar el reporte formal'});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="header-responsive" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Docentes</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Gestión del cuerpo docente</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={generarReporte}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span className="hide-sm">Reporte</span>
          </button>
          <button className="btn-primary" onClick={nuevo}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            <span className="hide-sm">Nuevo docente</span>
            <span className="show-sm">Nuevo</span>
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div className="filters-grid">
          <input className="form-input" placeholder="Buscar por nombre o DNI..." value={buscar} onChange={e => setBuscar(e.target.value)} />
          <div className="filters-group">
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
              {loading ? (
                <tr><td colSpan={10} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : docentes.length === 0 ? (
                <tr><td colSpan={10} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No se encontraron docentes</td></tr>
              ) : docentes.map((d, i) => (
                <tr key={d.id}>
                  <td className="hide-sm" style={{color:'#94a3b8',fontSize:'12px',fontWeight:'600'}}>{(pagina-1)*limit + i+1}</td>
                  <td>
                    <div style={{fontWeight:'500'}}>{d.apellidos}, {d.nombre}</div>
                    <div className="hide-sm" style={{fontSize:'12px',color:'#94a3b8'}}>{d.email}</div>
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
                        className={d.activo ? "btn-danger" : "btn-primary"} 
                        style={{padding:'5px 10px',fontSize:'12px', minWidth: d.activo ? '80px' : '60px'}} 
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
        {!loading && total > 0 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderTop:'1px solid #e2e8f0'}}>
            <div style={{fontSize:'14px',color:'#64748b'}}>
              Mostrando <span style={{fontWeight:'600',color:'#1e293b'}}>{(pagina-1)*limit + 1}</span> a <span style={{fontWeight:'600',color:'#1e293b'}}>{Math.min(pagina*limit, total)}</span> de <span style={{fontWeight:'600',color:'#1e293b'}}>{total}</span> docentes
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button 
                className="btn-secondary" 
                style={{padding:'6px 12px'}} 
                disabled={pagina === 1}
                onClick={() => setPagina(p => p - 1)}
              >
                Anterior
              </button>
              <div style={{display:'flex',alignItems:'center',padding:'0 12px',fontSize:'14px',fontWeight:'600',color:'#1e293b'}}>
                Página {pagina} de {Math.ceil(total / limit)}
              </div>
              <button 
                className="btn-secondary" 
                style={{padding:'6px 12px'}} 
                disabled={pagina >= Math.ceil(total / limit)}
                onClick={() => setPagina(p => p + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>{editando.id ? 'Editar docente' : 'Nuevo docente'}</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="responsive-grid">
                <div className="form-group">
                  <label className="form-label">DNI *</label>
                  <input 
                    className="form-input" 
                    value={editando.dni||''} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 8) setEditando(p => ({...p,dni:val}));
                    }} 
                    placeholder="8 dígitos"
                  />
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
                  <input 
                    className="form-input" 
                    value={editando.telefono||''} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setEditando(p => ({...p,telefono:val}));
                    }} 
                  />
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
                  <input 
                    className="form-input" 
                    type="number" 
                    min={1} 
                    max={40} 
                    value={editando.horas_max_semana ?? ''} 
                    onChange={e => {
                      const val = e.target.value;
                      setEditando(p => ({...p, horas_max_semana: val === '' ? undefined : parseInt(val)}));
                    }} 
                  />
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

      {/* Modal de Confirmación */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header" style={{borderBottom:'none',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',color: docenteAToggle?.activo ? '#dc2626' : '#2563eb'}}>
                <div style={{background: docenteAToggle?.activo ? '#fee2e2' : '#dbeafe',padding:'8px',borderRadius:'50%'}}>
                  {docenteAToggle?.activo ? (
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  ) : (
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  )}
                </div>
                <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>
                  ¿{docenteAToggle?.activo ? 'Desactivar' : 'Activar'} docente?
                </h2>
              </div>
            </div>
            <div className="modal-body" style={{paddingTop:'16px'}}>
              <p style={{margin:0,color:'#64748b',lineHeight:'1.5'}}>
                ¿Estás seguro que deseas {docenteAToggle?.activo ? 'desactivar' : 'activar'} a <strong>{docenteAToggle?.nombre}</strong>? 
                {docenteAToggle?.activo 
                  ? ' Este docente ya no aparecerá en las listas activas.' 
                  : ' El docente volverá a estar disponible en el sistema.'}
              </p>
            </div>
            <div className="modal-footer" style={{borderTop:'none',paddingTop:0,marginTop:'8px'}}>
              <button className="btn-secondary" onClick={() => {setShowConfirm(false); setDocenteAToggle(null);}}>
                Cancelar
              </button>
              <button 
                className={docenteAToggle?.activo ? "btn-danger" : "btn-primary"} 
                onClick={confirmarToggle} 
                disabled={saving}
              >
                {saving ? 'Procesando...' : `Sí, ${docenteAToggle?.activo ? 'desactivar' : 'activar'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
