'use client';
import { useState, useEffect } from 'react';

interface Ambiente { id:string; codigo:string; nombre:string; tipo:string; capacidad:number; piso:number; edificio:string; disponible:boolean; }
const empty: Partial<Ambiente> = { codigo:'', nombre:'', tipo:'aula', capacidad:30, piso:1, edificio:'', disponible:true };

export default function AulasPage() {
  const [items, setItems] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<Ambiente>>({...empty});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  function cargar() {
    setLoading(true);
    const q = filtroTipo ? `?tipo=${filtroTipo}` : '';
    fetch(`/api/aulas${q}`).then(r=>r.json()).then(d => setItems(d.data||[])).finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, [filtroTipo]);

  async function guardar() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/aulas', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({type:'success',text:'Ambiente creado correctamente'});
      setShowModal(false); cargar();
    } catch(e:any) { setMsg({type:'error',text:e.message}); }
    finally { setSaving(false); }
  }

  const aulas = items.filter(i => i.tipo === 'aula');
  const labs = items.filter(i => i.tipo === 'laboratorio');
  const otros = items.filter(i => i.tipo !== 'aula' && i.tipo !== 'laboratorio');

  return (
    <div style={{padding:'32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Aulas y Laboratorios</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Gestión de ambientes académicos</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({...empty}); setShowModal(true); setMsg(null); }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Nuevo ambiente
        </button>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'24px'}}>
        {[
          {label:'Aulas',count:aulas.length,color:'#1a3a5c',bg:'#dbeafe'},
          {label:'Laboratorios',count:labs.length,color:'#065f46',bg:'#d1fae5'},
          {label:'Otros',count:otros.length,color:'#92400e',bg:'#fef3c7'},
        ].map((s,i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{background:s.bg}}>
              <svg width="22" height="22" fill="none" stroke={s.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color:s.color,margin:'0 0 2px'}}>{s.count}</p>
              <p style={{fontSize:'13px',color:'#64748b',margin:0}}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div style={{marginBottom:'16px'}}>
        <select className="form-input" style={{width:'auto',minWidth:'200px'}} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          <option value="aula">Aulas</option>
          <option value="laboratorio">Laboratorios</option>
          <option value="auditorio">Auditorios</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Código</th><th>Nombre</th><th>Tipo</th><th>Capacidad</th><th>Piso</th><th>Edificio</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando...</td></tr>
              ) : items.map(a => (
                <tr key={a.id}>
                  <td style={{fontWeight:'600',color:'#475569',fontFamily:'monospace'}}>{a.codigo}</td>
                  <td style={{fontWeight:'500'}}>{a.nombre}</td>
                  <td><span className={`badge badge-${a.tipo}`}>{a.tipo}</span></td>
                  <td style={{textAlign:'center'}}>{a.capacidad} alumnos</td>
                  <td style={{textAlign:'center'}}>{a.piso}°</td>
                  <td style={{color:'#64748b'}}>{a.edificio}</td>
                  <td>
                    <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:a.disponible?'#dcfce7':'#fee2e2',color:a.disponible?'#166534':'#991b1b'}}>
                      {a.disponible ? '● Disponible' : '○ No disponible'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>Nuevo ambiente</h2>
              <button onClick={() => setShowModal(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div className="form-group"><label className="form-label">Código *</label><input className="form-input" value={form.codigo||''} onChange={e=>setForm(p=>({...p,codigo:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Tipo *</label>
                  <select className="form-input" value={form.tipo||'aula'} onChange={e=>setForm(p=>({...p,tipo:e.target.value}))}>
                    <option value="aula">Aula</option><option value="laboratorio">Laboratorio</option><option value="auditorio">Auditorio</option>
                  </select>
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Nombre *</label><input className="form-input" value={form.nombre||''} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Capacidad</label><input className="form-input" type="number" value={form.capacidad||30} onChange={e=>setForm(p=>({...p,capacidad:parseInt(e.target.value)}))}/></div>
                <div className="form-group"><label className="form-label">Piso</label><input className="form-input" type="number" value={form.piso||1} onChange={e=>setForm(p=>({...p,piso:parseInt(e.target.value)}))}/></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label className="form-label">Edificio</label><input className="form-input" value={form.edificio||''} onChange={e=>setForm(p=>({...p,edificio:e.target.value}))}/></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
