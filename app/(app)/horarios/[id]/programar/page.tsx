'use client';
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import GrillaHorarios from '@/components/horarios/GrillaHorarios';
import BloqueHorario from '@/components/horarios/BloqueHorario';
import { fetchProgramacionCursos } from '@/lib/fetch-programacion-cursos';
import { useHorarioHistory } from '@/lib/hooks/useHorarioHistory';

function translateTipo(tipo: string): string {
  const map: Record<string, string> = {
    'UNASSIGNED': 'Bloque de curso sin asignar',
    'CRUCE_DOCENTE': 'Cruce de Docente',
    'CRUCE_AMBIENTE': 'Cruce de Aula / Laboratorio',
    'CRUCE_GRUPO': 'Cruce de Horario de Estudiantes',
    'SOBRECARGA': 'Exceso de Carga Horaria del Docente'
  };
  return map[tipo] || tipo;
}

function translateSeveridad(sev: string): string {
  return sev === 'error' ? 'Incompatibilidad Crítica' : 'Advertencia / Observación';
}

function formatearDescripcion(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/grupo_estudiante/gi, 'clases teoría/práctica regular')
    .replace(/\bteoria\b/gi, 'Teoría')
    .replace(/\bpractica\b/gi, 'Práctica')
    .replace(/\blaboratorio\b/gi, 'Laboratorio')

    .replace(/Docente ocupado/gi, 'El docente está ocupado en')
    .replace(/no hay bloque de (\d+)h de/gi, 'no se encontró un horario libre continuo de $1 horas para la sesión de')
    .replace(/no hay bloque de (\d+)h/gi, 'no se encontró un horario libre continuo de $1 horas')
    .trim();
}

function formatearSugerencia(sug: string): string {
  if (!sug) return '';
  return sug
    .replace(/Reejecutar CSP/gi, 'Volver a ejecutar la asignación inteligente')
    .replace(/flexibilidad/gi, 'opciones flexibles')
    .replace(/P2 \+ práctica en aula/gi, 'prioridad flexibilizada y permitiendo clases de práctica en aulas comunes')
    .replace(/motor CSP/gi, 'motor de asignación automática')
    .trim();
}

// Matches a conflict's docente_nombre (e.g. "Arellano Salazar, Cesar") to a
// diagnostic docente entry (e.g. "Cesar Arellano Salazar") by shared word tokens.
function matchDocenteEnDiag(confNombre: string, docentes: any[]): any | null {
  if (!confNombre || !docentes?.length) return null;
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  const tokens = normalize(confNombre);
  let best: any = null;
  let bestScore = 0;
  for (const doc of docentes) {
    const docTokens = normalize(doc.docente_nombre);
    const shared = tokens.filter(t => docTokens.includes(t) && t.length > 2).length;
    if (shared > bestScore) { bestScore = shared; best = doc; }
  }
  return bestScore >= 2 ? best : null;
}

export default function ProgramarPage() {
  const pathname = usePathname();
  const progId = pathname.split('/')[2];

  const [prog, setProg] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const history = useHorarioHistory([]);
  const asignaciones = history.asignaciones;
  const [conflictos, setConflictos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const [cspStats, setCspStats] = useState<any>(null);
  const [docentesConCarga, setDocentesConCarga] = useState<Set<string>>(new Set());
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [diagAbierto, setDiagAbierto] = useState(false);
  const [expandedDocente, setExpandedDocente] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, dashRes, confRes, cursosRes, diagRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetch('/api/dashboard').then(r => r.json()),
        fetch(`/api/horarios/resolver/conflictos?programacion_id=${progId}`).then(r => r.json()).catch(() => ({ data: [] })),
        fetchProgramacionCursos(progId),
        fetch(`/api/horarios/resolver/diagnostico?programacion_id=${progId}`).then(r => r.json()).catch(() => ({ data: null })),
      ]);

      const dataProg = progRes.data;
      const ids = new Set<string>(
        (cursosRes.cargaDocentes || []).map((d: { id: string }) => d.id)
      );
      setDocentesConCarga(ids);
      setProg(dataProg);
      setSlots(dashRes.slots || []);
      history.setAsignacionesIniciales(dataProg?.config?.asignaciones || []);
      setCspStats(dataProg?.config?.csp_stats || null);
      setConflictos(confRes.data || []);
      setDiagnostico(diagRes.data || null);
    } finally {
      setLoading(false);
    }
  }, [progId]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [conflictosAbiertos, setConflictosAbiertos] = useState(true);

  // --- Lógica Drag & Drop ---
  const [sugerenciasRecolocacion, setSugerenciasRecolocacion] = useState<any[]>([]);
  const [movimientoPendiente, setMovimientoPendiente] = useState<any>(null);
  const [ultimoMovimiento, setUltimoMovimiento] = useState<{ origen: any, destino: any } | null>(null);
  // Set persistente de IDs de bloques movidos manualmente en esta sesión
  const [bloquesMovidos, setBloquesMovidos] = useState<Set<string>>(new Set());

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeBlockAsignaciones, setActiveBlockAsignaciones] = useState<any[]>([]);

  const handleDragStart = (event: DragStartEvent) => {
    const asignacion = event.active.data.current as any;
    if (!asignacion) return;
    setActiveDragId(asignacion.id);

    const bloque = history.asignaciones.filter((a: any) => 
      a.ambiente_id === asignacion.ambiente_id &&
      a.docente_id === asignacion.docente_id &&
      a.curso_id === asignacion.curso_id &&
      a.tipo === asignacion.tipo &&
      a.grupo_id === asignacion.grupo_id &&
      a.dia === asignacion.dia
    );

    bloque.sort((a: any, b: any) => {
      const idxA = slots.findIndex((s: any) => s.id === a.slot_id);
      const idxB = slots.findIndex((s: any) => s.id === b.slot_id);
      return idxA - idxB;
    });

    setActiveBlockAsignaciones(bloque);
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setActiveBlockAsignaciones([]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); history.undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); history.redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  const aplicarMovimiento = async (
    asignacion: any, 
    newDia: string, 
    newSlotId: string, 
    targetAmbiente: string, 
    targetAmbienteCodigo: string = '', 
    targetAmbienteNombre: string = '', 
    advertenciasAceptadas = false,
    bloqueAsignaciones?: any[]
  ) => {
    const block = bloqueAsignaciones || [asignacion];
    const slotIndexOrigin = slots.findIndex(s => s.id === asignacion.slot_id);
    const slotIndexTarget = slots.findIndex(s => s.id === newSlotId);
    const deltaSlot = slotIndexTarget - slotIndexOrigin;

    const moveMap = new Map();
    for (const a of block) {
      const aSlotIndex = slots.findIndex((s: any) => s.id === a.slot_id);
      const newASlotIndex = aSlotIndex + deltaSlot;
      const newASlot = slots[newASlotIndex] || slots[slots.length - 1];
      
      moveMap.set(a.id, {
        newDia,
        newSlotId: newASlot.id,
        targetAmbiente,
        targetAmbienteCodigo,
        targetAmbienteNombre
      });
    }

    setResolving(true);
    const nuevasAsignaciones = history.asignaciones.map((a: any) => {
      const mov = moveMap.get(a.id);
      if (mov) {
        return { 
          ...a, 
          dia: mov.newDia, 
          slot_id: mov.newSlotId, 
          ambiente_id: mov.targetAmbiente,
          ...(mov.targetAmbienteCodigo ? { ambiente_codigo: mov.targetAmbienteCodigo } : {}),
          ...(mov.targetAmbienteNombre ? { ambiente_nombre: mov.targetAmbienteNombre } : {})
        };
      }
      return a;
    });

    history.commitMove(nuevasAsignaciones);
    // Registrar el bloque como movido manualmente (persiste en la sesión)
    const ids = Array.from(moveMap.keys());
    setBloquesMovidos(prev => new Set([...prev, ...ids]));
    setUltimoMovimiento({
      origen: { dia: asignacion.dia, slot_id: asignacion.slot_id, ambiente_id: asignacion.ambiente_id },
      destino: { dia: newDia, slot_id: newSlotId, ambiente_id: targetAmbiente }
    });

    try {
      await fetch(`/api/horarios/programaciones/${progId}/movimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          asignaciones: nuevasAsignaciones, 
          movimiento: { 
            bloqueId: asignacion.id, 
            origen: { dia: asignacion.dia, slot_id: asignacion.slot_id }, 
            destino: { dia: newDia, slot_id: newSlotId, ambiente_id: targetAmbiente },
            advertenciasAceptadas
          } 
        })
      });
      setMsg({ type: 'success', text: 'Movimiento manual registrado correctamente.' });
    } catch (e) {
      history.undo();
      setMsg({ type: 'error', text: 'Error al registrar movimiento.' });
    }
    setMovimientoPendiente(null);
    setSugerenciasRecolocacion([]);
    setResolving(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    setActiveBlockAsignaciones([]);
    const { active, over } = event;
    if (!over) return;

    const asignacion = active.data.current;
    if (!asignacion) return;

    const { dia: newDia, slot_id: newSlotId, ambiente_id: overAmbienteId, ambiente_codigo: overAmbienteCodigo, ambiente_nombre: overAmbienteNombre } = over.data.current as any;
    const targetAmbiente = overAmbienteId || asignacion.ambiente_id;
    const targetAmbienteCodigo = overAmbienteCodigo || asignacion.ambiente_codigo;
    const targetAmbienteNombre = overAmbienteNombre || asignacion.ambiente_nombre;

    if (asignacion.dia === newDia && asignacion.slot_id === newSlotId && asignacion.ambiente_id === targetAmbiente) {
      return;
    }

    setResolving(true);
    try {
      const bloqueAsignaciones = history.asignaciones.filter((a: any) => 
        a.ambiente_id === asignacion.ambiente_id &&
        a.docente_id === asignacion.docente_id &&
        a.curso_id === asignacion.curso_id &&
        a.tipo === asignacion.tipo &&
        a.grupo_id === asignacion.grupo_id &&
        a.dia === asignacion.dia
      );

      bloqueAsignaciones.sort((a: any, b: any) => {
        const idxA = slots.findIndex((s: any) => s.id === a.slot_id);
        const idxB = slots.findIndex((s: any) => s.id === b.slot_id);
        return idxA - idxB;
      });

      const slotIndexOrigin = slots.findIndex((s: any) => s.id === asignacion.slot_id);
      const slotIndexTarget = slots.findIndex((s: any) => s.id === newSlotId);
      const deltaSlot = slotIndexTarget - slotIndexOrigin;

      let isConflict = false;
      for (const a of bloqueAsignaciones) {
        const aSlotIndex = slots.findIndex((s: any) => s.id === a.slot_id);
        const newASlotIndex = aSlotIndex + deltaSlot;
        const newASlot = slots[newASlotIndex];

        if (!newASlot) {
          setMsg({ type: 'error', text: 'El movimiento del bloque excede los horarios permitidos.' });
          setResolving(false);
          return;
        }

        const confGrupo = history.asignaciones.find((other: any) => !bloqueAsignaciones.some((ba: any) => ba.id === other.id) && other.dia === newDia && other.slot_id === newASlot.id && other.grupo_id === a.grupo_id);
        const confDocente = a.docente_id && history.asignaciones.find((other: any) => !bloqueAsignaciones.some((ba: any) => ba.id === other.id) && other.dia === newDia && other.slot_id === newASlot.id && other.docente_id === a.docente_id);
        const confAmbiente = targetAmbiente && history.asignaciones.find((other: any) => !bloqueAsignaciones.some((ba: any) => ba.id === other.id) && other.dia === newDia && other.slot_id === newASlot.id && other.ambiente_id === targetAmbiente);

        if (confGrupo || confDocente || confAmbiente) isConflict = true;
      }

      if (isConflict) {
        const firstAsignacion = bloqueAsignaciones[0];
        const res = await fetch('/api/horarios/recolocar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programacion_id: progId, bloque: { ...firstAsignacion, duracion_horas: bloqueAsignaciones.length }, asignaciones: history.asignaciones }),
        });
        const data = await res.json();
        setSugerenciasRecolocacion(data.sugerencias || []);

        const firstTargetIndex = slots.findIndex((s: any) => s.id === firstAsignacion.slot_id) + deltaSlot;
        const firstTargetSlotId = slots[firstTargetIndex]?.id;

        setMovimientoPendiente({ 
          asignacion: firstAsignacion, 
          bloqueAsignaciones,
          newDia, 
          newSlotId: firstTargetSlotId, 
          targetAmbiente, 
          targetAmbienteCodigo, 
          targetAmbienteNombre, 
          original: { dia: firstAsignacion.dia, slot_id: firstAsignacion.slot_id, ambiente_id: firstAsignacion.ambiente_id } 
        });
        setResolving(false);
        return;
      }

      aplicarMovimiento(bloqueAsignaciones[0], newDia, slots[slots.findIndex((s: any) => s.id === bloqueAsignaciones[0].slot_id) + deltaSlot]?.id, targetAmbiente, targetAmbienteCodigo, targetAmbienteNombre, false, bloqueAsignaciones);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      setResolving(false);
    }
  };
  // -------------------------

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
    if (!cspStats) {
      setMsg({ type: 'error', text: 'Debes ejecutar el motor de programación (CSP) antes de avanzar a la Fase 4.' });
      return;
    }
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

  const retrocederFase = async () => {
    if (!window.confirm('¿Deseas volver a la Fase 2? Se mantendrán los datos generados.')) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 2 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/horarios/${progId}/disponibilidad`;
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

  const asignacionesVisibles = useMemo(() => {
    if (docentesConCarga.size === 0) return asignaciones;
    return asignaciones.filter(
      a => !a.docente_id || docentesConCarga.has(a.docente_id)
    );
  }, [asignaciones, docentesConCarga]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  return (
    <div className="horarios-programar-page" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Fase 3: Programación (Motor CSP)</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: '4px', marginRight: '16px', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button className="btn-secondary" onClick={history.undo} disabled={!history.canUndo} style={{ padding: '6px 12px', fontSize: '12px' }} title="Deshacer (Ctrl+Z)">↩️</button>
            <button className="btn-secondary" onClick={history.redo} disabled={!history.canRedo} style={{ padding: '6px 12px', fontSize: '12px' }} title="Rehacer (Ctrl+Y)">↪️</button>
          </div>
          <button className="btn-secondary" onClick={() => ejecutarMotor(false)} disabled={resolving || prog.fase !== 3}>
            {resolving ? '⚙️ Resolviendo...' : asignacionesVisibles.length > 0 ? '🔄 Reejecutar CSP' : '⚙️ Ejecutar Auto-Asignación'}
          </button>
          <button className="btn-secondary" onClick={retrocederFase} disabled={prog.fase !== 3}>
            ← Volver a Fase 2
          </button>
          <button className="btn-primary" onClick={avanzarFase} disabled={prog.fase !== 3}>
            Avanzar a Fase 4 →
          </button>
          <button className="btn-danger" onClick={cancelarProgramacion} disabled={prog.fase !== 3}>
            Cancelar
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{msg.text}</span>
          <button
            onClick={() => setMsg(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0 8px',
              marginLeft: '16px',
              opacity: 0.7,
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            ×
          </button>
        </div>
      )}

      {cspStats && (
        <div className="card csp-stats-card" style={{ marginBottom: '20px', borderLeft: '4px solid #6366f1', background: 'var(--bg-card)' }}>
          <h3 style={{ fontSize: '15px', margin: '0 0 12px', color: 'var(--text-primary)' }}>Estadísticas CSP</h3>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>Asignados: <b>{cspStats.asignados}/{cspStats.total_bloques}</b></span>
            <span>P1 (preferida): <b style={{ color: '#059669' }}>{cspStats.prioridad_alta}</b></span>
            <span>P2 (aceptable): <b style={{ color: '#ca8a04' }}>{cspStats.prioridad_baja}</b></span>

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

      {/* ── Panel de Diagnóstico de Disponibilidad Docente ── */}
      {diagnostico && (
        <div className="diagnostico-panel" style={{ marginBottom: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

          {/* Header */}
          <div
            className="diagnostico-header"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: diagAbierto ? 'var(--bg-card-hover)' : 'var(--bg-card)', borderBottom: diagAbierto ? '1px solid var(--border-color)' : 'none' }}
            onClick={() => setDiagAbierto(!diagAbierto)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>📊</span>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Diagnóstico de Disponibilidad Docente
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  Análisis de horas requeridas vs. disponibles por docente
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Summary badges */}
              <span style={{ background: 'rgba(113, 212, 150, 0.16)', color: '#2a9951', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>
                ✓ {diagnostico.resumen.ok} OK
              </span>
              {diagnostico.resumen.alertas > 0 && (
                <span style={{ background: 'rgba(239,68,68,0.16)', color: '#fecaca', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>
                  ⚠ {diagnostico.resumen.alertas} con alertas
                </span>
              )}
              {diagnostico.resumen.total_horas_faltantes > 0 && (
                <span style={{ background: 'rgba(245,158,11,0.16)', color: '#fde68a', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px' }}>
                  +{diagnostico.resumen.total_horas_faltantes}h a agregar
                </span>
              )}
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                {diagAbierto ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {diagAbierto && (
            <div style={{ padding: '0' }}>

              {/* Summary KPI row */}
              <div className="diagnostico-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', borderBottom: '1px solid #f1f5f9' }}>
                {[
                  { label: 'Docentes en programación', value: diagnostico.resumen.total_docentes, color: '#93c5fd', bg: 'rgba(59,130,246,0.10)' },
                  { label: 'Con disponibilidad OK', value: diagnostico.resumen.ok, color: '#6ee7b7', bg: 'rgba(16,185,129,0.10)' },
                  { label: 'Con alertas de disponibilidad', value: diagnostico.resumen.alertas, color: diagnostico.resumen.alertas > 0 ? '#fca5a5' : '#6ee7b7', bg: diagnostico.resumen.alertas > 0 ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.10)' },
                  { label: 'Horas totales a agregar', value: `${diagnostico.resumen.total_horas_faltantes}h`, color: diagnostico.resumen.total_horas_faltantes > 0 ? '#fcd34d' : '#6ee7b7', bg: diagnostico.resumen.total_horas_faltantes > 0 ? 'rgba(245,158,11,0.10)' : 'rgba(16,185,129,0.10)' },
                ].map((kpi, i) => (
                  <div key={i} className="diagnostico-kpi" style={{ padding: '16px 20px', background: kpi.bg, borderRight: i < 3 ? '1px solid #f1f5f9' : 'none', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Teacher table */}
              <div className="diagnostico-table-wrap" style={{ overflowX: 'auto' }}>
                <table className="diagnostico-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card-hover)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Docente</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Horas de cursos</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>+ Asesoría</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#93c5fd', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Total requerido</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Horas disponibles</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#f87171', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Horas a agregar</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Bloque máx.</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Días marcados</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Estado</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>Cursos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostico.docentes.map((doc: any, i: number) => {
                      const isAlert = doc.estado !== 'ok';
                      const isExpanded = expandedDocente === doc.docente_id;
                      const estadoConfig: Record<string, { label: string; bg: string; color: string; icon: string; border: string }> = {
                        ok:                  { label: 'OK',                      bg: 'rgba(148,163,184,0.14)', color: '#cbd5e1', icon: '✓', border: 'rgba(148,163,184,0.24)' },
                        horas_insuficientes: { label: 'Horas insuficientes',     bg: 'rgba(148,163,184,0.14)', color: '#e2e8f0', icon: '✕', border: 'rgba(148,163,184,0.24)' },
                        sin_bloque_continuo: { label: 'Sin bloque continuo',     bg: 'rgba(148,163,184,0.14)', color: '#e2e8f0', icon: '⚡', border: 'rgba(148,163,184,0.24)' },
                        pocos_dias:          { label: 'Pocos días disponibles',  bg: 'rgba(148,163,184,0.14)', color: '#e2e8f0', icon: '📅', border: 'rgba(148,163,184,0.24)' },
                      };
                      const ec = estadoConfig[doc.estado] || estadoConfig.ok;
                      const pct = doc.horas_disponibles > 0 ? Math.min(100, Math.round((doc.horas_requeridas / doc.horas_disponibles) * 100)) : 0;

                      return (
                        <Fragment key={doc.docente_id}>
                          <tr
                            className="diagnostico-row"
                            style={{ background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-card-hover)', borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)' }}
                          >
                            {/* Docente nombre + badges */}
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                              <div>{doc.docente_nombre}</div>
                              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', background: doc.condicion === 'nombrado' ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.14)', color: doc.condicion === 'nombrado' ? '#bbf7d0' : '#cbd5e1', border: '1px solid rgba(148,163,184,0.18)' }}>
                                  {doc.condicion || '—'}
                                </span>
                                <span style={{ fontSize: '9px', fontWeight: '600', padding: '1px 5px', borderRadius: '3px', background: 'rgba(148,163,184,0.14)', color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.18)', textTransform: 'capitalize' }}>
                                  {doc.categoria || '—'}
                                </span>
                              </div>
                            </td>
                            {/* Horas cursos */}
                            <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-primary)', fontWeight: '600' }}>{doc.horas_cursos}h</td>
                            {/* Asesoría */}
                            <td style={{ padding: '12px', textAlign: 'center', color: '#93c5fd', fontWeight: '600' }}>+1h</td>
                            {/* Total requerido */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ fontWeight: '800', fontSize: '14px', color: '#93c5fd' }}>{doc.horas_requeridas}h</span>
                            </td>
                            {/* Horas disponibles + mini bar */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <div style={{ fontWeight: '600', color: doc.horas_disponibles >= doc.horas_requeridas ? '#6ee7b7' : '#fca5a5' }}>
                                {doc.horas_disponibles}h
                              </div>
                              <div style={{ marginTop: '4px', height: '4px', borderRadius: '2px', background: '#334155', width: '60px', margin: '4px auto 0' }}>
                                <div style={{ height: '4px', borderRadius: '2px', width: `${Math.min(pct, 100)}%`, background: doc.horas_faltantes > 0 ? '#ef4444' : '#22c55e' }} />
                              </div>
                            </td>
                            {/* Horas a agregar */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {doc.horas_faltantes > 0 ? (
                                <span style={{ fontWeight: '800', fontSize: '15px', color: '#fca5a5', background: 'rgba(239,68,68,0.12)', padding: '3px 10px', borderRadius: '6px', display: 'inline-block' }}>
                                  +{doc.horas_faltantes}h
                                </span>
                              ) : (
                                <span style={{ color: '#6ee7b7', fontWeight: '700' }}>—</span>
                              )}
                            </td>
                            {/* Bloque máx continuo */}
                            <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              {doc.max_bloque_continuo != null ? `${doc.max_bloque_continuo}h` : '—'}
                            </td>
                            {/* Días */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ color: doc.dias_marcados < 3 ? '#fca5a5' : 'var(--text-secondary)', fontWeight: doc.dias_marcados < 3 ? '700' : '400' }}>
                                {doc.dias_marcados ?? doc.dias_disponibles ?? '—'} días
                              </span>
                            </td>
                            {/* Estado badge */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: ec.bg, color: ec.color, border: `1px solid ${ec.border}`, whiteSpace: 'nowrap' }}>
                                {ec.icon} {ec.label}
                              </span>
                            </td>
                            {/* Expand cursos */}
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <button
                                onClick={() => setExpandedDocente(isExpanded ? null : doc.docente_id)}
                                style={{ fontSize: '11px', color: '#bfdbfe', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '600' }}
                              >
                                {doc.cursos.length} cursos {isExpanded ? '▲' : '▼'}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable course breakdown */}
                          {isExpanded && (
                            <tr key={`${doc.docente_id}-detail`}>
                              <td colSpan={10} className="diagnostico-detail-cell" style={{ padding: '0 16px 16px 48px', background: 'var(--bg-card-hover)', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ paddingTop: '12px' }}>
                                  <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Detalle de carga curricular asignada
                                  </p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {doc.cursos.map((c: any, ci: number) => (
                                      <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', borderRadius: '8px', padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                                        <span style={{ fontWeight: '700', color: '#93c5fd', fontSize: '12px', minWidth: '80px' }}>{c.codigo}</span>
                                        <span style={{ flex: 1, color: 'var(--text-primary)', fontSize: '12px' }}>{c.curso_nombre}</span>
                                        <span style={{ fontSize: '10px', background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                                          Ciclo {c.ciclo_plan || '—'}
                                        </span>
                                        {c.horas_teoria > 0 && <span style={{ fontSize: '10px', background: 'rgba(59,130,246,0.12)', color: '#bfdbfe', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>T: {c.horas_teoria}h</span>}
                                        {c.horas_practica > 0 && <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.12)', color: '#fde68a', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>P: {c.horas_practica}h</span>}
                                        {c.horas_laboratorio > 0 && <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.12)', color: '#a7f3d0', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>L: {c.horas_laboratorio}h × {c.cantidad_labs} turnos</span>}
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-primary)', minWidth: '50px', textAlign: 'right' }}>= {c.total_horas}h</span>
                                      </div>
                                    ))}
                                    {/* Totals row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card-hover)', borderRadius: '8px', padding: '10px 14px', border: '1px solid var(--border-color)', marginTop: '4px' }}>
                                      <span style={{ flex: 1, fontWeight: '700', color: 'var(--text-primary)', fontSize: '12px' }}>Total de horas de clase</span>
                                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#93c5fd' }}>{doc.horas_cursos}h</span>
                                    </div>

                                    {doc.horas_faltantes > 0 && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.12)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(248,113,113,0.35)', marginTop: '4px' }}>
                                        <span style={{ fontSize: '16px' }}>⚠️</span>
                                        <div>
                                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#fca5a5' }}>
                                            Se deben agregar <strong>{doc.horas_faltantes} hora{doc.horas_faltantes > 1 ? 's' : ''} de disponibilidad</strong> a este docente
                                          </div>
                                          <div style={{ fontSize: '12px', color: '#fecaca', marginTop: '2px' }}>
                                            Disponibles: {doc.horas_disponibles}h · Requeridas: {doc.horas_requeridas}h · Diferencia: {doc.horas_faltantes}h
                                          </div>
                                        </div>
                                        <a href={`/horarios/${progId}/disponibilidad`} style={{ marginLeft: 'auto', background: '#b91c1c', color: 'white', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                          Ajustar disponibilidad →
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Panel de Alertas y Conflictos del Motor CSP */}
      {conflictos.length > 0 && (
        <div className="card conflictos-panel" style={{ marginBottom: '20px', borderLeft: '4px solid #ef4444', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setConflictosAbiertos(!conflictosAbiertos)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Conflictos y Cursos sin Asignar ({conflictos.length})
              </h3>
            </div>
            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--bg-card-hover)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
              {conflictosAbiertos ? '▲ Colapsar' : '▼ Expandir'}
            </button>
          </div>
          
          {conflictosAbiertos && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                El motor de asignación CSP ha detectado incompatibilidades o restricciones insatisfechas al procesar el horario. Revise el detalle de cada bloque no asignado para ver el motivo exacto (ej. docente sin disponibilidad o cruce de aulas/grupos).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                {conflictos.map((conf, index) => {
                  const esCritico = conf.severidad === 'error' || conf.tipo === 'UNASSIGNED';
                  return (
                    <div 
                      key={conf.id || index} 
                      style={{ 
                        background: 'var(--bg-card)', 
                        borderRadius: '8px', 
                        padding: '14px', 
                        border: `1px solid var(--border-color)`,
                        borderLeft: `4px solid ${esCritico ? '#f87171' : '#fbbf24'}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ 
                          fontSize: '10px', 
                          fontWeight: 'bold', 
                          textTransform: 'uppercase',
                          color: esCritico ? '#fca5a5' : '#fde68a',
                          background: esCritico ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.05em'
                        }}>
                          {translateTipo(conf.tipo)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Prioridad: <b style={{ color: esCritico ? '#dc2626' : '#d97706' }}>{translateSeveridad(conf.severidad)}</b>
                        </span>
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--text-primary)', 
                        whiteSpace: 'pre-wrap', 
                        background: 'var(--bg-card-hover)', 
                        padding: '10px 14px', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-color)', 
                        margin: '6px 0 10px', 
                        lineHeight: '1.5' 
                      }}>
                        {formatearDescripcion(conf.descripcion)}
                      </div>
                      {conf.sugerencia && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#bfdbfe', 
                          display: 'flex', 
                          alignItems: 'flex-start', 
                          gap: '8px', 
                          background: 'rgba(59,130,246,0.12)', 
                          padding: '8px 12px', 
                          borderRadius: '6px', 
                          border: '1px solid rgba(59,130,246,0.25)',
                          lineHeight: '1.4'
                        }}>
                          <span style={{ color: '#93c5fd', fontWeight: '700', flexShrink: 0 }}>💡 Acción sugerida:</span>
                          <span>{formatearSugerencia(conf.sugerencia)}</span>
                        </div>
                      )}

                      {/* ── Diagnóstico de horas del docente afectado ── */}
                      {(() => {
                        const docenteNombreConf = conf.datos?.docente_nombre as string | undefined;
                        const docDiag = diagnostico ? matchDocenteEnDiag(docenteNombreConf || '', diagnostico.docentes) : null;
                        if (!docDiag) return null;

                        // Hours needed for THIS specific course block (e.g. 2h continuous for EE-402)
                        const bloqueSesion: number = conf.datos?.horas_requeridas ?? 1;
                        // Slots already blocked on the days the engine tried
                        const conflsDetectados: string[] = conf.datos?.conflictos_detectados ?? [];
                        const slotsBloqueados = conflsDetectados.length;

                        const hFaltantes = docDiag.horas_faltantes;   // global shortage
                        const hReq      = docDiag.horas_requeridas;
                        const hDisp     = docDiag.horas_disponibles;

                        // True cause: even if total hours look OK, if the engine found that all
                        // tried slots are occupied, the teacher needs a fresh continuous block.
                        // We recommend adding at least `bloqueSesion` consecutive hours on a new day.
                        const horasAAgregar = hFaltantes > 0 ? hFaltantes : bloqueSesion;
                        const causaCruce    = hFaltantes === 0 && slotsBloqueados > 0;

                        // Coverage bar: show used/available ratio (capped at 100%)
                        const pct = hDisp > 0 ? Math.min(100, Math.round((hReq / hDisp) * 100)) : 100;

                        return (
                          <div style={{ marginTop: '10px', borderRadius: '8px', border: '1px solid #fde68a', background: '#fffbeb', padding: '12px 14px' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '14px' }}>👨‍🏫</span>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#92400e' }}>Disponibilidad de {docDiag.docente_nombre}</span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: '800', background: '#dc2626', color: 'white', padding: '3px 10px', borderRadius: '20px' }}>
                                Agregar +{horasAAgregar}h
                              </span>
                            </div>

                            {/* Mini stats row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                              {[
                                { label: 'Horas de cursos', value: `${docDiag.horas_cursos}h`, sub: '', color: '#1a3a5c', bg: '#eff6ff' },
                                { label: 'Requerido total', value: `${hReq}h`, sub: 'motor CSP global', color: '#0f172a', bg: '#f1f5f9', bold: true },
                                { label: 'Bloque para este curso', value: `${bloqueSesion}h`, sub: 'continuas / consecutivas', color: '#7c3aed', bg: '#ede9fe', bold: true },
                                { label: 'Disponibles ahora', value: `${hDisp}h`, sub: `${docDiag.dias_marcados} días marcados`, color: hFaltantes > 0 ? '#dc2626' : '#059669', bg: hFaltantes > 0 ? '#fef2f2' : '#f0fdf4' },
                              ].map((s, si) => (
                                <div key={si} style={{ background: s.bg, borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
                                  <div style={{ fontSize: s.bold ? '15px' : '14px', fontWeight: '800', color: s.color }}>{s.value}</div>
                                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', lineHeight: '1.2' }}>{s.label}</div>
                                  <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '1px' }}>{s.sub}</div>
                                </div>
                              ))}
                            </div>

                            {/* Progress bar */}
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#92400e', marginBottom: '4px' }}>
                                <span>Cobertura de disponibilidad global</span>
                                <span style={{ fontWeight: '700' }}>{hDisp}h disponibles / {hReq}h necesarias</span>
                              </div>
                              <div style={{ height: '6px', borderRadius: '3px', background: '#fde68a', overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: '3px', width: `${Math.min(pct, 100)}%`, background: hFaltantes > 0 ? '#ef4444' : '#f59e0b', transition: 'width 0.4s ease' }} />
                              </div>
                            </div>

                            {/* Cause diagnosis + action */}
                            {causaCruce ? (
                              // Teacher has enough total hours, but all tried slots are occupied by other assignments
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
                                    ⚡ Cruce de horarios — todas las franjas revisadas están ocupadas
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.5' }}>
                                    El docente tiene {hDisp}h marcadas, pero las {slotsBloqueados} franjas probadas ya están tomadas por otras asignaciones.
                                    Para garantizar que el motor pueda colocar este bloque de <strong>{bloqueSesion}h continuas</strong>, se recomienda
                                    agregar al menos <strong style={{ color: '#dc2626' }}>+{bloqueSesion}h adicionales consecutivas</strong> en
                                    un día donde el docente no tenga otras clases (ej: martes o jueves por la tarde).
                                  </div>
                                </div>
                                <a
                                  href={`/horarios/${progId}/disponibilidad`}
                                  style={{ flexShrink: 0, background: '#d97706', color: 'white', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap', alignSelf: 'center' }}
                                >
                                  Ampliar disponibilidad →
                                </a>
                              </div>
                            ) : (
                              // Classic global hours shortage
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b', marginBottom: '4px' }}>
                                    ✕ Disponibilidad insuficiente para cubrir la carga total
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: '1.5' }}>
                                    Para resolver este conflicto se deben agregar
                                    {' '}<strong style={{ color: '#dc2626' }}>al menos {horasAAgregar}h continuas</strong>{' '}
                                    de disponibilidad a este docente en franjas sin asignaciones previas.
                                  </div>
                                </div>
                                <a
                                  href={`/horarios/${progId}/disponibilidad`}
                                  style={{ flexShrink: 0, background: '#dc2626', color: 'white', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap', alignSelf: 'center' }}
                                >
                                  Ajustar disponibilidad →
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <GrillaHorarios 
          asignaciones={asignacionesVisibles} 
          slots={slots} 
          docentesConCarga={docentesConCarga}
          ultimoMovimiento={ultimoMovimiento}
          bloquesMovidos={bloquesMovidos}
          activeBlockIds={new Set(activeBlockAsignaciones.map(a => a.id))}
          restringidosConfig={prog?.config?.horarios_restringidos}
        />
        
        <DragOverlay>
          {activeDragId ? (
            <div style={{ position: 'relative' }}>
              {activeBlockAsignaciones.map((a, i) => {
                const activeIndex = activeBlockAsignaciones.findIndex(ab => ab.id === activeDragId);
                const offset = i - activeIndex;
                return (
                  <div key={a.id} style={{
                    position: offset === 0 ? 'relative' : 'absolute',
                    top: offset === 0 ? undefined : `calc(${offset * 100}% + ${offset * 4}px)`,
                    left: 0,
                    right: 0,
                    zIndex: 9999
                  }}>
                    <BloqueHorario asignacion={a} />
                  </div>
                )
              })}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {movimientoPendiente && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div className="card" style={{width:'600px',maxWidth:'90vw',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
            <h2 style={{fontSize:'18px',color:'#b91c1c',margin:'0 0 16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <span>⛔</span> Conflicto detectado en la posición destino
            </h2>
            <div style={{flex:1,overflowY:'auto',marginBottom:'24px',fontSize:'14px',color:'#334155'}}>
              <p style={{marginBottom:'16px'}}>Has intentado mover el bloque a una posición donde ya existe una clase asignada para este grupo, docente o aula. Puedes forzar el movimiento bajo tu responsabilidad, o elegir una de las posiciones sugeridas por el motor inteligente:</p>
              
              {sugerenciasRecolocacion.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sugerenciasRecolocacion.map((sug, i) => (
                    <button key={i} onClick={() => aplicarMovimiento(movimientoPendiente.asignacion, sug.dia, sug.slot_id, sug.ambiente_id, sug.ambiente_codigo, sug.ambiente_nombre, false, movimientoPendiente.bloqueAsignaciones)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card-hover)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', textAlign: 'left' }}>
                      <div>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>{sug.calidad}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{sug.dia} • {sug.hora_inicio} a {sug.hora_fin} • {sug.ambiente_nombre}</div>
                      </div>
                      <span style={{ fontSize: '20px' }}>→</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="alert alert-warning">No se encontraron alternativas óptimas de recolocación automática.</div>
              )}
            </div>
            <div style={{display:'flex',gap:'12px',justifyContent:'flex-end'}}>
              <button className="btn-secondary" onClick={() => { setMovimientoPendiente(null); setSugerenciasRecolocacion([]); }}>Cancelar movimiento</button>
              <button className="btn-primary" style={{background:'#b91c1c',borderColor:'#b91c1c'}} onClick={() => aplicarMovimiento(movimientoPendiente.asignacion, movimientoPendiente.newDia, movimientoPendiente.newSlotId, movimientoPendiente.targetAmbiente, movimientoPendiente.targetAmbienteCodigo, movimientoPendiente.targetAmbienteNombre, true, movimientoPendiente.bloqueAsignaciones)}>
                Forzar movimiento (ignorar cruces)
              </button>
            </div>
          </div>
        </div>
      )}

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
