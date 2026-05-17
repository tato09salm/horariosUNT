-- Fix: insertar ciclos (ON CONFLICT sin clave unica, usar INSERT directo)
INSERT INTO ciclos (nombre, año, semestre, fecha_inicio, fecha_fin, activo) VALUES
('2026-I', 2026, 'I', '2026-04-13', '2026-08-08', false),
('2025-II', 2025, 'II', '2025-09-01', '2025-12-20', true);
