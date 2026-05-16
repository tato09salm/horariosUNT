'use client';
import { useState, useEffect, useRef } from 'react';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
const DIAS_L: Record<string,string> = {lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado'};

export default function ReportesPage() {
  const [ciclos, setCiclos] = useState<any[]>([]);
  const [cicloId, setCicloId] = useState('');
  const [docentes, setDocentes] = useState<any[]>([]);
  const [ambientes, setAmbientes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [tipoReporte, setTipoReporte] = useState<'operacional'|'gestion'|'docente'>('operacional');
  const [docenteId, setDocenteId] = useState('');
  const [ambienteId, setAmbienteId] = useState('');
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/ciclos').then(r=>r.json()).then(d=>{
      setCiclos(d.data||[]);
      const a = d.data?.find((c:any)=>c.activo);
      if(a) setCicloId(a.id);
    });
    fetch('/api/docentes').then(r=>r.json()).then(d=>setDocentes(d.data||[]));
    fetch('/api/aulas').then(r=>r.json()).then(d=>setAmbientes(d.data||[]));
    fetch('/api/dashboard').then(r=>r.json()).then(d=>{ setSlots(d.slots||[]); setDashData(d); });
  }, []);

  async function generarReporte() {
    if (!cicloId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ciclo_id:cicloId});
      if (tipoReporte==='docente' && docenteId) q.set('docente_id',docenteId);
      if (ambienteId) q.set('ambiente_id',ambienteId);
      const res = await fetch(`/api/horarios?${q}`);
      const data = await res.json();
      setAsignaciones(data.data||[]);
      if (cicloId) {
        const d = await fetch(`/api/dashboard?ciclo_id=${cicloId}`).then(r=>r.json());
        setDashData(d);
      }
    } finally { setLoading(false); }
  }

  async function exportarPDF() {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const ciclo = ciclos.find(c=>c.id===cicloId);

    // Header
    doc.setFillColor(26, 58, 92);
    doc.rect(0, 0, 297, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 148.5, 10, {align:'center'});
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Escuela de Ingeniería de Sistemas', 148.5, 17, {align:'center'});
    doc.setFontSize(10);
    doc.text(`${tipoReporte==='gestion'?'REPORTE DE GESTIÓN':'REPORTE OPERACIONAL'} — ${ciclo?.nombre||''} — Generado: ${new Date().toLocaleDateString('es-PE')}`, 148.5, 24, {align:'center'});

    doc.setTextColor(0, 0, 0);
    let y = 35;

    if (tipoReporte === 'gestion') {
      // Estadísticas
      doc.setFontSize(12); doc.setFont('helvetica','bold');
      doc.text('RESUMEN EJECUTIVO', 15, y); y += 8;

      doc.setFontSize(9); doc.setFont('helvetica','normal');
      const stats = [
        ['Docentes activos', dashData?.stats?.totalDocentes],
        ['Cursos activos', dashData?.stats?.totalCursos],
        ['Ambientes disponibles', dashData?.stats?.totalAmbientes],
        ['Total asignaciones', dashData?.stats?.totalAsignaciones],
      ];
      autoTable(doc, {
        startY: y, head:[['Indicador','Valor']],
        body: stats, theme:'striped',
        headStyles:{fillColor:[26,58,92]}, margin:{left:15,right:15},
        tableWidth: 100,
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Carga docentes
      doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text('CARGA HORARIA POR DOCENTE', 15, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Docente','Categoría','Condición','Horas Asignadas','Horas Máx.','% Carga']],
        body: dashData?.cargaDocentes?.map((d:any)=>[
          d.nombre, d.categoria.replace('_',' '), d.condicion,
          `${d.horas_asignadas}h`, `${d.horas_max_semana}h`, `${d.porcentaje_carga||0}%`
        ])||[],
        theme:'striped', headStyles:{fillColor:[26,58,92]}, margin:{left:15,right:15},
        styles:{fontSize:8},
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Ocupación ambientes
      doc.setFontSize(11); doc.setFont('helvetica','bold');
      doc.text('OCUPACIÓN DE AMBIENTES', 15, y); y += 6;
      autoTable(doc, {
        startY: y,
        head:[['Ambiente','Tipo','Horas Usadas','% Ocupación']],
        body: dashData?.ocupacionAmbientes?.map((a:any)=>[
          a.nombre, a.tipo, `${a.horas_usadas}h`, `${a.porcentaje}%`
        ])||[],
        theme:'striped', headStyles:{fillColor:[26,58,92]}, margin:{left:15,right:15},
        styles:{fontSize:8},
      });
    } else {
      // Reporte operacional
      const docGrp: Record<string,any[]> = {};
      asignaciones.forEach(a => {
        const k = tipoReporte==='docente' ? a.docente_nombre : a.ambiente_nombre;
        if (!docGrp[k]) docGrp[k] = [];
        docGrp[k].push(a);
      });

      Object.entries(docGrp).forEach(([titulo, rows]) => {
        if (y > 170) { doc.addPage(); y = 20; }
        doc.setFontSize(11); doc.setFont('helvetica','bold');
        doc.text(titulo, 15, y); y += 6;
        autoTable(doc, {
          startY: y,
          head:[['Día','Hora Inicio','Hora Fin','Curso','Ambiente/Docente','Tipo','Grupo']],
          body: rows.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(r=>[
            DIAS_L[r.dia]||r.dia, r.hora_inicio, r.hora_fin, r.curso_nombre,
            tipoReporte==='docente' ? r.ambiente_nombre : r.docente_nombre,
            r.tipo, `G${r.numero_grupo}`
          ]),
          theme:'striped', headStyles:{fillColor:[26,58,92]}, margin:{left:15,right:15},
          styles:{fontSize:8},
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      });
    }

    const nombre = tipoReporte==='gestion' ? 'reporte-gestion' : tipoReporte==='docente' ? 'horario-docente' : 'reporte-operacional';
    doc.save(`${nombre}-${ciclo?.nombre||'unt'}.pdf`);
  }

  const docenteSelec = docentes.find(d=>d.id===docenteId);

  // Organizar asignaciones para vista previa
  const porDocente: Record<string,any[]> = {};
  const porAmbiente: Record<string,any[]> = {};
  asignaciones.forEach(a => {
    if (!porDocente[a.docente_nombre]) porDocente[a.docente_nombre] = [];
    porDocente[a.docente_nombre].push(a);
    if (!porAmbiente[a.ambiente_nombre]) porAmbiente[a.ambiente_nombre] = [];
    porAmbiente[a.ambiente_nombre].push(a);
  });

  return (
    <div style={{padding:'32px'}}>
      <div style={{marginBottom:'24px'}}>
        <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Reportes</h1>
        <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Generación de reportes operacionales y de gestión en PDF</p>
      </div>

      {/* Config Panel */}
      <div className="card" style={{marginBottom:'20px'}}>
        <h3 style={{fontSize:'16px',fontWeight:'600',margin:'0 0 16px'}}>Configuración del reporte</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'16px'}}>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">Tipo de reporte</label>
            <select className="form-input" value={tipoReporte} onChange={e=>setTipoReporte(e.target.value as any)}>
              <option value="operacional">📋 Operacional (Aulas y Docentes)</option>
              <option value="docente">👤 Horario por Docente</option>
              <option value="gestion">📊 Gestión (Resumen Ejecutivo)</option>
            </select>
          </div>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">Ciclo académico</label>
            <select className="form-input" value={cicloId} onChange={e=>setCicloId(e.target.value)}>
              {ciclos.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.activo?' (Activo)':''}</option>)}
            </select>
          </div>
          {tipoReporte==='docente' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Docente</label>
              <select className="form-input" value={docenteId} onChange={e=>setDocenteId(e.target.value)}>
                <option value="">Todos los docentes</option>
                {docentes.map(d=><option key={d.id} value={d.id}>[{d.categoria}] {d.apellidos}, {d.nombre}</option>)}
              </select>
            </div>
          )}
          {tipoReporte==='operacional' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Filtrar por ambiente (opcional)</label>
              <select className="form-input" value={ambienteId} onChange={e=>setAmbienteId(e.target.value)}>
                <option value="">Todos los ambientes</option>
                {ambientes.map(a=><option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:'12px'}}>
          <button className="btn-primary" onClick={generarReporte} disabled={loading}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            {loading ? 'Generando...' : 'Previsualizar'}
          </button>
          {asignaciones.length > 0 && (
            <button className="btn-secondary" onClick={exportarPDF}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {/* Vista previa */}
      {asignaciones.length > 0 && tipoReporte !== 'gestion' && (
        <div ref={reportRef}>
          {/* Cabecera reporte */}
          <div style={{background:'#1a3a5c',color:'white',borderRadius:'12px 12px 0 0',padding:'20px 24px',marginBottom:0}}>
            <p style={{fontSize:'12px',margin:'0 0 2px',opacity:0.7}}>UNIVERSIDAD NACIONAL DE TRUJILLO — Escuela de Ingeniería de Sistemas</p>
            <h2 style={{fontSize:'18px',fontWeight:'700',margin:'0 0 2px'}}>
              {tipoReporte==='docente' ? `Horario del Docente: ${docenteSelec ? `${docenteSelec.apellidos}, ${docenteSelec.nombre}` : 'Todos'}` : 'Reporte Operacional de Horarios'}
            </h2>
            <p style={{fontSize:'13px',margin:0,opacity:0.8}}>Ciclo: {ciclos.find(c=>c.id===cicloId)?.nombre} • Generado: {new Date().toLocaleDateString('es-PE')}</p>
          </div>

          {tipoReporte==='docente' && (
            Object.entries(porDocente).map(([docNombre, rows]) => (
              <div key={docNombre} style={{marginBottom:'24px'}}>
                <div style={{background:'#f8fafc',padding:'12px 20px',borderLeft:'4px solid #1a3a5c',marginBottom:'8px'}}>
                  <h3 style={{fontSize:'15px',fontWeight:'600',color:'#1e293b',margin:'0 0 2px'}}>{docNombre}</h3>
                  <p style={{fontSize:'12px',color:'#64748b',margin:0}}>{rows.length} sesiones asignadas</p>
                </div>
                {/* Mini grid */}
                <div style={{overflowX:'auto'}}>
                  <div className="horario-grid" style={{minWidth:'700px'}}>
                    <div className="horario-header">Hora</div>
                    {DIAS.slice(0,5).map(d=><div key={d} className="horario-header">{DIAS_L[d]}</div>)}
                    {slots.map((slot:any)=>(
                      <div key={slot.id} style={{display:'contents'}}>
                        <div className="horario-time">{slot.hora_inicio}<br/>{slot.hora_fin}</div>
                        {DIAS.slice(0,5).map(dia=>{
                          const c = rows.find(r=>r.dia===dia && r.slot_id===slot.id);
                          return (
                            <div key={dia} className="horario-cell">
                              {c && <div className={`block-${c.tipo}`}><div style={{fontWeight:'600',fontSize:'10px'}}>{c.curso_codigo}</div><div style={{fontSize:'9px'}}>{c.ambiente_codigo}</div></div>}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}

          {tipoReporte==='operacional' && (
            Object.entries(porAmbiente).map(([ambNombre, rows]) => (
              <div key={ambNombre} style={{marginBottom:'20px'}}>
                <div style={{background:'#f8fafc',padding:'10px 20px',borderLeft:'4px solid #10b981',marginBottom:'8px'}}>
                  <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:0}}>{ambNombre}</h3>
                </div>
                <div className="card" style={{padding:0}}>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Día</th><th>Hora</th><th>Curso</th><th>Docente</th><th>Tipo</th><th>Grupo</th></tr></thead>
                      <tbody>
                        {rows.sort((a,b)=>DIAS.indexOf(a.dia)-DIAS.indexOf(b.dia)).map(r=>(
                          <tr key={r.id}>
                            <td style={{textTransform:'capitalize',fontWeight:'500'}}>{r.dia}</td>
                            <td style={{fontSize:'12px',color:'#64748b'}}>{r.hora_inicio} - {r.hora_fin}</td>
                            <td><div style={{fontWeight:'500',fontSize:'13px'}}>{r.curso_nombre}</div><div style={{fontSize:'11px',color:'#94a3b8'}}>{r.curso_codigo}</div></td>
                            <td style={{fontSize:'13px'}}>{r.docente_nombre}</td>
                            <td><span className={`badge badge-${r.tipo}`}>{r.tipo}</span></td>
                            <td style={{textAlign:'center'}}>G{r.numero_grupo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reporte de gestión */}
      {tipoReporte==='gestion' && dashData && asignaciones.length >= 0 && (
        <div>
          <div style={{background:'#1a3a5c',color:'white',borderRadius:'12px 12px 0 0',padding:'20px 24px'}}>
            <p style={{fontSize:'12px',margin:'0 0 2px',opacity:0.7}}>UNIVERSIDAD NACIONAL DE TRUJILLO — Escuela de Ingeniería de Sistemas</p>
            <h2 style={{fontSize:'18px',fontWeight:'700',margin:'0 0 2px'}}>Reporte de Gestión — Resumen Ejecutivo</h2>
            <p style={{fontSize:'13px',margin:0,opacity:0.8}}>Ciclo: {ciclos.find(c=>c.id===cicloId)?.nombre}</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',padding:'20px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {[
              {l:'Docentes',v:dashData.stats?.totalDocentes,c:'#1a3a5c'},
              {l:'Cursos',v:dashData.stats?.totalCursos,c:'#065f46'},
              {l:'Ambientes',v:dashData.stats?.totalAmbientes,c:'#92400e'},
              {l:'Asignaciones',v:dashData.stats?.totalAsignaciones,c:'#6b21a8'},
            ].map((s,i)=>(
              <div key={i} style={{background:'white',borderRadius:'10px',padding:'16px',textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
                <p style={{fontSize:'26px',fontWeight:'700',color:s.c,margin:'0 0 4px'}}>{s.v}</p>
                <p style={{fontSize:'12px',color:'#64748b',margin:0}}>{s.l}</p>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',borderTop:'1px solid #e2e8f0'}}>
            <div style={{padding:'20px',borderRight:'1px solid #e2e8f0'}}>
              <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px'}}>Carga horaria docentes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {dashData.cargaDocentes?.slice(0,8).map((d:any,i:number)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'12px',color:'#374151',fontWeight:'500',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombre}</span>
                      <span style={{fontSize:'11px',color:'#64748b',marginLeft:'8px',flexShrink:0}}>{d.horas_asignadas}/{d.horas_max_semana}h</span>
                    </div>
                    <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'5px'}}>
                      <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(d.porcentaje_carga)>90?'#dc2626':parseFloat(d.porcentaje_carga)>60?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(d.porcentaje_carga),100)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{padding:'20px'}}>
              <h3 style={{fontSize:'14px',fontWeight:'600',color:'#1e293b',margin:'0 0 12px'}}>Ocupación de ambientes</h3>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {dashData.ocupacionAmbientes?.slice(0,8).map((a:any,i:number)=>(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px'}}>
                      <span style={{fontSize:'12px',color:'#374151',fontWeight:'500'}}>{a.codigo} — {a.nombre}</span>
                      <span style={{fontSize:'11px',color:'#64748b'}}>{a.porcentaje}%</span>
                    </div>
                    <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'5px'}}>
                      <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(a.porcentaje)>70?'#dc2626':parseFloat(a.porcentaje)>40?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(a.porcentaje),100)}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{padding:'16px 20px',borderTop:'1px solid #e2e8f0',textAlign:'right'}}>
            <button className="btn-secondary" onClick={exportarPDF}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Exportar PDF
            </button>
          </div>
        </div>
      )}

      {asignaciones.length === 0 && !loading && tipoReporte !== 'gestion' && (
        <div style={{textAlign:'center',padding:'60px',color:'#94a3b8'}}>
          <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{margin:'0 auto 12px',display:'block',opacity:0.4}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p style={{fontSize:'15px',margin:'0 0 4px'}}>Configure y previsualice el reporte</p>
          <p style={{fontSize:'13px',margin:0}}>Seleccione el tipo de reporte y haga clic en Previsualizar</p>
        </div>
      )}
    </div>
  );
}
