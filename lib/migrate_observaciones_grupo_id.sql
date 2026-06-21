-- Migración: Agregar grupo_id a observaciones_asignaciones
-- Una observación por grupo (docente + ciclo + grupo), no por bloque de 1h

ALTER TABLE observaciones_asignaciones ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES grupos(id);

-- Índice único: solo 1 observación por (docente_id, ciclo_id, grupo_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_grupo_unique ON observaciones_asignaciones (docente_id, ciclo_id, grupo_id) WHERE grupo_id IS NOT NULL;

-- Backfill: asignar grupo_id a registros existentes
UPDATE observaciones_asignaciones oa
SET grupo_id = sub.grupo_id
FROM (
  SELECT DISTINCT oa.id AS obs_id, a.grupo_id
  FROM observaciones_asignaciones oa
  JOIN asignaciones a ON oa.docente_id = a.docente_id AND oa.ciclo_id = a.ciclo_id AND oa.tipo_sesion = a.tipo::text
  JOIN grupos g ON a.grupo_id = g.id
  WHERE oa.curso_id = g.curso_id AND oa.grupo_id IS NULL
) sub
WHERE oa.id = sub.obs_id;
