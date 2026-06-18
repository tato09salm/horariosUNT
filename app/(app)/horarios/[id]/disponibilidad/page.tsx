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
  const [restringidos, setRestringidos] = useState<Record<string, string>>({});
  const [loadedRestringidos, setLoadedRestringidos] = useState(false);
  const [docenteId, setDocenteId] = useState<string>('');
  const [disponibilidad, setDisponibilidad] = useState<Record<string, PrioridadSlot>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  // Configuración de período de disponibilidad
  const [disponibilidadPeriodo, setDisponibilidadPeriodo] = useState<any>(null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaCierre, setFechaCierre] = useState('');
  const [enviarNotificacion, setEnviarNotificacion] = useState(false);

  const [accesoError, setAccesoError] = useState<string | null>(null);
  const [soloLectura, setSoloLectura] = useState(false);

  // ── Resumen de docentes pendientes (para bloquear el avance a Fase 3) ─────
  const [resumenPendientes, setResumenPendientes] = useState<{
    totalDocentes: number;
    docentesCompletos: number;
    pendientes: { docente_id: string; nombre: string }[];
    listo: boolean;
  } | null>(null);
  const [checandoResumen, setCheandoResumen] = useState(false);

  const isAdminOrSec = user?.rol.codigo === 'admin' || user?.rol.codigo === 'secretaria';
  const isDocente = user?.rol.codigo === 'docente';

  // ── Drag-select (estilo Excel / LettuceMeet) ──────────────────────────────
  // isDragging: si hay un arrastre de mouse en curso.
  // Usamos refs (no state) para no perder eventos por timing de re-render.
  const isDraggingRef = useRef(false);
  const movedDuringDragRef = useRef(false);
  const visitedDuringDragRef = useRef<Set<string>>(new Set());

  const cargarDisponibilidadPeriodo = useCallback(async () => {
    if (!progId) return;
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}/disponibilidad-periodo`);
      const data = await res.json();
      if (res.ok && data.data) {
        setDisponibilidadPeriodo(data.data);
        // Convertir a hora local (Perú) para datetime-local
        const fechaInicio = data.data.fecha_inicio ? new Date(data.data.fecha_inicio) : null;
        const fechaCierre = data.data.fecha_cierre ? new Date(data.data.fecha_cierre) : null;

        // Ajustar a zona horaria local del navegador (asumiendo Perú)
        if (fechaInicio) {
          const offset = fechaInicio.getTimezoneOffset() * 60000;
          const localDate = new Date(fechaInicio.getTime() - offset);
          setFechaInicio(localDate.toISOString().slice(0, 16));
        }
        if (fechaCierre) {
          const offset = fechaCierre.getTimezoneOffset() * 60000;
          const localDate = new Date(fechaCierre.getTime() - offset);
          setFechaCierre(localDate.toISOString().slice(0, 16));
        }
      }
    } catch (e) {
      console.error('Error cargando período de disponibilidad:', e);
    }
  }, [progId]);

  const guardarDisponibilidadPeriodo = async () => {
    if (!progId || !fechaInicio || !fechaCierre) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}/disponibilidad-periodo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_inicio: fechaInicio,
          fecha_cierre: fechaCierre,
          enviar_notificacion: enviarNotificacion
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDisponibilidadPeriodo(data.data);
      // Don't reset checkbox - allow user to send multiple notifications
      await cargarDisponibilidadPeriodo(); // Reload to get updated state
      setMsg({ type: 'success', text: 'Período de disponibilidad configurado correctamente' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

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

  // ── Resumen de docentes pendientes (solo admin/secretaria) ────────────────
  const cargarResumenPendientes = useCallback(async () => {
    if (!progId || !isAdminOrSec) return;
    setCheandoResumen(true);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}/disponibilidad-resumen`);
      const data = await res.json();
      if (res.ok) setResumenPendientes(data.data);
    } catch (e) {
      console.error('Error cargando resumen de disponibilidad:', e);
    } finally {
      setCheandoResumen(false);
    }
  }, [progId, isAdminOrSec]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, docRes, dashRes, configRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetchProgramacionCursos(progId),
        fetch('/api/dashboard').then(r => r.json()).catch(() => ({ slots: [] })),
        fetch('/api/configuracion?clave=HORARIOS_RESTRINGIDOS').then(r => r.json()).catch(() => ({ data: null })),
      ]);

      const progData = progRes.data;
      setProg(progData);
      setDocentes(docRes.cargaDocentes || []);
      const activeSlots = dashRes?.slots || [];
      setSlots(activeSlots);

      let restDict: Record<string, string> = {};
      if (progData?.config?.horarios_restringidos) {
        restDict = progData.config.horarios_restringidos;
      } else if (configRes.data && configRes.data.valor) {
        try {
          const parsed = JSON.parse(configRes.data.valor);
          if (Array.isArray(parsed)) {
            parsed.forEach(id => {
              restDict[id] = 'HORA LIBRE (REFRIGERIO)';
            });
          } else if (parsed && typeof parsed === 'object') {
            restDict = parsed;
          }
        } catch(e) {}
      } else {
        const foodSlot = activeSlots.find((s: any) => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
        if (foodSlot) {
          restDict[foodSlot.id] = 'HORA LIBRE (REFRIGERIO)';
        }
      }
      setRestringidos(restDict);
      setLoadedRestringidos(true);

      // ── Validaciones de acceso para docentes ──────────────────────────────
      if (isDocente) {
        // 1. Debe estar en Fase 2
        if (progData?.fase !== 2) {
          if (progData?.fase > 2) {
            // Fase avanzada → solo lectura, pero intentamos cargar disponibilidad
            setSoloLectura(true);
          } else {
            setAccesoError('Esta programación aún no está en la Fase 2 de disponibilidad docente.');
            setLoading(false);
            return;
          }
        }

        // 2. Estado publicado o cancelado → solo lectura
        if (progData?.estado === 'publicado' || progData?.estado === 'cancelado') {
          setSoloLectura(true);
        }

        // 3. Verificar perfil de docente y cursos asignados via API
        // El API ya valida: usuario_id → docente → programacion_cursos
        const dispRes = await fetch(`/api/horarios/disponibilidad?programacion_id=${progId}`);
        const dispData = await dispRes.json();

        if (!dispRes.ok) {
          // El API devuelve error si no tiene perfil de docente asociado
          setAccesoError(dispData.error || 'No tienes acceso a esta programación.');
          setLoading(false);
          return;
        }

        // Cargar disponibilidad desde la respuesta ya obtenida
        if (dispData.data) {
          const dict: Record<string, PrioridadSlot> = {};
          dispData.data.forEach((d: any) => {
            if (d.disponible && (d.prioridad === 1 || d.prioridad === 2)) {
              dict[`${d.dia}-${d.slot_id}`] = d.prioridad as PrioridadSlot;
            } else {
              dict[`${d.dia}-${d.slot_id}`] = 0;
            }
          });
          setDisponibilidad(dict);
          if (dispData.docente_id) setDocenteId(dispData.docente_id);
        }
      } else if (docRes.cargaDocentes?.length > 0) {
        setDocenteId(docRes.cargaDocentes[0].id);
        await cargarDisponibilidad(docRes.cargaDocentes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [progId, user, isDocente, cargarDisponibilidad]);

  useEffect(() => { cargarDatos(); cargarDisponibilidadPeriodo(); }, [cargarDatos, cargarDisponibilidadPeriodo]);
  useEffect(() => { cargarResumenPendientes(); }, [cargarResumenPendientes]);

  // ── Lógica de pintado de una celda individual ─────────────────────────────
  // modo 'click'   -> ciclo: vacío(0) → preferida(1) → aceptable(2) → se queda en aceptable
  // modo 'drag'    -> cada celda reacciona según SU PROPIO estado actual:
  //                   vacío(0) -> preferida(1)
  //                   preferida(1) o aceptable(2) -> no disponible(0)
  const aplicarCambioCelda = useCallback((key: string, modo: 'click' | 'drag') => {
    setDisponibilidad(prev => {
      const current = prev[key] ?? 0;
      let next: PrioridadSlot;

      if (modo === 'click') {
        if (current === 0) next = 1;
        else if (current === 1) next = 2;
        else next = 2; // ya está en "aceptable", el click simple no la cambia
      } else {
        // drag
        if (current === 0) next = 1;
        else next = 0; // preferida o aceptable -> no disponible
      }

      if (next === current) return prev; // evita re-render innecesario
      return { ...prev, [key]: next };
    });
  }, []);

  const puedeEditar = !soloLectura && prog?.estado !== 'publicado' && prog?.estado !== 'cancelado';

  const handleCellMouseDown = useCallback((key: string) => {
    if (!puedeEditar) return;
    isDraggingRef.current = true;
    movedDuringDragRef.current = false;
    visitedDuringDragRef.current = new Set([key]);
    // No aplicamos el cambio aún: esperamos a ver si fue click o arrastre (mouseup decide).
  }, [puedeEditar]);

  const handleCellMouseEnter = useCallback((key: string) => {
    if (!puedeEditar || !isDraggingRef.current) return;
    if (visitedDuringDragRef.current.has(key)) return;
    movedDuringDragRef.current = true;
    visitedDuringDragRef.current.add(key);
    aplicarCambioCelda(key, 'drag');
  }, [puedeEditar, aplicarCambioCelda]);

  const handleCellMouseUp = useCallback((key: string) => {
    if (!puedeEditar) return;
    if (isDraggingRef.current && !movedDuringDragRef.current) {
      // El mouse bajó y subió en la misma celda sin moverse entre celdas -> es un click simple.
      aplicarCambioCelda(key, 'click');
    } else if (isDraggingRef.current && movedDuringDragRef.current) {
      // Hubo arrastre: la celda donde se soltó el mouse también debe reaccionar
      // si no fue "visitada" todavía (por ejemplo, un drag de una sola celda de distancia
      // ya quedó cubierta por mouseEnter, pero por seguridad la aplicamos solo si falta).
      if (!visitedDuringDragRef.current.has(key)) {
        aplicarCambioCelda(key, 'drag');
      }
    }
    isDraggingRef.current = false;
    movedDuringDragRef.current = false;
    visitedDuringDragRef.current = new Set();
  }, [puedeEditar, aplicarCambioCelda]);

  // Si el usuario suelta el mouse fuera de la grilla, igual debemos terminar el drag.
  useEffect(() => {
    const onWindowMouseUp = () => {
      isDraggingRef.current = false;
      movedDuringDragRef.current = false;
      visitedDuringDragRef.current = new Set();
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, []);

  const guardarDisponibilidad = async () => {
    if (soloLectura) return;
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
      // Refrescar el resumen de pendientes (puede que este docente ahora esté completo)
      cargarResumenPendientes();
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
      if (docenteId) await cargarDisponibilidad(docenteId);
      cargarResumenPendientes();
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Error importando: ' + err.message });
    } finally {
      setLoading(false);
    }

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
    // ── Bloqueo: no avanzar si falta algún docente por marcar su disponibilidad ──
    setMsg(null);
    setCheandoResumen(true);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}/disponibilidad-resumen`);
      const data = await res.json();
      if (res.ok) {
        setResumenPendientes(data.data);
        if (!data.data.listo) {
          setMsg({
            type: 'error',
            text: `No se puede avanzar a la Fase 3: faltan ${data.data.pendientes.length} de ${data.data.totalDocentes} docente(s) por registrar su disponibilidad.`,
          });
          return;
        }
      }
    } catch (e) {
      console.error('Error validando resumen antes de avanzar:', e);
      // No bloqueamos por un error de red, pero sí avisamos.
    } finally {
      setCheandoResumen(false);
    }

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

  // ── Pantalla de error de acceso (para docentes sin permiso) ───────────────
  if (accesoError) {
    return (
      <div style={{ padding: '40px', maxWidth: '560px', margin: '0 auto' }}>
        <div style={{ marginBottom: '16px' }}>
          <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
        </div>
        <div style={{
          background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px',
          padding: '32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#9a3412', margin: '0 0 8px' }}>
            Acceso restringido
          </h2>
          <p style={{ color: '#c2410c', fontSize: '14px', margin: 0 }}>{accesoError}</p>
        </div>
      </div>
    );
  }

  // ── Banner de solo lectura (docente fuera de fecha o fase avanzada) ────────
  const bannerSoloLectura = soloLectura && isDocente && (
    <div style={{
      background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px',
      padding: '12px 16px', marginBottom: '16px',
      display: 'flex', alignItems: 'center', gap: '10px',
      color: '#0369a1', fontSize: '14px',
    }}>
      <span style={{ fontSize: '18px' }}>👁️</span>
      <span>
        <strong>Vista de solo lectura.</strong>{' '}
        {prog?.estado === 'publicado' || prog?.estado === 'cancelado'
          ? 'La programación ya no permite modificaciones.'
          : 'Esta programación ya avanzó de fase. Tu disponibilidad registrada se muestra a continuación.'}
      </span>
    </div>
  );

  return (
    <div className="horarios-disponibilidad-page" style={{ padding: '32px' }}>
      <div style={{ marginBottom: '8px' }}>
        <a href="/horarios" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none' }}>← Volver a Horarios</a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              margin: '0 0 4px'
            }}
          >
            {prog.nombre}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Fase 2: Disponibilidad Docente (doble prioridad)</p>
        </div>
        {isAdminOrSec && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={importarCSV} />
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={saving || loading}>
              📥 Importar CSV
            </button>
            <button className="btn-secondary" onClick={notificarDocentes}>Notificar Docentes</button>
            <button className="btn-secondary" onClick={retrocederFase}>← Volver a Fase 1</button>
            <button
              className="btn-primary"
              onClick={avanzarFase}
              disabled={checandoResumen}
              title={resumenPendientes && !resumenPendientes.listo ? 'Aún faltan docentes por registrar su disponibilidad' : undefined}
            >
              {checandoResumen ? 'Verificando...' : 'Avanzar a Fase 3'}
            </button>
            <button className="btn-danger" onClick={cancelarProgramacion}>Cancelar</button>
          </div>
        )}
      </div>

      {bannerSoloLectura}

      {/* Aviso de docentes pendientes (solo admin/secretaria) */}
      {isAdminOrSec && resumenPendientes && !resumenPendientes.listo && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
          padding: '12px 16px', marginBottom: '16px',
          color: '#92400e', fontSize: '14px',
        }}>
          <strong>⚠️ Faltan {resumenPendientes.pendientes.length} de {resumenPendientes.totalDocentes} docentes</strong> por registrar su disponibilidad.
          No se podrá avanzar a la Fase 3 hasta que todos registren al menos una franja.
        </div>
      )}
      {isAdminOrSec && resumenPendientes && resumenPendientes.listo && resumenPendientes.totalDocentes > 0 && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px',
          padding: '12px 16px', marginBottom: '16px',
          color: '#065f46', fontSize: '14px',
        }}>
          ✅ Los {resumenPendientes.totalDocentes} docentes con carga ya registraron su disponibilidad. Puedes avanzar a la Fase 3.
        </div>
      )}

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

      {/* Sección de configuración de período de disponibilidad (solo admin/secretaria) */}
      {isAdminOrSec && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 16px' }}>Configuración del Período de Disponibilidad</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Fecha y Hora de Inicio:</label>
              <input
                type="datetime-local"
                className="form-input"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>Fecha y Hora de Cierre:</label>
              <input
                type="datetime-local"
                className="form-input"
                value={fechaCierre}
                onChange={e => setFechaCierre(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div
              className="notif-card"
              role="switch"
              aria-checked={enviarNotificacion}
              tabIndex={0}
              onClick={() => setEnviarNotificacion(!enviarNotificacion)}
              onKeyDown={e => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setEnviarNotificacion(!enviarNotificacion);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                ...(enviarNotificacion ? {
                  border: '1px solid #3b82f6',
                  background: 'rgba(59, 130, 246, 0.05)',
                } : {}),
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: enviarNotificacion ? '#3b82f6' : 'var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={enviarNotificacion ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                      Notificar a docentes asignados
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: enviarNotificacion ? '#3b82f6' : 'var(--border-color)',
                      color: enviarNotificacion ? '#fff' : 'var(--text-secondary)',
                      fontWeight: '500',
                    }}>
                      {enviarNotificacion ? 'Activo' : 'Desactivado'}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    Se enviará un correo automático al actualizar el período
                  </p>
                </div>
              </div>
              <div style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                background: enviarNotificacion ? '#3b82f6' : 'var(--border-color)',
                position: 'relative',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: '2px',
                  left: enviarNotificacion ? '22px' : '2px',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}></div>
              </div>
            </div>
          </div>
          {disponibilidadPeriodo && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                <strong>Período actual:</strong><br />
                Inicio: {new Date(disponibilidadPeriodo.fecha_inicio).toLocaleString('es-PE', { timeZone: 'America/Lima' })}<br />
                Cierre: {new Date(disponibilidadPeriodo.fecha_cierre).toLocaleString('es-PE', { timeZone: 'America/Lima' })}<br />
                Notificación enviada: {disponibilidadPeriodo.notificacion_enviada ? 'Sí' : 'No'}
              </p>
            </div>
          )}
          <button
            className="btn-primary"
            onClick={guardarDisponibilidadPeriodo}
            disabled={saving || !fechaInicio || !fechaCierre}
          >
            {saving ? 'ACTUALIZANDO...' : 'ACTUALIZAR PERÍODO'}
          </button>
        </div>
      )}

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
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {soloLectura
                  ? 'Tu disponibilidad registrada (solo lectura).'
                  : 'Clic: preferida → aceptable. Arrastra para pintar varias celdas a la vez (estilo Excel).'}
              </p>
            </div>
          )}
          {/* Botón guardar: oculto en solo lectura para docentes */}
          {!soloLectura && (
            <button
              className="btn-primary"
              onClick={guardarDisponibilidad}
              disabled={saving || prog?.estado === 'publicado' || prog?.estado === 'cancelado'}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
          <span className="availability-legend__item availability-legend__preferred">
            <span style={{ display: 'inline-block', width: 14, height: 14, background: '#059669', marginRight: 6 }} />
            Preferida ({contarPrioridad(1)})
          </span>
          <span className="availability-legend__item availability-legend__acceptable">
            <span style={{ display: 'inline-block', width: 14, height: 14, background: '#fde047', marginRight: 6 }} />
            Aceptable ({contarPrioridad(2)})
          </span>
          <span className="availability-legend__item availability-legend__none">
            <span style={{ display: 'inline-block', width: 14, height: 14, background: '#fef2f2', border: '1px solid #fecaca', marginRight: 6 }} />
            No disponible
          </span>
        </div>
        <div
          className="horario-grid"
          style={{ minWidth: '900px', userSelect: 'none' }}
          // Evita que el navegador intente "seleccionar texto" mientras arrastramos sobre las celdas.
          onMouseLeave={() => { /* el listener global de window.mouseup ya cubre este caso */ }}
        >
          <div className="horario-header">Hora</div>
          {DIAS.map(d => <div key={d} className="horario-header">{DIAS_LABEL[d]}</div>)}
          {slots.map((slot) => {
            const isRestringido = loadedRestringidos ? (slot.id in restringidos) : (slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00');
            if (isRestringido) return null;
            return (
              <div key={slot.id} style={{ display: 'contents' }}>
                <div className="horario-time">{slot.hora_inicio}<br />{slot.hora_fin}</div>
                {DIAS.map(dia => {
                  const key = `${dia}-${slot.id}`;
                  const p = disponibilidad[key] ?? 0;
                  const st = PRIORIDAD_STYLE[p];
                  return (
                    <div
                      key={key}
                      onMouseDown={(e) => { e.preventDefault(); handleCellMouseDown(key); }}
                      onMouseEnter={() => handleCellMouseEnter(key)}
                      onMouseUp={() => handleCellMouseUp(key)}
                      className={`horario-slot-cell${p === 0 ? ' horario-slot-cell--none' : ''}`}
                      style={{
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        background: st.bg,
                        minHeight: 36,
                        cursor: soloLectura ? 'default' : 'pointer',
                        opacity: soloLectura ? 0.85 : 1,
                      }}
                    />
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