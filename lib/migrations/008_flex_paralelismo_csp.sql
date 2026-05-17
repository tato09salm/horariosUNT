-- Flexibilidad 90/5/5 + refuerzo docentes con varios cursos + labs completos

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

-- Regenerar disponibilidad en programaciones activas
DO $$
DECLARE
    prog RECORD;
    n INTEGER;
BEGIN
    FOR prog IN SELECT id, nombre FROM programaciones ORDER BY nombre LOOP
        n := poblar_disponibilidad_programacion(prog.id);
        RAISE NOTICE 'Disponibilidad regenerada: % (% celdas)', prog.nombre, n;
    END LOOP;
END $$;
