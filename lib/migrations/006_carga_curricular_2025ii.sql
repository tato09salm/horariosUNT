-- Carga curricular 2025-II (teoría, lab por turno, turnos) — sección A única
-- Fuente: _recursos/carga-curricular-2025-ii.csv

CREATE TEMP TABLE IF NOT EXISTS tmp_carga_25ii (
  dni VARCHAR(20) NOT NULL,
  codigo VARCHAR(20) NOT NULL,
  horas_teoria INTEGER NOT NULL DEFAULT 0,
  horas_lab_turno INTEGER NOT NULL DEFAULT 0,
  turnos_labs INTEGER NOT NULL DEFAULT 0
);

TRUNCATE tmp_carga_25ii;

INSERT INTO tmp_carga_25ii (dni, codigo, horas_teoria, horas_lab_turno, turnos_labs) VALUES
('39393939', 'IS-201', 2, 4, 3),
('40404040', 'SOC-201', 1, 0, 0),
('41414141', 'EDU-201', 2, 0, 0),
('42424242', 'FIL-201', 2, 0, 0),
('43434343', 'MAT-201', 2, 0, 0),
('44444445', 'FIS-201', 0, 2, 3),
('45454545', 'FIS-202', 2, 0, 0),
('46464646', 'IS-401', 1, 3, 2),
('47474747', 'IS-402', 1, 3, 1),
('48484848', 'IS-403', 1, 2, 3),
('49494949', 'IS-404', 2, 3, 3),
('50505050', 'IS-405', 1, 2, 2),
('50505050', 'IS-406', 2, 2, 2),
('51515151', 'FIS-401', 1, 2, 3),
('52525252', 'ECO-401', 2, 0, 0),
('53535353', 'IS-601', 1, 2, 2),
('48484848', 'IS-602', 1, 2, 3),
('53535353', 'IS-603', 2, 3, 3),
('49494949', 'IS-604', 1, 2, 3),
('54545454', 'CF-601', 1, 2, 1),
('55555556', 'IND-601', 1, 2, 1),
('57575757', 'AMB-601', 2, 0, 0),
('46464646', 'IS-801', 2, 2, 1),
('58585858', 'IS-802', 2, 3, 3),
('59595959', 'IS-803', 1, 3, 1),
('60606060', 'IS-804', 1, 2, 3),
('61616161', 'IS-805', 1, 2, 3),
('51515151', 'IS-806', 1, 3, 2),
('36363636', 'FIS-801', 1, 2, 3),
('62626262', 'DER-801', 2, 0, 0),
('59595959', 'IS-1001', 1, 2, 1),
('47474747', 'IS-1002', 1, 3, 2),
('58585858', 'IS-1003', 2, 2, 1),
('60606060', 'IS-1004', 1, 2, 2),
('61616161', 'IS-1005', 2, 0, 0),
('36363636', 'IS-1006', 2, 3, 3),
('63636363', 'FIS-1001', 2, 3, 3),
('55555556', 'IND-1001', 2, 0, 0);

-- Catálogo: horas por turno de lab + cantidad de turnos
UPDATE cursos c SET
  horas_teoria = t.horas_teoria,
  horas_practica = 0,
  horas_laboratorio = t.horas_lab_turno,
  cantidad_labs = CASE WHEN t.turnos_labs > 0 THEN t.turnos_labs ELSE 1 END,
  bloque_indivisible = true
FROM tmp_carga_25ii t
WHERE c.codigo = t.codigo;

-- Programación HORARIO 2025-II
DO $$
DECLARE
  c_25_ii UUID;
  admin_id UUID;
  prog_id UUID;
  n INTEGER := 0;
  r RECORD;
BEGIN
  SELECT id INTO c_25_ii FROM ciclos WHERE nombre = '2025-II';
  SELECT id INTO admin_id FROM usuarios WHERE email = 'admin@unt.edu.pe' LIMIT 1;

  IF c_25_ii IS NULL THEN
    RAISE NOTICE 'Ciclo 2025-II no encontrado; omitiendo programación.';
    RETURN;
  END IF;

  SELECT id INTO prog_id FROM programaciones WHERE ciclo_id = c_25_ii AND nombre = 'HORARIO 2025-II' LIMIT 1;

  IF prog_id IS NULL THEN
    INSERT INTO programaciones (ciclo_id, nombre, fase, estado, created_by)
    VALUES (c_25_ii, 'HORARIO 2025-II', 2, 'en_disponibilidad', admin_id)
    RETURNING id INTO prog_id;
  ELSE
    UPDATE programaciones SET fase = 2, estado = 'en_disponibilidad', updated_at = NOW()
    WHERE id = prog_id;
  END IF;

  DELETE FROM programacion_cursos WHERE programacion_id = prog_id;

  FOR r IN
    SELECT t.*, cu.id AS curso_id, g.id AS grupo_id, d.id AS docente_id
    FROM tmp_carga_25ii t
    JOIN cursos cu ON cu.codigo = t.codigo
    JOIN grupos g ON g.curso_id = cu.id AND g.ciclo_id = c_25_ii
    JOIN docentes d ON d.dni = t.dni AND d.activo = true
  LOOP
    INSERT INTO programacion_cursos (
      programacion_id, curso_id, grupo_id, docente_id,
      horas_teoria, horas_practica, horas_laboratorio, horas_consejeria, seccion
    ) VALUES (
      prog_id, r.curso_id, r.grupo_id, r.docente_id,
      r.horas_teoria, 0, r.horas_lab_turno, 1, 'A'
    );
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'HORARIO 2025-II: % filas de carga curricular (sección A)', n;
END $$;

-- Pre-validación: horas requeridas = teoría + práctica + (lab por turno × turnos) + asesoría
DROP VIEW IF EXISTS v_pre_validacion_csp CASCADE;

CREATE VIEW v_pre_validacion_csp AS
SELECT
  pc.programacion_id, d.id AS docente_id,
  d.nombre || ' ' || d.apellidos AS docente_nombre,
  SUM(pc.horas_teoria + pc.horas_practica
      + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs, 1), 1)) AS horas_cursos,
  SUM(pc.horas_teoria + pc.horas_practica
      + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs, 1), 1)) + 1 AS horas_requeridas,
  COALESCE(r.total_horas_disponibles, 0) AS horas_disponibles,
  COALESCE(r.max_bloque_continuo, 0) AS max_bloque_continuo,
  COALESCE(r.dias_disponibles, 0) AS dias_disponibles,
  MAX(GREATEST(pc.horas_teoria, pc.horas_practica, pc.horas_laboratorio)) AS max_bloque_curso,
  CASE
    WHEN COALESCE(r.total_horas_disponibles, 0) <
      SUM(pc.horas_teoria + pc.horas_practica
          + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs, 1), 1)) + 1
      THEN 'horas_insuficientes'
    WHEN COALESCE(r.max_bloque_continuo, 0) < MAX(GREATEST(pc.horas_teoria, pc.horas_practica))
      THEN 'sin_bloque_continuo'
    WHEN COALESCE(r.dias_disponibles, 0) < 3 THEN 'pocos_dias'
    ELSE 'ok'
  END AS estado,
  CASE
    WHEN COALESCE(r.total_horas_disponibles, 0) <
      SUM(pc.horas_teoria + pc.horas_practica
          + pc.horas_laboratorio * GREATEST(COALESCE(cu.cantidad_labs, 1), 1)) + 1
      THEN 'Ampliar disponibilidad docente'
    WHEN COALESCE(r.max_bloque_continuo, 0) < MAX(GREATEST(pc.horas_teoria, pc.horas_practica))
      THEN 'Marcar bloques continuos para teoría (lab no requiere contigüidad)'
  END AS mensaje
FROM programacion_cursos pc
JOIN docentes d ON d.id = pc.docente_id
JOIN cursos cu ON cu.id = pc.curso_id
LEFT JOIN v_docente_resumen_disponibilidad r
  ON r.docente_id = d.id AND r.programacion_id = pc.programacion_id
WHERE pc.docente_id IS NOT NULL
GROUP BY pc.programacion_id, d.id, d.nombre, d.apellidos,
         r.total_horas_disponibles, r.max_bloque_continuo, r.dias_disponibles;

-- Laboratorios: siempre disponibles (sin mantenimiento programado)
UPDATE disponibilidad_ambiente da SET estado = 'disponible', motivo = NULL
FROM ambientes a
WHERE da.ambiente_id = a.id AND a.tipo = 'laboratorio' AND da.estado <> 'disponible';

-- Disponibilidad docente más flexible (90% con ventanas amplias)
CREATE OR REPLACE FUNCTION poblar_disponibilidad_programacion(p_programacion_id UUID)
RETURNS INTEGER AS $$
DECLARE
    doc RECORD;
    perfil INTEGER;
    insertados INTEGER := 0;
    n INTEGER;
    horas_req INTEGER;
    horas_disp INTEGER;
BEGIN
    DELETE FROM disponibilidad_docente WHERE programacion_id = p_programacion_id;

    FOR doc IN SELECT id, dni FROM docentes WHERE activo = true LOOP
        perfil := abs(hashtext(COALESCE(doc.dni, doc.id::text))) % 3;

        IF perfil = 0 THEN
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 8, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 8, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 8, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 8, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 8, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    9, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    9, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   9, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 6, 2);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    7, 11, 2);

        ELSIF perfil = 1 THEN
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 6, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 6, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 6, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 6, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 6, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     8, 13, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 8, 13, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   8, 13, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 5, 2);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    6, 10, 2);

        ELSE
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 5, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 5, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 5, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 5, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 5, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    8, 13, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    8, 13, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 5, 2);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    6, 9, 2);
        END IF;
    END LOOP;

    -- GARANTÍA: docentes con carga asignada tienen mínimo 20h
    FOR doc IN
        SELECT d.id,
               GREATEST(COALESCE(SUM(pc.horas_teoria + pc.horas_practica + pc.horas_laboratorio), 0) + 2, 20) AS requeridas
        FROM docentes d
        LEFT JOIN programacion_cursos pc
          ON pc.docente_id = d.id AND pc.programacion_id = p_programacion_id
        WHERE d.activo = true
        GROUP BY d.id
        HAVING COALESCE(SUM(pc.horas_teoria + pc.horas_practica + pc.horas_laboratorio), 0) > 0
    LOOP
        SELECT COUNT(*) INTO horas_disp
        FROM disponibilidad_docente
        WHERE programacion_id = p_programacion_id AND docente_id = doc.id;

        IF horas_disp < 20 THEN
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 14, 1);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 8, 2);
        END IF;

        horas_req := doc.requeridas;
        SELECT COUNT(*) INTO horas_disp
        FROM disponibilidad_docente
        WHERE programacion_id = p_programacion_id AND docente_id = doc.id;

        IF horas_disp < horas_req THEN
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     9, 14, 2);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 9, 14, 2);
            PERFORM insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 14, 2);
        END IF;

        insertados := insertados + 1;
    END LOOP;

    RETURN insertados;
END;
$$ LANGUAGE plpgsql;
