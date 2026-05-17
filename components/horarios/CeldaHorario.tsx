'use client';

import BloqueHorario, { type BloqueHorarioProps } from '@/components/horarios/BloqueHorario';

type Asignacion = BloqueHorarioProps['asignacion'];

export default function CeldaHorario({
  asignaciones,
  compact = false,
}: {
  asignaciones: Asignacion[];
  compact?: boolean;
}) {
  if (!asignaciones.length) return null;

  if (asignaciones.length === 1) {
    return (
      <div className="horario-celda-contenido">
        <BloqueHorario asignacion={asignaciones[0]} compact={compact} />
      </div>
    );
  }

  return (
    <div className="horario-celda-contenido horario-celda-contenido--paralelo">
      <span className="horario-badge-paralelo" title="Varios cursos en la misma franja">
        {asignaciones.length} en paralelo
      </span>
      <div
        className="horario-grid-paralelo"
        style={{
          gridTemplateColumns: `repeat(${Math.min(asignaciones.length, 2)}, 1fr)`,
        }}
      >
        {asignaciones.map((a, idx) => (
          <BloqueHorario key={a.id || `${a.curso_codigo}-${idx}`} asignacion={a} compact />
        ))}
      </div>
    </div>
  );
}
