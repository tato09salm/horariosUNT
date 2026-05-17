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

  const ejecutarMotor = async () => {
    setResolving(true); setMsg(null);
    try {
      const res = await fetch('/api/horarios/resolver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programacion_id: progId }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error);
      
      setMsg({ type: 'success', text: 'El motor CSP ha completado la asignación.' });
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

  function getCell(dia: string, slotId: string) {
    return asignaciones.filter(a => a.dia === dia && a.slot_id === slotId);
  }

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
          <button className="btn-secondary" onClick={ejecutarMotor} disabled={resolving || prog.fase !== 3}>
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
            <span>⚠</span> Conflictos no resueltos por el Motor ({conflictos.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px' }}>
            {conflictos.map((c: any, i: number) => (
              <li key={i} style={{ marginBottom: '6px' }}>{c.descripcion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Grilla visual tentativa */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px' }}>
          Asignaciones Tentativas
        </h3>
        {asignaciones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <p style={{ margin: '0 0 16px' }}>No hay asignaciones generadas aún.</p>
            <button className="btn-primary" onClick={ejecutarMotor} disabled={resolving || prog.fase !== 3}>
              ⚙️ Ejecutar Motor CSP
            </button>
          </div>
        ) : (
          <div className="horario-grid" style={{ minWidth: '1000px' }}>
            <div className="horario-header">Hora</div>
            {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
            
            {slots.map((slot) => (
              <div key={slot.id} style={{ display: 'contents' }}>
                <div className="horario-time">{slot.hora_inicio}<br />{slot.hora_fin}</div>
                {DIAS.map(dia => {
                  const cells = getCell(dia, slot.id);
                  return (
                    <div key={`${dia}-${slot.id}`} className="horario-cell">
                      {cells.map(c => (
                        <div key={c.id} className={`block-${c.tipo}`} style={{ marginBottom: '4px', cursor: 'pointer', borderLeftWidth: '4px' }} title={`${c.curso_nombre}\nG${c.numero_grupo}\n${c.docente_nombre}\n${c.ambiente_nombre}`}>
                          <div style={{ fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.curso_codigo} - G{c.numero_grupo}
                          </div>
                          <div style={{ fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>
                            {c.ambiente_codigo}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
