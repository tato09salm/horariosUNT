'use client';
import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';

interface Ambiente { id:string; codigo:string; nombre:string; tipo:string; capacidad:number; piso:number; edificio:string; disponible:boolean; }
const empty: Partial<Ambiente> = { codigo:'', nombre:'', tipo:'aula', capacidad:30, piso:1, edificio:'', disponible:true };

export default function AulasPage() {
  const [items, setItems] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPiso, setFiltroPiso] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ aulas: 0, laboratorios: 0, otros: 0 });
  const { darkMode } = useTheme();
  const user = useUser();
  const isAdmin = user?.rol === 'admin';
  const limit = 10;
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ambienteAToggle, setAmbienteAToggle] = useState<{id:string, nombre:string, disponible:boolean}|null>(null);
  const [form, setForm] = useState<Partial<Ambiente>>({...empty});
  const [historialEdificios, setHistorialEdificios] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('historial_edificios');
    if (saved) setHistorialEdificios(JSON.parse(saved));
  }, []);

  const cargar = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (buscar) q.set('buscar', buscar);
    if (filtroTipo) q.set('tipo', filtroTipo);
    if (filtroPiso) q.set('piso', filtroPiso);
    if (filtroEstado) q.set('disponible', filtroEstado);
    q.set('page', pagina.toString());
    q.set('limit', limit.toString());
    q.set('all', 'true'); // Para ver todos los ambientes (disponibles o no)
    
    fetch(`/api/aulas?${q}`).then(r=>r.json()).then(d => {
      setItems(d.data||[]);
      setTotal(d.total||0);
      if (d.stats) setStats(d.stats);
    }).finally(() => setLoading(false));
  }, [buscar, filtroTipo, filtroPiso, filtroEstado, pagina]);

  useEffect(() => { const t = setTimeout(cargar, 300); return () => clearTimeout(t); }, [cargar]);

  // Reset pagina al cambiar filtro
  useEffect(() => { setPagina(1); }, [buscar, filtroTipo, filtroPiso, filtroEstado]);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const url = form.id ? `/api/aulas/${form.id}` : '/api/aulas';
      const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Guardar en historial de edificios si no existe
      if (form.edificio && !historialEdificios.includes(form.edificio)) {
        const nuevoHistorial = [form.edificio, ...historialEdificios].slice(0, 10);
        setHistorialEdificios(nuevoHistorial);
        localStorage.setItem('historial_edificios', JSON.stringify(nuevoHistorial));
      }

      setMsg({type:'success',text:`Ambiente ${form.id ? 'actualizado' : 'creado'} correctamente`});
      setShowModal(false); cargar();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  function eliminarDelHistorial(e: React.MouseEvent, edificio: string) {
    e.stopPropagation();
    const nuevo = historialEdificios.filter(h => h !== edificio);
    setHistorialEdificios(nuevo);
    localStorage.setItem('historial_edificios', JSON.stringify(nuevo));
  }

  async function confirmarToggle() {
    if (!ambienteAToggle) return;
    setSaving(true);
    try {
      const nuevoEstado = !ambienteAToggle.disponible;
      const resDoc = await fetch(`/api/aulas/${ambienteAToggle.id}`);
      const { data: a } = await resDoc.json();
      
      const res = await fetch(`/api/aulas/${ambienteAToggle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, disponible: nuevoEstado })
      });
      
      if (!res.ok) throw new Error();
      
      setShowConfirm(false);
      setAmbienteAToggle(null);
      cargar();
    } catch (e: any) {
      setMsg({type:'error',text:'Error al cambiar estado del ambiente'});
    } finally {
      setSaving(false);
    }
  }

  function toggleEstado(a: Ambiente) {
    setAmbienteAToggle({id: a.id, nombre: a.nombre.toUpperCase(), disponible: a.disponible});
    setShowConfirm(true);
  }

  function editar(a: Ambiente) {
    setForm({
      ...a,
      codigo: a.codigo.toUpperCase(),
      nombre: a.nombre.toUpperCase(),
      edificio: a.edificio.toUpperCase()
    });
    setShowModal(true);
    setMsg(null);
  }

  async function generarReporte() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filtroTipo) q.set('tipo', filtroTipo);
      q.set('reporte', 'true');
      
      const res = await fetch(`/api/aulas?${q}`);
      const data = await res.json();
      const todosLosAmbientes = data.data || [];

      const doc = new jsPDF();
      
      // Encabezado Formal
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 105, 20, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 105, 28, { align: 'center' });
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 35, 196, 35);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('REPORTE OFICIAL DE AMBIENTES ACADÉMICOS', 14, 45);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);
      doc.text(`Total de registros: ${todosLosAmbientes.length}`, 14, 57);

      const tableData = todosLosAmbientes.map((a: Ambiente, i: number) => [
        i + 1,
        a.codigo.toUpperCase(),
        a.nombre.toUpperCase(),
        a.tipo.toUpperCase(),
        a.capacidad,
        a.piso + '°',
        a.edificio.toUpperCase(),
        a.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE'
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['ORD.', 'CÓDIGO', 'NOMBRE', 'TIPO', 'CAP.', 'PISO', 'EDIFICIO', 'ESTADO']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 15 },
          7: { halign: 'center' }
        },
        didDrawPage: () => {
          const str = 'Página ' + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`reporte_ambientes_${new Date().getTime()}.pdf`);
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
          <h1 style={{fontSize:'24px',fontWeight:'700',color: darkMode ? '#fff' : '#1e293b',margin:'0 0 4px'}}>Aulas y Laboratorios</h1>
          <p style={{color: darkMode ? '#94a3b8' : '#64748b',fontSize:'14px',margin:0}}>Gestión de ambientes académicos</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={generarReporte}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span className="hide-sm">Reporte</span>
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setForm({...empty}); setShowModal(true); setMsg(null); }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              <span className="hide-sm">Nuevo ambiente</span>
              <span className="show-sm">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Stats */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', marginBottom:'24px'}}>
        {[
          {label:'Aulas',count:stats.aulas,color: darkMode ? '#60a5fa' : '#1a3a5c',bg: darkMode ? 'rgba(96,165,250,0.1)' : '#dbeafe'},
          {label:'Laboratorios',count:stats.laboratorios,color: darkMode ? '#34d399' : '#065f46',bg: darkMode ? 'rgba(52,211,153,0.1)' : '#d1fae5'},
          {label:'Otros',count:stats.otros,color: darkMode ? '#fbbf24' : '#92400e',bg: darkMode ? 'rgba(251,191,36,0.1)' : '#fef3c7'},
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{padding: '16px 12px', gap: '10px', background: darkMode ? 'var(--bg-card)' : 'white'}}>
            <div className="stat-icon" style={{background:s.bg, width:'36px', height:'36px'}}>
              <svg width="20" height="20" fill="none" stroke={s.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div style={{minWidth: 0}}>
              <p style={{fontSize:'20px',fontWeight:'700',color:s.color,margin:'0'}}>{s.count}</p>
              <p style={{fontSize:'11px',color: darkMode ? '#94a3b8' : '#64748b',margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div className="filters-grid">
          <input className="form-input" placeholder="Buscar nombre o edificio..." value={buscar} onChange={e => setBuscar(e.target.value)} />
          <div className="filters-group">
            <select className="form-input" style={{width:'auto'}} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="aula">Aulas</option>
              <option value="laboratorio">Laboratorios</option>
              <option value="auditorio">Auditorios</option>
            </select>
            <select className="form-input hide-sm" style={{width:'auto'}} value={filtroPiso} onChange={e => setFiltroPiso(e.target.value)}>
              <option value="">Todos los pisos</option>
              {[1,2,3,4,5].map(p => <option key={p} value={p}>Piso {p}</option>)}
            </select>
            <select className="form-input" style={{width:'auto'}} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="true">Disponible</option>
              <option value="false">Inactivo</option>
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
                <th>Código</th>
                <th>Nombre</th>
                <th className="hide-sm">Tipo</th>
                <th className="hide-sm">Capacidad</th>
                <th className="hide-sm">Piso</th>
                <th className="hide-sm">Edificio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No se encontraron ambientes</td></tr>
              ) : items.map(a => (
                <tr key={a.id}>
                  <td style={{fontWeight:'600',color:'#475569',fontFamily:'monospace'}}>{a.codigo.toUpperCase()}</td>
                  <td style={{fontWeight:'500'}}>{a.nombre.toUpperCase()}</td>
                  <td className="hide-sm"><span className={`badge badge-${a.tipo}`}>{a.tipo.toUpperCase()}</span></td>
                  <td className="hide-sm" style={{textAlign:'center'}}>{a.capacidad} alumnos</td>
                  <td className="hide-sm" style={{textAlign:'center'}}>{a.piso}°</td>
                  <td className="hide-sm" style={{color:'#64748b'}}>{a.edificio.toUpperCase()}</td>
                  <td>
                    <span className={`docentes-status-badge ${a.disponible ? 'docentes-status-badge--activo' : 'docentes-status-badge--inactivo'}`}>
                      {a.disponible ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      {isAdmin && (
                        <>
                          <button className="btn-secondary btn-crud-edit" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => editar(a)}>
                            <span className="hide-sm">Editar</span>
                            <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button
                            className={a.disponible ? "btn-secondary btn-crud-deactivate" : "btn-primary"}
                            style={{padding:'5px 10px',fontSize:'12px', minWidth: a.disponible ? '80px' : '60px'}}
                            onClick={() => toggleEstado(a)}
                          >
                            <span className="hide-sm">{a.disponible ? 'Desactivar' : 'Activar'}</span>
                            <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={a.disponible ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && total > 0 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderTop:'1px solid ' + (darkMode ? '#374151' : '#e2e8f0')}}>
            <div style={{fontSize:'14px',color: darkMode ? '#94a3b8' : '#64748b'}}>
              Mostrando <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{(pagina-1)*limit + 1}</span> a <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{Math.min(pagina*limit, total)}</span> de <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{total}</span> ambientes
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button className="btn-secondary" style={{padding:'6px 12px', color: darkMode ? '#00A6FF' : undefined}} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Anterior</button>
              <div style={{display:'flex',alignItems:'center',padding:'0 12px',fontSize:'14px',fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>Página {pagina} de {Math.ceil(total / limit)}</div>
              <button className="btn-secondary" style={{padding:'6px 12px', color: darkMode ? '#00A6FF' : undefined}} disabled={pagina >= Math.ceil(total / limit)} onClick={() => setPagina(p => p + 1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>{form.id ? 'Editar ambiente' : 'Nuevo ambiente'}</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="responsive-grid">
                <div className="form-group"><label className="form-label">Código *</label><input className="form-input" value={form.codigo||''} onChange={e=>setForm(p=>({...p,codigo:e.target.value.toUpperCase()}))}/></div>
                <div className="form-group"><label className="form-label">Tipo *</label>
                  <select className="form-input" value={form.tipo||'aula'} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                    <option value="aula">Aula</option><option value="laboratorio">Laboratorio</option><option value="auditorio">Auditorio</option>
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre||''} onChange={e=>setForm(p=>({...p,nombre:e.target.value.toUpperCase()}))}/></div>
                <div className="form-group">
                  <label className="form-label">Capacidad</label>
                  <input 
                    className="form-input" 
                    type="number" 
                    value={form.capacidad ?? ''} 
                    onChange={e => {
                      const val = e.target.value;
                      setForm(p => ({...p, capacidad: val === '' ? undefined : parseInt(val)}));
                    }}
                  />
                </div>
                <div className="form-group"><label className="form-label">Piso</label><input className="form-input" type="number" value={form.piso||1} onChange={e=>setForm(p=>({...p,piso:parseInt(e.target.value)}))}/></div>
                <div className="form-group" style={{gridColumn:'1/-1', position:'relative'}}>
                  <label className="form-label">Edificio</label>
                  <input 
                    className="form-input" 
                    value={form.edificio||''} 
                    onChange={e=>setForm(p=>({...p,edificio:e.target.value.toUpperCase()}))}
                    autoComplete="off"
                  />
                  {historialEdificios.length > 0 && (
                    <div style={{
                      marginTop:'4px',
                      display:'flex',
                      flexWrap:'wrap',
                      gap:'8px'
                    }}>
                      {historialEdificios.map((h, i) => (
                        <div 
                          key={i} 
                          onClick={() => setForm(p => ({...p, edificio: h}))}
                          style={{
                            background:'#f1f5f9',
                            padding:'4px 10px',
                            borderRadius:'6px',
                            fontSize:'12px',
                            cursor:'pointer',
                            display:'flex',
                            alignItems:'center',
                            gap:'8px',
                            border:'1px solid #e2e8f0',
                            color:'#475569'
                          }}
                        >
                          <span>{h}</span>
                          <button 
                            onClick={(e) => eliminarDelHistorial(e, h)}
                            style={{
                              background:'#fee2e2',
                              border:'none',
                              color:'#ef4444',
                              cursor:'pointer',
                              width:'18px',
                              height:'18px',
                              borderRadius:'50%',
                              display:'flex',
                              alignItems:'center',
                              justifyContent:'center',
                              fontSize:'12px',
                              fontWeight:'bold',
                              transition:'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header" style={{borderBottom:'none',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',color: ambienteAToggle?.disponible ? '#dc2626' : '#2563eb'}}>
                <div style={{background: ambienteAToggle?.disponible ? '#fee2e2' : '#dbeafe',padding:'8px',borderRadius:'50%'}}>
                  {ambienteAToggle?.disponible ? (
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  ) : (
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  )}
                </div>
                <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>
                  ¿{ambienteAToggle?.disponible ? 'Desactivar' : 'Activar'} ambiente?
                </h2>
              </div>
            </div>
            <div className="modal-body" style={{paddingTop:'16px'}}>
              <p style={{margin:0,color:'#64748b',lineHeight:'1.5'}}>
                ¿Estás seguro que deseas {ambienteAToggle?.disponible ? 'desactivar' : 'activar'} el ambiente <strong>{ambienteAToggle?.nombre}</strong>? 
                {ambienteAToggle?.disponible 
                  ? ' Este ambiente ya no podrá ser asignado en los horarios.' 
                  : ' El ambiente volverá a estar disponible para asignaciones.'}
              </p>
            </div>
            <div className="modal-footer" style={{borderTop:'none',paddingTop:0,marginTop:'8px'}}>
              <button className="btn-secondary" onClick={() => {setShowConfirm(false); setAmbienteAToggle(null);}}>
                Cancelar
              </button>
              <button className={ambienteAToggle?.disponible ? "btn-danger" : "btn-primary"} onClick={confirmarToggle} disabled={saving}>
                {saving ? 'Procesando...' : `Sí, ${ambienteAToggle?.disponible ? 'desactivar' : 'activar'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
