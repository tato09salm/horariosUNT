'use client';
import {
  colorCiclo,
  TIPO_SESION_ICON,
  TIPO_SESION_LABEL,
  formatDocente,
  tipoAmbienteLabel,
} from '@/lib/horario-utils';

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
}

export default function BloqueHorario({ asignacion: c, compact = false }: BloqueHorarioProps) {
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

  return (
    <div
      className={`bloque-horario bloque-horario--${tipo}${compact ? ' bloque-horario--compact' : ''}`}
      style={{ borderLeftColor: isAsesoria ? '#6366f1' : cicloColor }}
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
          <span>ASESORÍA</span>
        ) : (
          <span>
            <strong>{c.curso_codigo}</strong>
            {!compact && c.curso_nombre && (
              <span className="bloque-horario__nombre-curso"> — {c.curso_nombre}</span>
            )}
            <span className="bloque-horario__grupo"> · G{c.numero_grupo}{labTurno}</span>
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
        <span className="bloque-horario__badge-ciclo" style={{ background: cicloColor }}>
          C{c.ciclo_plan}
        </span>
      ) : null}
    </div>
  );
}
