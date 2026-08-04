'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  colorCiclo,
  TIPO_SESION_ICON,
  TIPO_SESION_LABEL,
  formatDocente,
  tipoAmbienteLabel,
} from '@/lib/horario-utils';
import { obtenerColorCurso, type ColorCurso } from '@/lib/colores-curso';

export interface BloqueHorarioProps {
  asignacion: {
    id: string;
    curso_codigo?: string;
    curso_nombre?: string;
    numero_grupo?: number | string;
    tipo?: string;
    ambiente_codigo?: string;
    ambiente_nombre?: string;
    ambiente_tipo?: string;
    docente_nombre?: string;
    ciclo_plan?: number;
    prioridad_usada?: number;
    bloque_continuo_id?: string | null;
    bloque_parte?: number | null;
    bloque_total?: number | null;
    lab_turno?: number | null;
    lab_turnos_total?: number | null;
  };
  compact?: boolean;
  mapaColores?: Map<string, ColorCurso>;
  movidoManualmente?: boolean;
  bloqueado?: boolean;
  duracion?: number;
  mini?: boolean;
}

function IconoTipoSesion({ tipo }: { tipo: string }) {
  const iconos: Record<string, { label: string; color: string }> = {
    teoria:      { label: 'T', color: '#1e40af' },
    practica:    { label: 'P', color: '#b45309' },
    laboratorio: { label: 'L', color: '#166534' },
    asesoria:    { label: 'C', color: '#7c2d12' },
    no_lectiva:  { label: 'NL', color: '#6366f1' },
    carga_adicional: { label: 'CAD', color: '#db2777' }
  };
  
  const info = iconos[tipo] || { label: 'T', color: '#1e40af' };
  
  return (
    <span 
      style={{
        background: info.color,
        color: 'white',
        padding: '2px 6px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: 'bold',
        marginLeft: '6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        lineHeight: '1',
        flexShrink: 0
      }}
      title={tipo.toUpperCase()}
    >
      {info.label}
    </span>
  );
}

export default function BloqueHorario({ asignacion: c, compact = false, mini = false, mapaColores, movidoManualmente = false, bloqueado = false, duracion = 1 }: BloqueHorarioProps) {
  const isAsesoria = c.tipo === 'asesoria';
  const cicloColor = colorCiclo(c.ciclo_plan);
  const tipo = c.tipo || 'teoria';
  const icon = tipo === 'no_lectiva' ? '💼' : (TIPO_SESION_ICON[tipo] || '📘');
  const tipoLabel = tipo === 'no_lectiva' ? 'No Lectiva' : (TIPO_SESION_LABEL[tipo] || tipo);
  const ambLabel = tipo === 'carga_adicional'
    ? (c.ambiente_nombre || 'OTROS')
    : tipoAmbienteLabel(isAsesoria ? 'asesoria' : (c.ambiente_tipo || 'aula'), c.ambiente_codigo);
  const continuo =
    duracion > 1
      ? ` · ${duracion}h`
      : c.bloque_total && c.bloque_total > 1
        ? ` · ${c.bloque_parte}/${c.bloque_total}`
        : '';
  const color = mapaColores 
    ? obtenerColorCurso(mapaColores, c.ciclo_plan, c.curso_codigo, c.tipo)
    : { 
        bg: isAsesoria ? '#f3f4f6' : (tipo === 'no_lectiva' ? 'rgba(99,102,241,0.1)' : (tipo === 'carga_adicional' ? '#FCE7F3' : cicloColor + '15')), 
        border: isAsesoria ? '#6b7280' : (tipo === 'no_lectiva' ? '#6366f1' : (tipo === 'carga_adicional' ? '#DB2777' : cicloColor)), 
        name: 'default' 
      };

  const customStyle: React.CSSProperties = {
    backgroundColor: color.bg,
    borderLeft: `5px solid ${color.border}`,
    position: 'relative',
    overflow: 'hidden',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: compact ? 'center' : 'space-between',
    minHeight: '44px'
  };

  if (color.patron === 'rayado') {
    customStyle.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.06) 4px, rgba(0,0,0,0.06) 8px)';
  }

  // Reservar espacio para el badge de ciclo (C1..C10) sin que tape el contenido
  if (c.ciclo_plan && !compact) {
    customStyle.paddingRight = '36px';
  }

  const numG = typeof c.numero_grupo === 'string' ? parseInt(c.numero_grupo, 10) : (c.numero_grupo || 1);
  const groupPillColors = ['#64748b', '#64748b', '#2563eb', '#d97706', '#059669', '#7c3aed']; // G1 uses default gray/slate, others get distinct colors
  const pillColor = groupPillColors[numG] || '#475569';

  // ── Tooltip/popover para tarjetas compactas (texto truncado) ────────────────
  const cardRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom'; width: number }>({ top: 0, left: 0, placement: 'bottom', width: 0 });
  const [ready, setReady] = useState(false);

  const tooltipVisible = compact && !!(hover || pinned) && !!anchorRect;

  const showTooltip = () => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setReady(false);
  };

  const clearHoverTimer = () => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
  };

  const hideTooltip = () => {
    clearHoverTimer();
    setHover(false);
    if (!pinned) {
      setAnchorRect(null);
      setReady(false);
    }
  };

  const togglePinned = () => {
    setPinned(prev => {
      const next = !prev;
      if (next) {
        clearHoverTimer();
        setHover(false);
        showTooltip();
      } else {
        setAnchorRect(null);
        setReady(false);
      }
      return next;
    });
  };

  // Posicionamiento inteligente tras medir el tooltip
  useEffect(() => {
    if (!anchorRect || !tooltipRef.current) return;
    const t = tooltipRef.current;
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 8;
    const spaceBelow = vh - (anchorRect.top + anchorRect.height);
    const spaceAbove = anchorRect.top;
    const placement: 'top' | 'bottom' = (spaceBelow >= spaceAbove && spaceBelow >= 40) ? 'bottom' : 'top';
    let top = placement === 'bottom'
      ? anchorRect.top + anchorRect.height + 8
      : anchorRect.top - th - 8;
    // Nunca dejar el tooltip fuera de la pantalla
    top = Math.max(M, Math.min(top, vh - th - M));
    let left = anchorRect.left + anchorRect.width / 2 - tw / 2;
    left = Math.max(M, Math.min(left, vw - tw - M));
    setPos({ top, left, placement, width: tw });
    setReady(true);
  }, [anchorRect, compact]);

  // Cerrar con un tap fuera de la tarjeta
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (cardRef.current && !cardRef.current.contains(t)) {
        setPinned(false);
        setAnchorRect(null);
        setReady(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [pinned]);

  // Ocultar al hacer scroll (el tooltip está en fixed y quedaría descolocado)
  useEffect(() => {
    if (!tooltipVisible) return;
    const onScroll = () => {
      setAnchorRect(null);
      setReady(false);
      setPinned(false);
      setHover(false);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [tooltipVisible]);

  const durLabel = duracion > 1
    ? `${duracion}H`
    : c.bloque_total && c.bloque_total > 1
      ? `${c.bloque_parte ?? 1}/${c.bloque_total}`
      : '1H';

  const tituloCodigo = isAsesoria
    ? 'ASESORÍA'
    : tipo === 'no_lectiva'
      ? (c.curso_nombre || 'NO LECTIVA')
      : tipo === 'carga_adicional'
        ? (c.curso_nombre || 'CARGA ADICIONAL')
        : (c.curso_codigo || c.curso_nombre || '');

  const arrowLeft = pos.width > 0 && anchorRect
    ? Math.max(14, Math.min((anchorRect.left + anchorRect.width / 2) - pos.left, pos.width - 14))
    : 14;

  return (
    <>
    <div
      ref={cardRef}
      className={`bloque-horario${compact ? ' bloque-horario--compact' : ''}${mini ? ' bloque-horario--mini' : ''}`}
      style={customStyle}
      onMouseEnter={compact ? () => {
        clearHoverTimer();
        hoverTimer.current = setTimeout(() => { setHover(true); showTooltip(); }, 160);
      } : undefined}
      onMouseLeave={compact ? hideTooltip : undefined}
      onClick={compact ? togglePinned : undefined}
    title={compact ? undefined : [
        c.curso_nombre,
        c.tipo !== 'no_lectiva' && c.tipo !== 'carga_adicional' ? `Sección G${c.numero_grupo}` : '',
        tipoLabel,
        ambLabel,
        formatDocente(c.docente_nombre),
        c.prioridad_usada ? `Prioridad P${c.prioridad_usada}` : '',
        movidoManualmente ? '✋ Movido manualmente' : '',
      ].filter(Boolean).join('\n')}
    >
      <div className="bloque-horario__titulo">
        {isAsesoria ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            ASESORÍA <IconoTipoSesion tipo="asesoria" />
          </span>
        ) : tipo === 'no_lectiva' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            <strong>{c.curso_nombre}</strong>
            <IconoTipoSesion tipo="no_lectiva" />
          </span>
        ) : tipo === 'carga_adicional' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            <strong>{c.curso_nombre}</strong>
            <IconoTipoSesion tipo="carga_adicional" />
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', minWidth: 0, maxWidth: '100%' }}>
            <strong>{c.curso_codigo}</strong>
            {!compact && c.curso_nombre && (
              <span className="bloque-horario__nombre-curso"> — {c.curso_nombre}</span>
            )}
            <span style={{
              background: numG > 1 ? pillColor : '#e2e8f0',
              color: numG > 1 ? 'white' : '#475569',
              padding: '1px 6px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 'bold',
              marginLeft: '2px',
              flexShrink: 0
            }}>
              G{c.numero_grupo}
            </span>
            <IconoTipoSesion tipo={tipo} />
          </span>
        )}
      </div>
      <div className="bloque-horario__meta">
        <span>{icon} {ambLabel}</span>
        <span className="bloque-horario__tipo">{tipoLabel}{continuo}</span>
      </div>
      {!compact && (
        <div className="bloque-horario__docente">
          <span className="bloque-horario__docente-nombre">{formatDocente(c.docente_nombre)}</span>
          {c.prioridad_usada ? (
            <span className={`bloque-horario__prio bloque-horario__prio--p${c.prioridad_usada}`}>
              {c.prioridad_usada === 1 ? '★ P1' : '○ P2'}
            </span>
          ) : null}
        </div>
      )}
      {c.ciclo_plan ? (
        <span className="bloque-horario__badge-ciclo" style={{ background: color.border, color: '#ffffff' }}>
          C{c.ciclo_plan}
        </span>
      ) : null}
      {/* Badge permanente de movimiento manual */}
      {movidoManualmente && (
        <span
          title="Este bloque fue reposicionado manualmente"
          style={{
            position: 'absolute',
            top: '3px',
            left: '6px',
            fontSize: '9px',
            fontWeight: '800',
            color: '#7c3aed',
            background: 'rgba(237,233,254,0.95)',
            padding: '1px 5px',
            borderRadius: '4px',
            letterSpacing: '0.3px',
            border: '1px solid rgba(124,58,237,0.3)',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          ✦ manual
        </span>
      )}
      {/* Badge de bloqueo: sesión continua multi-hora, no arrastrable individualmente */}
      {bloqueado && (
        <span
          title={`Bloque continuo (${c.bloque_parte ?? 1}/${c.bloque_total ?? 1}): no se puede mover individualmente`}
          style={{
            position: 'absolute',
            top: '3px',
            right: '6px',
            fontSize: '10px',
            color: '#64748b',
            background: 'rgba(241,245,249,0.95)',
            padding: '1px 4px',
            borderRadius: '4px',
            border: '1px solid rgba(100,116,139,0.25)',
            zIndex: 3,
            pointerEvents: 'none',
            lineHeight: 1.2,
          }}
        >
          🔒
        </span>
      )}
    </div>
    {tooltipVisible && typeof document !== 'undefined' && createPortal(
      <div
        ref={tooltipRef}
        className={`horario-tooltip horario-tooltip--${pos.placement}${ready ? ' horario-tooltip--show' : ''}`}
        style={{ top: pos.top, left: pos.left }}
        role="tooltip"
      >
        <span className="horario-tooltip__arrow" style={{ left: arrowLeft }} />
        <div className="horario-tooltip__titulo">
          <strong>{tituloCodigo}</strong>
          {c.curso_nombre && c.curso_nombre !== tituloCodigo && (
            <span> — {c.curso_nombre}</span>
          )}
        </div>
        <div className="horario-tooltip__badges">
          <span className="horario-tooltip__grupo" style={{ background: pillColor }}>G{c.numero_grupo ?? 1}</span>
          <IconoTipoSesion tipo={tipo} />
          <span className="horario-tooltip__tipo">{tipoLabel}</span>
        </div>
        <div className="horario-tooltip__fila">Aula: <strong>{ambLabel}</strong></div>
        <div className="horario-tooltip__fila">Duración: <strong>{durLabel}</strong></div>
        <div className="horario-tooltip__fila">Docente: {formatDocente(c.docente_nombre) || 'Sin docente'}</div>
        {c.prioridad_usada ? (
          <div className="horario-tooltip__fila">Periodo: <strong>{c.prioridad_usada === 1 ? '★ P1' : '○ P2'}</strong></div>
        ) : null}
      </div>,
      document.body
    )}
    </>
  );
}
