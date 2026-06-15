'use client';

import { useState, useEffect, useMemo } from 'react';
import CeldaHorario from '@/components/horarios/CeldaHorario';
import LeyendaHorarios from '@/components/horarios/LeyendaHorarios';
import { DroppableCell } from '@/components/horarios/DroppableCell';
import { DIAS_SEMANA, DIAS_LABEL } from '@/lib/horario-utils';
import { generarMapaColores } from '@/lib/colores-curso';
import { SelectorDocente } from '@/components/horarios/SelectorDocente';

const DIAS = [...DIAS_SEMANA, 'sabado'];

interface GrillaHorariosProps {
  asignaciones: any[];
  slots: any[];
  docentesConCarga?: Set<string>;
  ultimoMovimiento?: { origen: any; destino: any } | null;
  bloquesMovidos?: Set<string>;
  activeBlockIds?: Set<string>;
  restringidosConfig?: Record<string, string>;
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
  ultimoMovimiento = null,
  bloquesMovidos = new Set(),
  activeBlockIds = new Set(),
  restringidosConfig,
}: GrillaHorariosProps) {
  const [vista, setVista] = useState<'aula' | 'general' | 'ciclo' | 'docente'>('general');
  const [aulaFiltro, setAulaFiltro] = useState<string>('');
  const [docenteFiltro, setDocenteFiltro] = useState<string>('');
  const [diaMobile, setDiaMobile] = useState<string>('lunes');
  const [isMobile, setIsMobile] = useState(false);
  const [todosDocentes, setTodosDocentes] = useState<any[]>([]);
  const [restringidos, setRestringidos] = useState<Record<string, string>>({});
  const [loadedRestringidos, setLoadedRestringidos] = useState(false);

  useEffect(() => {
    if (restringidosConfig) {
      setRestringidos(restringidosConfig);
      setLoadedRestringidos(true);
      return;
    }
    fetch('/api/configuracion?clave=HORARIOS_RESTRINGIDOS')
      .then(r => r.json())
      .then(res => {
        let restDict: Record<string, string> = {};
        if (res.data && res.data.valor) {
          try {
            const parsed = JSON.parse(res.data.valor);
            if (Array.isArray(parsed)) {
              parsed.forEach(id => {
                restDict[id] = 'HORA LIBRE (REFRIGERIO)';
              });
            } else if (parsed && typeof parsed === 'object') {
              restDict = parsed;
            }
          } catch(e) {}
        } else {
          const foodSlot = slots.find((s: any) => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
          if (foodSlot) {
            restDict[foodSlot.id] = 'HORA LIBRE (REFRIGERIO)';
          }
        }
        setRestringidos(restDict);
        setLoadedRestringidos(true);
      })
      .catch(() => {
        let restDict: Record<string, string> = {};
        const foodSlot = slots.find((s: any) => s.hora_inicio === '13:00' || s.hora_inicio === '13:00:00');
        if (foodSlot) {
          restDict[foodSlot.id] = 'HORA LIBRE (REFRIGERIO)';
        }
        setRestringidos(restDict);
        setLoadedRestringidos(true);
      });
  }, [slots, restringidosConfig]);

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

  const asesoriasAsig: any[] = []; // asesoría removed from CSP

  const diasVisibles = [...DIAS]; // always show Mon–Sat (Sáb 7–13 emergencia)
  useEffect(() => {
    if (!diasVisibles.includes(diaMobile)) setDiaMobile('lunes');
  }, [diasVisibles, diaMobile]);
  const diasGrilla = isMobile ? [diaMobile] : diasVisibles;
  const compactBlocks = isMobile || (typeof window !== 'undefined' && window.innerWidth < 1200);

  function getCell(dia: string, slotId: string, asigArr: any[]) {
    return asigArr
      .filter(a => a.dia === dia && a.slot_id === slotId)
      .sort((a, b) => {
        // Nombrados (0) first, then contratados (1)
        if ((a.condicion_orden ?? 1) !== (b.condicion_orden ?? 1))
          return (a.condicion_orden ?? 1) - (b.condicion_orden ?? 1);
        // Within same condicion: principal→asociado→auxiliar→jefe_practica
        if ((a.categoria_orden ?? 4) !== (b.categoria_orden ?? 4))
          return (a.categoria_orden ?? 4) - (b.categoria_orden ?? 4);
        // Within same level: seniority (fecha_ingreso)
        return (a.fecha_ingreso || '') < (b.fecha_ingreso || '') ? -1 : 1;
      });
  }

  function renderGrilla(titulo: string, asigGrilla: any[], key: string, contextData: any = {}) {
    if (asigGrilla.length === 0 && Object.keys(contextData).length === 0) return null;

    // ── Precalculo de bloques contiguos del mismo curso/grupo/tipo/aula/docente en el mismo día ──
    const groupsMap = new Map<string, any[]>();
    asigGrilla.forEach(a => {
      const slotIdx = slots.findIndex(s => s.id === a.slot_id);
      if (slotIdx === -1) return;
      const grpKey = `${a.dia}_${a.curso_codigo}_${a.numero_grupo}_${a.tipo}_${a.ambiente_codigo || a.ambiente_id || ''}_${a.docente_id || ''}`;
      if (!groupsMap.has(grpKey)) {
        groupsMap.set(grpKey, []);
      }
      groupsMap.get(grpKey)!.push({ ...a, slotIdx });
    });

    const blocksList: any[][] = [];
    groupsMap.forEach(items => {
      items.sort((a, b) => a.slotIdx - b.slotIdx);
      let currentBlock: any[] = [];
      items.forEach((item, idx) => {
        if (idx === 0) {
          currentBlock = [item];
        } else {
          const prevItem = currentBlock[currentBlock.length - 1];
          if (item.slotIdx === prevItem.slotIdx + 1) {
            currentBlock.push(item);
          } else {
            blocksList.push(currentBlock);
            currentBlock = [item];
          }
        }
      });
      if (currentBlock.length > 0) {
        blocksList.push(currentBlock);
      }
    });

    const blockStartMap = new Map<string, { block: any[], duration: number }>();
    const hiddenCellsSet = new Set<string>();

    blocksList.forEach(block => {
      if (block.length <= 1) return;
      const startItem = block[0];
      const startIdx = startItem.slotIdx;
      const dia = startItem.dia;

      // Validar si podemos expandir (cero colisiones con otras asignaciones de inicio en los slots siguientes)
      let canSpan = true;
      for (let i = 1; i < block.length; i++) {
        const nextSlot = slots[startIdx + i];
        if (!nextSlot) {
          canSpan = false;
          break;
        }

        // Buscar otras asignaciones en el mismo día/slot que no sean de este bloque
        const otherAsigs = asigGrilla.filter(a => 
          a.dia === dia && 
          a.slot_id === nextSlot.id && 
          !block.some(b => b.id === a.id)
        );

        if (otherAsigs.length > 0) {
          canSpan = false;
          break;
        }
      }

      if (canSpan) {
        blockStartMap.set(`${dia}_${startItem.slot_id}`, { block, duration: block.length });
        for (let i = 1; i < block.length; i++) {
          hiddenCellsSet.add(`${block[i].dia}_${block[i].slot_id}`);
        }
      }
    });

    return (
      <div key={key} style={{ marginBottom: '40px' }}>
        <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px', fontWeight: '600' }}>
          {titulo}
        </h4>
        <div
          className={`horario-grid horario-grid--responsive${isMobile ? ' horario-grid--mobile-one-day' : ''}`}
          style={{ gridTemplateColumns: `90px repeat(${diasVisibles.length}, 1fr)` }}
        >
          <div className="horario-header horario-header--show">Hora</div>
          {diasVisibles.map(d => (
            <div key={d} className={`horario-header${diasGrilla.includes(d) ? ' horario-header--show' : ''}`}>
              {DIAS_LABEL[d]}
            </div>
          ))}
          {slots.map((slot, sIdx) => {
            const isLunch = loadedRestringidos ? (slot.id in restringidos) : (slot.hora_inicio === '13:00' || slot.hora_inicio === '13:00:00');
            const lunchMsg = loadedRestringidos ? (restringidos[slot.id] || 'HORA LIBRE (REFRIGERIO)') : 'HORA LIBRE (REFRIGERIO)';
            return (
              <div key={slot.id} style={{ display: 'contents' }}>
                <div
                  className={`horario-time${isLunch || !isMobile ? ' horario-time--show' : ''}${isLunch ? ' horario-time--lunch' : ''}`}
                  style={{ gridColumn: 1 }}
                >
                  {slot.hora_inicio.substring(0, 5)}<br />{slot.hora_fin.substring(0, 5)}
                </div>
                {isLunch ? (
                  <div
                    className="horario-cell horario-cell--show horario-cell--lunch"
                    style={{ gridColumn: isMobile ? '2' : `2 / span ${diasVisibles.length}` }}
                  >
                    {lunchMsg}
                  </div>
                ) : (
                  diasVisibles.map(dia => {
                    const cellKey = `${dia}_${slot.id}`;
                    if (hiddenCellsSet.has(cellKey)) {
                      return null; // Omitir renderizado
                    }

                    const hasStartBlock = blockStartMap.get(cellKey);
                    const duration = hasStartBlock ? hasStartBlock.duration : 1;
                    const cells = getCell(dia, slot.id, asigGrilla);
                    const dropId = `${key}-${dia}-${slot.id}`;

                    const esOrigen = ultimoMovimiento &&
                      ultimoMovimiento.origen.dia === dia &&
                      ultimoMovimiento.origen.slot_id === slot.id &&
                      (!contextData.ambiente_id || ultimoMovimiento.origen.ambiente_id === contextData.ambiente_id);
                    const esDestino = ultimoMovimiento &&
                      ultimoMovimiento.destino.dia === dia &&
                      ultimoMovimiento.destino.slot_id === slot.id &&
                      (!contextData.ambiente_id || ultimoMovimiento.destino.ambiente_id === contextData.ambiente_id);

                    const cellStyle: React.CSSProperties = {};
                    if (duration > 1) {
                      cellStyle.gridRow = `span ${duration}`;
                    }
                    if (!isMobile) {
                      const dayIndex = diasVisibles.indexOf(dia);
                      cellStyle.gridColumn = dayIndex + 2;
                    } else {
                      cellStyle.gridColumn = 2;
                    }

                    return (
                      <DroppableCell
                        key={dropId}
                        id={dropId}
                        dia={dia}
                        slot_id={slot.id}
                        ambiente_id={contextData.ambiente_id}
                        ambiente_codigo={contextData.ambiente_codigo}
                        ambiente_nombre={contextData.ambiente_nombre}
                        esOrigen={!!esOrigen}
                        esDestino={!!esDestino}
                        className={`horario-cell${diasGrilla.includes(dia) ? ' horario-cell--show' : ''}`}
                        style={cellStyle}
                      >
                        <CeldaHorario
                          asignaciones={cells}
                          compact={compactBlocks}
                          mapaColores={mapaColores}
                          bloquesMovidos={bloquesMovidos}
                          activeBlockIds={activeBlockIds}
                          duracion={duration}
                        />
                      </DroppableCell>
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
          <button className={vista === 'general' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('general')}>General</button>
          <button className={vista === 'aula' ? 'btn-primary' : 'btn-secondary'} onClick={() => setVista('aula')}>Por aula</button>
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
          {diasVisibles.map(d => (
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
                  `amb-${amb.id || amb.codigo}`,
                  { ambiente_id: amb.id || amb.codigo, ambiente_codigo: amb.codigo, ambiente_nombre: amb.nombre }
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
