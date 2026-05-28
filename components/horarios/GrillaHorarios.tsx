'use client';

import { useState, useEffect, useMemo } from 'react';
import CeldaHorario from '@/components/horarios/CeldaHorario';
import LeyendaHorarios from '@/components/horarios/LeyendaHorarios';
import { DIAS_SEMANA, DIAS_LABEL } from '@/lib/horario-utils';
import { generarMapaColores } from '@/lib/colores-curso';
import { SelectorDocente } from '@/components/horarios/SelectorDocente';

const DIAS = [...DIAS_SEMANA];

interface GrillaHorariosProps {
  asignaciones: any[];
  slots: any[];
  docentesConCarga?: Set<string>;
}

function normalizarAsignacion(a: any) {
  const ambienteCodigo = a.ambiente_codigo || a.aula || '';
  const ambienteNombre = a.ambiente_nombre || a.aula_nombre || ambienteCodigo || '';
  const docenteNombre = a.docente_nombre || a.docente || '';
  const docenteId = a.docente_id || docenteNombre || null;

  return {
    ...a,
    docente_id: docenteId,
    docente_nombre: docenteNombre,
    ambiente_id: a.ambiente_id || ambienteCodigo || null,
    ambiente_codigo: ambienteCodigo,
    ambiente_nombre: ambienteNombre,
    ambiente_tipo: a.ambiente_tipo || a.tipo_ambiente || '',
  };
}

export default function GrillaHorarios({
  asignaciones,
  slots,
  docentesConCarga = new Set(),
}: GrillaHorariosProps) {
  const [vista, setVista] = useState<'aula' | 'general' | 'ciclo' | 'docente'>('aula');
  const [aulaFiltro, setAulaFiltro] = useState<string>('');
  const [docenteFiltro, setDocenteFiltro] = useState<string>('');
  const [diaMobile, setDiaMobile] = useState<string>('lunes');
  const [isMobile, setIsMobile] = useState(false);
  const [todosDocentes, setTodosDocentes] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/docentes?reporte=true')
      .then(res => res.json())
      .then(res => {
        if (res.data) {
          setTodosDocentes(res.data);
        }
      })
      .catch(err => console.error('Error loading teachers', err));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const asignacionesNormalizadas = useMemo(
    () => asignaciones.map(normalizarAsignacion),
    [asignaciones]
  );

  const asignacionesVisibles = useMemo(() => {
    if (docentesConCarga.size === 0) return asignacionesNormalizadas;
    return asignacionesNormalizadas.filter(
      a => a.tipo === 'asesoria' || !a.docente_id || docentesConCarga.has(a.docente_id)
    );
  }, [asignacionesNormalizadas, docentesConCarga]);

  const mapaColores = useMemo(() => {
    return generarMapaColores(asignacionesVisibles);
  }, [asignacionesVisibles]);

  const docentesUnicos = useMemo(() => {
    return Array.from(
      new Map(
        asignacionesVisibles
          .filter(a => a.docente_id && (docentesConCarga.size === 0 || docentesConCarga.has(a.docente_id)))
          .map(a => [a.docente_id, a.docente_nombre])
      ).entries()
    )
      .map(([id, nombre]) => ({ id, nombre: (nombre as string) || '' }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [asignacionesVisibles, docentesConCarga]);

  const horasAsignadasMap = useMemo(() => {
    const map = new Map<string, number>();
    asignacionesNormalizadas.forEach(a => {
      if (a.docente_id) {
        map.set(a.docente_id, (map.get(a.docente_id) || 0) + 1);
      }
    });
    return map;
  }, [asignacionesNormalizadas]);

  const docentesConHoras = useMemo(() => {
    const list = todosDocentes.length > 0
      ? todosDocentes
      : docentesUnicos.map(d => ({ id: d.id, nombre: d.nombre, apellidos: '' }));

    return list.map(d => ({
      id: d.id,
      nombre: d.nombre,
      apellidos: d.apellidos || '',
      dni: d.dni || '',
      categoria: d.categoria || '',
      condicion: d.condicion || '',
      horas_max_semana: d.horas_max_semana || 20,
      horas_asignadas: horasAsignadasMap.get(d.id) || 0,
    })).sort((a, b) => {
      const nameA = `${a.apellidos}, ${a.nombre}`.toLowerCase();
      const nameB = `${b.apellidos}, ${b.nombre}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [todosDocentes, docentesUnicos, horasAsignadasMap]);

  useEffect(() => {
    if (vista === 'docente' && !docenteFiltro && docentesUnicos.length > 0) {
      setDocenteFiltro(docentesUnicos[0].id);
    }
  }, [vista, docentesUnicos, docenteFiltro]);

  const asigFiltradas = useMemo(() => {
    if (vista === 'docente' && docenteFiltro) {
      return asignacionesVisibles.filter(a => a.docente_id === docenteFiltro);
    }
    return asignacionesVisibles;
  }, [asignacionesVisibles, vista, docenteFiltro]);

  const ciclosLista = useMemo(() => {
    return Array.from(
      new Set(asigFiltradas.map(a => a.ciclo_plan).filter((c): c is number => c != null && c > 0))
    ).sort((a, b) => a - b);
  }, [asigFiltradas]);

  const ambientesEnUso = useMemo(() => {
    return Array.from(
      new Map(
        asigFiltradas
          .filter(a => a.ambiente_codigo && a.tipo !== 'asesoria')
          .map(a => [
            a.ambiente_id || a.ambiente_codigo,
            { id: a.ambiente_id, codigo: a.ambiente_codigo, nombre: a.ambiente_nombre, tipo: a.ambiente_tipo },
          ])
      ).values()
    ).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [asigFiltradas]);

  const asesoriasAsig = useMemo(() => {
    return asigFiltradas.filter(a => a.tipo === 'asesoria');
  }, [asigFiltradas]);

  const diasGrilla = isMobile ? [diaMobile] : [...DIAS];
  const compactBlocks = isMobile || (typeof window !== 'undefined' && window.innerWidth < 1200);

  function getCell(dia: string, slotId: string, asigArr: any[]) {
    return asigArr
      .filter(a => a.dia === dia && a.slot_id === slotId)
      .sort((a, b) => {
        if (a.condicion_orden !== b.condicion_orden) return (a.condicion_orden || 0) - (b.condicion_orden || 0);
        return (a.categoria_orden || 0) - (b.categoria_orden || 0);
      });
  }

  function renderGrilla(titulo: string, asigGrilla: any[], key: string) {
    if (asigGrilla.length === 0) return null;

    return (
      <div key={key} style={{ marginBottom: '40px' }}>
        <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px', fontWeight: '600' }}>
          {titulo}
        </h4>
        <div
          className={`horario-grid horario-grid--responsive${isMobile ? ' horario-grid--mobile-one-day' : ''}`}
          style={{ gridTemplateColumns: `90px repeat(${DIAS.length}, 1fr)` }}
        >
          <div className="horario-header horario-header--show">Hora</div>
          {DIAS.map(d => (
            <div key={d} className={`horario-header${diasGrilla.includes(d) ? ' horario-header--show' : ''}`}>
              {DIAS_LABEL[d]}
            </div>
          ))}
          {slots.map(slot => {
            const isLunch = slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00';
            return (
              <div key={slot.id} style={{ display: 'contents' }}>
                <div
                  className={`horario-time${isLunch || !isMobile ? ' horario-time--show' : ''}${isLunch ? ' horario-time--lunch' : ''}`}
                >
                  {slot.hora_inicio.substring(0, 5)}<br />{slot.hora_fin.substring(0, 5)}
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
                        <CeldaHorario asignaciones={cells} compact={compactBlocks} mapaColores={mapaColores} />
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
    <div>
      <LeyendaHorarios mapaColores={mapaColores} asignaciones={asignacionesVisibles} />

      {asignacionesVisibles.length > 0 && (
        <div className="card programar-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '16px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <button className={vista === 'aula' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('aula')}>Por aula</button>
          <button className={vista === 'general' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('general')}>General</button>
          <button className={vista === 'ciclo' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('ciclo')}>Por ciclo</button>
          <button className={vista === 'docente' ? 'btn-primary' : 'btn-secondary'} onClick={() => { setVista('docente'); if (docentesUnicos[0]) setDocenteFiltro(docentesUnicos[0].id); }}>Por docente</button>

          {vista === 'aula' && ambientesEnUso.length > 0 && (
            <select className="form-input" style={{ maxWidth: 280 }} value={aulaFiltro} onChange={e => setAulaFiltro(e.target.value)}>
              <option value="">Todas las aulas</option>
              {ambientesEnUso.map(a => (
                <option key={a.id || a.codigo} value={a.id || a.codigo}>{a.codigo} — {a.nombre}</option>
              ))}
            </select>
          )}
          {vista === 'docente' && docentesConHoras.length > 0 && (
            <SelectorDocente
              docentes={docentesConHoras}
              docenteSeleccionadoId={docenteFiltro}
              onSeleccionar={setDocenteFiltro}
            />
          )}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto', padding: '24px', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div className="programar-dia-tabs">
          {DIAS.map(d => (
            <button key={d} type="button" className={diaMobile === d ? 'active' : ''} onClick={() => setDiaMobile(d)}>
              {DIAS_LABEL[d]}
            </button>
          ))}
        </div>

        {asignacionesVisibles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            No hay asignaciones en este horario.
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 20px', fontStyle: 'italic' }}>
              {vista === 'aula' && 'Una grilla por aula o laboratorio utilizado en este horario.'}
              {vista === 'general' && 'Todas las asignaciones por franja horaria. Labs en paralelo (distintos ambientes) aparecen en la misma celda.'}
              {vista === 'ciclo' && 'Por ciclo del plan de estudios (II, IV, VI…). Distintas secciones (G1, G2…) pueden coincidir en horario.'}
              {vista === 'docente' && 'Carga horaria del docente seleccionado (incluye asesorías si aplica).'}
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
            {vista === 'ciclo' && asesoriasAsig.length > 0 && renderGrilla('Asesorías docentes', asesoriasAsig, 'asesorias')}
            {vista === 'general' &&
              renderGrilla(
                'Vista general — paralelismo por franja',
                asigFiltradas.filter(a => a.tipo !== 'asesoria'),
                'general'
              )}
            {vista === 'docente' && renderGrilla('Horario del docente', asigFiltradas, 'docente')}
          </div>
        )}
      </div>
    </div>
  );
}
