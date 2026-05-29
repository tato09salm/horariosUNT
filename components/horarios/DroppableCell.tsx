import { useDroppable } from '@dnd-kit/core';

interface DroppableCellProps {
  id: string;
  dia: string;
  slot_id: string;
  ambiente_id?: string;
  ambiente_codigo?: string;
  ambiente_nombre?: string;
  esOrigen?: boolean;
  esDestino?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function DroppableCell({
  id, dia, slot_id, ambiente_id, ambiente_codigo, ambiente_nombre,
  esOrigen, esDestino, className, children
}: DroppableCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    data: { dia, slot_id, ambiente_id, ambiente_codigo, ambiente_nombre }
  });

  let backgroundColor: string | undefined;
  let border: string | undefined;
  let boxShadow: string | undefined;
  let opacity: number | undefined;

  if (isOver) {
    // Activamente sobrevolando: verde vivo
    backgroundColor = 'rgba(34, 197, 94, 0.18)';
    border = '2px dashed #22c55e';
  } else if (esDestino) {
    // Celda destino del último movimiento: azul suave
    backgroundColor = 'rgba(59, 130, 246, 0.10)';
    border = '2px solid #3b82f6';
    boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
  } else if (esOrigen) {
    // Celda origen del último movimiento: rojo tenue + menor opacidad
    backgroundColor = 'rgba(239, 68, 68, 0.07)';
    border = '2px dashed rgba(239,68,68,0.4)';
    opacity = 0.75;
  }

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        backgroundColor,
        border,
        boxShadow,
        opacity,
        transition: 'background-color 0.3s, border 0.3s, box-shadow 0.3s, opacity 0.3s',
        position: 'relative',
      }}
    >
      {/* Badge de destino */}
      {esDestino && !isOver && (
        <span
          title="Celda destino del último movimiento"
          style={{
            position: 'absolute',
            top: '3px',
            right: '5px',
            fontSize: '9px',
            color: '#1d4ed8',
            fontWeight: '700',
            zIndex: 2,
            pointerEvents: 'none',
            background: 'rgba(219,234,254,0.92)',
            padding: '1px 5px',
            borderRadius: '4px',
            letterSpacing: '0.3px',
          }}
        >
          ↓ destino
        </span>
      )}
      {/* Badge de origen */}
      {esOrigen && !isOver && (
        <span
          title="Celda origen del último movimiento"
          style={{
            position: 'absolute',
            top: '3px',
            right: '5px',
            fontSize: '9px',
            color: '#b91c1c',
            fontWeight: '700',
            zIndex: 2,
            pointerEvents: 'none',
            background: 'rgba(254,226,226,0.92)',
            padding: '1px 5px',
            borderRadius: '4px',
            letterSpacing: '0.3px',
          }}
        >
          ↑ origen
        </span>
      )}
      {children}
    </div>
  );
}
