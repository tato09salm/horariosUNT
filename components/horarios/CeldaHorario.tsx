'use client';
import BloqueHorario, { type BloqueHorarioProps } from '@/components/horarios/BloqueHorario';
import { type ColorCurso } from '@/lib/colores-curso';

type Asignacion = BloqueHorarioProps['asignacion'];

export default function CeldaHorario({
  asignaciones,
  compact = false,
  mapaColores,
}: {
  asignaciones: Asignacion[];
  compact?: boolean;
  mapaColores?: Map<string, ColorCurso>;
}) {
  if (!asignaciones.length) return null;

  if (asignaciones.length === 1) {
    return (
      <div className="horario-celda-contenido">
        <BloqueHorario asignacion={asignaciones[0]} compact={compact} mapaColores={mapaColores} />
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
          <BloqueHorario key={a.id || `${a.curso_codigo}-${idx}`} asignacion={a} compact mapaColores={mapaColores} />
        ))}
      </div>
    </div>
  );
}
