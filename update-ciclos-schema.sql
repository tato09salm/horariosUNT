-- Actualizar tabla de ciclos para soportar tipos de ciclo
-- Primero, agregar el tipo enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_ciclo') THEN
    CREATE TYPE tipo_ciclo AS ENUM ('regular', 'extraordinario');
  END IF;
END $$;

-- Agregar la columna tipo_ciclo a la tabla ciclos
ALTER TABLE ciclos 
ADD COLUMN IF NOT EXISTS tipo tipo_ciclo DEFAULT 'regular';

-- Modificar la restricción de semestre para permitir valores más flexibles
ALTER TABLE ciclos 
DROP CONSTRAINT IF EXISTS ciclos_semestre_check;

-- Crear una nueva restricción que valide semestre según el tipo de ciclo
ALTER TABLE ciclos 
ADD CONSTRAINT ciclos_semestre_check 
CHECK (
  (tipo = 'regular' AND semestre IN ('I', 'II')) OR
  (tipo = 'extraordinario' AND semestre IN ('EXT'))
);