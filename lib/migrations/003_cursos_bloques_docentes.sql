-- Cursos: bloques indivisibles vs laboratorios múltiples
ALTER TABLE cursos
  ADD COLUMN IF NOT EXISTS bloque_indivisible BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cantidad_labs INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS horas_laboratorio INTEGER DEFAULT 0;

-- Sincronizar horas de lab desde práctica del catálogo
UPDATE cursos
SET horas_laboratorio = horas_practica
WHERE horas_laboratorio = 0 AND horas_practica > 0;

-- Cursos con varias sesiones de lab independientes (divisibles)
UPDATE cursos
SET bloque_indivisible = false,
    cantidad_labs = GREATEST(2, LEAST(horas_laboratorio, 4))
WHERE horas_laboratorio >= 3;

-- Teoría suele ser bloque continuo
UPDATE cursos
SET bloque_indivisible = true
WHERE horas_teoria >= 2 AND horas_laboratorio <= 2;
