'use client';
import { fetchProgramacionCursos } from '@/lib/fetch-programacion-cursos';
import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/app/(app)/layout';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };

/** 0 = no disponible, 1 = alta prioridad, 2 = baja prioridad */
type PrioridadSlot = 0 | 1 | 2;

const PRIORIDAD_STYLE: Record<PrioridadSlot, { bg: string; border?: string }> = {
  0: { bg: '#fef2f2', border: '1px solid #fecaca' },
  1: { bg: '#059669' },
  2: { bg: '#fde047', border: '1px solid #eab308' },
};

export default function DisponibilidadPage() {
  const user = useUser();
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [docentes, setDocentes] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [docenteId, setDocenteId] = useState<string>('');
  const [disponibilidad, setDisponibilidad] = useState<Record<string, PrioridadSlot>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const isAdminOrSec = user?.rol === 'admin' || user?.rol === 'secretaria';

  const cargarDisponibilidad = useCallback(async (dId: string | null) => {
    let url = `/api/horarios/disponibilidad?programacion_id=${progId}`;
    if (dId) url += `&docente_id=${dId}`;

    const res = await fetch(url).then(r => r.json());
    if (res.data) {
      const dict: Record<string, PrioridadSlot> = {};
      res.data.forEach((d: any) => {
        if (d.disponible && (d.prioridad === 1 || d.prioridad === 2)) {
          dict[`${d.dia}-${d.slot_id}`] = d.prioridad as PrioridadSlot;
        } else {
          dict[`${d.dia}-${d.slot_id}`] = 0;
        }
      });
      setDisponibilidad(dict);
      if (res.docente_id) setDocenteId(res.docente_id);
    }
  }, [progId]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, docRes, dashRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetchProgramacionCursos(progId),
        fetch('/api/dashboard').then(r => r.json()),
      ]);

      setProg(progRes.data);
      setDocentes(docRes.cargaDocentes || []);
      setSlots(dashRes.slots || []);

      if (user?.rol === 'docente') {
        await cargarDisponibilidad(null);
      } else if (docRes.cargaDocentes?.length > 0) {
        setDocenteId(docRes.cargaDocentes[0].id);
        await cargarDisponibilidad(docRes.cargaDocentes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [progId, user, cargarDisponibilidad]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const toggleSlot = (dia: string, slotId: string) => {
    if (prog?.estado === 'publicado' || prog?.estado === 'cancelado') return;
    const key = `${dia}-${slotId}`;
    const current = disponibilidad[key] ?? 0;
    const next: PrioridadSlot = current === 0 ? 1 : current === 1 ? 2 : 0;
    setDisponibilidad(prev => ({ ...prev, [key]: next }));
  };

  const guardarDisponibilidad = async () => {
    setSaving(true); setMsg(null);
    try {
      const disponibilidades = [];
      for (const dia of DIAS) {
        for (const slot of slots) {
          const key = `${dia}-${slot.id}`;
          const prioridad = disponibilidad[key] ?? 0;
          disponibilidades.push({
            slot_id: slot.id,
            dia,
            prioridad: prioridad === 0 ? null : prioridad,
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const importarCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !progId) return;

    setLoading(true);
    setMsg({ type: 'info', text: 'Procesando archivo CSV...' });

    try {
      const text = await file.text();
      const rows = text.split('\n').filter(r => r.trim());
      const header = rows[0].split(',').map(c => c.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase());
      const data = rows.slice(1).map(row => {
        const values = row.split(',').map(v => v.trim());
        const obj: Record<string, string> = {};
        header.forEach((h, i) => obj[h] = values[i] || '');
        return obj;
      });

      const res = await fetch(`/api/horarios/programaciones/${progId}/importar-disponibilidad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: data })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setMsg({ type: 'success', text: json.message });
      // Recargar datos para el docente actual si lo hay
      if (docenteId) await cargarDisponibilidad(docenteId);
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Error importando: ' + err.message });
    } finally {
      setLoading(false);
    }
    
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  const retrocederFase = async () => {
    if (!window.confirm('¿Deseas volver a la Fase 1? Se mantendrán los datos cargados.')) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/horarios/crear?id=${progId}`;
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  const cancelarProgramacion = async () => {
    if (!window.confirm('¿Seguro que deseas cancelar esta programación?')) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = '/horarios';
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
  };

  const contarPrioridad = (p: PrioridadSlot) =>
    Object.values(disponibilidad).filter(v => v === p).length;

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
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 2: Disponibilidad Docente (doble prioridad)</p>
        </div>
        {isAdminOrSec && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={importarCSV} />
            <button className="btn-secondary" style={{ background: '#fff', border: '1px solid #cbd5e1' }} onClick={() => fileInputRef.current?.click()} disabled={saving || loading}>
              📥 Importar CSV
            </button>
            <button className="btn-secondary" onClick={notificarDocentes}>Notificar Docentes</button>
            <button className="btn-secondary" onClick={retrocederFase}>← Volver a Fase 1</button>
            <button className="btn-primary" onClick={avanzarFase}>Avanzar a Fase 3</button>
            <button className="btn-danger" onClick={cancelarProgramacion}>Cancelar</button>
          </div>
        )}
      </div>

      {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {isAdminOrSec ? (
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Seleccionar Docente</label>
              <select className="form-input" value={docenteId} onChange={e => { setDocenteId(e.target.value); cargarDisponibilidad(e.target.value); }}>
                {docentes.map(d => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Mi Disponibilidad</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Clic: preferida, aceptable, no disponible.</p>
            </div>
          )}
          <button className="btn-primary" onClick={guardarDisponibilidad} disabled={saving || prog?.estado === 'publicado' || prog?.estado === 'cancelado'}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
          <span><span style={{ display: 'inline-block', width: 14, height: 14, background: '#059669', marginRight: 6 }} /> Preferida ({contarPrioridad(1)})</span>
          <span><span style={{ display: 'inline-block', width: 14, height: 14, background: '#fde047', marginRight: 6 }} /> Aceptable ({contarPrioridad(2)})</span>
          <span><span style={{ display: 'inline-block', width: 14, height: 14, background: '#fef2f2', border: '1px solid #fecaca', marginRight: 6 }} /> No disponible</span>
        </div>
        <div className="horario-grid" style={{ minWidth: '900px' }}>
          <div className="horario-header">Hora</div>
          {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
          {slots.map((slot) => {
            if (slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00') return null;
            return (
              <div key={slot.id} style={{ display: 'contents' }}>
                <div className="horario-time">{slot.hora_inicio}<br />{slot.hora_fin}</div>
                {DIAS.map(dia => {
                  const p = disponibilidad[`${dia}-${slot.id}`] ?? 0;
                  const st = PRIORIDAD_STYLE[p];
                  return (
                    <div key={`${dia}-${slot.id}`} onClick={() => toggleSlot(dia, slot.id)}
                      style={{ borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: st.bg, minHeight: 36, cursor: 'pointer' }} />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
