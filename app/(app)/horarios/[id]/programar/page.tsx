'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };

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

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, dashRes, confRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch(`/api/horarios/resolver/conflictos?programacion_id=${progId}`).then(r => r.json()).catch(() => ({ data: [] }))
      ]);

      const dataProg = progRes.data;
      setProg(dataProg);
      setSlots(dashRes.slots || []);
      setAsignaciones(dataProg?.config?.asignaciones || []);
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
      // Validar primero
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
      
      setMsg({ type: 'success', text: `Asignación completada. Se generaron ${resData.data?.asignaciones?.length || 0} bloques.` });
      cargarDatos(); // Recargar grilla
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

  function getCell(dia: string, slotId: string, asigArr: any[]) {
    return asigArr
      .filter(a => a.dia === dia && a.slot_id === slotId)
      .sort((a, b) => {
         if (a.condicion_orden !== b.condicion_orden) return (a.condicion_orden || 0) - (b.condicion_orden || 0);
         return (a.categoria_orden || 0) - (b.categoria_orden || 0);
      });
  }

  // Generar color consistente por curso
  function getColor(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  const ciclos = Array.from(new Set(asignaciones.map(a => a.ciclo_plan || 0))).sort((a,b)=>a-b);

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
            {resolving ? '⚙️ Resolviendo...' : asignaciones.length > 0 ? '🔄 Reejecutar CSP' : '⚙️ Ejecutar Auto-Asignación'}
          </button>
          <button className="btn-primary" onClick={avanzarFase} disabled={prog.fase !== 3}>
            Avanzar a Fase 4 →
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Tabla de conflictos si existen */}
      {conflictos.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '16px', color: '#b91c1c', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❌</span> ERROR: Conflicto de horario detectado ({conflictos.length})
          </h3>
          <div style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px', whiteSpace: 'pre-line' }}>
            {conflictos.map((c: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px', background:'#fef2f2', padding:'12px', borderRadius:'6px', border:'1px solid #fca5a5' }}>
                <strong>Conflicto detectado:</strong><br/>
                {c.descripcion}
              </div>
            ))}
            <div style={{marginTop:'12px', borderTop:'1px solid #cbd5e1', paddingTop:'12px'}}>
              <strong>DEBUG:</strong><br/>
              - Algoritmo CSP ejecutado: ✓<br/>
              - Algoritmo GA ejecutado: ✓<br/>
              - Restricciones evaluadas: Automáticas<br/>
              - Sugerencia: Reasignar los grupos sin asignar a otras aulas disponibles o ampliar disponibilidad docente.
            </div>
          </div>
        </div>
      )}

      {/* Grillas visuales tentativa */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px' }}>
          Asignaciones Tentativas
        </h3>
        {asignaciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <p style={{ margin: '0 0 16px' }}>No hay asignaciones generadas aún.</p>
            <button className="btn-primary" onClick={() => ejecutarMotor(false)} disabled={resolving || prog.fase !== 3}>
              ⚙️ Ejecutar Motor CSP
            </button>
          </div>
        ) : (
          <div>
            {ciclos.map(ciclo => {
              const asigCiclo = asignaciones.filter(a => (a.ciclo_plan || 0) === ciclo);
              return (
                <div key={ciclo} style={{ marginBottom: '40px' }}>
                  <h4 style={{ fontSize: '15px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                    Grilla del Ciclo {ciclo === 0 ? 'Generales' : ciclo}
                  </h4>
                  <div className="horario-grid" style={{ minWidth: '1000px' }}>
                    <div className="horario-header">Hora</div>
                    {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
                    
                    {slots.map((slot) => {
                      const isLunch = slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00';
                      
                      return (
                        <div key={slot.id} style={{ display: 'contents' }}>
                          <div className="horario-time" style={isLunch ? {background:'#f1f5f9'} : {}}>
                            {slot.hora_inicio}<br />{slot.hora_fin}
                          </div>
                          {isLunch ? (
                            <div style={{ gridColumn: `span ${DIAS.length}`, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 'bold', letterSpacing: '2px', borderBottom: '1px solid #e2e8f0' }}>
                              🍽️ HORA LIBRE (REFRIGERIO)
                            </div>
                          ) : (
                            DIAS.map(dia => {
                              const cells = getCell(dia, slot.id, asigCiclo);
                              return (
                                <div key={`${dia}-${slot.id}`} className="horario-cell" style={{display:'flex', flexDirection:'column', gap:'4px', padding:'4px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                                  {cells.map(c => {
                                    const hexColor = getColor(c.curso_codigo);
                                    return (
                                      <div key={c.id} style={{ padding: '6px', borderRadius: '4px', background: `${hexColor}15`, borderLeft: `4px solid ${hexColor}`, cursor: 'pointer', fontSize:'11px' }} title={`${c.curso_nombre}\nG${c.numero_grupo}\n${c.docente_nombre}\n${c.ambiente_nombre}`}>
                                        <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                          {c.curso_codigo} - G{c.numero_grupo}
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: hexColor, marginTop: '2px', opacity: 0.8 }}>
                                          {c.tipo}
                                        </div>
                                        <div style={{ color: '#475569', marginTop:'2px' }}>
                                          Aula: {c.ambiente_codigo}
                                        </div>
                                        <div style={{ color: '#475569', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                          Doc: {c.docente_nombre}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
