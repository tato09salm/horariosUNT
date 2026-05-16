'use client';
import { useState, useEffect, useCallback } from 'react';

const ACCIONES = ['LOGIN','LOGOUT','CREATE','UPDATE','DELETE','ASSIGN','UNASSIGN','GENERATE_SCHEDULE','EXPORT_REPORT'];
const TABLAS = ['docentes','cursos','ambientes','asignaciones','usuarios','ciclos'];

const colorAccion: Record<string,string> = {
  LOGIN:'#d1fae5|#065f46', LOGOUT:'#f3e8ff|#6b21a8',
  CREATE:'#dbeafe|#1e40af', UPDATE:'#fef3c7|#92400e',
  DELETE:'#fee2e2|#991b1b', ASSIGN:'#d1fae5|#065f46',
  UNASSIGN:'#fef3c7|#92400e', GENERATE_SCHEDULE:'#ede9fe|#5b21b6',
  EXPORT_REPORT:'#f1f5f9|#475569',
};

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ accion:'', tabla:'', desde:'', hasta:'' });
  const [detalle, setDetalle] = useState<any>(null);

  const limite = 25;

  const cargar = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
    if (filtros.accion) q.set('accion', filtros.accion);
    if (filtros.tabla) q.set('tabla', filtros.tabla);
    if (filtros.desde) q.set('desde', filtros.desde);
    if (filtros.hasta) q.set('hasta', filtros.hasta + 'T23:59:59');
    fetch(`/api/auditoria?${q}`).then(r=>r.json()).then(d=>{
      setLogs(d.data||[]); setTotal(d.total||0);
    }).finally(()=>setLoading(false));
  }, [pagina, filtros]);

  useEffect(() => { cargar(); }, [cargar]);

  function getAccionBadge(accion: string) {
    const colors = (colorAccion[accion]||'#f1f5f9|#475569').split('|');
    return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background:colors[0],color:colors[1]}}>{accion}</span>;
  }

  const totalPaginas = Math.ceil(total / limite);

  return (
    <div style={{padding:'32px'}}>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Auditoría del Sistema</h1>
        <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Registro completo de acciones — Solo administradores</p>
      </div>

      {/* Stats rápidos */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {[
          {label:'Total registros', value:total, color:'#1a3a5c'},
          {label:'Esta página', value:logs.length, color:'#065f46'},
          {label:'Página actual', value:`${pagina}/${totalPaginas||1}`, color:'#92400e'},
          {label:'Por página', value:limite, color:'#6b21a8'},
        ].map((s,i)=>(
          <div key={i} className="card" style={{padding:'16px',textAlign:'center'}}>
            <p style={{fontSize:'22px',fontWeight:'700',color:s.color,margin:'0 0 4px'}}>{s.value}</p>
            <p style={{fontSize:'12px',color:'#64748b',margin:0}}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{padding:'16px',marginBottom:'16px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
          <div>
            <label className="form-label">Acción</label>
            <select className="form-input" value={filtros.accion} onChange={e=>{ setFiltros(p=>({...p,accion:e.target.value})); setPagina(1); }}>
              <option value="">Todas</option>
              {ACCIONES.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Tabla afectada</label>
            <select className="form-input" value={filtros.tabla} onChange={e=>{ setFiltros(p=>({...p,tabla:e.target.value})); setPagina(1); }}>
              <option value="">Todas</option>
              {TABLAS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Desde</label>
            <input className="form-input" type="date" value={filtros.desde} onChange={e=>{ setFiltros(p=>({...p,desde:e.target.value})); setPagina(1); }} />
          </div>
          <div>
            <label className="form-label">Hasta</label>
            <input className="form-input" type="date" value={filtros.hasta} onChange={e=>{ setFiltros(p=>({...p,hasta:e.target.value})); setPagina(1); }} />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0}}>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Fecha/Hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Tabla</th><th>Descripción</th><th>IP</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando registros...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No hay registros</td></tr>
              ) : logs.map(log=>(
                <tr key={log.id}>
                  <td style={{fontSize:'12px',color:'#64748b',whiteSpace:'nowrap'}}>
                    <div>{new Date(log.created_at).toLocaleDateString('es-PE')}</div>
                    <div style={{color:'#94a3b8'}}>{new Date(log.created_at).toLocaleTimeString('es-PE')}</div>
                  </td>
                  <td>
                    <div style={{fontWeight:'500',fontSize:'13px'}}>{log.usuario_nombre||'—'}</div>
                    <div style={{fontSize:'11px',color:'#94a3b8'}}>{log.usuario_email||''}</div>
                  </td>
                  <td style={{fontSize:'12px',color:'#64748b',textTransform:'capitalize'}}>—</td>
                  <td>{getAccionBadge(log.accion)}</td>
                  <td style={{fontSize:'12px',color:'#64748b',fontFamily:'monospace'}}>{log.tabla_afectada||'—'}</td>
                  <td style={{fontSize:'12px',color:'#374151',maxWidth:'250px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.descripcion||'—'}</td>
                  <td style={{fontSize:'11px',color:'#94a3b8',fontFamily:'monospace'}}>{log.ip_address||'—'}</td>
                  <td>
                    {(log.datos_anteriores||log.datos_nuevos) && (
                      <button className="btn-secondary" style={{padding:'4px 10px',fontSize:'11px'}} onClick={()=>setDetalle(log)}>Ver</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'16px'}}>
          <p style={{fontSize:'13px',color:'#64748b',margin:0}}>Mostrando {((pagina-1)*limite)+1}–{Math.min(pagina*limite,total)} de {total} registros</p>
          <div style={{display:'flex',gap:'6px'}}>
            <button className="btn-secondary" style={{padding:'6px 12px',fontSize:'13px'}} disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>← Anterior</button>
            {Array.from({length:Math.min(totalPaginas,5)}).map((_,i)=>{
              const p = Math.max(1, Math.min(pagina-2,totalPaginas-4)) + i;
              return (
                <button key={p} className={pagina===p?'btn-primary':'btn-secondary'} style={{padding:'6px 12px',fontSize:'13px'}} onClick={()=>setPagina(p)}>{p}</button>
              );
            })}
            <button className="btn-secondary" style={{padding:'6px 12px',fontSize:'13px'}} disabled={pagina>=totalPaginas} onClick={()=>setPagina(p=>p+1)}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDetalle(null)}>
          <div className="modal" style={{maxWidth:'700px'}}>
            <div className="modal-header">
              <h2 style={{fontSize:'16px',fontWeight:'600',margin:0}}>Detalle del registro</h2>
              <button onClick={()=>setDetalle(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom:'12px'}}>
                <p style={{fontSize:'12px',color:'#64748b',margin:'0 0 2px'}}>Acción: {getAccionBadge(detalle.accion)} — {detalle.descripcion}</p>
                <p style={{fontSize:'12px',color:'#64748b',margin:0}}>Usuario: {detalle.usuario_nombre} • {new Date(detalle.created_at).toLocaleString('es-PE')}</p>
              </div>
              {detalle.datos_anteriores && (
                <div style={{marginBottom:'12px'}}>
                  <label className="form-label">Datos anteriores</label>
                  <pre style={{background:'#fee2e2',borderRadius:'8px',padding:'12px',fontSize:'12px',overflow:'auto',maxHeight:'200px',margin:0,color:'#991b1b'}}>
                    {JSON.stringify(typeof detalle.datos_anteriores === 'string' ? JSON.parse(detalle.datos_anteriores) : detalle.datos_anteriores, null, 2)}
                  </pre>
                </div>
              )}
              {detalle.datos_nuevos && (
                <div>
                  <label className="form-label">Datos nuevos</label>
                  <pre style={{background:'#d1fae5',borderRadius:'8px',padding:'12px',fontSize:'12px',overflow:'auto',maxHeight:'200px',margin:0,color:'#065f46'}}>
                    {JSON.stringify(typeof detalle.datos_nuevos === 'string' ? JSON.parse(detalle.datos_nuevos) : detalle.datos_nuevos, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
