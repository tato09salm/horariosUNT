'use client';
import { useState, useEffect } from 'react';
import { useUser } from '../layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#1a3a5c', '#2563a8', '#3b82f6', '#60a5fa', '#93c5fd', '#c8102e'];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cicloId, setCicloId] = useState('');
  const [programaciones, setProgramaciones] = useState<any[]>([]);

  const user = useUser();
  const isDocente = user?.rol === 'docente';

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => {
      setData(d);
      setCicloId(d.ciclo?.id || '');
    }).finally(() => setLoading(false));
    fetch('/api/horarios/programaciones').then(r => r.json()).then(d => setProgramaciones(d.data || []));
  }, []);

  function recargar(id: string) {
    setCicloId(id);
    setLoading(true);
    fetch(`/api/dashboard?ciclo_id=${id}`).then(r => r.json()).then(setData).finally(() => setLoading(false));
  }

  if (loading) return (
    <div style={{padding:'40px',textAlign:'center'}}>
      <div style={{width:'40px',height:'40px',border:'3px solid #e2e8f0',borderTop:'3px solid #1a3a5c',borderRadius:'50%',animation:'spin 0.7s linear infinite',margin:'0 auto 12px'}} />
      <p style={{color:'#64748b'}}>Cargando dashboard...</p>
    </div>
  );

  const categoriaData = data?.horasPorCategoria?.map((h: any) => ({
    name: h.categoria.replace('_', ' '),
    horas: parseInt(h.horas),
    condicion: h.condicion,
  })) || [];

  const diasData = data?.distribucionDias?.map((d: any) => ({
    name: d.dia.substring(0, 3).toUpperCase(),
    cantidad: parseInt(d.cantidad),
  })) || [];

  const ocupacionTop = data?.ocupacionAmbientes?.slice(0, 6).map((a: any) => ({
    name: a.codigo,
    porcentaje: parseFloat(a.porcentaje),
    tipo: a.tipo,
  })) || [];

  if (isDocente) {
    const miCarga = data?.cargaDocentes?.find((d: any) => d.nombre.toLowerCase().includes(user?.nombre?.toLowerCase()) || d.nombre.toLowerCase().includes(user?.apellidos?.toLowerCase()));
    const programacionesActivas = programaciones.filter((p: any) => p.estado !== 'publicado' && p.estado !== 'cancelado');

    return (
      <div style={{padding:'32px'}}>
        <div style={{marginBottom:'28px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Bienvenido, {user?.nombre}</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Panel de control — Perfil docente</p>
        </div>

        {/* Stats Row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'16px',marginBottom:'24px'}}>
          <div className="stat-card">
            <div className="stat-icon" style={{background:'#dbeafe'}}>
              <svg width="22" height="22" fill="none" stroke="#1a3a5c" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color:'#1a3a5c',margin:'0 0 2px'}}>{miCarga ? `${miCarga.horas_asignadas}h` : '0h'}</p>
              <p style={{fontSize:'13px',color:'#64748b',margin:0}}>Horas asignadas ({data?.ciclo?.nombre || 'Ciclo actual'})</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{background:'#d1fae5'}}>
              <svg width="22" height="22" fill="none" stroke="#065f46" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color:'#065f46',margin:'0 0 2px'}}>{miCarga ? `${miCarga.horas_max_semana}h` : '—'}</p>
              <p style={{fontSize:'13px',color:'#64748b',margin:0}}>Límite de horas semanales</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{background:'#fef3c7'}}>
              <svg width="22" height="22" fill="none" stroke="#92400e" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color:'#92400e',margin:'0 0 2px'}}>{programacionesActivas.length}</p>
              <p style={{fontSize:'13px',color:'#64748b',margin:0}}>Programaciones activas</p>
            </div>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px'}}>
          <div className="card" style={{padding:'32px',textAlign:'center'}}>
            <div style={{fontSize:'48px',marginBottom:'16px'}}>🎓</div>
            <h2 style={{fontSize:'20px',fontWeight:'600',color:'#1e293b',margin:'0 0 8px'}}>Tu portal académico</h2>
            <p style={{color:'#64748b',fontSize:'14px',margin:'0 auto 24px'}}>Desde aquí podrás ver tu horario publicado final y consultar tus asignaciones de clase.</p>
            <div style={{display:'flex',justifyContent:'center',gap:'16px'}}>
              <a href="/horarios" className="btn-primary" style={{textDecoration:'none',padding:'8px 24px'}}>Ver mi horario general</a>
            </div>
          </div>

          <div className="card" style={{padding:'24px'}}>
            <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:'0 0 16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <span>⏳</span> Disponibilidad Pendiente
            </h3>
            {programacionesActivas.length > 0 ? (
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {programacionesActivas.map((p: any) => (
                  <div key={p.id} style={{padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <h4 style={{margin:'0 0 4px',fontSize:'14px',fontWeight:'600',color:'#0f172a'}}>{p.nombre}</h4>
                      <p style={{margin:0,fontSize:'12px',color:'#64748b'}}>Fase actual: {p.fase}</p>
                    </div>
                    <a href={`/horarios/${p.id}/disponibilidad`} style={{textDecoration:'none'}}>
                      <button className="btn-primary" style={{padding:'6px 12px',fontSize:'12px'}}>Marcar disponibilidad</button>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{padding:'24px',textAlign:'center',background:'#f8fafc',borderRadius:'8px',border:'1px dashed #cbd5e1'}}>
                <p style={{margin:0,fontSize:'13px',color:'#64748b'}}>No hay programaciones activas en este momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:'32px'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px'}}>
        <div>
          <h1 style={{fontSize:'24px',fontWeight:'700',color:'#1e293b',margin:'0 0 4px'}}>Dashboard</h1>
          <p style={{color:'#64748b',fontSize:'14px',margin:0}}>Panel de control — Gestión de horarios académicos</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <select className="form-input" style={{width:'auto',minWidth:'180px'}} value={cicloId} onChange={e => recargar(e.target.value)}>
            {data?.ciclos?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nombre} {c.activo ? '(Activo)' : ''}</option>
            ))}
          </select>
          <div style={{background:'#dcfce7',color:'#166534',padding:'4px 12px',borderRadius:'9999px',fontSize:'12px',fontWeight:'600'}}>
            {data?.ciclo?.nombre || 'Sin ciclo'}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'24px'}}>
        {[
          { label: 'Docentes activos', value: data?.stats?.totalDocentes, color: '#1a3a5c', bg: '#dbeafe', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
          { label: 'Cursos activos', value: data?.stats?.totalCursos, color: '#065f46', bg: '#d1fae5', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
          { label: 'Ambientes', value: data?.stats?.totalAmbientes, color: '#92400e', bg: '#fef3c7', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
          { label: 'Asignaciones', value: data?.stats?.totalAsignaciones, color: '#6b21a8', bg: '#f3e8ff', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        ].map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{background:stat.bg}}>
              <svg width="22" height="22" fill="none" stroke={stat.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
              </svg>
            </div>
            <div>
              <p style={{fontSize:'28px',fontWeight:'700',color:stat.color,margin:'0 0 2px'}}>{stat.value ?? '—'}</p>
              <p style={{fontSize:'13px',color:'#64748b',margin:0}}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Widget de Fases Activas */}
      {programaciones.filter((p: any) => p.estado !== 'cancelado').length > 0 && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📋</span> Programaciones Activas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {programaciones.filter((p: any) => p.estado !== 'cancelado').map((p: any) => {
              const faseBadge: Record<number, { label: string; color: string; bg: string; url: string }> = {
                1: { label: 'Fase 1 · Carga', color: '#1d4ed8', bg: '#dbeafe', url: `/horarios/crear` },
                2: { label: 'Fase 2 · Disponibilidad', color: '#7c3aed', bg: '#ede9fe', url: `/horarios/${p.id}/disponibilidad` },
                3: { label: 'Fase 3 · Programación CSP', color: '#b45309', bg: '#fef3c7', url: `/horarios/${p.id}/programar` },
                4: { label: 'Fase 4 · Publicación', color: '#065f46', bg: '#d1fae5', url: `/horarios/${p.id}/publicar` },
              };
              const badge = faseBadge[p.fase];
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ background: badge?.bg, color: badge?.color, padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600' }}>
                      {p.estado === 'publicado' ? '✅ Publicado' : badge?.label}
                    </span>
                    <span style={{ fontWeight: '500', color: '#1e293b', fontSize: '14px' }}>{p.nombre}</span>
                  </div>
                  {p.estado !== 'publicado' && badge && (
                    <a href={badge.url} style={{ textDecoration: 'none' }}>
                      <button className="btn-primary" style={{ padding: '4px 14px', fontSize: '12px' }}>Continuar →</button>
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
        {/* Distribución por día */}
        <div className="card">
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:'0 0 20px'}}>Asignaciones por día</h3>
          {diasData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={diasData} margin={{top:0,right:0,bottom:0,left:-20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize:12,fill:'#64748b'}} />
                <YAxis tick={{fontSize:12,fill:'#64748b'}} />
                <Tooltip contentStyle={{borderRadius:'8px',border:'1px solid #e2e8f0',fontSize:'13px'}} />
                <Bar dataKey="cantidad" fill="#1a3a5c" radius={[4,4,0,0]} name="Asignaciones" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{color:'#94a3b8',fontSize:'14px',textAlign:'center',padding:'40px 0'}}>Sin datos para el ciclo seleccionado</p>}
        </div>

        {/* Horas por categoría */}
        <div className="card">
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:'0 0 20px'}}>Horas por categoría docente</h3>
          {categoriaData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoriaData} cx="50%" cy="50%" outerRadius={75} dataKey="horas" nameKey="name" label={({name, value}) => `${name}: ${value}`} labelLine={false} fontSize={10}>
                  {categoriaData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{color:'#94a3b8',fontSize:'14px',textAlign:'center',padding:'40px 0'}}>Sin datos</p>}
        </div>
      </div>

      {/* Ocupación de ambientes + Carga docentes */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
        {/* Ocupación ambientes */}
        <div className="card">
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:'0 0 16px'}}>Ocupación de ambientes</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {ocupacionTop.length > 0 ? ocupacionTop.map((a: any, i: number) => (
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'13px',color:'#374151',fontWeight:'500'}}>{a.name}</span>
                  <span style={{fontSize:'12px',color:'#64748b'}}>{a.porcentaje}%</span>
                </div>
                <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'6px',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:'9999px',background:a.porcentaje > 70 ? '#dc2626' : a.porcentaje > 40 ? '#f59e0b' : '#10b981',width:`${Math.min(a.porcentaje,100)}%`,transition:'width 0.3s'}} />
                </div>
              </div>
            )) : <p style={{color:'#94a3b8',fontSize:'14px',textAlign:'center',padding:'20px 0'}}>Sin datos</p>}
          </div>
        </div>

        {/* Carga docentes */}
        <div className="card">
          <h3 style={{fontSize:'16px',fontWeight:'600',color:'#1e293b',margin:'0 0 16px'}}>Carga horaria docentes</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'8px',maxHeight:'220px',overflowY:'auto'}}>
            {data?.cargaDocentes?.length > 0 ? data.cargaDocentes.slice(0, 8).map((d: any, i: number) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontSize:'11px',fontWeight:'600',color:'#475569'}}>{d.nombre.split(' ')[0][0]}{d.nombre.split(' ').slice(-1)[0][0]}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'2px'}}>
                    <span style={{fontSize:'12px',color:'#374151',fontWeight:'500',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{d.nombre}</span>
                    <span style={{fontSize:'11px',color:'#64748b',flexShrink:0,marginLeft:'8px'}}>{d.horas_asignadas}/{d.horas_max_semana}h</span>
                  </div>
                  <div style={{background:'#f1f5f9',borderRadius:'9999px',height:'4px'}}>
                    <div style={{height:'100%',borderRadius:'9999px',background:parseFloat(d.porcentaje_carga)>90?'#dc2626':parseFloat(d.porcentaje_carga)>60?'#f59e0b':'#10b981',width:`${Math.min(parseFloat(d.porcentaje_carga),100)}%`}} />
                  </div>
                </div>
              </div>
            )) : <p style={{color:'#94a3b8',fontSize:'14px',textAlign:'center',padding:'20px 0'}}>Sin datos</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
