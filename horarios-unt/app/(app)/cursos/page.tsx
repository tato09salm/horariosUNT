'use client';
import { useState, useEffect, useCallback } from 'react';

interface Curso { id:string; codigo:string; nombre:string; creditos:number; horas_teoria:number; horas_practica:number; ciclo_plan:number; escuela_nombre:string; activo:boolean; }
const empty: Partial<Curso> = { codigo:'', nombre:'', creditos:3, horas_teoria:3, horas_practica:0, ciclo_plan:1 };

export default function CursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [escuelas, setEscuelas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({...empty});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    const q = buscar ? `?buscar=${encodeURIComponent(buscar)}` : '';
    fetch(`/api/cursos${q}`).then(r=>r.json()).then(d=>setCursos(d.data||[])).finally(()=>setLoading(false));
  }, [buscar]);

  useEffect(() => { const t = setTimeout(cargar, 300); return () => clearTimeout(t); }, [cargar]);
  useEffect(() => { fetch('/api/dashboard').then(r=>r.json()); fetch('/api/ciclos').then(r=>r.json()); }, []);

  // Fetch escuelas
  useEffect(() => {
    fetch('/api/cursos').then(r=>r.json()).then(d => {
      const esc = Array.from(new Set(d.data?.map((c:any) => JSON.stringify({id:c.escuela_id, nombre:c.escuela_nombre})))).map((s:any) => JSON.parse(s));
      setEscuelas(esc);
    });
  }, []);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/cursos', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:'Curso creado correctamente'});
      setShowModal(false); cargar();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  // Agrupar por ciclo plan
  const porCiclo = cursos.reduce((acc:any, c) => {
    const k = c.ciclo_plan || 0;
    if (!acc[k]) acc[k] = [];
    acc[k].push(c);
    return acc;
  }, {});

  return (
    <div style={{padding:'32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Cursos</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Plan de estudios — Ingeniería de Sistemas</p>
        </div>
        <button className="btn-primary" onClick={()=>{setForm({...empty});setShowModal(true);setMsg(null);}}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo curso
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {[
          {label:'Total cursos', value:cursos.length, color:'#1a3a5c'},
          {label:'Créditos total', value:cursos.reduce((s,c)=>s+c.creditos,0), color:'#065f46'},
          {label:'Hrs. teoría/sem', value:cursos.reduce((s,c)=>s+c.horas_teoria,0), color:'#92400e'},
          {label:'Hrs. práctica/sem', value:cursos.reduce((s,c)=>s+c.horas_practica,0), color:'#6b21a8'},
        ].map((s,i)=>(
          <div key={i} className="card" style={{padding:'16px',textAlign:'center'}}>
            <p style={{fontSize:'28px',fontWeight:'700',color:s.color,margin:'0 0 4px'}}>{s.value}</p>
            <p style={{fontSize:'12px',color:'#64748b',margin:0}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Búsqueda */}
      <div style={{marginBottom:'16px'}}>
        <input className="form-input" style={{maxWidth:'400px'}} placeholder="Buscar curso..." value={buscar} onChange={e=>setBuscar(e.target.value)} />
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando cursos...</div>
      ) : (
        Object.keys(porCiclo).sort((a,b)=>parseInt(a)-parseInt(b)).map(ciclo => (
          <div key={ciclo} style={{marginBottom:'20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
              <div style={{background:'#1a3a5c',color:'white',borderRadius:'6px',padding:'3px 10px',fontSize:'12px',fontWeight:'600'}}>
                {ciclo === '0' ? 'Sin ciclo' : `Ciclo ${ciclo}`}
              </div>
              <div style={{height:'1px',flex:1,background:'#e2e8f0'}} />
              <span style={{fontSize:'12px',color:'#94a3b8'}}>{porCiclo[ciclo].length} cursos</span>
            </div>
            <div className="card" style={{padding:0}}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Código</th><th>Nombre</th><th>Créditos</th><th>H. Teoría</th><th>H. Práctica</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {porCiclo[ciclo].map((c:Curso)=>(
                      <tr key={c.id}>
                        <td style={{fontWeight:'600',color:'#475569',fontFamily:'monospace',fontSize:'13px'}}>{c.codigo}</td>
                        <td style={{fontWeight:'500'}}>{c.nombre}</td>
                        <td style={{textAlign:'center'}}><span style={{background:'#f1f5f9',color:'#374151',padding:'2px 8px',borderRadius:'6px',fontSize:'12px',fontWeight:'600'}}>{c.creditos} cr.</span></td>
                        <td style={{textAlign:'center'}}><span className="badge badge-teoria">{c.horas_teoria}h</span></td>
                        <td style={{textAlign:'center'}}>{c.horas_practica > 0 ? <span className="badge badge-laboratorio">{c.horas_practica}h</span> : <span style={{color:'#94a3b8',fontSize:'12px'}}>—</span>}</td>
                        <td><span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:c.activo?'#dcfce7':'#fee2e2',color:c.activo?'#166534':'#991b1b'}}>{c.activo?'Activo':'Inactivo'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Nuevo curso</h2>
              <button onClick={()=>setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group"><label className="form-label">Código *</label><input className="form-input" value={form.codigo||''} onChange={e=>setForm((p:any)=>({...p,codigo:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Ciclo del plan</label><input className="form-input" type="number" min={1} max={10} value={form.ciclo_plan||1} onChange={e=>setForm((p:any)=>({...p,ciclo_plan:parseInt(e.target.value)}))}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Escuela</label>
                  <select className="form-input" value={form.escuela_id||''} onChange={e=>setForm((p:any)=>({...p,escuela_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {escuelas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Créditos</label><input className="form-input" type="number" min={1} max={8} value={form.creditos||3} onChange={e=>setForm((p:any)=>({...p,creditos:parseInt(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Horas teoría/semana</label><input className="form-input" type="number" min={0} max={10} value={form.horas_teoria||3} onChange={e=>setForm((p:any)=>({...p,horas_teoria:parseInt(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Horas práctica/semana</label><input className="form-input" type="number" min={0} max={10} value={form.horas_practica||0} onChange={e=>setForm((p:any)=>({...p,horas_practica:parseInt(e.target.value)}))}/></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
