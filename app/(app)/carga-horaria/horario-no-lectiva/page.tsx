'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DIAS_LABEL: Record<string, string> = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb' };
const SLOTS = Array.from({ length: 14 }, (_, i) => {
  const h = String(7 + i).padStart(2, '0');
  return { id: h + ':00', label: h + ':00 - ' + String(8 + i).padStart(2, '0') + ':00' };
});

const SECCIONES_NO_LECTIVAS: { key: string; num: string; title: string; descField: string; color: string }[] = [
  { key: 'preparacion', num: '2', title: 'Preparación y Evaluación', descField: 'descripcion', color: '#3b82f6' }, // blue
  { key: 'consejeria', num: '3', title: 'Consejería y Tutoría', descField: 'detalles', color: '#10b981' }, // green
  { key: 'investigacion', num: '4', title: 'Investigación', descField: 'proyecto', color: '#8b5cf6' }, // purple
  { key: 'capacitacion', num: '5', title: 'Capacitación', descField: 'detalles', color: '#f59e0b' }, // amber
  { key: 'gobierno', num: '6', title: 'Gobierno', descField: 'detalles', color: '#ef4444' }, // red
  { key: 'administracion', num: '7', title: 'Administración', descField: 'detalles', color: '#6366f1' }, // indigo
  { key: 'asesoria', num: '8', title: 'Asesoría de Tesis', descField: 'detalles', color: '#ec4899' }, // pink
  { key: 'rsu', num: '9', title: 'Responsabilidad Social', descField: 'plan', color: '#14b8a6' }, // teal
  { key: 'comites', num: '10', title: 'Comités Técnicos', descField: 'detalles', color: '#84cc16' }, // lime
];

export default function HorarioNoLectivaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docenteId = searchParams.get('docenteId');
  const cicloAcademico = searchParams.get('cicloAcademico');
  const cargaHorariaId = searchParams.get('cargaHorariaId');

  const [selectedSection, setSelectedSection] = useState('preparacion');
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());
  const [slotsPorSeccion, setSlotsPorSeccion] = useState<Record<string, Set<string>>>({});
  const [horasEsperadas, setHorasEsperadas] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [docenteNombre, setDocenteNombre] = useState('');
  const mouseDownRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const slotKey = (dia: string, horaId: string) => `${dia}|${horaId}`;

  // Load lectiva schedule and existing non-lectiva data ONCE
  useEffect(() => {
    if (!docenteId || !cicloAcademico) return;
    setLoading(true);
    Promise.all([
      // Lectiva schedule
      fetch(`/api/docentes/${docenteId}/horario?ciclo_id=${cicloAcademico}`).then(r => r.json()).catch(() => ({})),
      // Existing carga horaria for non-lectiva
      fetch(`/api/carga-horaria?docente_id=${docenteId}&ciclo_academico_id=${cicloAcademico}`).then(r => r.json()).catch(() => ({})),
      // Docente info
      fetch(`/api/docentes/${docenteId}`).then(r => r.json()).catch(() => ({})),
    ]).then(([horarioData, chData, docData]) => {
      // Blocked slots from lectiva (filter out non-lectiva)
      const blocked = new Set<string>();
      const asignaciones = (horarioData?.asignaciones || horarioData?.data || [])
        .filter((a: any) => a.tipo !== 'no_lectiva');
      asignaciones.forEach((a: any) => {
        const dia = a.dia;
        const hi = a.hora_inicio?.slice(0, 5);
        if (dia && hi) blocked.add(slotKey(dia, hi));
      });
      setBlockedSlots(blocked);

      // Load existing non-lectiva items for ALL sections
      const newSlotsPorSeccion: Record<string, Set<string>> = {};
      const newHorasEsperadas: Record<string, number> = {};

      if (chData?.data?.length > 0) {
        const ch = chData.data[0];
        SECCIONES_NO_LECTIVAS.forEach(sec => {
          const rows = ch[sec.key];
          newSlotsPorSeccion[sec.key] = new Set<string>();
          let totalHoras = 0;
          if (rows && Array.isArray(rows)) {
            rows.forEach((r: any) => {
              totalHoras += Number(r.horas) || 0;
              if (r.dia && r.hora_inicio) {
                // If there's a duration block, expand it into 1-hour slots
                const startHour = parseInt(r.hora_inicio.split(':')[0]);
                const endHour = r.hora_fin ? parseInt(r.hora_fin.split(':')[0]) : startHour + 1;
                for (let h = startHour; h < endHour; h++) {
                  const hh = String(h).padStart(2, '0') + ':00';
                  newSlotsPorSeccion[sec.key].add(slotKey(r.dia, hh));
                }
              }
            });
          } else if (rows && rows.horas) { // legacy single object fallback
            totalHoras = Number(rows.horas) || 0;
          }
          newHorasEsperadas[sec.key] = totalHoras;
        });
      }
      setSlotsPorSeccion(newSlotsPorSeccion);
      setHorasEsperadas(newHorasEsperadas);
      setDocenteNombre(docData?.data?.nombre + ' ' + (docData?.data?.apellidos || '') || '');
      setLoading(false);
    });
  }, [docenteId, cicloAcademico]); // Only run on mount or when IDs change

  // Current selected slots for the active tab
  const selectedSlots = slotsPorSeccion[selectedSection] || new Set<string>();

  const updateSelectedSlots = useCallback((newSet: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSlotsPorSeccion(prev => {
      const currentSet = prev[selectedSection] || new Set<string>();
      const updatedSet = typeof newSet === 'function' ? newSet(currentSet) : newSet;
      return { ...prev, [selectedSection]: updatedSet };
    });
  }, [selectedSection]);

  const isBlocked = useCallback((dia: string, horaId: string) => {
    return blockedSlots.has(slotKey(dia, horaId));
  }, [blockedSlots]);

  const toggleCell = useCallback((dia: string, horaId: string) => {
    if (isBlocked(dia, horaId)) return;
    const key = slotKey(dia, horaId);

    setSlotsPorSeccion(prev => {
      const next = { ...prev };
      const isAlreadyInActive = next[selectedSection]?.has(key);

      if (isAlreadyInActive) {
        const newSet = new Set(next[selectedSection]);
        newSet.delete(key);
        next[selectedSection] = newSet;
      } else {
        // Remove from other sections
        SECCIONES_NO_LECTIVAS.forEach(sec => {
          if (sec.key !== selectedSection && next[sec.key]?.has(key)) {
            const newSet = new Set(next[sec.key]);
            newSet.delete(key);
            next[sec.key] = newSet;
          }
        });

        // Add to active section if limit not exceeded
        const currentActiveSize = next[selectedSection]?.size || 0;
        const limit = horasEsperadas[selectedSection] || 0;

        if (currentActiveSize < limit) {
          const newSet = new Set(next[selectedSection] || []);
          newSet.add(key);
          next[selectedSection] = newSet;
        } else {
          setMessage(`Límite alcanzado: solo se permiten ${limit} horas para ${SECCIONES_NO_LECTIVAS.find(s => s.key === selectedSection)?.title || 'esta actividad'}`);
          setTimeout(() => setMessage(null), 3000);
        }
      }
      return next;
    });
  }, [isBlocked, selectedSection, horasEsperadas]);

  const handleMouseDown = (dia: string, horaId: string) => {
    mouseDownRef.current = true;
    toggleCell(dia, horaId);
  };

  const handleMouseEnter = (dia: string, horaId: string) => {
    if (!mouseDownRef.current) return;
    if (isBlocked(dia, horaId)) return;
    const key = slotKey(dia, horaId);

    setSlotsPorSeccion(prev => {
      if (prev[selectedSection]?.has(key)) return prev;

      const next = { ...prev };

      // Remove from other sections
      SECCIONES_NO_LECTIVAS.forEach(sec => {
        if (sec.key !== selectedSection && next[sec.key]?.has(key)) {
          const newSet = new Set(next[sec.key]);
          newSet.delete(key);
          next[sec.key] = newSet;
        }
      });

      // Add to active section if limit not exceeded
      const currentActiveSize = next[selectedSection]?.size || 0;
      const limit = horasEsperadas[selectedSection] || 0;

      if (currentActiveSize < limit) {
        const newSet = new Set(next[selectedSection] || []);
        newSet.add(key);
        next[selectedSection] = newSet;
      }

      return next;
    });
  };

  const handleMouseUp = () => {
    mouseDownRef.current = false;
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Get end time for a block, handling last slot edge case
  const getBlockEnd = useCallback((lastIdx: number): string => {
    if (lastIdx + 1 < SLOTS.length) return SLOTS[lastIdx + 1].id;
    const h = parseInt(SLOTS[lastIdx].id.split(':')[0]) + 1;
    return String(h).padStart(2, '0') + ':00';
  }, []);

  // Build contiguous blocks for a specific section
  const buildBlocksForSection = useCallback((secKey: string): { dia: string; hora_inicio: string; hora_fin: string; horas: number }[] => {
    const secSlots = slotsPorSeccion[secKey] || new Set<string>();
    const blocks: { dia: string; hora_inicio: string; hora_fin: string; horas: number }[] = [];
    for (const dia of DIAS) {
      let start: string | null = null;
      let prevIdx = -2;
      for (let i = 0; i < SLOTS.length; i++) {
        const key = slotKey(dia, SLOTS[i].id);
        if (secSlots.has(key)) {
          if (start === null || i !== prevIdx + 1) {
            if (start !== null) {
              const startHour = parseInt(start.split(':')[0]);
              const blockEnd = getBlockEnd(prevIdx);
              const endHour = parseInt(blockEnd.split(':')[0]);
              blocks.push({ dia, hora_inicio: start, hora_fin: blockEnd, horas: endHour - startHour });
            }
            start = SLOTS[i].id;
          }
          prevIdx = i;
        }
      }
      if (start !== null) {
        const startHour = parseInt(start.split(':')[0]);
        const blockEnd = getBlockEnd(prevIdx);
        const endHour = parseInt(blockEnd.split(':')[0]);
        blocks.push({ dia, hora_inicio: start, hora_fin: blockEnd, horas: endHour - startHour });
      }
    }
    return blocks;
  }, [slotsPorSeccion, getBlockEnd]);

  // Build contiguous blocks from selected slots
  const buildBlocks = useCallback((): { dia: string; hora_inicio: string; hora_fin: string }[] => {
    return buildBlocksForSection(selectedSection);
  }, [buildBlocksForSection, selectedSection]);

  // Get total selected hours
  const totalHours = selectedSlots.size;

  const handleSave = async () => {
    if (!cargaHorariaId) {
      setMessage('Error: No hay carga horaria seleccionada');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const payload: any = {
        carga_horaria_id: cargaHorariaId,
        docente_id: docenteId,
      };

      SECCIONES_NO_LECTIVAS.forEach(sec => {
        const blocks = buildBlocksForSection(sec.key);
        const scheduledHours = blocks.reduce((sum, b) => sum + b.horas, 0);
        const expectedHours = horasEsperadas[sec.key] || 0;
        const remainder = Math.max(0, expectedHours - scheduledHours);

        const items = blocks.map(b => ({
          descripcion: sec.title,
          horas: b.horas,
          dia: b.dia,
          hora_inicio: b.hora_inicio,
          hora_fin: b.hora_fin,
        }));

        if (remainder > 0) {
          items.push({
            descripcion: sec.title,
            horas: remainder,
            dia: null as any,
            hora_inicio: null as any,
            hora_fin: null as any,
          });
        }

        payload[sec.key] = {
          items,
          horas: expectedHours,
          descripcion: sec.title,
        };
      });

      const res = await fetch('/api/carga-horaria/no-lectiva', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }
      setMessage('Horarios guardados correctamente');
      setTimeout(() => {
        setMessage(null);
        router.push(`/carga-horaria/nuevo?cicloAcademico=${cicloAcademico}&reset=true&docenteId=${docenteId}`);
      }, 1500);
    } catch (e: any) {
      setMessage('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Cargando horarios...</div>;
  }

  return (
    <div className="page-container" onMouseUp={handleMouseUp}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Programar Horario No Lectivo</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {docenteNombre || 'Docente'}
          </p>
        </div>
        <button className="btn-secondary" onClick={() => router.back()} style={{ padding: '8px 16px', fontSize: '13px' }}>
          Volver
        </button>
      </div>

      {/* Section selector */}
      <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
        <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '12px', color: 'var(--text-primary)' }}>
          Selecciona la actividad no lectiva:
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {SECCIONES_NO_LECTIVAS.map(sec => {
            const isSelected = selectedSection === sec.key;
            const assignedCount = slotsPorSeccion[sec.key]?.size || 0;
            const expectedCount = horasEsperadas[sec.key] || 0;

            return (
              <button
                key={sec.key}
                onClick={() => setSelectedSection(sec.key)}
                style={{
                  padding: '8px 14px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: isSelected ? sec.color : sec.color + '40',
                  cursor: 'pointer',
                  background: isSelected ? sec.color : sec.color + '12',
                  color: isSelected ? '#fff' : sec.color,
                  fontWeight: isSelected ? '600' : '500',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 2px 8px ${sec.color}40` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: isSelected ? '#fff' : sec.color,
                }} />
                <span>{sec.num}. {sec.title}</span>
                {expectedCount > 0 && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isSelected ? 'rgba(255,255,255,0.2)' : sec.color + '1a',
                    color: isSelected ? '#fff' : sec.color,
                    marginLeft: '4px',
                    fontWeight: 700,
                  }}>
                    {assignedCount}/{expectedCount}h
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '14px', marginBottom: 0 }}>
          Haz clic o arrastra el mouse sobre la cuadrícula para seleccionar los bloques horarios.
          Las celdas en gris son horarios de carga lectiva (bloqueados).
        </p>
      </div>

      {/* Grid */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div
          ref={gridRef}
          style={{
            display: 'grid',
            gridTemplateColumns: '90px repeat(6, 1fr)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'hidden',
            fontSize: '12px',
            userSelect: 'none',
          }}
        >
          {/* Header row */}
          <div style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e3a5f 100%)', color: 'white', padding: '10px 4px', fontWeight: 700, textAlign: 'center', fontSize: '11px' }}>
            Hora
          </div>
          {DIAS.map(d => (
            <div key={d} style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #1e3a5f 100%)', color: 'white', padding: '10px 4px', fontWeight: 700, textAlign: 'center', fontSize: '11px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
              {DIAS_LABEL[d]}
            </div>
          ))}

          {/* Slot rows */}
          {SLOTS.map((slot, si) => (
            <React.Fragment key={slot.id}>
              {/* Time label */}
              <div key={`time-${slot.id}`} style={{
                background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', padding: '8px 4px',
                fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)',
                minHeight: '44px', fontWeight: 600,
              }}>
                {slot.label}
              </div>
              {/* Day cells */}
              {DIAS.map(d => {
                const key = slotKey(d, slot.id);
                const cellBlocked = isBlocked(d, slot.id);
                const occupyingSec = SECCIONES_NO_LECTIVAS.find(sec => slotsPorSeccion[sec.key]?.has(key));
                const isCurrentSec = occupyingSec?.key === selectedSection;

                return (
                  <div
                    key={key}
                    onMouseDown={() => handleMouseDown(d, slot.id)}
                    onMouseEnter={() => handleMouseEnter(d, slot.id)}
                    style={{
                      minHeight: '44px', borderBottom: '1px solid var(--border-color)',
                      borderLeft: si === 0 ? 'none' : '1px solid var(--border-color)',
                      cursor: cellBlocked ? 'not-allowed' : 'pointer',
                      background: cellBlocked
                        ? 'var(--bg-card-hover)'
                        : occupyingSec
                          ? occupyingSec.color
                          : 'var(--bg-card)',
                      opacity: cellBlocked ? 0.5 : 1,
                      transition: 'background 0.15s, color 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', color: occupyingSec ? '#fff' : 'var(--text-muted)',
                      fontWeight: cellBlocked ? 500 : (occupyingSec ? 600 : 400),
                    }}
                  >
                    {cellBlocked ? 'No disponible' : occupyingSec ? (isCurrentSec ? '✓' : occupyingSec.num) : ''}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Summary + Save */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong style={{ fontSize: '14px' }}>
              Horas seleccionadas para esta actividad: {totalHours} {horasEsperadas[selectedSection] > 0 ? `/ ${horasEsperadas[selectedSection]}` : ''}
            </strong>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Bloques: {buildBlocks().map(b => `${DIAS_LABEL[b.dia]} ${b.hora_inicio}-${b.hora_fin}`).join(', ') || 'Ninguno'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={() => updateSelectedSlots(new Set())} style={{ padding: '8px 16px', fontSize: '13px' }}>
              Limpiar
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', fontSize: '13px' }}>
              {saving ? 'Guardando...' : 'Guardar Horarios'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: message.includes('Error') ? '#fee2e2' : '#dcfce7',
          color: message.includes('Error') ? '#dc2626' : '#16a34a',
          border: '1px solid', borderColor: message.includes('Error') ? '#fca5a5' : '#86efac',
          fontSize: '13px',
          fontWeight: '500',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
