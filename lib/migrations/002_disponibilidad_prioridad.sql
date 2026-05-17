-- ========================================
-- MIGRACIÓN 002: Prioridad en disponibilidad docente
-- Ejecutar: psql -U postgres -d horariosUNT -f lib/migrations/002_disponibilidad_prioridad.sql
-- ========================================

ALTER TABLE disponibilidad_docente
  ADD COLUMN IF NOT EXISTS prioridad INTEGER CHECK (prioridad IN (1, 2));

COMMENT ON COLUMN disponibilidad_docente.prioridad IS
  '1 = alta (preferida), 2 = baja (aceptable). NULL o disponible=false = no disponible';
