-- ========================================
-- Migración: Agregar columna 'tipo' a tabla ciclos
-- Objetivo: Soporte para ciclos regulares y extraordinarios
-- ========================================

-- Paso 1: Crear el tipo ENUM (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_ciclo') THEN
    CREATE TYPE tipo_ciclo AS ENUM ('regular', 'extraordinario');
  END IF;
END $$;

-- Paso 2: Agregar la columna 'tipo' a la tabla ciclos
ALTER TABLE ciclos 
ADD COLUMN IF NOT EXISTS tipo tipo_ciclo DEFAULT 'regular';

-- Paso 3: Eliminar la antigua restricción de semestre (si existe)
ALTER TABLE ciclos 
DROP CONSTRAINT IF EXISTS ciclos_semestre_check;

-- Paso 4: Agregar nueva restricción que valide según el tipo de ciclo
ALTER TABLE ciclos 
ADD CONSTRAINT ciclos_semestre_check 
CHECK (
  (tipo = 'regular' AND semestre IN ('I', 'II')) OR
  (tipo = 'extraordinario' AND semestre IN ('EXT'))
);

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Migración completada exitosamente';
  RAISE NOTICE '- Tipo tipo_ciclo creado';
  RAISE NOTICE '- Columna tipo agregada a la tabla ciclos';
  RAISE NOTICE '- Restricción de semestre actualizada';
END $$;
