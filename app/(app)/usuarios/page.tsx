'use client';
import { useState, useEffect } from 'react';

interface Usuario { id:string; nombre:string; apellidos:string; email:string; rol:string; activo:boolean; created_at:string; }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({ nombre:'', apellidos:'', email:'', password:'', rol:'secretaria' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  function cargar() {
    setLoading(true);
    fetch('/api/usuarios').then(r=>r.json()).then(d=>setUsuarios(d.data||[])).finally(()=>setLoading(false));
  }
  useEffect(() => { cargar(); }, []);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/usuarios', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:'Usuario creado correctamente'});
      setShowModal(false); cargar();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  const rolColor: Record<string,string> = { admin:'#fee2e2|#991b1b', secretaria:'#dbeafe|#1e40af', docente:'#d1fae5|#065f46' };

  return (
    <div style={{padding:'32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Usuarios del sistema</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Gestión de accesos y roles</p>
        </div>
        <button className="btn-primary" onClick={()=>{setForm({nombre:'',apellidos:'',email:'',password:'temporal123',rol:'secretaria'});setShowModal(true);setMsg(null);}}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo usuario
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Resumen roles */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'20px'}}>
        {['admin','secretaria','docente'].map(rol=>{
          const count = usuarios.filter(u=>u.rol===rol).length;
          const colors = (rolColor[rol]||'#f1f5f9|#475569').split('|');
          return (
            <div key={rol} className="card" style={{padding:'16px',display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'10px',background:colors[0],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="20" height="20" fill="none" stroke={colors[1]} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p style={{fontSize:'22px',fontWeight:'700',color:colors[1],margin:'0 0 2px'}}>{count}</p>
                <p style={{fontSize:'12px',color:'#64748b',margin:0,textTransform:'capitalize'}}>{rol}s</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>#</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : usuarios.map((u,i)=>{
                const colors = (rolColor[u.rol]||'#f1f5f9|#475569').split('|');
                return (
                  <tr key={u.id}>
                    <td style={{color:'#94a3b8',fontSize:'12px'}}>{i+1}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <div style={{width:'32px',height:'32px',borderRadius:'50%',background:colors[0],display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <span style={{fontSize:'12px',fontWeight:'600',color:colors[1]}}>{u.nombre?.[0]}{u.apellidos?.[0]}</span>
                        </div>
                        <div>
                          <div style={{fontWeight:'500'}}>{u.nombre} {u.apellidos}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{color:'#64748b',fontSize:'13px'}}>{u.email}</td>
                    <td>
                      <span style={{display:'inline-flex',alignItems:'center',padding:'2px 10px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:colors[0],color:colors[1],textTransform:'capitalize'}}>{u.rol}</span>
                    </td>
                    <td>
                      <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:u.activo?'#dcfce7':'#fee2e2',color:u.activo?'#166534':'#991b1b'}}>
                        {u.activo?'● Activo':'○ Inactivo'}
                      </span>
                    </td>
                    <td style={{fontSize:'12px',color:'#94a3b8'}}>{new Date(u.created_at).toLocaleDateString('es-PE')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
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
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group"><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Apellidos *</label><input className="form-input" value={form.apellidos||''} onChange={e=>setForm((p:any)=>({...p,apellidos:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Email *</label><input className="form-input" type="email" value={form.email||''} onChange={e=>setForm((p:any)=>({...p,email:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Contraseña inicial</label><input className="form-input" type="password" value={form.password||''} onChange={e=>setForm((p:any)=>({...p,password:e.target.value}))}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Rol *</label>
                  <select className="form-input" value={form.rol||'secretaria'} onChange={e=>setForm((p:any)=>({...p,rol:e.target.value}))}>
                    <option value="admin">Administrador</option>
                    <option value="secretaria">Secretaria</option>
                    <option value="docente">Docente</option>
                  </select>
                  <p style={{fontSize:'11px',color:'#94a3b8',marginTop:'4px',margin:'4px 0 0'}}>
                    {form.rol==='admin' && '⚠ Acceso total al sistema incluyendo auditoría y usuarios'}
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
