-- Seeder 2026-I para Carga Horaria
-- ====================================

DO $$
DECLARE
  v_ciclo_id UUID;
  v_curso_id UUID;
  v_ch_id UUID;
BEGIN

  -- Asegurar ciclo 2026-I
  INSERT INTO ciclos (nombre, año, semestre, activo)
  SELECT '2026-I', 2026, 1, true
  WHERE NOT EXISTS (SELECT 1 FROM ciclos WHERE nombre = '2026-I');

  SELECT id INTO v_ciclo_id FROM ciclos WHERE nombre = '2026-I';

  -- Docente DNI 22222222
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '22222222', 'Docente1', 'Apellidos', 'docente22222222@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '22222222');

  -- Docente DNI 11111111
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '11111111', 'Docente2', 'Apellidos', 'docente11111111@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '11111111');

  -- Docente DNI 33333333
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '33333333', 'Docente3', 'Apellidos', 'docente33333333@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '33333333');

  -- Docente DNI 55555555
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '55555555', 'Docente4', 'Apellidos', 'docente55555555@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '55555555');

  -- Docente DNI 66666666
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '66666666', 'Docente5', 'Apellidos', 'docente66666666@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '66666666');

  -- Docente DNI 44444444
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '44444444', 'Docente6', 'Apellidos', 'docente44444444@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '44444444');

  -- Docente DNI 77777777
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '77777777', 'Docente7', 'Apellidos', 'docente77777777@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '77777777');

  -- Docente DNI 99999999
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '99999999', 'Docente8', 'Apellidos', 'docente99999999@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '99999999');

  -- Docente DNI 88888888
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '88888888', 'Docente9', 'Apellidos', 'docente88888888@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '88888888');

  -- Docente DNI 70707070
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '70707070', 'Docente10', 'Apellidos', 'docente70707070@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '70707070');

  -- Docente DNI 70808080
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '70808080', 'Docente11', 'Apellidos', 'docente70808080@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '70808080');

  -- Docente DNI 70909090
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '70909090', 'Docente12', 'Apellidos', 'docente70909090@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '70909090');

  -- Docente DNI 21212121
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '21212121', 'Docente13', 'Apellidos', 'docente21212121@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '21212121');

  -- Docente DNI 20202020
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '20202020', 'Docente14', 'Apellidos', 'docente20202020@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '20202020');

  -- Docente DNI 22222223
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '22222223', 'Docente15', 'Apellidos', 'docente22222223@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '22222223');

  -- Docente DNI 27272727
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '27272727', 'Docente16', 'Apellidos', 'docente27272727@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '27272727');

  -- Docente DNI 25252525
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '25252525', 'Docente17', 'Apellidos', 'docente25252525@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '25252525');

  -- Docente DNI 24242424
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '24242424', 'Docente18', 'Apellidos', 'docente24242424@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '24242424');

  -- Docente DNI 23232323
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '23232323', 'Docente19', 'Apellidos', 'docente23232323@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '23232323');

  -- Docente DNI 26262626
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '26262626', 'Docente20', 'Apellidos', 'docente26262626@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '26262626');

  -- Docente DNI 29292929
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '29292929', 'Docente21', 'Apellidos', 'docente29292929@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '29292929');

  -- Docente DNI 28282828
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '28282828', 'Docente22', 'Apellidos', 'docente28282828@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '28282828');

  -- Docente DNI 30303030
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '30303030', 'Docente23', 'Apellidos', 'docente30303030@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '30303030');

  -- Docente DNI 31313131
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '31313131', 'Docente24', 'Apellidos', 'docente31313131@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '31313131');

  -- Docente DNI 33333334
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '33333334', 'Docente25', 'Apellidos', 'docente33333334@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '33333334');

  -- Docente DNI 32323232
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '32323232', 'Docente26', 'Apellidos', 'docente32323232@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '32323232');

  -- Docente DNI 36363636
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '36363636', 'Docente27', 'Apellidos', 'docente36363636@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '36363636');

  -- Docente DNI 34343434
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '34343434', 'Docente28', 'Apellidos', 'docente34343434@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '34343434');

  -- Docente DNI 35353535
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '35353535', 'Docente29', 'Apellidos', 'docente35353535@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '35353535');

  -- Docente DNI 37373737
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '37373737', 'Docente30', 'Apellidos', 'docente37373737@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '37373737');

  -- Docente DNI 38383838
  INSERT INTO docentes (dni, nombre, apellidos, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana, activo)
  SELECT '38383838', 'Docente31', 'Apellidos', 'docente38383838@unt.edu.pe', 'auxiliar', 'contratado', '2026-01-01', 'licenciado', 40, true
  WHERE NOT EXISTS (SELECT 1 FROM docentes WHERE dni = '38383838');

  -- Carga Horaria: Docente1 (DNI 22222222) - Ciclos I, VII, IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '22222222'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '22222222' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-902 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-902';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 7, 1, 1, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-701 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-701';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 7, 1, 1, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-101 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-101';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 0, 3, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente2 (DNI 11111111) - Ciclos I, IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '11111111'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '11111111' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-102 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-102';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 0, 2, 6, 1, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-905 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-905';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 1, 3, 11, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente3 (DNI 33333333) - Ciclos I, VII
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '33333333'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '33333333' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EI-701 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EI-701';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EL-702 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-702';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 0, 2, 4, 0, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-102 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-102';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 0, 2, 4, 0, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente4 (DNI 55555555) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '55555555'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '55555555' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EG-101 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EG-101';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 4, 0, 5, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente5 (DNI 66666666) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '66666666'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '66666666' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EG-102 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EG-102';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente6 (DNI 44444444) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '44444444'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '44444444' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EG-103 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EG-103';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente7 (DNI 77777777) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '77777777'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '77777777' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EG-104 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EG-104';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 4, 0, 6, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente8 (DNI 99999999) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '99999999'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '99999999' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EG-105 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EG-105';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente9 (DNI 88888888) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '88888888'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '88888888' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EG-105 (Ciclo I) — Solo práctica, sin teoría
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EG-105';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 2, 0, 2, 0, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente10 (DNI 70707070) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '70707070'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '70707070' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-101 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-101';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 2, 0, 2, 0, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente11 (DNI 70808080) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '70808080'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '70808080' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-102 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-102';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 2, 0, 2, 0, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente12 (DNI 70909090) - Ciclos I
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 1, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '70909090'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '70909090' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-103 (Ciclo I)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-103';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 2, 0, 2, 0, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente13 (DNI 21212121) - Ciclos III, V, VII
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '21212121'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '21212121' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-702 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-702';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 0, 0, 2, 1, 0, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-301 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-301';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 1, 2, 9, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EL-502 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-502';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 0, 2, 6, 1, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente14 (DNI 20202020) - Ciclos III
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '20202020'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '20202020' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-302 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-302';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 0, 4, 14, 1, 0, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente15 (DNI 22222223) - Ciclos III, V
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '22222223'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '22222223' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-504 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-504';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 2, 10, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EL-301 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-301';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 1, 3, 8, 1, 1, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente16 (DNI 27272727) - Ciclos III
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '27272727'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '27272727' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-302 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-302';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente17 (DNI 25252525) - Ciclos III
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '25252525'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '25252525' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-301 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-301';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente18 (DNI 24242424) - Ciclos III
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '24242424'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '24242424' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-302 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-302';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 9, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente19 (DNI 23232323) - Ciclos III
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '23232323'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '23232323' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-303 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-303';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 5, 1, 1, 1
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente20 (DNI 26262626) - Ciclos III
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 3, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '26262626'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '26262626' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-304 (Ciclo III)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-304';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 4, 2, 13, 1, 1, 4
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente21 (DNI 29292929) - Ciclos V, VII
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 5, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '29292929'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '29292929' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-704 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-704';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 0, 0, 3, 6, 0, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-501 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-501';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 1, 3, 11, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente22 (DNI 28282828) - Ciclos V
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 5, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '28282828'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '28282828' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-502 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-502';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 1, 3, 12, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente23 (DNI 30303030) - Ciclos V, VII
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 5, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '30303030'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '30303030' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-503 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-503';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 9, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-703 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-703';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 1, 3, 11, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente24 (DNI 31313131) - Ciclos V, IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 5, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '31313131'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '31313131' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-501 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-501';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 7, 1, 1, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EL-902 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-902';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 0, 2, 6, 1, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente25 (DNI 33333334) - Ciclos V
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 5, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '33333334'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '33333334' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-501 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-501';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 5, 1, 1, 1
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente26 (DNI 32323232) - Ciclos V
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 5, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '32323232'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '32323232' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-502 (Ciclo V)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-502';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 9, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente27 (DNI 36363636) - Ciclos VII, IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 7, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '36363636'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '36363636' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-901 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-901';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 0, 2, 6, 1, 0, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-702 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-702';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 11, 1, 1, 4
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente28 (DNI 34343434) - Ciclos VII, IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 7, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '34343434'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '34343434' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EI-901 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EI-901';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 2, 6, 1, 1, 1
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-704 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-704';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 1, 3, 6, 1, 1, 1
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente29 (DNI 35353535) - Ciclos VII, IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 7, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '35353535'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '35353535' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EL-701 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EL-701';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 1, 3, 8, 1, 1, 2
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EI-901 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EI-901';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 2, 6, 1, 1, 1
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-903 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-903';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 5, 1, 1, 1
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente30 (DNI 37373737) - Ciclos VII
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 7, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '37373737'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '37373737' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EP-701 (Ciclo VII)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EP-701';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 2, 2, 0, 4, 1, 1, 0
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

  -- Carga Horaria: Docente31 (DNI 38383838) - Ciclos IX
  INSERT INTO carga_horaria (docente_id, ciclo_academico_id, ciclo_plan, modalidad, horas_asignadas, facultad, dpto_academico, activo)
  SELECT d.id, v_ciclo_id, 9, 'TIEMPO COMPLETO 40 H', 0, 'Ingenieria', 'Ingenieria de Sistemas', true
  FROM docentes d WHERE d.dni = '38383838'
  ON CONFLICT ON CONSTRAINT unique_docente_ciclo_academico DO NOTHING;

  SELECT ch.id INTO v_ch_id FROM carga_horaria ch
  JOIN docentes d ON ch.docente_id = d.id
  WHERE d.dni = '38383838' AND ch.ciclo_academico_id = v_ciclo_id;

  -- EE-901 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-901';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 2, 2, 9, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  -- EE-904 (Ciclo IX)
  SELECT c.id INTO v_curso_id FROM cursos c WHERE c.codigo = 'EE-904';
  INSERT INTO carga_horaria_cursos (carga_horaria_id, curso_id, seccion, escuela, num_alumnos, hrs_teo, hrs_pra, hrs_lab, total_hrs, teoria_grupos, practica_grupos, laboratorio_grupos)
  SELECT v_ch_id, v_curso_id, 'A', 'Ing. Sistemas', 40, 1, 1, 3, 11, 1, 1, 3
  WHERE NOT EXISTS (SELECT 1 FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id AND chc.curso_id = v_curso_id);

  UPDATE carga_horaria SET horas_asignadas = (
    SELECT COALESCE(SUM(chc.hrs_teo + chc.hrs_pra + chc.hrs_lab), 0)
    FROM carga_horaria_cursos chc WHERE chc.carga_horaria_id = v_ch_id
  ) WHERE id = v_ch_id;

END;
$$;

