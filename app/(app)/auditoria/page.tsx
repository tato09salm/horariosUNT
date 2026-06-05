'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/lib/theme';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { darkMode } = useTheme();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({ accion:'', tabla:'', desde:'', hasta:'' });
  const [detalle, setDetalle] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const limite = 25;

  async function generarReporte() {
    try {
      setExporting(true);
      const q = new URLSearchParams();
      if (filtros.accion) q.set('accion', filtros.accion);
      if (filtros.tabla) q.set('tabla', filtros.tabla);
      if (filtros.desde) q.set('desde', filtros.desde);
      if (filtros.hasta) q.set('hasta', filtros.hasta + 'T23:59:59');
      
      const res = await fetch(`/api/auditoria?${q}&pagina=1&limite=10000`);
      const data = await res.json();
      const logsFull = data.data || [];
      
      if (logsFull.length === 0) {
        alert('No hay registros para generar el reporte');
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
      doc.text('REPORTE DE AUDITORÍA DEL SISTEMA', 14, 45);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 52);
      
      let filtrosTexto = '';
      if (filtros.accion) filtrosTexto += ` | Acción: ${filtros.accion}`;
      if (filtros.tabla) filtrosTexto += ` | Tabla: ${filtros.tabla}`;
      if (filtros.desde) filtrosTexto += ` | Desde: ${filtros.desde}`;
      if (filtros.hasta) filtrosTexto += ` | Hasta: ${filtros.hasta}`;
      doc.text(`Total de registros: ${logsFull.length}${filtrosTexto}`, 14, 57);

      const tableData = logsFull.map((l: any, i: number) => [
        i + 1,
        new Date(l.created_at).toLocaleString('es-PE'),
        l.usuario_nombre || '—',
        l.usuario_email || '—',
        l.accion,
        l.tabla_afectada || '—',
        l.descripcion || '—',
        l.ip_address || '—'
      ]);

      autoTable(doc, {
        startY: 65,
        head: [['#', 'FECHA/HORA', 'USUARIO', 'EMAIL', 'ACCIÓN', 'TABLA', 'DESCRIPCIÓN', 'IP']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
        columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 7: { cellWidth: 35 } },
        didDrawPage: (data) => {
          const str = 'Página ' + doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 196, doc.internal.pageSize.height - 10, { align: 'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        }
      });
      doc.save(`reporte_auditoria_${new Date().getTime()}.pdf`);
    } catch (error) {
      alert('Error al generar el reporte');
    } finally {
      setExporting(false);
    }
  }

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
    return <span style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'9999px',fontSize:'11px',fontWeight:'600',background: darkMode ? `rgba(${colors[1].startsWith('#') ? '148,163,184' : '0,0,0'}, 0.15)` : colors[0], color: darkMode ? colors[0] : colors[1], border: darkMode ? `1px solid rgba(${colors[1].startsWith('#') ? '148,163,184' : '0,0,0'}, 0.2)` : 'none'}}>{accion.toUpperCase()}</span>;
  }

  const totalPaginas = Math.ceil(total / limite);

  return (
    <div style={{padding:'32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color: 'var(--text-primary)',margin:'0 0 4px'}}>Auditoría del Sistema</h1>
          <p style={{color: 'var(--text-secondary)',fontSize:'14px',margin:0}}>Registro completo de acciones — Solo administradores</p>
        </div>
        <button className="btn-primary" onClick={generarReporte} disabled={exporting} style={{display:'flex',alignItems:'center',gap:'8px'}}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          {exporting ? 'Generando...' : 'Reporte'}
        </button>
      </div>

      {/* Stats rápidos */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {[
          {label:'Total registros', value:total, color: darkMode ? '#60a5fa' : '#1a3a5c'},
          {label:'Esta página', value:logs.length, color: darkMode ? '#34d399' : '#065f46'},
          {label:'Página actual', value:`${pagina}/${totalPaginas||1}`, color: darkMode ? '#fbbf24' : '#92400e'},
          {label:'Por página', value:limite, color: darkMode ? '#a78bfa' : '#6b21a8'},
        ].map((s,i)=>(
          <div key={i} className="card" style={{padding:'16px',textAlign:'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)'}}>
            <p style={{fontSize:'22px',fontWeight:'700',color:s.color,margin:'0 0 4px'}}>{s.value}</p>
            <p style={{fontSize:'12px',color: 'var(--text-muted)',margin:0}}>{s.label.toUpperCase()}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{padding:'16px',marginBottom:'16px', border: '1px solid var(--border-color)', background: 'var(--bg-card)'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
          <div>
            <label className="form-label">ACCIÓN</label>
            <select className="form-input" value={filtros.accion} onChange={e=>{ setFiltros(p=>({...p,accion:e.target.value})); setPagina(1); }}>
              <option value="">TODAS</option>
              {ACCIONES.map(a=><option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">TABLA AFECTADA</label>
            <select className="form-input" value={filtros.tabla} onChange={e=>{ setFiltros(p=>({...p,tabla:e.target.value})); setPagina(1); }}>
              <option value="">TODAS</option>
              {TABLAS.map(t=><option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">DESDE</label>
            <input className="form-input" type="date" value={filtros.desde} onChange={e=>{ setFiltros(p=>({...p,desde:e.target.value})); setPagina(1); }} />
          </div>
          <div>
            <label className="form-label">HASTA</label>
            <input className="form-input" type="date" value={filtros.hasta} onChange={e=>{ setFiltros(p=>({...p,hasta:e.target.value})); setPagina(1); }} />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card" style={{padding:0, border: '1px solid var(--border-color)', background: 'var(--bg-card)'}}>
        <div className="table-container">
          <table>
            <thead>
              <tr><th>FECHA/HORA</th><th>USUARIO</th><th>ROL</th><th>ACCIÓN</th><th>TABLA</th><th>DESCRIPCIÓN</th><th>IP</th><th></th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>Cargando registros...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'var(--text-muted)'}}>No hay registros</td></tr>
              ) : logs.map(log=>(
                <tr key={log.id}>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)',whiteSpace:'nowrap'}}>
                    <div>{new Date(log.created_at).toLocaleDateString('es-PE')}</div>
                    <div style={{color:'var(--text-muted)'}}>{new Date(log.created_at).toLocaleTimeString('es-PE')}</div>
                  </td>
                  <td>
                    <div style={{fontWeight:'500',fontSize:'13px', color: 'var(--text-primary)'}}>{log.usuario_nombre||'—'}</div>
                    <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{log.usuario_email||''}</div>
                  </td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)',textTransform:'uppercase'}}>{log.usuario_rol?.toUpperCase() || '—'}</td>
                  <td>{getAccionBadge(log.accion)}</td>
                  <td style={{fontSize:'12px',color:'var(--text-secondary)',fontFamily:'monospace'}}>{log.tabla_afectada?.toUpperCase()||'—'}</td>
                  <td style={{fontSize:'12px',color:'var(--text-primary)',maxWidth:'250px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.descripcion||'—'}</td>
                  <td style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'monospace'}}>{log.ip_address||'—'}</td>
                  <td>
                    {(log.datos_anteriores||log.datos_nuevos) && (
                      <button className="btn-secondary btn-crud-edit" style={{padding:'4px 10px',fontSize:'11px'}} onClick={()=>setDetalle(log)}>VER</button>
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
          <p style={{fontSize:'13px',color: 'var(--text-secondary)',margin:0}}>Mostrando <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{((pagina-1)*limite)+1}</span>–<span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{Math.min(pagina*limite,total)}</span> de <span style={{fontWeight:'600',color: darkMode ? '#00A6FF' : '#1e293b'}}>{total}</span> registros</p>
          <div style={{display:'flex',gap:'6px'}}>
            <button className="btn-secondary" style={{padding:'6px 12px',fontSize:'13px', color: darkMode ? '#00A6FF' : undefined}} disabled={pagina<=1} onClick={()=>setPagina(p=>p-1)}>← ANTERIOR</button>
            <button className="btn-secondary" style={{padding:'6px 12px',fontSize:'13px', color: darkMode ? '#00A6FF' : undefined}} disabled={pagina>=totalPaginas} onClick={()=>setPagina(p=>p+1)}>SIGUIENTE →</button>
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
