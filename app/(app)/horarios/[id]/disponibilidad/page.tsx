'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/app/(app)/layout';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };

export default function DisponibilidadPage() {
  const user = useUser();
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [docenteId, setDocenteId] = useState<string>('');
  const [disponibilidad, setDisponibilidad] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const isAdminOrSec = user?.rol === 'admin' || user?.rol === 'secretaria';

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, docRes, dashRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetch(`/api/horarios/programaciones/${progId}/cursos`).then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
      ]);

      setProg(progRes.data);
      setDocentes(docRes.cargaDocentes || []);
      setSlots(dashRes.slots || []);

      if (user?.rol === 'docente') {
        cargarDisponibilidad(null);
      } else if (docRes.cargaDocentes?.length > 0) {
        setDocenteId(docRes.cargaDocentes[0].id);
        cargarDisponibilidad(docRes.cargaDocentes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [progId, user]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const cargarDisponibilidad = async (dId: string | null) => {
    let url = `/api/horarios/disponibilidad?programacion_id=${progId}`;
    if (dId) url += `&docente_id=${dId}`;
    
    const res = await fetch(url).then(r => r.json());
    if (res.data) {
      const dict: Record<string, boolean> = {};
      res.data.forEach((d: any) => {
        dict[`${d.dia}-${d.slot_id}`] = d.disponible;
      });
      setDisponibilidad(dict);
      if (res.docente_id) setDocenteId(res.docente_id);
    }
  };

  const toggleSlot = (dia: string, slotId: string) => {
    if (prog?.estado === 'publicado' || prog?.fase !== 2) return;
    const key = `${dia}-${slotId}`;
    setDisponibilidad(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const guardarDisponibilidad = async () => {
    setSaving(true); setMsg(null);
    try {
      const disponibilidades = [];
      for (const dia of DIAS) {
        for (const slot of slots) {
          const key = `${dia}-${slot.id}`;
          disponibilidades.push({
            slot_id: slot.id,
            dia,
            disponible: disponibilidad[key] || false,
          });
        }
      }

      const res = await fetch('/api/horarios/disponibilidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programacion_id: progId, docente_id: docenteId, disponibilidades }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'Disponibilidad guardada correctamente' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const notificarDocentes = async () => {
    setMsg(null);
    try {
      const res = await fetch('/api/horarios/disponibilidad/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programacion_id: progId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: data.message });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  const avanzarFase = async () => {
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 3 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/horarios/${progId}/programar`;
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 2: Disponibilidad Docente</p>
        </div>
        {isAdminOrSec && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={notificarDocentes}>📧 Notificar Docentes</button>
            <button className="btn-primary" onClick={avanzarFase}>Avanzar a Fase 3 →</button>
          </div>
        )}
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {isAdminOrSec ? (
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Seleccionar Docente (Admin/Secretaria puede modificar por ellos)</label>
              <select className="form-input" value={docenteId} onChange={e => { setDocenteId(e.target.value); cargarDisponibilidad(e.target.value); }}>
                {docentes.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Mi Disponibilidad</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Marca los bloques en los que puedes dictar clases.</p>
            </div>
          )}

          <button className="btn-primary" onClick={guardarDisponibilidad} disabled={saving || prog.fase !== 2}>
            {saving ? 'Guardando...' : '💾 Guardar Disponibilidad'}
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="horario-grid" style={{ minWidth: '900px' }}>
          <div className="horario-header">Hora</div>
          {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
          
          {slots.map((slot) => (
            <div key={slot.id} style={{ display: 'contents' }}>
              <div className="horario-time">{slot.hora_inicio}<br />{slot.hora_fin}</div>
              {DIAS.map(dia => {
                const isSelected = disponibilidad[`${dia}-${slot.id}`];
                return (
                  <div
                    key={`${dia}-${slot.id}`}
                    onClick={() => toggleSlot(dia, slot.id)}
                    style={{
                      borderRight: '1px solid #e2e8f0',
                      borderBottom: '1px solid #e2e8f0',
                      background: isSelected ? '#10b981' : '#f8fafc',
                      cursor: prog.fase === 2 ? 'pointer' : 'not-allowed',
                      transition: 'background 0.2s'
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
