import { useDraggable } from '@dnd-kit/core';
import BloqueHorario, { type BloqueHorarioProps } from './BloqueHorario';

interface DraggableBlockProps extends BloqueHorarioProps {
  movidoManualmente?: boolean;
  todosEnCelda?: BloqueHorarioProps['asignacion'][]; // todos los bloques visibles en la celda actual
  esParteBloqueActivo?: boolean;
  duracion?: number;
}

/**
 * Determina si un bloque está "bloqueado" y no puede moverse de forma individual.
 * Regla: si pertenece a un bloque continuo (misma sesión dividida en varias horas)
 * o si comparte grupo+curso+docente con otro bloque en la misma celda (mismo slot),
 * no se puede arrastrar individualmente para no romper la continuidad.
 */
function esBloqueado(asignacion: BloqueHorarioProps['asignacion']): boolean {
  // El usuario solicitó que ya no se bloquee el movimiento individual (ahora se mueven en bloque)
  return false;
}

export function DraggableBlock({ asignacion, compact, mapaColores, movidoManualmente, esParteBloqueActivo, duracion }: DraggableBlockProps) {
  const bloqueado = esBloqueado(asignacion);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asignacion.id,
    data: asignacion,
    disabled: bloqueado,
  });

  const isHidden = esParteBloqueActivo || isDragging;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isHidden ? 0.3 : 1, // Usar 0.3 para indicar el rastro origen
    zIndex: isDragging ? 999 : 1,
    cursor: bloqueado ? 'not-allowed' : 'grab',
    height: '100%'
  } : {
    opacity: isHidden ? 0.3 : 1,
    cursor: bloqueado ? 'not-allowed' : 'grab',
    height: '100%'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(bloqueado ? {} : listeners)}
      {...(bloqueado ? {} : attributes)}
      title={bloqueado ? 'Este bloque es parte de una sesión continua y no puede moverse individualmente' : undefined}
    >
      <BloqueHorario
        asignacion={asignacion}
        compact={compact}
        mapaColores={mapaColores}
        movidoManualmente={movidoManualmente}
        bloqueado={bloqueado}
        duracion={duracion}
      />
    </div>
  );
}
