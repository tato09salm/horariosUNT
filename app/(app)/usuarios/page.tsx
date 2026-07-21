'use client';
import { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';

interface Usuario { id:string; nombre:string; apellidos:string; email:string; rol:string; activo:boolean; created_at:string; }

const roleLabels: Record<string, string> = {
  admin: 'ADMINISTRADOR(A)',
  director_escuela: 'DIRECTOR DE ESCUELA',
  secretaria: 'SECRETARIO/A',
  docente: 'DOCENTE',
};

const roleOrder = ['admin', 'director_escuela', 'secretaria', 'docente'];

export default function UsuariosPage() {
  const user = useUser();
  const { darkMode } = useTheme();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [countsByRole, setCountsByRole] = useState<Record<string, number>>({ admin: 0, director_escuela: 0, secretaria: 0, docente: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ nombre:'', apellidos:'', email:'', password:'', rol:'secretaria' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const limit = 10;
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const canWrite = isAdmin; // Director solo lectura en página de usuarios

  const cargar = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (buscar) params.set('buscar', buscar);
    if (filtroRol) params.set('rol', filtroRol);
    params.set('page', pagina.toString());
    params.set('limit', limit.toString());
    
    fetch(`/api/usuarios?${params}`)
      .then(r => r.json())
      .then(d => {
        setUsuarios(d.data || []);
        setTotal(d.total || 0);
        setCountsByRole(d.countsByRole || { admin: 0, director_escuela: 0, secretaria: 0, docente: 0 });
      })
      .catch(() => setMsg({ type: 'error', text: 'Error al cargar usuarios' }))
      .finally(() => setLoading(false));
  }, [buscar, filtroRol, pagina]);

  useEffect(() => { setPagina(1); }, [buscar, filtroRol]);
  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/usuarios', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:'Usuario creado correctamente'});
      setShowModal(false);
      cargar();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  async function generarReporte() {
    try {
      // Usar los mismos filtros de búsqueda y rol, pero sin paginación
      const params = new URLSearchParams();
      if (buscar) params.set('buscar', buscar);
      if (filtroRol) params.set('rol', filtroRol);
      params.set('reporte', 'true');
      
      const res = await fetch(`/api/usuarios?${params}`);
      const data = await res.json();
      const usuariosFull = data.data || [];
      
      if (usuariosFull.length === 0) {
        setMsg({ type: 'warning', text: 'No hay usuarios para generar el reporte' });
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
      doc.text('REPORTE DE USUARIOS DEL SISTEMA', 14, 45);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);
      
      // Mostrar filtros aplicados en el reporte
      let filtrosTexto = '';
      if (buscar) filtrosTexto += ` | Búsqueda: "${buscar}"`;
      if (filtroRol) filtrosTexto += ` | Rol: ${roleLabels[filtroRol] || filtroRol}`;
      doc.text(`Total de registros: ${usuariosFull.length}${filtrosTexto}`, 14, 57);

      const tableData = usuariosFull.map((u: Usuario, i: number) => [
        i + 1,
        `${u.nombre.toUpperCase()} ${u.apellidos.toUpperCase()}`,
        u.email,
        roleLabels[u.rol] || u.rol.toUpperCase(),
        u.activo ? 'ACTIVO' : 'INACTIVO',
        new Date(u.created_at).toLocaleDateString('es-PE')
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['#', 'NOMBRE COMPLETO', 'EMAIL', 'ROL', 'ESTADO', 'CREDO']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 2: { cellWidth: 50 }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center', cellWidth: 25 } },
        didDrawPage: (data) => {
          const str = 'Página ' + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        }
      });
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      setMsg({type:'error', text:'Error al generar el reporte'});
    }
  }

  return (
    <div className="page-container">
      <div className="header-responsive" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color: darkMode ? '#fff' : '#1e293b',margin:'0 0 4px'}}>Usuarios del sistema</h1>
          <p style={{color: darkMode ? '#94a3b8' : '#64748b',fontSize:'14px',margin:0}}>Gestión de accesos y roles</p>
        </div>
        <div className="header-actions" style={{display:'flex',gap:'12px'}}>
          <button className="btn-primary" onClick={generarReporte}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span className="hide-sm">Reporte</span>
          </button>
          {canWrite && (
            <button className="btn-primary" onClick={()=>{setForm({nombre:'',apellidos:'',email:'',password:'temporal123',rol:'secretaria'});setShowModal(true);setMsg(null);}}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              <span className="hide-sm">Nuevo usuario</span>
              <span className="show-sm">Nuevo</span>
            </button>
          )}
        </div>
      </div>
      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      
      {/* Resumen roles - mostrando totales de la página actual */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'20px'}}>
        {roleOrder.map(rol=>{
          const count = countsByRole[rol] || 0;
          const brightColors: Record<string, string> = {
            admin: darkMode ? '#f472b6' : '#991b1b',
            secretaria: darkMode ? '#60a5fa' : '#1e40af',
            docente: darkMode ? '#34d399' : '#065f46'
          };
          const brightBg: Record<string, string> = {
            admin: darkMode ? 'rgba(244,114,182,0.1)' : '#fee2e2',
            secretaria: darkMode ? 'rgba(96,165,250,0.1)' : '#dbeafe',
            docente: darkMode ? 'rgba(52,211,153,0.1)' : '#d1fae5'
          };
          return (
            <div key={rol} className="card" style={{padding:'16px',display:'flex',alignItems:'center',gap:'12px', background: darkMode ? 'var(--bg-card)' : 'white'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'10px',background:brightBg[rol],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="20" height="20" fill="none" stroke={brightColors[rol]} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p style={{fontSize:'22px',fontWeight:'700',color: brightColors[rol],margin:'0 0 2px'}}>{count}</p>
                <p style={{fontSize:'12px',color: darkMode ? '#94a3b8' : '#64748b',margin:0,textTransform:'capitalize'}}>{roleLabels[rol]}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'center'}}>
          <input className="form-input" placeholder="🔍 Buscar por nombre o email..." style={{flex:1,minWidth:'200px'}} value={buscar} onChange={e => setBuscar(e.target.value)} />
          <select className="form-input" style={{width:'180px'}} value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="director_escuela">Directores de escuela</option>
            <option value="secretaria">Secretarios/as</option>
            <option value="docente">Docentes</option>
          </select>
          {(buscar || filtroRol) && (
            <button className="btn-secondary" onClick={() => { setBuscar(''); setFiltroRol(''); }} style={{padding:'6px 12px'}}>✖ Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="hide-sm">#</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th className="hide-sm">Creado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>
                  {buscar || filtroRol ? 'No se encontraron usuarios con esos filtros' : 'No hay usuarios registrados'}
                </td></tr>
              ) : (
                usuarios.map((u,i)=>{
                  const brightColors: Record<string, string> = {
                    admin: darkMode ? '#f472b6' : '#991b1b',
                    director_escuela: darkMode ? '#c084fc' : '#6b21a8',
                    secretaria: darkMode ? '#60a5fa' : '#1e40af',
                    docente: darkMode ? '#34d399' : '#065f46'
                  };
                  const brightBg: Record<string, string> = {
                    admin: darkMode ? 'rgba(244,114,182,0.1)' : '#fee2e2',
                    director_escuela: darkMode ? 'rgba(192,132,252,0.1)' : '#f3e8ff',
                    secretaria: darkMode ? 'rgba(96,165,250,0.1)' : '#dbeafe',
                    docente: darkMode ? 'rgba(52,211,153,0.1)' : '#d1fae5'
                  };
                  const numero = (pagina - 1) * limit + i + 1;
                  return (
                    <tr key={u.id}>
                      <td className="hide-sm" style={{color: darkMode ? '#94a3b8' : '#94a3b8',fontSize:'12px',fontWeight:'600'}}>{numero}</td>
                      <td>
                        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                          <div style={{width:'32px',height:'32px',borderRadius:'50%',background:brightBg[u.rol]||'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <span style={{fontSize:'12px',fontWeight:'600',color:brightColors[u.rol]||'#475569'}}>{u.nombre?.[0]}{u.apellidos?.[0]}</span>
                          </div>
                          <div>
                            <div style={{fontWeight:'500', color: darkMode ? '#e2e8f0' : '#1e293b'}}>{u.nombre.toUpperCase()} {u.apellidos.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{color: darkMode ? '#94a3b8' : '#64748b',fontSize:'13px'}}>{u.email}</td>
                      <td>
                        <span style={{display:'inline-flex',alignItems:'center',padding:'2px 10px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:brightBg[u.rol]||'#f1f5f9',color:brightColors[u.rol]||'#475569',textTransform:'uppercase'}}>
                        {roleLabels[u.rol] || u.rol.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`docentes-status-badge ${u.activo ? 'docentes-status-badge--activo' : 'docentes-status-badge--inactivo'}`}>
                          {u.activo ? '● Activo' : '○ Inactivo'}
                        </span>
                      </td>
                      <td className="hide-sm" style={{fontSize:'12px',color: darkMode ? '#94a3b8' : '#94a3b8'}}>{new Date(u.created_at).toLocaleDateString('es-PE')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && total > limit && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderTop:'1px solid ' + (darkMode ? '#374151' : '#e2e8f0'),flexWrap:'wrap',gap:'12px'}}>
            <div style={{fontSize:'14px',color: darkMode ? '#94a3b8' : '#64748b'}}>
              Mostrando <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{(pagina-1)*limit + 1}</span> a{' '}
              <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{Math.min(pagina*limit, total)}</span> de{' '}
              <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{total}</span> usuarios
            </div>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <button className="btn-secondary" style={{padding:'6px 12px', color: darkMode ? '#00A6FF' : undefined}} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>◀ Anterior</button>
              <span style={{fontSize:'14px',fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>Página {pagina} de {Math.ceil(total / limit)}</span>
              <button className="btn-secondary" style={{padding:'6px 12px', color: darkMode ? '#00A6FF' : undefined}} disabled={pagina >= Math.ceil(total / limit)} onClick={() => setPagina(p => p + 1)}>Siguiente ▶</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear Usuario */}
      {canWrite && showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Nuevo usuario</h2>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div className="responsive-grid">
                <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value.toUpperCase()}))}/></div>
                <div className="form-group"><label className="form-label">Apellidos *</label><input className="form-input" value={form.apellidos||''} onChange={e=>setForm((p:any)=>({...p,apellidos:e.target.value.toUpperCase()}))}/></div>
                <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email||''} onChange={e=>setForm((p:any)=>({...p,email:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Contraseña inicial</label><input className="form-input" type="password" value={form.password||''} onChange={e=>setForm((p:any)=>({...p,password:e.target.value}))}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Rol *</label>
                  <select className="form-input" value={form.rol||'secretaria'} onChange={e=>setForm((p:any)=>({...p,rol:e.target.value}))}>
                    <option value="admin">Administrador</option>
                    <option value="director_escuela">Director de Escuela</option>
                    <option value="secretaria">Secretaria</option>
                    <option value="docente">Docente</option>
                  </select>
                  <p style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px',margin:'4px 0 0'}}>
                    {form.rol==='admin' && '⚠ Acceso total al sistema incluyendo auditoría y usuarios'}
                    {form.rol==='director_escuela' && '✓ Gestión de docentes, cursos, aulas y usuarios de su escuela'}
                    {form.rol==='secretaria' && '✓ Gestión de horarios, docentes, cursos y reportes'}
                    {form.rol==='docente' && '○ Solo visualización de horarios y dashboard'}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving?'Creando...':'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}