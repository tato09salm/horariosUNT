'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTheme } from '@/lib/theme';
import { useUser } from '../layout';

interface Curso { id:string; codigo:string; nombre:string; creditos:number; horas_teoria:number; horas_practica:number; ciclo_plan:number; escuela_id:string; escuela_nombre:string; activo:boolean; }
const empty: Partial<Curso> = { codigo:'', nombre:'', creditos:3, horas_teoria:3, horas_practica:0, ciclo_plan:1, activo: true };

export default function CursosPage() {
  const { darkMode } = useTheme();
  const user = useUser();
  const isAdmin = user?.rol.codigo === 'admin';
  const isDirector = user?.rol.codigo === 'director_escuela';
  const canWrite = isAdmin || isDirector; // Director puede escribir

  // ── Persistir filtros en URL ──────────────────────────────────────────────
  const getParam = (key: string) => typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get(key) || '' : '';

  const [buscar,       setBuscar]       = useState(() => getParam('buscar'));
  const [filtroCiclo,  setFiltroCiclo]  = useState(() => getParam('ciclo'));
  const [filtroEstado, setFiltroEstado] = useState(() => getParam('estado'));

  useEffect(() => {
    const params = new URLSearchParams();
    if (buscar)       params.set('buscar',  buscar);
    if (filtroCiclo)  params.set('ciclo',   filtroCiclo);
    if (filtroEstado) params.set('estado',  filtroEstado);
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [buscar, filtroCiclo, filtroEstado]);

  const hayFiltrosActivos = !!(buscar || filtroCiclo || filtroEstado);

  function limpiarFiltros() {
    setBuscar('');
    setFiltroCiclo('');
    setFiltroEstado('');
    setPagina(1);
  }

  const [cursos,   setCursos]   = useState<Curso[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadingPDF, setLoadingPDF] = useState(false);
  const [pagina,   setPagina]   = useState(1);
  const [total,    setTotal]    = useState(0);
  const [stats,    setStats]    = useState({ total_cursos:0, total_creditos:0, total_teoria:0, total_practica:0 });
  const limit = 10;

  const [escuelas,      setEscuelas]      = useState<any[]>([]);
  const [showModal,     setShowModal]     = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [cursoAToggle,  setCursoAToggle]  = useState<{id:string, nombre:string, activo:boolean}|null>(null);
  const [form,          setForm]          = useState<Partial<Curso>>({...empty});
  const formOriginal                      = useRef<Partial<Curso>>({...empty});
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState<{type:string; text:string}|null>(null);

  const [curriculas, setCurriculas] = useState<any[]>([]);
  const [selectedCurricula, setSelectedCurricula] = useState<string>('');
  const [loadedCurriculas, setLoadedCurriculas] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    Promise.all([
      fetch('/api/configuracion?clave=ID_MALLA_CURRICULAR_ACTUAL').then(r => r.json()),
      fetch('/api/curriculas?manage=true').then(r => r.json())
    ]).then(([configRes, currRes]) => {
      const allCurriculas = currRes.data || [];
      const filtered = allCurriculas.filter((c: any) => c.estado === 'ACTIVA' || c.estado === 'EN_EXTINCION');
      setCurriculas(filtered);

      const mallaActualId = configRes.data?.valor || '';
      if (mallaActualId) {
        setSelectedCurricula(mallaActualId);
      } else if (filtered.length > 0) {
        setSelectedCurricula(filtered[0].id);
      }
      setLoadedCurriculas(true);
      if (filtered.length === 0) {
        setLoading(false);
      }
    }).catch(err => {
      console.error('Error al cargar currículas/configuración:', err);
      setLoadedCurriculas(true);
      setLoading(false);
    });
  }, []);

  const cargar = useCallback(() => {
    if (!selectedCurricula) return;
    setLoading(true);
    const q = new URLSearchParams();
    if (buscar)       q.set('buscar', buscar);
    if (filtroCiclo)  q.set('ciclo',  filtroCiclo);
    if (filtroEstado) q.set('activo', filtroEstado);
    q.set('curricula_id', selectedCurricula);
    q.set('page',  pagina.toString());
    q.set('limit', limit.toString());
    fetch(`/api/cursos?${q}`)
      .then(r => r.json())
      .then(d => { setCursos(d.data||[]); setTotal(d.total||0); if (d.stats) setStats(d.stats); })
      .catch(() => setToast({ type:'error', text:'Error al cargar cursos. Verifica tu conexión.' }))
      .finally(() => setLoading(false));
  }, [buscar, filtroCiclo, filtroEstado, pagina, selectedCurricula]);

  useEffect(() => { const t = setTimeout(cargar, 400); return () => clearTimeout(t); }, [cargar]);
  useEffect(() => { setPagina(1); }, [buscar, filtroCiclo, filtroEstado]);

  function formatCurriculaSelectLabel(c: any) {
    const base = `${c.nombre_carrera} (${c.año_curricula}) - ${c.modalidad_estudios}`;
    if (c.estado === 'EN_EXTINCION') {
      return `${base} - EN EXTINCIÓN`;
    }
    return base;
  }

  useEffect(() => {
    fetch('/api/cursos?reporte=true').then(r=>r.json()).then(d => {
      const esc = Array.from(new Set(d.data?.map((c:any) => JSON.stringify({id:c.escuela_id, nombre:c.escuela_nombre}))))
        .filter(s => s !== 'null')
        .map((s:any) => JSON.parse(s));
      setEscuelas(esc);
    });
  }, []);

  function hayChangios(): boolean {
    return JSON.stringify(form) !== JSON.stringify(formOriginal.current);
  }

  function intentarCerrarModal() {
    if (hayChangios()) setShowCloseConfirm(true);
    else setShowModal(false);
  }

  async function guardar() {
    setSaving(true);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const url    = form.id ? `/api/cursos/${form.id}` : '/api/cursos';
      const body = {
        ...form,
        curricula_id: selectedCurricula
      };
      const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowModal(false);
      setToast({ type:'success', text:`Curso ${form.id ? 'actualizado' : 'creado'} correctamente` });
      cargar();
    } catch(e:any) {
      setToast({ type:'error', text: e.message || 'Error al guardar' });
    } finally { setSaving(false); }
  }

  async function confirmarToggle() {
    if (!cursoAToggle) return;
    setSaving(true);
    try {
      const resCur = await fetch(`/api/cursos/${cursoAToggle.id}`);
      const { data: c } = await resCur.json();
      const res = await fetch(`/api/cursos/${cursoAToggle.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...c, activo: !cursoAToggle.activo }),
      });
      if (!res.ok) throw new Error();
      setShowConfirm(false);
      setCursoAToggle(null);
      setToast({ type:'success', text:`Curso ${cursoAToggle.activo ? 'desactivado' : 'activado'} correctamente` });
      cargar();
    } catch {
      setToast({ type:'error', text:'Error al cambiar estado del curso' });
    } finally { setSaving(false); }
  }

  function toggleEstado(c: Curso) {
    setCursoAToggle({ id:c.id, nombre:c.nombre.toUpperCase(), activo:c.activo });
    setShowConfirm(true);
  }

  function editar(c: Curso) {
    const base = { ...c, nombre:c.nombre.toUpperCase(), codigo:c.codigo.toUpperCase() };
    setForm(base);
    formOriginal.current = base;
    setShowModal(true);
  }

  function nuevo() {
    const base = { ...empty };
    setForm(base);
    formOriginal.current = base;
    setShowModal(true);
  }

  async function generarReporte() {
    // ── loadingPDF separado para no bloquear la tabla ──
    setLoadingPDF(true);
    try {
      const q = new URLSearchParams();
      if (buscar)       q.set('buscar', buscar);
      if (filtroCiclo)  q.set('ciclo',  filtroCiclo);
      if (filtroEstado) q.set('activo', filtroEstado);
      if (selectedCurricula) q.set('curricula_id', selectedCurricula);
      q.set('reporte', 'true');
      const res  = await fetch(`/api/cursos?${q}`);
      const data = await res.json();
      const todosLosCursos = data.data || [];

      if (todosLosCursos.length === 0) {
        setToast({ type:'error', text:'No hay registros para generar el reporte' });
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(16); doc.setTextColor(30, 41, 59);
      doc.text('UNIVERSIDAD NACIONAL DE TRUJILLO', 105, 20, { align:'center' });
      doc.setFontSize(12);
      doc.text('Facultad de Ingeniería - Escuela de Ingeniería de Sistemas', 105, 28, { align:'center' });
      doc.setDrawColor(226, 232, 240); doc.line(14, 35, 196, 35);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text('REPORTE OFICIAL DE PLAN DE ESTUDIOS', 14, 45);
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })}`, 14, 52);
      doc.text(`Total de cursos: ${todosLosCursos.length}`, 14, 57);

      autoTable(doc, {
        startY: 65,
        head: [['ORD.', 'CÓDIGO', 'ASIGNATURA', 'CICLO', 'CR.', 'HT', 'HP', 'ESTADO']],
        body: todosLosCursos.map((c: Curso, i: number) => [
          i + 1, c.codigo.toUpperCase(), c.nombre.toUpperCase(),
          c.ciclo_plan || '—', c.creditos,
          c.horas_teoria + 'h', c.horas_practica + 'h',
          c.activo ? 'ACTIVO' : 'INACTIVO',
        ]),
        theme: 'striped',
        headStyles: { fillColor:[30,41,59], textColor:[255,255,255], fontSize:9, fontStyle:'bold', halign:'center' },
        bodyStyles: { fontSize:8, textColor:[51,65,85] },
        columnStyles: {
          0: { halign:'center', cellWidth:10 }, 1: { halign:'center', cellWidth:20 },
          3: { halign:'center', cellWidth:15 }, 4: { halign:'center', cellWidth:10 },
          5: { halign:'center', cellWidth:12 }, 6: { halign:'center', cellWidth:12 },
          7: { halign:'center' },
        },
        didDrawPage: () => {
          doc.setFontSize(8); doc.setTextColor(148, 163, 184);
          doc.text('Página ' + doc.internal.getNumberOfPages(), 196, doc.internal.pageSize.height - 10, { align:'right' });
          doc.text('Sistema de Gestión de Horarios - UNT', 14, doc.internal.pageSize.height - 10);
        },
      });
      doc.save(`plan_estudios_${new Date().getTime()}.pdf`);
    } catch {
      setToast({ type:'error', text:'Error al generar el reporte' });
    } finally { setLoadingPDF(false); }
  }

  const totalPaginas = Math.ceil(total / limit);

  if (loadedCurriculas && curriculas.length === 0) {
    return (
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#ef4444', margin: '0 0 8px' }}>Inaccesible</h1>
        <p style={{ fontSize: '18px', color: 'var(--text-secondary)', margin: 0 }}>No hay una currícula configurada</p>
      </div>
    );
  }

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
          <h1 style={{fontSize:'24px',fontWeight:'700',margin:'0 0 4px'}}>Cursos</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'14px',margin:0}}>Plan de estudios — Ingeniería de Sistemas</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={generarReporte} disabled={loadingPDF}>
            {loadingPDF
              ? <span style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',display:'inline-block',animation:'spin 0.7s linear infinite'}} />
              : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            }
            <span className="hide-sm">{loadingPDF ? 'Generando...' : 'Reporte'}</span>
          </button>
          {canWrite && (
            <button className="btn-primary" onClick={nuevo}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              <span className="hide-sm">Nuevo curso</span>
              <span className="show-sm">Nuevo</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
        {[
          {label:'Total cursos',      value:stats.total_cursos,    color: darkMode?'#60a5fa':'#1a3a5c'},
          {label:'Créditos total',    value:stats.total_creditos,  color: darkMode?'#34d399':'#065f46'},
          {label:'Hrs. teoría/sem',   value:stats.total_teoria,    color: darkMode?'#fbbf24':'#92400e'},
          {label:'Hrs. práctica/sem', value:stats.total_practica,  color: darkMode?'#a78bfa':'#6b21a8'},
        ].map((s,i) => (
          <div key={i} className="stat-card" style={{padding:'16px 12px',gap:'10px',background:darkMode?'var(--bg-card)':'white'}}>
            <div style={{minWidth:0}}>
              <p style={{fontSize:'20px',fontWeight:'700',color:s.color,margin:'0'}}>{s.value}</p>
              <p style={{fontSize:'11px',color:darkMode?'#94a3b8':'#64748b',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{marginBottom:'16px',padding:'16px'}}>
        <div style={{display:'flex',gap:'12px',alignItems:'center',width:'100%',flexWrap:'wrap'}}>

          <select 
            className="form-input" 
            style={{flex:'0 0 280px'}} 
            value={selectedCurricula} 
            onChange={e => setSelectedCurricula(e.target.value)}
          >
            {curriculas.map(c => (
              <option key={c.id} value={c.id}>
                {formatCurriculaSelectLabel(c)}
              </option>
            ))}
          </select>

          {/* Buscador */}
          <div style={{position:'relative',flex:'1 1 0',minWidth:0}}>
            <input
              className="form-input"
              placeholder="Buscar por código o nombre..."
              value={buscar}
              onChange={e => setBuscar(e.target.value.toUpperCase())}
              style={{width:'100%', paddingRight: loading && buscar ? 36 : undefined, textTransform:'uppercase'}}
            />
            {loading && buscar && (
              <span style={{
                position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                width:14,height:14,borderRadius:'50%',
                border:'2px solid var(--border-color)',borderTopColor:'#1a3a5c',
                display:'inline-block',animation:'spin 0.7s linear infinite',
              }} />
            )}
          </div>

          <select className="form-input" style={{flex:'0 0 160px'}} value={filtroCiclo} onChange={e => setFiltroCiclo(e.target.value)}>
            <option value="">Todos los ciclos</option>
            {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Ciclo {c}</option>)}
          </select>

          <select className="form-input" style={{flex:'0 0 160px'}} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>

          {/* Botón limpiar filtros */}
          {hayFiltrosActivos && (
            <button
              onClick={limpiarFiltros}
              title="Limpiar filtros"
              style={{
                flexShrink:0,display:'flex',alignItems:'center',gap:6,
                padding:'8px 14px',borderRadius:8,fontSize:13,fontWeight:500,
                border:'1.5px solid #fca5a5',background:'#fff5f5',color:'#991b1b',
                cursor:'pointer',whiteSpace:'nowrap',transition:'all 0.15s',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Limpiar
            </button>
          )}
        </div>

        {/* Contador resultados */}
        {!loading && hayFiltrosActivos && (
          <p style={{margin:'10px 0 0',fontSize:'13px',color:'var(--text-secondary)'}}>
            {total === 0
              ? 'Sin resultados para los filtros aplicados'
              : <><strong style={{color:'var(--text-primary)'}}>{total}</strong> curso{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</>
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
                <th className="hide-sm">Ciclo</th>
                <th>Código</th>
                <th>Nombre</th>
                <th className="hide-sm">Créditos</th>
                <th className="hide-sm">H. Teoría</th>
                <th className="hide-sm">H. Práctica</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>Cargando cursos...</td></tr>
              ) : cursos.length === 0 ? (
                <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94a3b8'}}>No se encontraron cursos</td></tr>
              ) : cursos.map((c:Curso) => (
                <tr key={c.id}>
                  <td className="hide-sm" style={{textAlign:'center'}}>
                    <span style={{background: darkMode ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe', color: darkMode ? '#60a5fa' : '#0369a1', borderRadius:'6px', padding:'2px 8px', fontSize:'11px', fontWeight:'600'}}>Ciclo {c.ciclo_plan}</span>
                  </td>
                  <td style={{fontWeight:'600',color: darkMode ? '#94a3b8' : '#475569',fontFamily:'monospace',fontSize:'13px'}}>{c.codigo.toUpperCase()}</td>
                  <td style={{fontWeight:'500'}}>{c.nombre.toUpperCase()}</td>
                  <td className="hide-sm" style={{textAlign:'center'}}>
                    <span style={{background: darkMode ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9', color: 'var(--text-secondary)', padding:'2px 8px', borderRadius:'6px', fontSize:'12px', fontWeight:'600'}}>{c.creditos} cr.</span>
                  </td>
                  <td className="hide-sm" style={{textAlign:'center'}}><span className="badge badge-teoria">{c.horas_teoria}h</span></td>
                  <td className="hide-sm" style={{textAlign:'center'}}>
                    {c.horas_practica > 0
                      ? <span className="badge badge-laboratorio">{c.horas_practica}h</span>
                      : <span style={{color:'var(--text-muted)',fontSize:'12px'}}>—</span>}
                  </td>
                  <td>
                    <span className={`docentes-status-badge ${c.activo ? 'docentes-status-badge--activo' : 'docentes-status-badge--inactivo'}`}>
                      {c.activo ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:'6px'}}>
                      {canWrite && (
                        <>
                          <button className="btn-secondary btn-crud-edit" style={{padding:'5px 10px',fontSize:'12px'}} onClick={() => editar(c)}>
                            <span className="hide-sm">Editar</span>
                            <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button
                            className="btn-secondary btn-crud-deactivate"
                            style={{padding:'5px 10px',fontSize:'12px'}}
                            onClick={() => toggleEstado(c)}
                          >
                            <span className="hide-sm">{c.activo ? 'Desactivar' : 'Activar'}</span>
                            <svg className="show-sm" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.activo ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} />
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
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px',borderTop:'1px solid '+(darkMode?'#374151':'#e2e8f0')}}>
            <div style={{fontSize:'14px',color:darkMode?'#94a3b8':'#64748b'}}>
              Mostrando{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{(pagina-1)*limit+1}</strong> a{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{Math.min(pagina*limit,total)}</strong> de{' '}
              <strong style={{color:darkMode?'#00A6FF':'#1e293b'}}>{total}</strong> cursos
            </div>
            <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
              <button className="btn-secondary" style={{padding:'6px 12px'}} disabled={pagina===1} onClick={() => setPagina(p=>p-1)}>Anterior</button>
              <span style={{fontSize:'14px',fontWeight:'600',color:darkMode?'#00A6FF':'#1e293b',padding:'0 8px'}}>{pagina} / {totalPaginas}</span>
              <button className="btn-secondary" style={{padding:'6px 12px'}} disabled={pagina>=totalPaginas} onClick={() => setPagina(p=>p+1)}>Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo / editar */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>{form.id ? 'Editar curso' : 'Nuevo curso'}</h2>
              <button onClick={intentarCerrarModal} style={{background:'none',border:'none',cursor:'pointer',color:'#64748b',padding:'4px'}}>
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="responsive-grid">
                <div className="form-group">
                  <label className="form-label">Código *</label>
                  <input className="form-input" value={form.codigo||''} onChange={e=>setForm((p:any)=>({...p,codigo:e.target.value.toUpperCase()}))} style={{textTransform:'uppercase'}}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Ciclo del plan</label>
                  <input className="form-input" type="number" min={1} max={10} value={form.ciclo_plan||1} onChange={e=>setForm((p:any)=>({...p,ciclo_plan:parseInt(e.target.value)}))}/>
                </div>
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label className="form-label">Nombre *</label>
                  <input className="form-input" value={form.nombre||''} onChange={e=>setForm((p:any)=>({...p,nombre:e.target.value.toUpperCase()}))} style={{textTransform:'uppercase'}}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Escuela</label>
                  <select className="form-input" value={form.escuela_id||''} onChange={e=>setForm((p:any)=>({...p,escuela_id:e.target.value}))}>
                    <option value="">Seleccionar...</option>
                    {escuelas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Créditos</label>
                  <input className="form-input" type="number" min={1} max={8} value={form.creditos||3} onChange={e=>setForm((p:any)=>({...p,creditos:parseInt(e.target.value)}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Horas teoría/semana</label>
                  <input className="form-input" type="number" min={0} max={10} value={form.horas_teoria||3} onChange={e=>setForm((p:any)=>({...p,horas_teoria:parseInt(e.target.value)}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Horas práctica/semana</label>
                  <input className="form-input" type="number" min={0} max={10} value={form.horas_practica||0} onChange={e=>setForm((p:any)=>({...p,horas_practica:parseInt(e.target.value)}))}/>
                </div>
              </div>
              <p style={{margin:'16px 0 0',fontSize:'12px',color:'var(--text-secondary)'}}>
                <span style={{color:'#dc2626',fontWeight:600}}>*</span> Campo obligatorio
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={intentarCerrarModal}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación cerrar con cambios */}
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
              <button className="btn-secondary" onClick={() => setShowCloseConfirm(false)}>Seguir editando</button>
              <button className="btn-danger" onClick={() => { setShowCloseConfirm(false); setShowModal(false); }}>Sí, descartar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación toggle */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'400px'}}>
            <div className="modal-header" style={{borderBottom:'none',paddingBottom:0}}>
              <div style={{display:'flex',alignItems:'center',gap:'12px',color:cursoAToggle?.activo?'#dc2626':'#2563eb'}}>
                <div style={{background:cursoAToggle?.activo?'#fee2e2':'#dbeafe',padding:'8px',borderRadius:'50%'}}>
                  {cursoAToggle?.activo
                    ? <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    : <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  }
                </div>
                <h2 style={{fontSize:'18px',fontWeight:'600',margin:0}}>¿{cursoAToggle?.activo ? 'Desactivar' : 'Activar'} curso?</h2>
              </div>
            </div>
            <div className="modal-body" style={{paddingTop:'16px'}}>
              <p style={{margin:0,color:'#64748b',lineHeight:'1.5'}}>
                ¿Estás seguro que deseas {cursoAToggle?.activo ? 'desactivar' : 'activar'} el curso{' '}
                <strong>{cursoAToggle?.nombre}</strong>?{' '}
                {cursoAToggle?.activo
                  ? 'Este curso ya no podrá ser utilizado para generar nuevos horarios.'
                  : 'El curso volverá a estar disponible en el plan de estudios.'}
              </p>
            </div>
            <div className="modal-footer" style={{borderTop:'none',paddingTop:0,marginTop:'8px'}}>
              <button className="btn-secondary" onClick={() => { setShowConfirm(false); setCursoAToggle(null); }}>Cancelar</button>
              <button className={cursoAToggle?.activo?'btn-danger':'btn-primary'} onClick={confirmarToggle} disabled={saving}>
                {saving ? 'Procesando...' : `Sí, ${cursoAToggle?.activo?'desactivar':'activar'}`}
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