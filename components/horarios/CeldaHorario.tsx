'use client';
import BloqueHorario, { type BloqueHorarioProps } from '@/components/horarios/BloqueHorario';
import { DraggableBlock } from '@/components/horarios/DraggableBlock';
import { type ColorCurso } from '@/lib/colores-curso';

type Asignacion = BloqueHorarioProps['asignacion'];

export default function CeldaHorario({
  asignaciones,
  compact = false,
  mapaColores,
  bloquesMovidos,
  activeBlockIds,
}: {
  asignaciones: Asignacion[];
  compact?: boolean;
  mapaColores?: Map<string, ColorCurso>;
  bloquesMovidos?: Set<string>;
  activeBlockIds?: Set<string>;
}) {
  if (!asignaciones.length) return null;

  if (asignaciones.length === 1) {
    const movido = bloquesMovidos?.has(asignaciones[0].id) ?? false;
    return (
      <div className="horario-celda-contenido">
        <DraggableBlock
          asignacion={asignaciones[0]}
          compact={compact}
          mapaColores={mapaColores}
          movidoManualmente={movido}
          esParteBloqueActivo={activeBlockIds?.has(asignaciones[0].id) ?? false}
        />
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
        {asignaciones.map((a, idx) => {
          const movido = bloquesMovidos?.has(a.id) ?? false;
          return (
            <DraggableBlock
              key={a.id || `${a.curso_codigo}-${idx}`}
              asignacion={a}
              compact
              mapaColores={mapaColores}
              movidoManualmente={movido}
              esParteBloqueActivo={activeBlockIds?.has(a.id) ?? false}
            />
          );
        })}
      </div>
    </div>
  );
}
