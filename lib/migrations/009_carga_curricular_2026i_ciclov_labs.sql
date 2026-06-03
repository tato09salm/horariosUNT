-- Carga curricular 2026-I: Ciclo V - Añadir horas de laboratorio a IND-501 y CF-501 y grupos extra para IND-501
--
-- Objetivo:
--   - IND-501 (Investigación de Operaciones): 2 horas de lab, 2 turnos, 3 grupos
--   - CF-501 (Contabilidad Gerencial): 2 horas de lab, 2 turnos, 1 grupo
--

-- Actualizar el catálogo de cursos con horas de laboratorio
UPDATE cursos c SET
  horas_laboratorio = 2,
  cantidad_labs = 2,
  bloque_indivisible = true
WHERE c.codigo IN ('IND-501', 'CF-501');

-- Añadir 2 grupos extra para IND-501 en ciclo 2026-I (si no existen)
DO $$
DECLARE
    c_26_i UUID;
    cur_ind501 UUID;
BEGIN
    SELECT id INTO c_26_i FROM ciclos WHERE nombre = '2026-I';
    SELECT id INTO cur_ind501 FROM cursos WHERE codigo = 'IND-501';

    IF c_26_i IS NOT NULL AND cur_ind501 IS NOT NULL THEN
        INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
        (c_26_i, cur_ind501, 8, 30, 25),
        (c_26_i, cur_ind501, 9, 30, 25)
        ON CONFLICT (ciclo_id, curso_id, numero_grupo) DO NOTHING;

        RAISE NOTICE 'Se agregaron 2 grupos extra para IND-501 (si no existían)';
    END IF;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
  RAISE NOTICE 'Se actualizaron cursos IND-501 y CF-501 con horas de laboratorio y grupos para IND-501';
END $$;
