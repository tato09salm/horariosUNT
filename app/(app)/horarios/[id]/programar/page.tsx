'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import GrillaHorarios from '@/components/horarios/GrillaHorarios';
import { fetchProgramacionCursos } from '@/lib/fetch-programacion-cursos';

export default function ProgramarPage() {
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [conflictos, setConflictos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const [cspStats, setCspStats] = useState<any>(null);
  const [docentesConCarga, setDocentesConCarga] = useState<Set<string>>(new Set());

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, dashRes, confRes, cursosRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch(`/api/horarios/resolver/conflictos?programacion_id=${progId}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetchProgramacionCursos(progId),
      ]);

      const dataProg = progRes.data;
      const ids = new Set<string>(
        (cursosRes.cargaDocentes || []).map((d: { id: string }) => d.id)
      );
      setDocentesConCarga(ids);
      setProg(dataProg);
      setSlots(dashRes.slots || []);
      setAsignaciones(dataProg?.config?.asignaciones || []);
      setCspStats(dataProg?.config?.csp_stats || null);
      setConflictos(confRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [progId]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const ejecutarMotor = async (force: boolean = false) => {
    if (!force) {
      setResolving(true); setMsg(null);
      try {
        const res = await fetch('/api/horarios/resolver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programacion_id: progId, dry_run: true }),
        });
        const resData = await res.json();
        setResolving(false);
        if (!res.ok) throw new Error(resData.error);
        if (resData.advertencias?.length > 0) {
          setAdvertencias(resData.advertencias);
          setShowWarningModal(true);
          return;
        }
      } catch (e: any) {
        setResolving(false);
        setMsg({ type: 'error', text: e.message });
        return;
      }
    }

    setResolving(true); setMsg(null);
    setShowWarningModal(false);
    try {
      const res = await fetch('/api/horarios/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programacion_id: progId }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);

      const st = resData.data?.csp_stats;
      const labsPar = st?.franjas_labs_paralelos != null ? ` · Labs en paralelo: ${st.franjas_labs_paralelos} franjas` : '';
      const reintento = st?.log?.some((l: string) => l.includes('Reintento flexible')) ? ' (incluye reintento flexible)' : '';
      setMsg({
        type: 'success',
        text: `Asignación completada${reintento}. ${resData.data?.asignaciones?.length || 0} bloques.${labsPar}`,
      });
      if (resData.data?.csp_stats) setCspStats(resData.data.csp_stats);
      cargarDatos();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setResolving(false);
    }
  };

  const avanzarFase = async () => {
    if (conflictos.length > 0 && !window.confirm('Hay conflictos sin resolver. ¿Estás seguro que quieres avanzar?')) {
      return;
    }
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 4 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/horarios/${progId}/publicar`;
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  const asignacionesVisibles = useMemo(() => {
    if (docentesConCarga.size === 0) return asignaciones;
    return asignaciones.filter(
      a => a.tipo === 'asesoria' || !a.docente_id || docentesConCarga.has(a.docente_id)
    );
  }, [asignaciones, docentesConCarga]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 3: Programación (Motor CSP)</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => ejecutarMotor(false)} disabled={resolving || prog.fase !== 3}>
            {resolving ? '⚙️ Resolviendo...' : asignacionesVisibles.length > 0 ? '🔄 Reejecutar CSP' : '⚙️ Ejecutar Auto-Asignación'}
          </button>
          <button className="btn-primary" onClick={avanzarFase} disabled={prog.fase !== 3}>
            Avanzar a Fase 4 →
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {cspStats && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #6366f1' }}>
          <h3 style={{ fontSize: '15px', margin: '0 0 12px' }}>Estadísticas CSP</h3>
          <div style={{ fontSize: '13px', color: '#475569', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>Asignados: <b>{cspStats.asignados}/{cspStats.total_bloques}</b></span>
            <span>P1 (preferida): <b style={{ color: '#059669' }}>{cspStats.prioridad_alta}</b></span>
            <span>P2 (aceptable): <b style={{ color: '#ca8a04' }}>{cspStats.prioridad_baja}</b></span>
            <span>Asesorías: <b>{cspStats.asesorias_asignadas}</b></span>
            {cspStats.bloques_continuos != null && (
              <span>Bloques continuos: <b>{cspStats.bloques_continuos}</b></span>
            )}
            {cspStats.franjas_labs_paralelos != null && (
              <span>Labs en paralelo (franjas): <b>{cspStats.franjas_labs_paralelos}</b></span>
            )}
            {cspStats.lab_coexistencias != null && (
              <span>Mismo lab, 2 cursos: <b>{cspStats.lab_coexistencias}</b></span>
            )}
          </div>
        </div>
      )}

      <GrillaHorarios 
        asignaciones={asignaciones} 
        slots={slots} 
        docentesConCarga={docentesConCarga} 
      />

      {showWarningModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div className="card" style={{width:'600px',maxWidth:'90vw',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
            <h2 style={{fontSize:'18px',color:'#b91c1c',margin:'0 0 16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <span>⚠️</span> Alerta de Disponibilidad Insuficiente
            </h2>
            <div style={{flex:1,overflowY:'auto',marginBottom:'24px',fontSize:'14px',color:'#334155'}}>
              <p style={{marginBottom:'16px'}}>Algunos docentes no tienen suficientes horas de disponibilidad marcadas para cubrir los cursos que se les ha asignado. Esto causará que el motor deje bloques sin asignar.</p>
              <ul style={{background:'#f8fafc',padding:'16px 16px 16px 32px',borderRadius:'6px',border:'1px solid #e2e8f0',margin:0}}>
                {advertencias.map((adv, i) => <li key={i} style={{marginBottom:'8px'}}>{adv}</li>)}
              </ul>
            </div>
            <div style={{display:'flex',gap:'12px',justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={() => setShowWarningModal(false)}>Cancelar</button>
              <button className="btn-secondary" style={{color:'#0f172a',borderColor:'#cbd5e1'}} onClick={() => { window.location.href = `/horarios/${progId}/disponibilidad`; }}>
                Ajustar Disponibilidad
              </button>
              <button className="btn-primary" style={{background:'#b91c1c',borderColor:'#b91c1c'}} onClick={() => ejecutarMotor(true)}>
                Continuar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
