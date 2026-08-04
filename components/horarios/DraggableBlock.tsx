import { useDraggable } from '@dnd-kit/core';
import BloqueHorario, { type BloqueHorarioProps } from './BloqueHorario';

interface DraggableBlockProps extends BloqueHorarioProps {
  movidoManualmente?: boolean;
  todosEnCelda?: BloqueHorarioProps['asignacion'][]; // todos los bloques visibles en la celda actual
  esParteBloqueActivo?: boolean;
  duracion?: number;
  mini?: boolean;
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

export function DraggableBlock({ asignacion, compact, mini, mapaColores, movidoManualmente, esParteBloqueActivo, duracion }: DraggableBlockProps) {
  const bloqueado = esBloqueado(asignacion);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: asignacion.id,
    data: asignacion,
    disabled: bloqueado,
  });

  const isHidden = esParteBloqueActivo || isDragging;

  // width:100% + minWidth:0 impide que la tarjeta se desborde hacia la columna
  // del día siguiente (permite que el grid paralelo reparta el ancho en N columnas).
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isHidden ? 0.3 : 1, // Usar 0.3 para indicar el rastro origen
    zIndex: isDragging ? 999 : 1,
    cursor: bloqueado ? 'not-allowed' : 'grab',
    height: '100%',
    width: '100%',
    minWidth: 0,
  } : {
    opacity: isHidden ? 0.3 : 1,
    cursor: bloqueado ? 'not-allowed' : 'grab',
    height: '100%',
    width: '100%',
    minWidth: 0,
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
        mini={mini}
        mapaColores={mapaColores}
        movidoManualmente={movidoManualmente}
        bloqueado={bloqueado}
        duracion={duracion}
      />
    </div>
  );
}
