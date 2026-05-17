'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import BloqueHorario from '@/components/horarios/BloqueHorario';
import LeyendaHorarios from '@/components/horarios/LeyendaHorarios';
import { DIAS_SEMANA, DIAS_LABEL } from '@/lib/horario-utils';
import { fetchProgramacionCursos } from '@/lib/fetch-programacion-cursos';

const DIAS = [...DIAS_SEMANA];

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
  const [vista, setVista] = useState<'ciclo' | 'docente' | 'aula'>('aula');
  const [aulaFiltro, setAulaFiltro] = useState<string>('');
  const [docenteFiltro, setDocenteFiltro] = useState<string>('');
  const [docentesConCarga, setDocentesConCarga] = useState<Set<string>>(new Set());
  const [diaMobile, setDiaMobile] = useState<string>('lunes');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

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

  function getCell(dia: string, slotId: string, asigArr: any[]) {
    return asigArr
      .filter(a => a.dia === dia && a.slot_id === slotId)
      .sort((a, b) => {
         if (a.condicion_orden !== b.condicion_orden) return (a.condicion_orden || 0) - (b.condicion_orden || 0);
         return (a.categoria_orden || 0) - (b.categoria_orden || 0);
      });
  }

  const asignacionesVisibles = useMemo(() => {
    if (docentesConCarga.size === 0) return asignaciones;
    return asignaciones.filter(
      a => a.tipo === 'asesoria' || !a.docente_id || docentesConCarga.has(a.docente_id)
    );
  }, [asignaciones, docentesConCarga]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos...</div>;
  if (!prog) return <div style={{ padding: '40px', textAlign: 'center' }}>Programación no encontrada</div>;

  const docentesUnicos = Array.from(
    new Map(
      asignacionesVisibles
        .filter(a => a.docente_id && docentesConCarga.has(a.docente_id))
        .map(a => [a.docente_id, a.docente_nombre])
    ).entries()
  ).map(([id, nombre]) => ({ id, nombre: nombre as string }));

  const asigFiltradas = vista === 'docente' && docenteFiltro
    ? asignacionesVisibles.filter(a => a.docente_id === docenteFiltro)
    : asignacionesVisibles;

  const ciclosLista = Array.from(
    new Set(asigFiltradas.map(a => a.ciclo_plan).filter((c): c is number => c != null && c > 0))
  ).sort((a, b) => a - b);

  const ambientesEnUso = Array.from(
    new Map(
      asigFiltradas
        .filter(a => a.ambiente_codigo && a.tipo !== 'asesoria')
        .map(a => [
          a.ambiente_id || a.ambiente_codigo,
          { id: a.ambiente_id, codigo: a.ambiente_codigo, nombre: a.ambiente_nombre, tipo: a.ambiente_tipo },
        ])
    ).values()
  ).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));

  const asesoriasAsig = asigFiltradas.filter(a => a.tipo === 'asesoria');

  const diasGrilla = isMobile ? [diaMobile] : [...DIAS];
  const compactBlocks = isMobile || (typeof window !== 'undefined' && window.innerWidth < 1200);

  function renderGrilla(
    titulo: string,
    asigGrilla: any[],
    key: string
  ) {
    if (asigGrilla.length === 0) return null;
    return (
      <div key={key} style={{ marginBottom: '40px' }}>
        <h4 style={{ fontSize: '15px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
          {titulo}
        </h4>
        <div className={`horario-grid horario-grid--responsive${isMobile ? ' horario-grid--mobile-one-day' : ''}`}>
          <div className="horario-header horario-header--show">Hora</div>
          {DIAS.map(d => (
            <div
              key={d}
              className={`horario-header${diasGrilla.includes(d) ? ' horario-header--show' : ''}`}
            >
              {DIAS_LABEL[d]}
            </div>
          ))}
          {slots.map((slot) => {
            const isLunch = slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00';
            return (
              <div key={slot.id} style={{ display: 'contents' }}>
                <div
                  className={`horario-time${isLunch || !isMobile ? ' horario-time--show' : ''}`}
                  style={isLunch ? { background: '#f1f5f9' } : {}}
                >
                  {slot.hora_inicio}<br />{slot.hora_fin}
                </div>
                {isLunch ? (
                  <div
                    className="horario-cell horario-cell--show horario-cell--lunch"
                    style={{ gridColumn: isMobile ? 'span 1' : `span ${DIAS.length}` }}
                  >
                    HORA LIBRE (REFRIGERIO)
                  </div>
                ) : (
                  DIAS.map(dia => {
                    const cells = getCell(dia, slot.id, asigGrilla);
                    return (
                      <div
                        key={`${dia}-${slot.id}`}
                        className={`horario-cell${diasGrilla.includes(dia) ? ' horario-cell--show' : ''}`}
                      >
                        {cells.map(c => (
                          <BloqueHorario key={c.id} asignacion={c} compact={compactBlocks} />
                        ))}
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
  }

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

      <LeyendaHorarios ciclos={ciclosLista.filter(c => c > 0)} />

      {asignacionesVisibles.length > 0 && (
        <div className="card programar-toolbar">
          <button className={vista === 'aula' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('aula')}>Por aula</button>
          <button className={vista === 'ciclo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('ciclo')}>Por ciclo</button>
          <button className={vista === 'docente' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setVista('docente'); if (!docenteFiltro && docentesUnicos[0]) setDocenteFiltro(docentesUnicos[0].id); }}>Por docente</button>
          {vista === 'aula' && ambientesEnUso.length > 0 && (
            <select className="form-input" style={{ maxWidth: 280 }} value={aulaFiltro} onChange={e => setAulaFiltro(e.target.value)}>
              <option value="">Todas las aulas</option>
              {ambientesEnUso.map(a => (
                <option key={a.id || a.codigo} value={a.id || a.codigo}>{a.codigo} — {a.nombre}</option>
              ))}
            </select>
          )}
          {vista === 'docente' && docentesUnicos.length > 0 && (
            <select className="form-input" style={{ maxWidth: 300 }} value={docenteFiltro} onChange={e => setDocenteFiltro(e.target.value)}>
              {docentesUnicos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          )}
        </div>
      )}

      {conflictos.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '16px', color: '#b91c1c', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>❌</span> ERROR: Conflicto de horario detectado ({conflictos.length})
          </h3>
          <div style={{ margin: 0, paddingLeft: '20px', color: '#475569', fontSize: '13px', whiteSpace: 'pre-line' }}>
            {conflictos.map((c: any, i: number) => (
              <div key={i} style={{ marginBottom: '16px', background:'#fef2f2', padding:'12px', borderRadius:'6px', border:'1px solid #fca5a5' }}>
                {typeof c === 'string' ? c : (c.descripcion || JSON.stringify(c))}
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

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: '0 0 16px' }}>
          Asignaciones Tentativas
        </h3>
        {docentesConCarga.size > 0 && (
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px' }}>
            Solo docentes con carga en esta programación ({docentesConCarga.size}).
          </p>
        )}

        <div className="programar-dia-tabs">
          {DIAS.map(d => (
            <button
              key={d}
              type="button"
              className={diaMobile === d ? 'active' : ''}
              onClick={() => setDiaMobile(d)}
            >
              {DIAS_LABEL[d]}
            </button>
          ))}
        </div>

        {asignacionesVisibles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <p style={{ margin: '0 0 16px' }}>No hay asignaciones generadas aún.</p>
            <button className="btn-primary" onClick={() => ejecutarMotor(false)} disabled={resolving || prog.fase !== 3}>
              ⚙️ Ejecutar Motor CSP
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>
              {vista === 'aula' && 'Una grilla por aula o laboratorio utilizado en esta programación.'}
              {vista === 'ciclo' && 'Por ciclo del plan de estudios (I, III, V…). Las asesorías se muestran aparte.'}
              {vista === 'docente' && 'Carga horaria del docente seleccionado (incluye asesoría si aplica).'}
            </p>
            {vista === 'aula' &&
              (aulaFiltro
                ? ambientesEnUso.filter(a => (a.id || a.codigo) === aulaFiltro)
                : ambientesEnUso
              ).map(amb =>
                renderGrilla(
                  `Aula / Lab: ${amb.codigo} — ${amb.nombre}`,
                  asigFiltradas.filter(
                    a => a.tipo !== 'asesoria' && (a.ambiente_id === amb.id || a.ambiente_codigo === amb.codigo)
                  ),
                  `amb-${amb.codigo}`
                )
              )}
            {vista === 'ciclo' &&
              ciclosLista.map(ciclo =>
                renderGrilla(
                  `Ciclo académico ${ciclo}`,
                  asigFiltradas.filter(a => a.ciclo_plan === ciclo && a.tipo !== 'asesoria'),
                  `ciclo-${ciclo}`
                )
              )}
            {vista === 'ciclo' && asesoriasAsig.length > 0 &&
              renderGrilla('Asesorías docentes', asesoriasAsig, 'asesorias')}
            {vista === 'docente' &&
              renderGrilla('Horario del docente', asigFiltradas, 'docente')}
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
