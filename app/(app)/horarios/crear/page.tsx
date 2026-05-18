'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchProgramacionCursos, programacionCursosApiUrl } from '@/lib/fetch-programacion-cursos';

// Helper para Romanos
const toRoman = (num: number) => {
  const map = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return map[num - 1] || num.toString();
};
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function CrearHorarioPage() {
  const searchParams = useSearchParams();
  const progId = searchParams.get('id');

  const [prog, setProg] = useState<any>(null);

  // Catálogos
  const [curriculas, setCurriculas] = useState<any[]>([]);
  const [curriculaActual, setCurriculaActual] = useState<string>('');
  const [cursosCurricula, setCursosCurricula] = useState<any[]>([]);
  const [docentes, setDocentes] = useState<any[]>([]);

  // Datos Programados
  const [grupos, setGrupos] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);

  // Estado UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Selección de Ciclos y Cursos
  const [selectedCiclosPlan, setSelectedCiclosPlan] = useState<number[]>([]);
  const [selectedCursosIds, setSelectedCursosIds] = useState<string[]>([]);

  // Buscador de docentes en la tabla
  const [searchGrupoId, setSearchGrupoId] = useState<string | null>(null);
  const [docenteSearch, setDocenteSearch] = useState('');
  const [alertasOpen, setAlertasOpen] = useState(false);

  // =================== CARGA INICIAL ===================
  const cargarConfiguracion = useCallback(async () => {
    try {
      const [currRes, configRes, docRes] = await Promise.all([
        fetch('/api/curriculas').then(r => r.json()),
        fetch('/api/configuracion?clave=ID_MALLA_CURRICULAR_ACTUAL').then(r => r.json()),
        fetch('/api/docentes?limit=1000').then(r => r.json()),
      ]);
      setCurriculas(currRes.data || []);
      setDocentes(docRes.data || []);

      const mallaActual = configRes.data?.valor || '';
      if (mallaActual) {
        setCurriculaActual(mallaActual);
      } else if (currRes.data && currRes.data.length > 0) {
        setCurriculaActual(currRes.data[0].id);
      }
    } catch (e) {
      console.error('Error config:', e);
    }
  }, []);

  const cargarProgramacion = useCallback(async () => {
    if (!progId) return;
    try {
      const [progRes, asignRes] = await Promise.all([
        fetch(`/api/horarios/programaciones/${progId}`).then(r => r.json()),
        fetchProgramacionCursos(progId)
      ]);

      setProg(progRes.data);
      setAsignaciones(asignRes.data || []);

      if (progId) {
        const grpRes = await fetch(`/api/horarios/grupos?programacion_id=${progId}`).then(r => r.json());
        setGrupos(grpRes.data || []);

        // Auto-seleccionar cursos que ya tienen grupos
        const ids = Array.from(new Set((grpRes.data || []).map((g: any) => g.curso_id))) as string[];
        setSelectedCursosIds(ids);
      }
    } catch (e) {
      console.error('Error prog:', e);
    } finally {
      setLoading(false);
    }
  }, [progId]);

  useEffect(() => {
    if (curriculaActual) {
      fetch(`/api/curriculas/${curriculaActual}/cursos`)
        .then(r => r.json())
        .then(res => {
          const cursos = res.data || [];
          setCursosCurricula(cursos);

          // Auto-marcar ciclos de los cursos que ya están seleccionados
          const ciclosConCursosSelectos = Array.from(new Set(
            cursos.filter((c: any) => selectedCursosIds.includes(c.id)).map((c: any) => c.ciclo_plan)
          )) as number[];
          if (ciclosConCursosSelectos.length > 0) {
            setSelectedCiclosPlan(prev => Array.from(new Set([...prev, ...ciclosConCursosSelectos])));
          }
        })
        .catch(e => console.error(e));
    }
  }, [curriculaActual, selectedCursosIds.length]);

  useEffect(() => {
    cargarConfiguracion().then(() => cargarProgramacion());
  }, [cargarConfiguracion, cargarProgramacion]);

  // =================== LÓGICA DE SELECCIÓN ===================
  const ciclosDisponibles = useMemo(() => {
    const set = new Set(cursosCurricula.map(c => c.ciclo_plan));
    return Array.from(set).sort((a, b) => a - b);
  }, [cursosCurricula]);

  const toggleCicloPlan = (cicloPlan: number) => {
    setSelectedCiclosPlan(prev => {
      if (prev.includes(cicloPlan)) return prev.filter(c => c !== cicloPlan);
      return [...prev, cicloPlan];
    });
  };

  const toggleCurso = (cursoId: string) => {
    setSelectedCursosIds(prev => {
      if (prev.includes(cursoId)) return prev.filter(id => id !== cursoId);
      return [...prev, cursoId];
    });
  };

  const seleccionarTodosCursosDeCiclo = (cicloPlan: number, selectAll: boolean) => {
    const cursosDelCiclo = cursosCurricula.filter(c => c.ciclo_plan === cicloPlan).map(c => c.id);
    if (selectAll) {
      setSelectedCursosIds(prev => Array.from(new Set([...prev, ...cursosDelCiclo])));
    } else {
      setSelectedCursosIds(prev => prev.filter(id => !cursosDelCiclo.includes(id)));
    }
  };

  // =================== OPTIMISTIC UI: GRUPOS ===================
  const agregarGrupo = async (cursoId: string, tipo_actividad: string) => {
    if (!progId) return;

    const tempId = `temp-g-${Date.now()}`;
    const gruposAct = grupos.filter(g => g.curso_id === cursoId && g.tipo_actividad === tipo_actividad);
    const numero_grupo = gruposAct.length > 0 ? Math.max(...gruposAct.map(g => g.numero_grupo)) + 1 : 1;

    const newGrupo = {
      id: tempId,
      programacion_id: progId,
      curso_id: cursoId,
      tipo_actividad,
      numero_grupo,
      max_alumnos: 40,
      isTemp: true
    };
    setGrupos(prev => [...prev, newGrupo]);

    try {
      const res = await fetch('/api/horarios/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programacion_id: progId,
          curso_id: cursoId,
          tipo_actividad,
          numero_grupo,
          max_alumnos: 40,
          num_alumnos: 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setGrupos(prev => prev.map(g => g.id === tempId ? data.data : g));
      setLastSaved(new Date());
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      setGrupos(prev => prev.filter(g => g.id !== tempId));
    }
  };

  const eliminarGrupo = async (grupoId: string) => {
    if (!confirm('¿Seguro que deseas eliminar este grupo y todas sus asignaciones?')) return;

    const grupoActual = grupos.find(g => g.id === grupoId);
    const asignacionesGrupo = asignaciones.filter(a => a.grupo_id === grupoId);

    setGrupos(prev => prev.filter(g => g.id !== grupoId));
    setAsignaciones(prev => prev.filter(a => a.grupo_id !== grupoId));

    try {
      const res = await fetch(`/api/horarios/grupos/${grupoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setLastSaved(new Date());
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      if (grupoActual) setGrupos(prev => [...prev, grupoActual]);
      setAsignaciones(prev => [...prev, ...asignacionesGrupo]);
    }
  };

  // =================== OPTIMISTIC UI: ASIGNACIONES ===================
  const addDocente = async (curso: any, grupoId: string, docente: any) => {
    if (!progId) return;

    const newId = `temp-pc-${Date.now()}`;
    const newAsig = {
      id: newId,
      curso_id: curso.id,
      grupo_id: grupoId,
      docente_id: docente.id,
      docente_nombre: `${docente.nombre} ${docente.apellidos}`,
      docente_codigo: docente.usuario_id || '0000',
      docente_dni: docente.dni,
      horas_teoria: 0,
      horas_practica: 0,
      horas_laboratorio: 0,
      horas_consejeria: 0,
      isTemp: true
    };

    setAsignaciones(prev => [...prev, newAsig]);
    setSearchGrupoId(null);
    setDocenteSearch('');

    try {
      const res = await fetch(programacionCursosApiUrl(progId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAsig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAsignaciones(prev => prev.map(a => a.id === newId ? { ...data.data, docente_nombre: newAsig.docente_nombre } : a));
      setLastSaved(new Date());
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      setAsignaciones(prev => prev.filter(a => a.id !== newId));
    }
  };

  const updateHoras = async (pc_id: string, field: string, value: number) => {
    const asigActual = asignaciones.find(a => a.id === pc_id);
    if (!asigActual) return;

    const updatedAsig = { ...asigActual, [field]: value };
    setAsignaciones(prev => prev.map(a => a.id === pc_id ? updatedAsig : a));

    try {
      const res = await fetch(programacionCursosApiUrl(progId as string), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pc_id,
          horas_teoria: updatedAsig.horas_teoria,
          horas_practica: updatedAsig.horas_practica,
          horas_laboratorio: updatedAsig.horas_laboratorio,
          horas_consejeria: updatedAsig.horas_consejeria
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setLastSaved(new Date());
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      setAsignaciones(prev => prev.map(a => a.id === pc_id ? asigActual : a));
    }
  };

  const removeDocente = async (pc_id: string) => {
    const asigActual = asignaciones.find(a => a.id === pc_id);
    setAsignaciones(prev => prev.filter(a => a.id !== pc_id));

    try {
      const res = await fetch(`${programacionCursosApiUrl(progId as string)}?pc_id=${pc_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setLastSaved(new Date());
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      if (asigActual) setAsignaciones(prev => [...prev, asigActual]);
    }
  };

  const avanzarFase = async () => {
    if (asignaciones.length === 0) {
      setMsg({ type: 'error', text: 'Agrega docentes a los grupos antes de avanzar.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/horarios/programaciones/${progId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 2 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.location.href = `/horarios/${progId}/disponibilidad`;
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
      setSaving(false);
    }
  };

  // =================== CÁLCULO DE CURSOS ===================
  const cursosFiltrados = useMemo(() => {
    const result: any[] = [];
    selectedCiclosPlan.sort((a, b) => a - b).forEach(cicloPlan => {
      const cursosDelCiclo = cursosCurricula.filter(c => c.ciclo_plan === cicloPlan && selectedCursosIds.includes(c.id));
      cursosDelCiclo.forEach(curso => result.push(curso));
    });
    return result;
  }, [selectedCiclosPlan, cursosCurricula, selectedCursosIds]);

  const cargaDocenteMap = useMemo(() => {
    const map: Record<string, { ocupada: number, max: number, nombre: string }> = {};
    docentes.forEach(d => {
      map[d.id] = { ocupada: 0, max: d.horas_max_semana || 0, nombre: `${d.nombre} ${d.apellidos}` };
    });
    asignaciones.forEach(a => {
      if (a.docente_id && map[a.docente_id]) {
        map[a.docente_id].ocupada += (a.horas_teoria || 0) + (a.horas_practica || 0) + (a.horas_laboratorio || 0) + (a.horas_consejeria || 0);
      }
    });
    return map;
  }, [asignaciones, docentes]);

  const alerts = useMemo(() => {
    const newAlerts: string[] = [];

    // Validar carga docente máxima
    Object.values(cargaDocenteMap).forEach(carga => {
      if (carga.ocupada > carga.max) {
        newAlerts.push(`El docente ${carga.nombre} supera su carga semanal disponible (${carga.ocupada}/${carga.max} hrs).`);
      }
    });

    cursosFiltrados.forEach(curso => {
      const actividades = [
        { id: 'teoria', name: 'TEORÍA', horas: curso.horas_teoria },
        { id: 'practica', name: 'PRÁCTICA', horas: curso.horas_practica },
        { id: 'laboratorio', name: 'LABORATORIO', horas: curso.horas_laboratorio || 0 }
      ].filter(a => a.horas > 0);

      actividades.forEach(act => {
        const gruposAct = grupos.filter(g => g.curso_id === curso.id && g.tipo_actividad === act.id);
        
        if (gruposAct.length === 0) {
          newAlerts.push(`El curso ${curso.codigo} no tiene grupos de ${act.name}.`);
        }

        gruposAct.forEach(grupo => {
          const asigs = asignaciones.filter(a => a.grupo_id === grupo.id);
          
          if (asigs.length === 0) {
            newAlerts.push(`El grupo ${grupo.numero_grupo} de ${act.name} del curso ${curso.codigo} no tiene docentes.`);
          }
          
          if (act.id === 'teoria') {
            const sum = asigs.reduce((s, a) => s + (a.horas_teoria || 0), 0);
            if (sum !== act.horas) newAlerts.push(`El grupo ${grupo.numero_grupo} de ${act.name} del curso ${curso.codigo} requiere ${act.horas}hrs (tiene ${sum}).`);
          } else if (act.id === 'practica') {
            const sum = asigs.reduce((s, a) => s + (a.horas_practica || 0), 0);
            if (sum !== act.horas) newAlerts.push(`El grupo ${grupo.numero_grupo} de ${act.name} del curso ${curso.codigo} requiere ${act.horas}hrs (tiene ${sum}).`);
          } else if (act.id === 'laboratorio') {
            const sum = asigs.reduce((s, a) => s + (a.horas_laboratorio || 0), 0);
            if (sum !== act.horas) newAlerts.push(`El grupo ${grupo.numero_grupo} de ${act.name} del curso ${curso.codigo} requiere ${act.horas}hrs (tiene ${sum}).`);
          }
        });
      });
    });
    return newAlerts;
  }, [cargaDocenteMap, cursosFiltrados, grupos, asignaciones, docentes]);

  const filteredDocentes = docenteSearch.length >= 2 ? docentes.filter(d =>
    normalize(d.nombre + ' ' + d.apellidos).includes(normalize(docenteSearch)) ||
    d.dni?.includes(docenteSearch) || d.email?.toLowerCase().includes(docenteSearch.toLowerCase())
  ) : [];

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada.</div>;

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>{prog.nombre}</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Fase 1: Carga de Información — {prog.ciclo_nombre}
            {lastSaved && <span style={{ marginLeft: '12px', color: '#10b981' }}>✔ Guardado</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Currícula Base:</label>
            <select className="form-input" style={{ padding: '6px 12px', fontSize: '13px' }} value={curriculaActual} onChange={e => setCurriculaActual(e.target.value)}>
              <option value="">Seleccionar currícula...</option>
              {curriculas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre_carrera} ({c.año_curricula})</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={avanzarFase} disabled={saving || alerts.length > 0 || cursosFiltrados.length === 0} title={alerts.length > 0 ? "Existen errores por corregir" : ""}>
            {saving ? 'Avanzando...' : 'Avanzar a Fase 2 →'}
          </button>
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type}`} style={{ marginBottom: '20px' }}>{msg.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px' }}>

        {/* PANEL IZQUIERDO: Selección de Ciclos y Cursos */}
        <div className="card" style={{ padding: '20px', height: 'fit-content' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Cursos a Programar</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ciclosDisponibles.map(cicloPlan => {
              const cursosDelCiclo = cursosCurricula.filter(c => c.ciclo_plan === cicloPlan);
              const isCicloSelected = selectedCiclosPlan.includes(cicloPlan);
              const seleccionadosCount = cursosDelCiclo.filter(c => selectedCursosIds.includes(c.id)).length;
              const allSelected = seleccionadosCount === cursosDelCiclo.length && cursosDelCiclo.length > 0;

              return (
                <div key={cicloPlan} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{ background: isCicloSelected ? '#e0e7ff' : '#f8fafc', padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: isCicloSelected ? '1px solid #c7d2fe' : 'none' }}
                    onClick={() => toggleCicloPlan(cicloPlan)}
                  >
                    <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px', flex: 1 }}>Ciclo {toRoman(cicloPlan)}</span>
                    <span style={{ fontSize: '11px', color: '#64748b', background: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{seleccionadosCount}/{cursosDelCiclo.length}</span>
                  </div>
                  {isCicloSelected && (
                    <div style={{ padding: '6px', background: '#fff' }}>
                      <div
                        style={{ fontSize: '11px', color: '#3b82f6', cursor: 'pointer', marginBottom: '6px', textAlign: 'right' }}
                        onClick={(e) => { e.stopPropagation(); seleccionarTodosCursosDeCiclo(cicloPlan, !allSelected); }}
                      >
                        {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {cursosDelCiclo.map(curso => (
                          <label key={curso.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px', cursor: 'pointer', background: selectedCursosIds.includes(curso.id) ? '#f8fafc' : 'transparent' }}>
                            <input type="checkbox" checked={selectedCursosIds.includes(curso.id)} onChange={() => toggleCurso(curso.id)} style={{ marginTop: '2px' }} />
                            <span style={{ fontSize: '12px', color: '#334155', lineHeight: '1.2' }}>{curso.codigo} - {curso.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: Tabla Plana */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflow: 'hidden' }}>
          {alerts.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', overflow: 'hidden' }}>
              <div 
                style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: alertasOpen ? '#fee2e2' : 'transparent' }}
                onClick={() => setAlertasOpen(!alertasOpen)}
              >
                <h4 style={{ color: '#b91c1c', fontWeight: '700', fontSize: '14px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚠️ Existen alertas de asignación que debe solucionar ({alerts.length})
                </h4>
                <span style={{ color: '#b91c1c', fontSize: '18px', lineHeight: 1 }}>{alertasOpen ? '▴' : '▾'}</span>
              </div>
              {alertasOpen && (
                <div style={{ padding: '16px', borderTop: '1px solid #fca5a5' }}>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#991b1b', fontSize: '13px' }}>
                    {alerts.map((al, idx) => <li key={idx} style={{ marginBottom: '4px' }}>{al}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#1e293b', color: '#fff' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '60px' }}>CICLO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>CÓDIGO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>CURSO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>GRUPO</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>DOCENTE</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '60px' }}>T</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '60px' }}>P</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '60px' }}>L</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '60px' }}>C</th>
                  </tr>
                </thead>
                <tbody>
                  {cursosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        Selecciona ciclos y cursos en el panel izquierdo.
                      </td>
                    </tr>
                  ) : (
                    cursosFiltrados.map(curso => {
                      const actividades = [
                        { id: 'teoria', name: 'TEORÍA', horas: curso.horas_teoria },
                        { id: 'practica', name: 'PRÁCTICA', horas: curso.horas_practica },
                        { id: 'laboratorio', name: 'LABORATORIO', horas: curso.horas_laboratorio || 0 }
                      ].filter(a => a.horas > 0);

                      const rowSpanCurso = 1 + actividades.reduce((acc, act) => {
                        const gruposAct = grupos.filter(g => g.curso_id === curso.id && g.tipo_actividad === act.id);
                        if (gruposAct.length === 0) return acc + 1;
                        return acc + gruposAct.reduce((gAcc, g) => {
                          const asigs = asignaciones.filter(a => a.grupo_id === g.id);
                          return gAcc + 1 + asigs.length + 1;
                        }, 0);
                      }, 0);

                      return (
                        <React.Fragment key={curso.id}>
                          {/* Course Header Row */}
                          <tr style={{ background: '#fff', borderTop: '2px solid #e2e8f0' }}>
                            <td rowSpan={rowSpanCurso} style={{ padding: '12px', verticalAlign: 'top', fontWeight: '600', color: '#3730a3', borderRight: '1px solid #f1f5f9' }}>
                              {toRoman(curso.ciclo_plan)}
                            </td>
                            <td rowSpan={rowSpanCurso} style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #f1f5f9', fontWeight: '600' }}>
                              {curso.codigo}
                            </td>
                            <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #f1f5f9', maxWidth: '250px' }}>
                              <div style={{ fontWeight: '700', color: '#1e293b', lineHeight: '1.3' }}>{curso.nombre}</div>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}></td>
                            <td style={{ padding: '8px 12px', textAlign: 'left' }}></td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>{curso.horas_teoria}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>{curso.horas_practica}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>{curso.horas_laboratorio || 0}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>-</td>
                          </tr>

                          {/* Activities & Group Rows */}
                          {actividades.map(act => {
                            const gruposAct = grupos.filter(g => g.curso_id === curso.id && g.tipo_actividad === act.id).sort((a, b) => a.numero_grupo - b.numero_grupo);
                            let rowSpanAct = 0;
                            if (gruposAct.length === 0) rowSpanAct = 1;
                            else {
                              rowSpanAct = gruposAct.reduce((acc, g) => {
                                const asigs = asignaciones.filter(a => a.grupo_id === g.id);
                                return acc + 1 + asigs.length + 1;
                              }, 0);
                            }

                            return (
                              <React.Fragment key={act.id}>
                                {gruposAct.length === 0 ? (
                                  <tr style={{ background: '#f8fafc' }}>
                                    <td style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #f1f5f9', background: '#f1f5f9' }}>
                                      <div style={{ fontWeight: '600', color: '#334155', marginBottom: '8px', textTransform: 'uppercase', fontSize: '12px' }}>{act.name}</div>
                                      <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', width: '100%', border: '1px dashed #cbd5e1', background: '#fff', color: '#475569' }} onClick={() => agregarGrupo(curso.id, act.id)}>
                                        + AGREGAR GRUPO
                                      </button>
                                    </td>
                                    <td colSpan={6} style={{ borderTop: '1px solid #f1f5f9' }}></td>
                                  </tr>
                                ) : (
                                  gruposAct.map((grupo, gIdx) => {
                                    const asigs = asignaciones.filter(a => a.grupo_id === grupo.id);
                                    const rowSpanGrupo = 1 + asigs.length + 1;
                                    const sumT = asigs.reduce((s, a) => s + (a.horas_teoria || 0), 0);
                                    const sumP = asigs.reduce((s, a) => s + (a.horas_practica || 0), 0);
                                    const sumL = asigs.reduce((s, a) => s + (a.horas_laboratorio || 0), 0);
                                    const sumC = asigs.reduce((s, a) => s + (a.horas_consejeria || 0), 0);

                                    return (
                                      <React.Fragment key={grupo.id}>
                                        <tr style={{ background: '#f8fafc' }}>
                                          {gIdx === 0 && (
                                            <td rowSpan={rowSpanAct} style={{ padding: '12px', verticalAlign: 'top', borderRight: '1px solid #f1f5f9', background: '#f1f5f9' }}>
                                              <div style={{ fontWeight: '600', color: '#334155', marginBottom: '8px', textTransform: 'uppercase', fontSize: '12px' }}>{act.name}</div>
                                              <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', width: '100%', border: '1px dashed #cbd5e1', background: '#fff', color: '#475569' }} onClick={() => agregarGrupo(curso.id, act.id)}>
                                                + AGREGAR GRUPO
                                              </button>
                                            </td>
                                          )}
                                          {/* Group Header */}
                                          <td rowSpan={rowSpanGrupo} style={{ padding: '12px', textAlign: 'center', fontWeight: '700', borderRight: '1px solid #f1f5f9', borderTop: '1px solid #f1f5f9', verticalAlign: 'top', position: 'relative' }}>
                                            G{grupo.numero_grupo}
                                            <button style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }} onClick={() => eliminarGrupo(grupo.id)} title="Eliminar Grupo">✖</button>
                                          </td>
                                          <td style={{ padding: '8px 12px', fontSize: '11px', color: '#94a3b8', fontWeight: '500', borderTop: '1px solid #f1f5f9' }}>
                                            COD. DOCENTE
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                                            {sumT}/{curso.horas_teoria}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                                            {sumP}/{curso.horas_practica}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                                            {sumL}/{curso.horas_laboratorio || 0}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                                            {sumC}/-
                                          </td>
                                        </tr>

                                        {/* Teachers */}
                                        {asigs.map(asig => {
                                          const carga = asig.docente_id && cargaDocenteMap[asig.docente_id] ? cargaDocenteMap[asig.docente_id] : null;
                                          const isExcedido = carga && carga.ocupada > carga.max;
                                          return (
                                            <tr key={asig.id} style={{ background: '#f8fafc' }}>
                                              <td style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                  <span style={{ fontSize: '11px', color: '#64748b', marginRight: '16px', display: 'inline-block', width: '30px', fontFamily: 'monospace' }}>{asig.docente_codigo || '0000'}</span>
                                                  <span style={{ fontWeight: '500', fontSize: '12px', color: '#1e293b' }}>{asig.docente_nombre}</span>
                                                  {carga && (
                                                    <span style={{ fontSize: '11px', marginLeft: '8px', color: isExcedido ? '#ef4444' : '#64748b', fontWeight: isExcedido ? '700' : '500', background: isExcedido ? '#fee2e2' : 'transparent', padding: isExcedido ? '2px 4px' : '0', borderRadius: '4px' }}>
                                                      ({carga.ocupada}/{carga.max})
                                                    </span>
                                                  )}
                                                </div>
                                                <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }} onClick={() => removeDocente(asig.id)} title="Eliminar docente">✖</button>
                                              </td>
                                              <td style={{ padding: '4px 8px' }}><input type="number" min="0" className="form-input" style={{ padding: '4px', textAlign: 'center', width: '100%', fontSize: '12px', border: '1px solid #e2e8f0', background: grupo.tipo_actividad !== 'teoria' ? '#e2e8f0' : '#fff' }} disabled={grupo.tipo_actividad !== 'teoria'} value={asig.horas_teoria} onChange={e => updateHoras(asig.id, 'horas_teoria', parseInt(e.target.value) || 0)} /></td>
                                              <td style={{ padding: '4px 8px' }}><input type="number" min="0" className="form-input" style={{ padding: '4px', textAlign: 'center', width: '100%', fontSize: '12px', border: '1px solid #e2e8f0', background: grupo.tipo_actividad !== 'practica' ? '#e2e8f0' : '#fff' }} disabled={grupo.tipo_actividad !== 'practica'} value={asig.horas_practica} onChange={e => updateHoras(asig.id, 'horas_practica', parseInt(e.target.value) || 0)} /></td>
                                              <td style={{ padding: '4px 8px' }}><input type="number" min="0" className="form-input" style={{ padding: '4px', textAlign: 'center', width: '100%', fontSize: '12px', border: '1px solid #e2e8f0', background: grupo.tipo_actividad !== 'laboratorio' ? '#e2e8f0' : '#fff' }} disabled={grupo.tipo_actividad !== 'laboratorio'} value={asig.horas_laboratorio} onChange={e => updateHoras(asig.id, 'horas_laboratorio', parseInt(e.target.value) || 0)} /></td>
                                              <td style={{ padding: '4px 8px' }}><input type="number" min="0" className="form-input" style={{ padding: '4px', textAlign: 'center', width: '100%', fontSize: '12px', border: '1px solid #e2e8f0' }} value={asig.horas_consejeria || 0} onChange={e => updateHoras(asig.id, 'horas_consejeria', parseInt(e.target.value) || 0)} /></td>
                                            </tr>
                                          );
                                        })}

                                        {/* Add Teacher Button Row */}
                                        <tr style={{ background: '#f8fafc' }}>
                                          <td style={{ padding: '8px 12px', position: 'relative' }}>
                                            {searchGrupoId === grupo.id ? (
                                              <div>
                                                <input
                                                  type="text"
                                                  autoFocus
                                                  className="form-input"
                                                  placeholder="🔍 Buscar nombre o DNI..."
                                                  value={docenteSearch}
                                                  onChange={e => setDocenteSearch(e.target.value)}
                                                  style={{ width: '100%', fontSize: '12px', padding: '6px' }}
                                                />
                                                {filteredDocentes.length > 0 && (
                                                  <div style={{ position: 'absolute', top: '100%', left: '12px', right: '12px', background: '#fff', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 20, maxHeight: '200px', overflowY: 'auto' }}>
                                                    {filteredDocentes.map(d => (
                                                      <div key={d.id} style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => addDocente(curso, grupo.id, d)}>
                                                        <div style={{ fontWeight: '600', fontSize: '12px', color: '#1e293b' }}>{d.nombre} {d.apellidos}</div>
                                                        <div style={{ fontSize: '10px', color: '#64748b' }}>COD: {d.usuario_id || '0000'} | DNI: {d.dni}</div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                <button style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px' }} onClick={() => setSearchGrupoId(null)}>Cancelar</button>
                                              </div>
                                            ) : (
                                              <button style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#475569', fontWeight: '600', fontSize: '10px', padding: '4px 8px', cursor: 'pointer', display: 'block', margin: '0 auto' }} onClick={() => { setSearchGrupoId(grupo.id); setDocenteSearch(''); }}>
                                                + AGREGAR DOCENTE
                                              </button>
                                            )}
                                          </td>
                                          <td colSpan={4}></td>
                                        </tr>
                                      </React.Fragment>
                                    );
                                  })
                                )}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
