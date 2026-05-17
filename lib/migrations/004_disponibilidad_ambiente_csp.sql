-- Disponibilidad explícita de ambientes + vistas de pre-validación CSP

CREATE TABLE IF NOT EXISTS disponibilidad_ambiente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ambiente_id UUID NOT NULL REFERENCES ambientes(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots_tiempo(id),
  dia dia_semana NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible', 'mantenimiento', 'reservado', 'bloqueado')),
  motivo VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ambiente_id, slot_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_disp_ambiente_dia ON disponibilidad_ambiente(ambiente_id, dia);
CREATE INDEX IF NOT EXISTS idx_disp_ambiente_estado ON disponibilidad_ambiente(estado);

-- Rango de slots por orden (excluye refrigerio 13:00)
CREATE OR REPLACE FUNCTION insert_disp_docente_rango(
  p_programacion_id UUID,
  p_docente_id UUID,
  p_dia dia_semana,
  p_orden_ini INTEGER,
  p_orden_fin INTEGER,
  p_prioridad INTEGER
) RETURNS INTEGER AS $$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO disponibilidad_docente (programacion_id, docente_id, slot_id, dia, disponible, prioridad)
  SELECT p_programacion_id, p_docente_id, st.id, p_dia, true, p_prioridad
  FROM slots_tiempo st
  WHERE st.orden BETWEEN p_orden_ini AND p_orden_fin
    AND st.hora_inicio <> '13:00'::time
  ON CONFLICT (programacion_id, docente_id, slot_id, dia) DO UPDATE
    SET disponible = true, prioridad = EXCLUDED.prioridad, updated_at = NOW();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION insert_disp_ambiente_rango(
  p_ambiente_id UUID,
  p_dia dia_semana,
  p_orden_ini INTEGER,
  p_orden_fin INTEGER,
  p_estado VARCHAR DEFAULT 'disponible',
  p_motivo VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO disponibilidad_ambiente (ambiente_id, slot_id, dia, estado, motivo)
  SELECT p_ambiente_id, st.id, p_dia, p_estado, p_motivo
  FROM slots_tiempo st
  WHERE st.orden BETWEEN p_orden_ini AND p_orden_fin
    AND st.hora_inicio <> '13:00'::time
  ON CONFLICT (ambiente_id, slot_id, dia) DO UPDATE
    SET estado = EXCLUDED.estado, motivo = EXCLUDED.motivo;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Bloques contiguos por docente/día (para validación)
CREATE OR REPLACE VIEW v_docente_bloques_contiguos AS
WITH ordenado AS (
  SELECT
    dd.programacion_id,
    dd.docente_id,
    dd.dia,
    st.orden,
    dd.prioridad,
    LAG(st.orden) OVER (PARTITION BY dd.programacion_id, dd.docente_id, dd.dia ORDER BY st.orden) AS orden_prev
  FROM disponibilidad_docente dd
  JOIN slots_tiempo st ON st.id = dd.slot_id
  WHERE dd.disponible = true AND st.hora_inicio <> '13:00'::time
),
grupos AS (
  SELECT
    *,
    SUM(CASE WHEN orden_prev IS NULL OR orden = orden_prev + 1 THEN 0 ELSE 1 END)
      OVER (PARTITION BY programacion_id, docente_id, dia ORDER BY orden) AS grp
  FROM ordenado
)
SELECT
  programacion_id,
  docente_id,
  dia,
  grp,
  COUNT(*) AS horas_consecutivas,
  MIN(orden) AS orden_inicio,
  MAX(orden) AS orden_fin
FROM grupos
GROUP BY programacion_id, docente_id, dia, grp;

CREATE OR REPLACE VIEW v_docente_resumen_disponibilidad AS
SELECT
  dd.programacion_id,
  d.id AS docente_id,
  d.nombre || ' ' || d.apellidos AS docente_nombre,
  d.categoria,
  COUNT(dd.id) AS total_horas_disponibles,
  COUNT(DISTINCT dd.dia) AS dias_disponibles,
  COALESCE(MAX(bc.horas_consecutivas), 0) AS max_bloque_continuo,
  COUNT(*) FILTER (WHERE bc.horas_consecutivas >= 4) AS ventanas_4h,
  COUNT(*) FILTER (WHERE bc.horas_consecutivas >= 2) AS ventanas_2h
FROM docentes d
JOIN disponibilidad_docente dd ON dd.docente_id = d.id
LEFT JOIN v_docente_bloques_contiguos bc
  ON bc.docente_id = d.id AND bc.programacion_id = dd.programacion_id
WHERE d.activo = true
GROUP BY dd.programacion_id, d.id, d.nombre, d.apellidos, d.categoria;

-- v_pre_validacion_csp se define en 006_carga_curricular_2025ii.sql (requiere DROP si cambian columnas)
