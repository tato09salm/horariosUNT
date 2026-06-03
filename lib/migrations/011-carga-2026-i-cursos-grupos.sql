-- ========================================
-- MIGRACIÓN: Añadir cursos, docentes y grupos para 2026-I (EG-, EE-, EL-, EP-, EI-)
-- ========================================

DO $$
DECLARE
    eis_id UUID;
    c_26_i UUID;
BEGIN
    SELECT id INTO eis_id FROM escuelas WHERE codigo = 'EIS';
    SELECT id INTO c_26_i FROM ciclos WHERE nombre = '2026-I';

    -- 1. Añadir cursos faltantes (EG-, EE-, EL-, EP-, EI-)
    INSERT INTO cursos (escuela_id, codigo, nombre, creditos, horas_teoria, horas_practica, horas_laboratorio, ciclo_plan, semestre) VALUES
    -- Ciclo I
    (eis_id, 'EE-102', 'Introducción a la Programación', 3, 2, 0, 2, 1, 1),
    (eis_id, 'EE-101', 'Introducción a la Ing. de Sistemas', 3, 1, 2, 0, 1, 1),
    (eis_id, 'EG-103', 'Desarrollo Personal', 2, 2, 2, 0, 1, 1),
    (eis_id, 'EG-101', 'Desarrollo del Pensamiento Lógico Matemático', 3, 1, 4, 0, 1, 1),
    (eis_id, 'EG-102', 'Lectura Crítica y Redac. Textos Académicos', 2, 2, 2, 0, 1, 1),
    (eis_id, 'EG-104', 'Introducción al Análisis Matemático', 3, 2, 4, 0, 1, 1),
    (eis_id, 'EG-105', 'Estadística General', 3, 2, 2, 0, 1, 1),
    -- Ciclo III
    (eis_id, 'EE-302', 'Programación Orientada a Objetos II', 4, 2, 0, 4, 3, 1),
    (eis_id, 'EE-301', 'Sistémica', 3, 1, 1, 0, 3, 1),
    (eis_id, 'EL-301', 'Ingeniería Gráfica (e)', 2, 1, 1, 0, 3, 1),
    (eis_id, 'EP-303', 'Matemática Aplicada', 3, 2, 2, 0, 3, 1),
    (eis_id, 'EP-302', 'Estadística Aplicada', 3, 2, 2, 0, 3, 1),
    (eis_id, 'EP-301', 'Administración General', 3, 2, 2, 0, 3, 1),
    (eis_id, 'EP-304', 'Física Electrónica', 3, 2, 2, 2, 3, 1),
    (eis_id, 'EL-302', 'Psicología Organizacional (e)', 2, 2, 2, 0, 3, 1),
    -- Ciclo V
    (eis_id, 'EE-502', 'Ingeniería de Datos I', 4, 2, 1, 3, 5, 1),
    (eis_id, 'EE-504', 'Sistemas de Información', 4, 2, 2, 2, 5, 1),
    (eis_id, 'EL-502', 'Transformación Digital', 2, 2, 0, 2, 5, 1),
    (eis_id, 'EE-501', 'Tecnología Web', 4, 1, 1, 3, 5, 1),
    (eis_id, 'EE-503', 'Arquitectura de Computadoras', 3, 1, 2, 2, 5, 1),
    (eis_id, 'EL-501', 'Teleinformática (e)', 2, 1, 0, 4, 5, 1),
    (eis_id, 'EP-502', 'Investigación de Operaciones', 2, 2, 0, 2, 5, 1),
    (eis_id, 'EP-501', 'Contabilidad Gerencial', 2, 2, 2, 2, 5, 1),
    -- Ciclo VII
    (eis_id, 'EE-704', 'Ingeniería de Software I', 4, 2, 1, 3, 7, 1),
    (eis_id, 'EE-703', 'Redes y Comunicaciones I', 4, 1, 1, 3, 7, 1),
    (eis_id, 'EL-702', 'Negocios Electrónicos (e)', 2, 2, 0, 2, 7, 1),
    (eis_id, 'EE-701', 'Gestión de Servicios de TI', 2, 1, 2, 0, 7, 1),
    (eis_id, 'EI-701', 'Metodología de la Investigación Científica', 2, 2, 2, 0, 7, 1),
    (eis_id, 'EL-701', 'Administración de Base de Datos', 3, 1, 1, 0, 7, 1),
    (eis_id, 'EE-702', 'Planeación Estratégica de TI', 3, 1, 2, 0, 7, 1),
    (eis_id, 'EP-701', 'Cadena de Suministros (e)', 2, 2, 2, 0, 7, 1),
    -- Ciclo IX
    (eis_id, 'EI-901', 'Tesis I', 2, 2, 2, 0, 9, 1),
    (eis_id, 'EE-902', 'Auditoría Informática', 3, 1, 2, 0, 9, 1),
    (eis_id, 'EE-901', 'Gestión de Proyectos de TI', 3, 1, 2, 0, 9, 1),
    (eis_id, 'EL-901', 'Emprendimiento Tecnológico', 2, 2, 0, 0, 9, 1),
    (eis_id, 'EE-905', 'Ingeniería Web', 4, 1, 1, 0, 9, 1),
    (eis_id, 'EE-904', 'Computación en la Nube', 4, 1, 1, 0, 9, 1),
    (eis_id, 'EL-902', 'Hackeo Ético (e)', 2, 2, 0, 0, 9, 1)
    ON CONFLICT (codigo) DO NOTHING;

    -- 2. Añadir docentes faltantes (DNIs del CSV)
    INSERT INTO docentes (nombre, apellidos, dni, categoria, condicion, fecha_ingreso, horas_max_semana, activo) VALUES
    ('Docente', '12345678', '12345678', 'auxiliar', 'contratado', NOW(), 20, true),
    ('Docente', '87654321', '87654321', 'auxiliar', 'contratado', NOW(), 20, true),
    ('Docente', '11223344', '11223344', 'auxiliar', 'contratado', NOW(), 20, true)
    ON CONFLICT (dni) DO NOTHING;

END $$;

-- 3. Añadir grupos con tipo_actividad para cada curso (según el CSV)
DO $$
DECLARE
    c_26_i UUID;
    -- Variables para IDs de cursos
    cur_ee102 UUID; cur_ee101 UUID; cur_eg103 UUID; cur_eg101 UUID;
    cur_eg102 UUID; cur_eg104 UUID; cur_eg105 UUID;
    cur_ee302 UUID; cur_ee301 UUID; cur_el301 UUID; cur_ep303 UUID;
    cur_ep302 UUID; cur_ep301 UUID; cur_ep304 UUID; cur_el302 UUID;
    cur_ee502 UUID; cur_ee504 UUID; cur_el502 UUID; cur_ee501 UUID;
    cur_ee503 UUID; cur_el501 UUID; cur_ep502 UUID; cur_ep501 UUID;
    cur_ee704 UUID; cur_ee703 UUID; cur_el702 UUID; cur_ee701 UUID;
    cur_ei701 UUID; cur_el701 UUID; cur_ee702 UUID; cur_ep701 UUID;
    cur_ei901 UUID; cur_ee902 UUID; cur_ee901 UUID; cur_el901 UUID;
    cur_ee905 UUID; cur_ee904 UUID; cur_el902 UUID;
BEGIN
    SELECT id INTO c_26_i FROM ciclos WHERE nombre = '2026-I';

    -- Obtener IDs de cursos
    SELECT id INTO cur_ee102 FROM cursos WHERE codigo = 'EE-102';
    SELECT id INTO cur_ee101 FROM cursos WHERE codigo = 'EE-101';
    SELECT id INTO cur_eg103 FROM cursos WHERE codigo = 'EG-103';
    SELECT id INTO cur_eg101 FROM cursos WHERE codigo = 'EG-101';
    SELECT id INTO cur_eg102 FROM cursos WHERE codigo = 'EG-102';
    SELECT id INTO cur_eg104 FROM cursos WHERE codigo = 'EG-104';
    SELECT id INTO cur_eg105 FROM cursos WHERE codigo = 'EG-105';
    SELECT id INTO cur_ee302 FROM cursos WHERE codigo = 'EE-302';
    SELECT id INTO cur_ee301 FROM cursos WHERE codigo = 'EE-301';
    SELECT id INTO cur_el301 FROM cursos WHERE codigo = 'EL-301';
    SELECT id INTO cur_ep303 FROM cursos WHERE codigo = 'EP-303';
    SELECT id INTO cur_ep302 FROM cursos WHERE codigo = 'EP-302';
    SELECT id INTO cur_ep301 FROM cursos WHERE codigo = 'EP-301';
    SELECT id INTO cur_ep304 FROM cursos WHERE codigo = 'EP-304';
    SELECT id INTO cur_el302 FROM cursos WHERE codigo = 'EL-302';
    SELECT id INTO cur_ee502 FROM cursos WHERE codigo = 'EE-502';
    SELECT id INTO cur_ee504 FROM cursos WHERE codigo = 'EE-504';
    SELECT id INTO cur_el502 FROM cursos WHERE codigo = 'EL-502';
    SELECT id INTO cur_ee501 FROM cursos WHERE codigo = 'EE-501';
    SELECT id INTO cur_ee503 FROM cursos WHERE codigo = 'EE-503';
    SELECT id INTO cur_el501 FROM cursos WHERE codigo = 'EL-501';
    SELECT id INTO cur_ep502 FROM cursos WHERE codigo = 'EP-502';
    SELECT id INTO cur_ep501 FROM cursos WHERE codigo = 'EP-501';
    SELECT id INTO cur_ee704 FROM cursos WHERE codigo = 'EE-704';
    SELECT id INTO cur_ee703 FROM cursos WHERE codigo = 'EE-703';
    SELECT id INTO cur_el702 FROM cursos WHERE codigo = 'EL-702';
    SELECT id INTO cur_ee701 FROM cursos WHERE codigo = 'EE-701';
    SELECT id INTO cur_ei701 FROM cursos WHERE codigo = 'EI-701';
    SELECT id INTO cur_el701 FROM cursos WHERE codigo = 'EL-701';
    SELECT id INTO cur_ee702 FROM cursos WHERE codigo = 'EE-702';
    SELECT id INTO cur_ep701 FROM cursos WHERE codigo = 'EP-701';
    SELECT id INTO cur_ei901 FROM cursos WHERE codigo = 'EI-901';
    SELECT id INTO cur_ee902 FROM cursos WHERE codigo = 'EE-902';
    SELECT id INTO cur_ee901 FROM cursos WHERE codigo = 'EE-901';
    SELECT id INTO cur_el901 FROM cursos WHERE codigo = 'EL-901';
    SELECT id INTO cur_ee905 FROM cursos WHERE codigo = 'EE-905';
    SELECT id INTO cur_ee904 FROM cursos WHERE codigo = 'EE-904';
    SELECT id INTO cur_el902 FROM cursos WHERE codigo = 'EL-902';

    -- Insertar grupos con tipo_actividad para cada curso
    -- EE-102 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee102, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee102, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee102, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee102, 'laboratorio', 2, 30, 25);

    -- EE-101 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee101, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee101, 'practica', 1, 30, 25);

    -- EE-102 (EG, Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee102, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee102, 'laboratorio', 3, 30, 25),
    (NULL, c_26_i, cur_ee102, 'teoria', 4, 30, 25),
    (NULL, c_26_i, cur_ee102, 'laboratorio', 4, 30, 25);

    -- EG-103 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_eg103, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_eg103, 'practica', 1, 30, 25);

    -- EG-101 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_eg101, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_eg101, 'practica', 1, 30, 25);

    -- EG-102 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_eg102, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_eg102, 'practica', 1, 30, 25);

    -- EG-104 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_eg104, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_eg104, 'practica', 1, 30, 25);

    -- EG-105 (Ciclo I)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_eg105, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_eg105, 'practica', 1, 30, 25);

    -- EE-302 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee302, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee302, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee302, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee302, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ee302, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee302, 'laboratorio', 3, 30, 25);

    -- EE-301 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee301, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee301, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee301, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee301, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee301, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee301, 'practica', 3, 30, 25);

    -- EL-301 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el301, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el301, 'practica', 1, 30, 25);

    -- EP-303 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep303, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep303, 'practica', 1, 30, 25);

    -- EP-302 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep302, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep302, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ep302, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ep302, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ep302, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ep302, 'practica', 3, 30, 25);

    -- EP-301 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep301, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep301, 'practica', 1, 30, 25);

    -- EP-304 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep304, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep304, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ep304, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ep304, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ep304, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ep304, 'laboratorio', 2, 30, 25);

    -- EL-302 (Ciclo III)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el302, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el302, 'practica', 1, 30, 25);

    -- EE-502 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee502, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee502, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee502, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee502, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee502, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee502, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ee502, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee502, 'practica', 3, 30, 25),
    (NULL, c_26_i, cur_ee502, 'laboratorio', 3, 30, 25);

    -- EE-504 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee504, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee504, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee504, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee504, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee504, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee504, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ee504, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee504, 'practica', 3, 30, 25),
    (NULL, c_26_i, cur_ee504, 'laboratorio', 3, 30, 25);

    -- EL-502 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el502, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el502, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_el502, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_el502, 'laboratorio', 2, 30, 25);

    -- EE-501 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee501, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee501, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee501, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee501, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee501, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee501, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ee501, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee501, 'practica', 3, 30, 25),
    (NULL, c_26_i, cur_ee501, 'laboratorio', 3, 30, 25);

    -- EE-503 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee503, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee503, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee503, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee503, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee503, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee503, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ee503, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee503, 'practica', 3, 30, 25),
    (NULL, c_26_i, cur_ee503, 'laboratorio', 3, 30, 25);

    -- EL-501 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el501, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el501, 'laboratorio', 1, 30, 25);

    -- EP-502 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep502, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep502, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ep502, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ep502, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ep502, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ep502, 'laboratorio', 3, 30, 25);

    -- EP-501 (Ciclo V)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep501, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep501, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ep501, 'laboratorio', 1, 30, 25);

    -- EE-704 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee704, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee704, 'practica', 3, 30, 25),
    (NULL, c_26_i, cur_ee704, 'laboratorio', 3, 30, 25),
    (NULL, c_26_i, cur_ee704, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee704, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee704, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee704, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee704, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee704, 'laboratorio', 2, 30, 25);

    -- EE-703 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee703, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee703, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee703, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_ee703, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee703, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee703, 'laboratorio', 2, 30, 25),
    (NULL, c_26_i, cur_ee703, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee703, 'practica', 3, 30, 25),
    (NULL, c_26_i, cur_ee703, 'laboratorio', 3, 30, 25);

    -- EL-702 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el702, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el702, 'laboratorio', 1, 30, 25),
    (NULL, c_26_i, cur_el702, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_el702, 'laboratorio', 2, 30, 25);

    -- EE-701 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee701, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee701, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee701, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee701, 'practica', 2, 30, 25);

    -- EI-701 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ei701, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ei701, 'practica', 1, 30, 25);

    -- EL-701 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el701, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el701, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_el701, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_el701, 'practica', 2, 30, 25);

    -- EE-702 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee702, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee702, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee702, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee702, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee702, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee702, 'practica', 3, 30, 25);

    -- EP-701 (Ciclo VII)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ep701, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ep701, 'practica', 1, 30, 25);

    -- EI-901 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ei901, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ei901, 'practica', 1, 30, 25);

    -- EE-902 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee902, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee902, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee902, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee902, 'practica', 2, 30, 25);

    -- EE-901 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee901, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee901, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee901, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee901, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee901, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee901, 'practica', 3, 30, 25);

    -- EL-901 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el901, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el901, 'teoria', 2, 30, 25);

    -- EE-905 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee905, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee905, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee905, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee905, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee905, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee905, 'practica', 3, 30, 25);

    -- EE-904 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_ee904, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_ee904, 'practica', 1, 30, 25),
    (NULL, c_26_i, cur_ee904, 'teoria', 2, 30, 25),
    (NULL, c_26_i, cur_ee904, 'practica', 2, 30, 25),
    (NULL, c_26_i, cur_ee904, 'teoria', 3, 30, 25),
    (NULL, c_26_i, cur_ee904, 'practica', 3, 30, 25);

    -- EL-902 (Ciclo IX)
    INSERT INTO grupos (programacion_id, ciclo_id, curso_id, tipo_actividad, numero_grupo, max_alumnos, num_alumnos) VALUES
    (NULL, c_26_i, cur_el902, 'teoria', 1, 30, 25),
    (NULL, c_26_i, cur_el902, 'teoria', 2, 30, 25);

END $$;
