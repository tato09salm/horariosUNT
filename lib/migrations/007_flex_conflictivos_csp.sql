-- Más disponibilidad para docentes con cursos conflictivos frecuentes (ciclos altos)
DO $$
DECLARE
  prog_id UUID;
  doc RECORD;
  n INTEGER;
BEGIN
  SELECT id INTO prog_id FROM programaciones WHERE nombre = 'HORARIO 2025-II' LIMIT 1;
  IF prog_id IS NULL THEN RETURN; END IF;

  FOR doc IN
    SELECT DISTINCT d.id, d.dni
    FROM docentes d
    JOIN programacion_cursos pc ON pc.docente_id = d.id AND pc.programacion_id = prog_id
    JOIN cursos cu ON cu.id = pc.curso_id
    WHERE cu.codigo IN ('IS-1002', 'IS-1004', 'IS-601', 'IS-402', 'IS-1006', 'IS-1003', 'IS-804')
  LOOP
    n := insert_disp_docente_rango(prog_id, doc.id, 'lunes', 8, 13, 1);
    n := n + insert_disp_docente_rango(prog_id, doc.id, 'martes', 8, 13, 1);
    n := n + insert_disp_docente_rango(prog_id, doc.id, 'miercoles', 8, 13, 1);
    n := n + insert_disp_docente_rango(prog_id, doc.id, 'jueves', 8, 13, 1);
    n := n + insert_disp_docente_rango(prog_id, doc.id, 'viernes', 8, 13, 1);
    n := n + insert_disp_docente_rango(prog_id, doc.id, 'sabado', 1, 5, 2);
    RAISE NOTICE 'Refuerzo disponibilidad docente % (% celdas extra)', doc.dni, n;
  END LOOP;
END $$;

-- Garantizar todos los laboratorios en todas las franjas útiles
DO $$
DECLARE
  amb RECORD;
  total INTEGER := 0;
  n INTEGER;
  dia_val dia_semana;
  dias dia_semana[] := ARRAY['lunes','martes','miercoles','jueves','viernes','sabado']::dia_semana[];
BEGIN
  FOR amb IN SELECT id FROM ambientes WHERE tipo = 'laboratorio' AND disponible = true LOOP
    FOREACH dia_val IN ARRAY dias LOOP
      n := insert_disp_ambiente_rango(amb.id, dia_val, 1, 14, 'disponible', NULL);
      total := total + n;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'Labs disponibilidad completa: % celdas', total;
END $$;
