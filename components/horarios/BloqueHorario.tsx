'use client';
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
}

function IconoTipoSesion({ tipo }: { tipo: string }) {
  const iconos: Record<string, { label: string; color: string }> = {
    teoria:      { label: 'T', color: '#1e40af' },
    practica:    { label: 'P', color: '#b45309' },
    laboratorio: { label: 'L', color: '#166534' },
    asesoria:    { label: 'C', color: '#7c2d12' }
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
        lineHeight: '1'
      }}
      title={tipo.toUpperCase()}
    >
      {info.label}
    </span>
  );
}

export default function BloqueHorario({ asignacion: c, compact = false, mapaColores }: BloqueHorarioProps) {
  const isAsesoria = c.tipo === 'asesoria';
  const cicloColor = colorCiclo(c.ciclo_plan);
  const tipo = c.tipo || 'teoria';
  const icon = TIPO_SESION_ICON[tipo] || '📘';
  const tipoLabel = TIPO_SESION_LABEL[tipo] || tipo;
  const ambLabel = tipoAmbienteLabel(isAsesoria ? 'asesoria' : (c.ambiente_tipo || 'aula'), c.ambiente_codigo);
  const continuo =
    c.bloque_total && c.bloque_total > 1
      ? ` · ${c.bloque_parte}/${c.bloque_total}`
      : '';
  const labTurno =
    tipo === 'laboratorio' && c.lab_turno
      ? ` (Grupo ${c.lab_turno})`
      : '';

  const color = mapaColores 
    ? obtenerColorCurso(mapaColores, c.ciclo_plan, c.curso_codigo, c.tipo)
    : { bg: isAsesoria ? '#f3f4f6' : cicloColor + '15', border: isAsesoria ? '#6b7280' : cicloColor, name: 'default' };

  const customStyle: React.CSSProperties = {
    backgroundColor: color.bg,
    borderLeft: `5px solid ${color.border}`,
  };

  if (color.patron === 'rayado') {
    customStyle.backgroundImage = 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.04) 4px, rgba(0,0,0,0.04) 8px)';
  }

  return (
    <div
      className={`bloque-horario${compact ? ' bloque-horario--compact' : ''}`}
      style={customStyle}
      title={[
        c.curso_nombre,
        `Sección G${c.numero_grupo}${labTurno}`,
        tipoLabel,
        ambLabel,
        formatDocente(c.docente_nombre),
        c.prioridad_usada ? `Prioridad P${c.prioridad_usada}` : '',
      ].filter(Boolean).join('\n')}
    >
      <div className="bloque-horario__titulo">
        {isAsesoria ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            ASESORÍA <IconoTipoSesion tipo="asesoria" />
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px' }}>
            <strong>{c.curso_codigo}</strong>
            {!compact && c.curso_nombre && (
              <span className="bloque-horario__nombre-curso"> — {c.curso_nombre}</span>
            )}
            <span className="bloque-horario__grupo"> · G{c.numero_grupo}{labTurno}</span>
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
          {formatDocente(c.docente_nombre)}
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
    </div>
  );
}
