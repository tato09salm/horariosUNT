-- ========================================
-- SISTEMA DE HORARIOS - UNIVERSIDAD NACIONAL DE TRUJILLO
-- Escuela de Ingeniería de Sistemas
-- Semestres: 2026-I y 2025-II
-- ========================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============= TABLAS BASE =============

-- Roles del sistema
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('admin', 'secretaria', 'docente');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'docente',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categoría del docente
DO $$ BEGIN
    CREATE TYPE categoria_docente AS ENUM ('principal', 'asociado', 'auxiliar', 'jefe_practica');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE condicion_docente AS ENUM ('nombrado', 'contratado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_grado AS ENUM ('bachiller', 'licenciado', 'magister', 'doctor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Docentes
CREATE TABLE IF NOT EXISTS docentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  nombre VARCHAR(100) NOT NULL,
  apellidos VARCHAR(150) NOT NULL,
  dni VARCHAR(8) UNIQUE NOT NULL,
  email VARCHAR(200),
  telefono VARCHAR(15),
  categoria categoria_docente NOT NULL,
  condicion condicion_docente NOT NULL,
  fecha_ingreso DATE NOT NULL,
  grado_academico tipo_grado,
  horas_max_semana INTEGER DEFAULT 20,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Ciclos académicos
CREATE TABLE IF NOT EXISTS ciclos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(50) UNIQUE NOT NULL,
  año INTEGER NOT NULL,
  semestre VARCHAR(2) NOT NULL CHECK (semestre IN ('I', 'II')),
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tipos de ambiente
DO $$ BEGIN
    CREATE TYPE tipo_ambiente AS ENUM ('aula', 'laboratorio', 'auditorio');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Aulas y laboratorios
CREATE TABLE IF NOT EXISTS ambientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  tipo tipo_ambiente NOT NULL,
  capacidad INTEGER NOT NULL DEFAULT 30,
  piso INTEGER DEFAULT 1,
  edificio VARCHAR(50),
  equipamiento TEXT[],
  disponible BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Escuelas/Departamentos
CREATE TABLE IF NOT EXISTS escuelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cursos
CREATE TABLE IF NOT EXISTS cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escuela_id UUID REFERENCES escuelas(id),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  creditos INTEGER NOT NULL DEFAULT 3,
  horas_teoria INTEGER NOT NULL DEFAULT 3,
  horas_practica INTEGER NOT NULL DEFAULT 0,
  horas_laboratorio INTEGER NOT NULL DEFAULT 0,
  bloque_indivisible BOOLEAN DEFAULT true,
  cantidad_labs INTEGER DEFAULT 1,
  ciclo_plan INTEGER,
  semestre INTEGER,
  prerequisitos UUID[],
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Grupos de cursos por ciclo
-- NOTA: Se asume única sección "A" globalmente por ciclo/curso según instrucción.
CREATE TABLE IF NOT EXISTS grupos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ciclo_id UUID REFERENCES ciclos(id),
  curso_id UUID REFERENCES cursos(id),
  numero_grupo INTEGER NOT NULL DEFAULT 1,
  max_alumnos INTEGER DEFAULT 30,
  num_alumnos INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ciclo_id, curso_id, numero_grupo)
);

-- Días de la semana
DO $$ BEGIN
    CREATE TYPE dia_semana AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_sesion AS ENUM ('teoria', 'practica', 'laboratorio');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Slots de tiempo disponibles
CREATE TABLE IF NOT EXISTS slots_tiempo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  orden INTEGER NOT NULL,
  UNIQUE(hora_inicio, hora_fin)
);

-- ============= HORARIOS =============

-- Asignaciones de horario
CREATE TABLE IF NOT EXISTS asignaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ciclo_id UUID REFERENCES ciclos(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES grupos(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES docentes(id),
  ambiente_id UUID REFERENCES ambientes(id),
  slot_id UUID REFERENCES slots_tiempo(id),
  dia dia_semana NOT NULL,
  tipo tipo_sesion NOT NULL DEFAULT 'teoria',
  estado VARCHAR(20) DEFAULT 'activo',
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice único para prevenir conflictos
DROP INDEX IF EXISTS idx_asig_docente_dia_slot;
DROP INDEX IF EXISTS idx_asig_ambiente_dia_slot;
DROP INDEX IF EXISTS idx_asig_grupo_dia_slot;

CREATE UNIQUE INDEX idx_asig_docente_dia_slot 
  ON asignaciones(docente_id, dia, slot_id, ciclo_id) 
  WHERE estado = 'activo';

CREATE UNIQUE INDEX idx_asig_ambiente_dia_slot 
  ON asignaciones(ambiente_id, dia, slot_id, ciclo_id) 
  WHERE estado = 'activo';

CREATE UNIQUE INDEX idx_asig_grupo_dia_slot 
  ON asignaciones(grupo_id, dia, slot_id, ciclo_id) 
  WHERE estado = 'activo';

-- ============= AUDITORÍA =============

DO $$ BEGIN
    CREATE TYPE accion_auditoria AS ENUM (
      'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 
      'GENERATE_SCHEDULE', 'EXPORT_REPORT', 'ASSIGN', 'UNASSIGN'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID REFERENCES usuarios(id),
  usuario_nombre VARCHAR(255),
  usuario_email VARCHAR(255),
  accion accion_auditoria NOT NULL,
  tabla_afectada VARCHAR(100),
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla_afectada);


-- ========================================
-- DATOS INICIALES
-- ========================================

-- 1. ESCUELA
INSERT INTO escuelas (nombre, codigo) VALUES 
('Escuela de Ingeniería de Sistemas', 'EIS')
ON CONFLICT (codigo) DO NOTHING;

-- 2. CICLOS ACADÉMICOS
INSERT INTO ciclos (nombre, año, semestre, fecha_inicio, fecha_fin, activo) VALUES
('2026-I', 2026, 'I', '2026-04-13', '2026-08-08', false),
('2025-II', 2025, 'II', '2025-09-01', '2025-12-20', true);

-- 3. SLOTS DE TIEMPO
INSERT INTO slots_tiempo (nombre, hora_inicio, hora_fin, orden) VALUES
('07:00 - 08:00', '07:00', '08:00', 1),
('08:00 - 09:00', '08:00', '09:00', 2),
('09:00 - 10:00', '09:00', '10:00', 3),
('10:00 - 11:00', '10:00', '11:00', 4),
('11:00 - 12:00', '11:00', '12:00', 5),
('12:00 - 13:00', '12:00', '13:00', 6),
('13:00 - 14:00', '13:00', '14:00', 7),
('14:00 - 15:00', '14:00', '15:00', 8),
('15:00 - 16:00', '15:00', '16:00', 9),
('16:00 - 17:00', '16:00', '17:00', 10),
('17:00 - 18:00', '17:00', '18:00', 11),
('18:00 - 19:00', '18:00', '19:00', 12),
('19:00 - 20:00', '19:00', '20:00', 13),
('20:00 - 21:00', '20:00', '21:00', 14)
ON CONFLICT (hora_inicio, hora_fin) DO NOTHING;

-- 4. AMBIENTES (Unificados de todos los horarios)
INSERT INTO ambientes (codigo, nombre, tipo, capacidad, piso, edificio) VALUES
-- Aulas Generales
('A-101', 'Aula 101', 'aula', 40, 1, 'Pabellón A'),
('A-102', 'Aula 102', 'aula', 40, 1, 'Pabellón A'),
('A-201', 'Aula 201', 'aula', 35, 2, 'Pabellón A'),
('A-301', 'Aula 301', 'aula', 30, 3, 'Pabellón A'),
('A-303', 'Posgrado A-303', 'aula', 30, 3, 'Pabellón A'),
('A-307', 'Posgrado A-307', 'aula', 30, 3, 'Pabellón A'),
('A-311', 'Posgrado A-311', 'aula', 30, 3, 'Pabellón A'),
('B-101', 'Aula B-101', 'aula', 45, 1, 'Pabellón B'),
-- Laboratorios
('LAB-1', 'Laboratorio 1', 'laboratorio', 30, 1, 'Laboratorios'),
('LAB-2', 'Laboratorio 2', 'laboratorio', 30, 1, 'Laboratorios'),
('LAB-3', 'Laboratorio 3', 'laboratorio', 30, 1, 'Laboratorios'),
('LAB-4', 'Laboratorio 4', 'laboratorio', 30, 1, 'Laboratorios'),
('LAB-FIS', 'Lab. Física', 'laboratorio', 25, 1, 'Laboratorios'),
('L-101', 'Lab. Computación I', 'laboratorio', 30, 1, 'Laboratorios'),
('L-102', 'Lab. Computación II', 'laboratorio', 30, 1, 'Laboratorios'),
-- Espacios Pedagógicos Generales (EPG) - Solo 2025-II
('EPG-1', 'Espacio Pedagógico General 1', 'aula', 40, 1, 'Pabellón EPG'),
('EPG-2', 'Espacio Pedagógico General 2', 'aula', 40, 1, 'Pabellón EPG'),
('EPG-3', 'Espacio Pedagógico General 3', 'aula', 40, 1, 'Pabellón EPG'),
('EPG-4', 'Espacio Pedagógico General 4', 'aula', 40, 1, 'Pabellón EPG'),
-- Talleres
('TC-IND', 'Taller de Confecciones - Ing. Industrial', 'laboratorio', 25, 1, 'Talleres')
ON CONFLICT (codigo) DO NOTHING;

-- 5. USUARIOS ADMIN
INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES
('Administrador', 'Sistema', 'admin@unt.edu.pe', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('María', 'García López', 'secretaria@unt.edu.pe', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'secretaria')
ON CONFLICT (email) DO NOTHING;

-- ========================================
-- DOCENTES (UNIFICADOS 2026-I y 2025-II)
-- DNIs canónicos tomados de cursos.csv
-- Profesores que enseñan en ambos semestres aparecen UNA sola vez.
-- ========================================
INSERT INTO docentes (nombre, apellidos, dni, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana)
VALUES
-- --- DOCENTES SOLO 2026-I (sin asignación en CSV 2025-II) ---
-- Ciclo I
('Marcelino', 'Torres Villanueva', '11111111', 'mtorres@unt.edu.pe', 'principal', 'nombrado', '2000-03-01', 'doctor', 20),
('Bertha', 'Urtecho Zavaleta', '44444444', 'burtecho@unt.edu.pe', 'principal', 'nombrado', '1998-03-01', 'doctor', 20),
('Jose Luis', 'Ponte Bejarano', '55555555', 'jponte@unt.edu.pe', 'asociado', 'nombrado', '2010-03-01', 'magister', 20),
('Jorge Luis', 'Rios Gonzales', '66666666', 'jrios@unt.edu.pe', 'auxiliar', 'contratado', '2015-08-01', 'licenciado', 16),
('Segundo', 'Guibar Obeso', '77777777', 'sguibar@unt.edu.pe', 'principal', 'nombrado', '2002-03-01', 'doctor', 20),
('Miquel', 'Ipanaque Zapata', '88888888', 'mipanaque@unt.edu.pe', 'asociado', 'nombrado', '2008-03-01', 'magister', 20),
('Martha', 'Cardoso', '99999999', 'mcardoso@unt.edu.pe', 'auxiliar', 'contratado', '2020-08-01', 'bachiller', 16),
-- Ciclo III (solo 2026-I)
('Marcos', 'Ferrer Reyna', '23232323', 'mferrer@unt.edu.pe', 'principal', 'nombrado', '1999-03-01', 'doctor', 20),
('Teresita', 'Rojas García', '24242424', 'trojas@unt.edu.pe', 'asociado', 'nombrado', '2011-03-01', 'magister', 20),
('Juan', 'Carrascal Cabanillas', '25252525', 'jcarrascal@unt.edu.pe', 'auxiliar', 'contratado', '2016-08-01', 'licenciado', 16),
('Wilma', 'Mendez Gil', '26262626', 'wmendez@unt.edu.pe', 'principal', 'nombrado', '2003-03-01', 'doctor', 20),
('Sheyla Laura', 'Escobedo Rodriguez', '27272727', 'sescobedo@unt.edu.pe', 'asociado', 'nombrado', '2009-03-01', 'magister', 20),
-- Ciclo V (solo 2026-I)
('Cesar', 'Arellano Salazar', '30303030', 'carellano@unt.edu.pe', 'auxiliar', 'contratado', '2017-08-01', 'licenciado', 16),
('Marcos', 'Baca Lopez', '32323232', 'mbaca@unt.edu.pe', 'asociado', 'nombrado', '2013-03-01', 'magister', 20),
('Ana', 'Cuadra Mituzgaray', '33333334', 'acuadra@unt.edu.pe', 'auxiliar', 'contratado', '2019-08-01', 'licenciado', 16),

-- --- DOCENTES CON DNI DEL CSV (aparecen en 2025-II, algunos también en 2026-I) ---
-- CSV DNI: 20202020 → IS-201 (Ciclo II 2025-II) + Ciclo III 2026-I
('Zoraida', 'Vidal Melgarejo', '20202020', 'zvidal@unt.edu.pe', 'principal', 'nombrado', '2001-03-01', 'doctor', 20),
-- CSV DNI: 21212121 → IS-803, IS-1001 (2025-II) + Ciclo III 2026-I
('Everson David', 'Agreda Gamboa', '21212121', 'eagreda@unt.edu.pe', 'asociado', 'nombrado', '2006-08-01', 'magister', 20),
-- CSV DNI: 22222222 → IS-804, IS-1004 (2025-II) + Ciclo I 2026-I
('Alberto', 'Mendoza de los Santos', '22222222', 'amendoza@unt.edu.pe', 'asociado', 'nombrado', '2005-08-01', 'magister', 20),
-- CSV DNI: 22222223 → IS-401, IS-801 (2025-II) + Ciclo III 2026-I
('Juan Carlos', 'Obando Roldán', '22222223', 'jobando@unt.edu.pe', 'auxiliar', 'contratado', '2019-03-01', 'licenciado', 16),
-- CSV DNI: 28282828 → IS-603 (2025-II) + Ciclo V 2026-I
('Luis', 'Boy Chavil', '28282828', 'lboy@unt.edu.pe', 'principal', 'nombrado', '2004-03-01', 'doctor', 20),
-- CSV DNI: 29292929 → IS-402, IS-601, IS-1002 (2025-II) + Ciclo V 2026-I
('Robert Jerry', 'Sánchez Ticona', '29292929', 'rsanchez@unt.edu.pe', 'asociado', 'nombrado', '2012-03-01', 'magister', 20),
-- CSV DNI: 31313131 → IS-405, IS-406 (2025-II) + Ciclo V 2026-I
('Camilo', 'Suárez Rebaza', '31313131', 'csuarez@unt.edu.pe', 'principal', 'nombrado', '2007-03-01', 'doctor', 20),
-- CSV DNI: 33333333 → FIS-1001 (2025-II) + Ciclo I 2026-I
('Paul', 'Cotrina Castellanos', '33333333', 'pcotrina@unt.edu.pe', 'auxiliar', 'contratado', '2018-03-01', 'licenciado', 16),
-- CSV DNI: 34343434 → IS-802, IS-1003 (2025-II) + Ciclo VII 2026-I
('Juan Pedro', 'Santos Fernández', '34343434', 'jsantos@unt.edu.pe', 'principal', 'nombrado', '2005-03-01', 'doctor', 20),
-- CSV DNI: 35353535 → IS-805, IS-1005 (2025-II) + Ciclo VII 2026-I
('Ricardo', 'Mendoza Rivera', '35353535', 'rmendoza@unt.edu.pe', 'asociado', 'nombrado', '2010-03-01', 'magister', 20),
-- CSV DNI: 36363636 → FIS-801, IS-1006 (2025-II) + Ciclo VII 2026-I
('Oscar Romel', 'Alcántara Moreno', '36363636', 'oalcantara@unt.edu.pe', 'auxiliar', 'contratado', '2018-08-01', 'licenciado', 16),
-- CSV DNI: 37373737 → IND-601, IND-1001 (2025-II) + Ciclo VII 2026-I
('Jhoe', 'Gonzalez Vasquez', '37373737', 'jgonzalez@unt.edu.pe', 'principal', 'nombrado', '2008-03-01', 'doctor', 20),
-- CSV DNI: 38383838 → FIS-401, IS-806 (2025-II) + Ciclo IX 2026-I
('José', 'Gómez Ávila', '38383838', 'jgomez@unt.edu.pe', 'asociado', 'nombrado', '2011-03-01', 'magister', 20),
-- CSV DNI: 40404040 → SOC-201 (Ciclo II 2025-II, solo 2025-II)
('Edgard', 'Pelaez Vinces', '40404040', 'epelaez@unt.edu.pe', 'asociado', 'nombrado', '2007-03-01', 'magister', 20),
-- CSV DNI: 41414141 → EDU-201 (Ciclo II 2025-II, solo 2025-II)
('Diego', 'Llaro Cruz', '41414141', 'dllaro@unt.edu.pe', 'auxiliar', 'contratado', '2018-08-01', 'licenciado', 16),
-- CSV DNI: 42424242 → FIL-201 (Ciclo II 2025-II, solo 2025-II)
('Alex', 'Herradas', '42424242', 'aherradas@unt.edu.pe', 'principal', 'nombrado', '2003-03-01', 'doctor', 20),
-- CSV DNI: 43434343 → MAT-201 (Ciclo II 2025-II, solo 2025-II)
('Milton', 'Cortez', '43434343', 'mcortez@unt.edu.pe', 'asociado', 'nombrado', '2010-03-01', 'magister', 20),
-- CSV DNI: 44444445 → FIS-201 (Ciclo II 2025-II, solo 2025-II)
('Arístides', 'Tavara Aponte', '44444445', 'atavara@unt.edu.pe', 'auxiliar', 'contratado', '2016-08-01', 'licenciado', 16),
-- CSV DNI: 45454545 → FIS-202 (Ciclo II 2025-II, solo 2025-II)
('Segundo Roseli', 'Jauregui Rosas', '45454545', 'sjauregui@unt.edu.pe', 'principal', 'nombrado', '2005-03-01', 'doctor', 20),
-- CSV DNI: 48484848 → IS-403, IS-602 (Ciclo IV/VI 2025-II, solo 2025-II)
('Cesar', 'Arellano Salazar', '48484848', 'carellano2@unt.edu.pe', 'principal', 'nombrado', '2006-03-01', 'doctor', 20),
-- CSV DNI: 49494949 → IS-404, IS-604 (Ciclo IV/VI 2025-II, solo 2025-II)
('Marcelino', 'Torres Villanueva', '49494949', 'mtorres2@unt.edu.pe', 'asociado', 'nombrado', '2011-03-01', 'magister', 20),
-- CSV DNI: 52525252 → ECO-401 (Ciclo IV 2025-II, solo 2025-II)
('Alberto', 'Asmat Alva', '52525252', 'aasmat@unt.edu.pe', 'asociado', 'nombrado', '2013-03-01', 'magister', 20),
-- CSV DNI: 54545454 → CF-601 (Ciclo VI 2025-II, solo 2025-II)
('Juan Manuel', 'Granda Fernández', '54545454', 'jgranda@unt.edu.pe', 'asociado', 'nombrado', '2014-03-01', 'magister', 20),
-- CSV DNI: 57575757 → AMB-601 (Ciclo VI 2025-II, solo 2025-II)
('Luis', 'Moncada Albites', '57575757', 'lmoncada@unt.edu.pe', 'asociado', 'nombrado', '2015-03-01', 'magister', 20),
-- CSV DNI: 62626262 → DER-801 (Ciclo VIII 2025-II, solo 2025-II)
('Marco Celi', 'Arevalo', '62626262', 'marevalo@unt.edu.pe', 'asociado', 'nombrado', '2012-03-01', 'magister', 20);


-- ========================================
-- CURSOS (UNIFICADOS 2026-I y 2025-II)
-- ========================================
DO $$
DECLARE
    eis_id UUID;
BEGIN
    SELECT id INTO eis_id FROM escuelas WHERE codigo = 'EIS';

    INSERT INTO cursos (escuela_id, codigo, nombre, creditos, horas_teoria, horas_practica, ciclo_plan, semestre)
    VALUES
    -- === CURSOS 2026-I ===
    -- Ciclo I
    (eis_id, 'IS-101', 'Introducción a la Programación', 3, 2, 0, 1, 1),
    (eis_id, 'IS-102', 'Introducción a la Ing. de Sistemas', 2, 1, 2, 1, 1),
    (eis_id, 'IS-103', 'Introducción a la Programación (Lab)', 2, 0, 0, 1, 1),
    (eis_id, 'PSI-101', 'Desarrollo Personal', 2, 2, 2, 1, 1),
    (eis_id, 'MAT-101', 'Desarrollo Pens. Lógico Matemático', 3, 1, 4, 1, 1),
    (eis_id, 'LNL-101', 'Lectura Crítica y Redacción', 2, 2, 2, 1, 1),
    (eis_id, 'MAT-102', 'Introducción al Análisis Matemático', 3, 2, 4, 1, 1),
    (eis_id, 'EST-101', 'Estadística General (Práctica)', 1, 0, 2, 1, 1),
    (eis_id, 'EST-102', 'Estadística General (Teoría)', 2, 2, 2, 1, 1),
    -- Ciclo III
    (eis_id, 'IS-301', 'Programación Orientada a Objetos II', 3, 2, 0, 3, 1),
    (eis_id, 'IS-302', 'Sistémica', 3, 2, 1, 3, 1),
    (eis_id, 'IS-303', 'Ingeniería Gráfica (e)', 2, 1, 1, 3, 1),
    (eis_id, 'MAT-301', 'Matemática Aplicada', 3, 1, 2, 3, 1),
    (eis_id, 'EST-301', 'Estadística Aplicada', 3, 1, 2, 3, 1),
    (eis_id, 'ADM-301', 'Administración General', 2, 2, 2, 3, 1),
    (eis_id, 'FIS-301', 'Física Electrónica', 3, 1, 2, 3, 1),
    (eis_id, 'PSI-301', 'Psicología Organizacional (e)', 2, 2, 2, 3, 1),
    -- Ciclo V
    (eis_id, 'IS-501', 'Ingeniería de Datos I', 4, 2, 1, 5, 1),
    (eis_id, 'IS-502', 'Sistemas de Información', 4, 2, 2, 5, 1),
    (eis_id, 'IS-503', 'Transformación digital', 2, 2, 0, 5, 1),
    (eis_id, 'IS-504', 'Tecnología web', 4, 1, 1, 5, 1),
    (eis_id, 'IS-505', 'Arquitectura de computadoras', 3, 1, 2, 5, 1),
    (eis_id, 'IS-506', 'Teleinformática(e)', 2, 1, 2, 5, 1),
    (eis_id, 'IND-501', 'Investigación de Operaciones', 2, 1, 2, 5, 1),
    (eis_id, 'CF-501', 'Contabilidad Gerencial', 2, 1, 2, 5, 1)
    -- Ciclo VII
    (eis_id, 'IS-701', 'Ingeniería de Software I', 2, 2, 1, 7, 1),
    (eis_id, 'IS-702', 'Redes y Comunicaciones I', 4, 1, 1, 7, 1),
    (eis_id, 'IS-703', 'Negocios Electrónicos (e)', 2, 2, 0, 7, 1),
    (eis_id, 'IS-704', 'Gestión de Servicios de TI', 2, 1, 2, 7, 1),
    (eis_id, 'IS-705', 'Metodología de la Investigación Científica', 2, 2, 2, 7, 1),
    (eis_id, 'IS-706', 'Administración de Base de Datos', 3, 1, 1, 7, 1),
    (eis_id, 'IS-707', 'Planeamiento Estratégico de TI', 4, 1, 2, 7, 1),
    (eis_id, 'IND-701', 'Cadena de Suministros (e)', 2, 2, 2, 7, 1),
    -- Ciclo IX
    (eis_id, 'IS-901', 'Tesis I', 2, 2, 2, 9, 1),
    (eis_id, 'IS-902', 'Analítica de Negocios', 2, 1, 2, 9, 1),
    (eis_id, 'IS-903', 'Auditoría Informática', 3, 1, 2, 9, 1),
    (eis_id, 'IS-904', 'Gestión de Proyectos de TI', 3, 1, 2, 9, 1),
    (eis_id, 'IS-905', 'Emprendimiento Tecnológico', 2, 2, 0, 9, 1),
    (eis_id, 'IS-906', 'Ingeniería Web', 4, 1, 1, 9, 1),
    (eis_id, 'IS-907', 'Computación en la Nube', 4, 1, 1, 9, 1),
    (eis_id, 'IS-908', 'Hackeo Ético (e)', 2, 2, 0, 9, 1),

    -- === CURSOS 2025-II ===
    -- Ciclo II
    (eis_id, 'IS-201', 'Programación Orientada a Objetos I', 4, 2, 0, 2, 2),
    (eis_id, 'SOC-201', 'Sociedad, Cultura y Ecología', 2, 1, 4, 2, 2),
    (eis_id, 'EDU-201', 'Cultura Investigativa y Pensamiento Crítico', 2, 2, 2, 2, 2),
    (eis_id, 'FIL-201', 'Ética, Convivencia Humana y Ciudadanía', 2, 2, 2, 2, 2),
    (eis_id, 'MAT-201', 'Trabajo de Investigación', 2, 2, 4, 2, 2),
    (eis_id, 'FIS-201', 'Física General', 2, 0, 0, 2, 2),
    (eis_id, 'FIS-202', 'Física General', 2, 2, 2, 2, 2),
    -- Ciclo IV
    (eis_id, 'IS-401', 'Diseño Web', 3, 1, 1, 4, 2),
    (eis_id, 'IS-402', 'Computación Gráfica y Visual (e)', 2, 1, 1, 4, 2),
    (eis_id, 'IS-403', 'Sistemas Digitales', 3, 1, 2, 4, 2),
    (eis_id, 'IS-404', 'Estructura de Datos OO', 4, 2, 1, 4, 2),
    (eis_id, 'IS-405', 'Trabajo de Investigación', 2, 1, 2, 4, 2),
    (eis_id, 'IS-406', 'Plataformas Tecnológicas (e)', 2, 2, 0, 4, 2),
    (eis_id, 'FIS-401', 'Pensamiento de diseño', 3, 1, 2, 4, 2),
    (eis_id, 'ECO-401', 'Economía General', 2, 2, 2, 4, 2),
    -- Ciclo VI
    (eis_id, 'IS-601', 'Ingeniería de Requerimientos', 3, 1, 2, 6, 2),
    (eis_id, 'IS-602', 'Sistemas Operativos', 3, 1, 2, 6, 2),
    (eis_id, 'IS-603', 'Ingeniería de Datos II', 4, 2, 1, 6, 2),
    (eis_id, 'IS-604', 'Sistemas Inteligentes', 3, 1, 2, 6, 2),
    (eis_id, 'CF-601', 'Trabajo de Investigación', 2, 1, 2, 6, 2),
    (eis_id, 'IND-601', 'Ingeniería Económica', 2, 1, 2, 6, 2),
    (eis_id, 'FIS-601', 'Gestión del Talento Humano (e)', 3, 2, 2, 6, 2),
    (eis_id, 'AMB-601', 'Ingeniería Ambiental (e)', 2, 2, 2, 6, 2),
    -- Ciclo VIII
    (eis_id, 'IS-801', 'Arquitectura Microservicios (e)', 2, 2, 0, 8, 2),
    (eis_id, 'IS-802', 'Ingeniería de Software II', 4, 2, 1, 8, 2),
    (eis_id, 'IS-803', 'Redes y Comunicaciones II', 2, 1, 1, 8, 2),
    (eis_id, 'IS-804', 'Seguridad de la Información', 3, 1, 2, 8, 2),
    (eis_id, 'IS-805', 'Trabajo de Investigación', 3, 1, 2, 8, 2),
    (eis_id, 'IS-806', 'Internet de las Cosas', 3, 1, 1, 8, 2),
    (eis_id, 'FIS-801', 'Marketing y Medios Sociales', 3, 1, 2, 8, 2),
    (eis_id, 'DER-801', 'Deontología y Derecho Informático', 2, 2, 2, 8, 2),
    -- Ciclo X
    (eis_id, 'IS-1001', 'Arquitectura Empresarial', 2, 1, 2, 10, 2),
    (eis_id, 'IS-1002', 'Aplicaciones Móviles', 3, 1, 1, 10, 2),
    (eis_id, 'IS-1003', 'Trabajo de Investigación A', 3, 2, 2, 10, 2),
    (eis_id, 'IS-1004', 'Gobierno de TIC', 3, 1, 2, 10, 2),
    (eis_id, 'IS-1005', 'Trabajo de Investigación B', 2, 2, 2, 10, 2),
    (eis_id, 'IS-1006', 'Prácticas Pre Profesionales', 4, 2, 1, 10, 2),
    (eis_id, 'FIS-1001', 'Sistemas Info. Empresarial', 3, 2, 2, 10, 2),
    (eis_id, 'IND-1001', 'Responsabilidad Social Corp.', 2, 2, 2, 10, 2)

    ON CONFLICT (codigo) DO NOTHING;
    
    -- Catálogo: Horas laboratorio y cantidad de turnos para cursos de Ciclo V 2026-I
    UPDATE cursos c SET
      horas_laboratorio = 2,
      cantidad_labs = 2,
      bloque_indivisible = true
    WHERE c.codigo IN ('IND-501', 'CF-501');
END $$;


-- ========================================
-- GRUPOS (POR CICLO)
-- ========================================
-- Nota: Todos son Sección A implícitamente. No hay campo sección en esta tabla simplificada.
-- Si un curso tiene dos profesores (ej. Tesis I), se crean dos grupos distintos (numero_grupo 1 y 2).

DO $$
DECLARE
    c_26_i UUID;
    c_25_ii UUID;
    
    -- IDs Cursos 2026-I
    cur_is101 UUID; cur_is102 UUID; cur_is103 UUID; cur_psi101 UUID; cur_mat101 UUID; cur_lnl101 UUID; cur_mat102 UUID; cur_est101 UUID; cur_est102 UUID;
    cur_is301 UUID; cur_is302 UUID; cur_is303 UUID; cur_mat301 UUID; cur_est301 UUID; cur_adm301 UUID; cur_fis301 UUID; cur_psi301 UUID;
    cur_is501 UUID; cur_is502 UUID; cur_is503 UUID; cur_is504 UUID; cur_is505 UUID; cur_is506 UUID; cur_ind501 UUID; cur_cf501 UUID;
    cur_is701 UUID; cur_is702 UUID; cur_is703 UUID; cur_is704 UUID; cur_is705 UUID; cur_is706 UUID; cur_is707 UUID; cur_ind701 UUID;
    cur_is901 UUID; cur_is902 UUID; cur_is903 UUID; cur_is904 UUID; cur_is905 UUID; cur_is906 UUID; cur_is907 UUID; cur_is908 UUID;

    -- IDs Cursos 2025-II
    cur_is201 UUID; cur_soc201 UUID; cur_edu201 UUID; cur_fil201 UUID; cur_mat201 UUID; cur_fis201 UUID; cur_fis202 UUID;
    cur_is401 UUID; cur_is402 UUID; cur_is403 UUID; cur_is404 UUID; cur_is405 UUID; cur_is406 UUID; cur_fis401 UUID; cur_eco401 UUID;
    cur_is601 UUID; cur_is602 UUID; cur_is603 UUID; cur_is604 UUID; cur_cf601 UUID; cur_ind601 UUID; cur_fis601 UUID; cur_amb601 UUID;
    cur_is801 UUID; cur_is802 UUID; cur_is803 UUID; cur_is804 UUID; cur_is805 UUID; cur_is806 UUID; cur_fis801 UUID; cur_der801 UUID;
    cur_is1001 UUID; cur_is1002 UUID; cur_is1003 UUID; cur_is1004 UUID; cur_is1005 UUID; cur_is1006 UUID; cur_fis1001 UUID; cur_ind1001 UUID;

BEGIN
    SELECT id INTO c_26_i FROM ciclos WHERE nombre = '2026-I';
    SELECT id INTO c_25_ii FROM ciclos WHERE nombre = '2025-II';

    -- === GRUPOS 2026-I ===
    -- Ciclo I
    SELECT id INTO cur_is101 FROM cursos WHERE codigo = 'IS-101'; SELECT id INTO cur_is102 FROM cursos WHERE codigo = 'IS-102';
    SELECT id INTO cur_is103 FROM cursos WHERE codigo = 'IS-103'; SELECT id INTO cur_psi101 FROM cursos WHERE codigo = 'PSI-101';
    SELECT id INTO cur_mat101 FROM cursos WHERE codigo = 'MAT-101'; SELECT id INTO cur_lnl101 FROM cursos WHERE codigo = 'LNL-101';
    SELECT id INTO cur_mat102 FROM cursos WHERE codigo = 'MAT-102'; SELECT id INTO cur_est101 FROM cursos WHERE codigo = 'EST-101';
    SELECT id INTO cur_est102 FROM cursos WHERE codigo = 'EST-102';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_26_i, cur_is101, 1, 30, 25), (c_26_i, cur_is102, 2, 30, 25), (c_26_i, cur_is103, 3, 30, 25),
    (c_26_i, cur_psi101, 4, 30, 25), (c_26_i, cur_mat101, 5, 30, 25), (c_26_i, cur_lnl101, 6, 30, 25),
    (c_26_i, cur_mat102, 7, 30, 25), (c_26_i, cur_est101, 8, 30, 25), (c_26_i, cur_est102, 9, 30, 25);

    -- Ciclo III
    SELECT id INTO cur_is301 FROM cursos WHERE codigo = 'IS-301'; SELECT id INTO cur_is302 FROM cursos WHERE codigo = 'IS-302';
    SELECT id INTO cur_is303 FROM cursos WHERE codigo = 'IS-303'; SELECT id INTO cur_mat301 FROM cursos WHERE codigo = 'MAT-301';
    SELECT id INTO cur_est301 FROM cursos WHERE codigo = 'EST-301'; SELECT id INTO cur_adm301 FROM cursos WHERE codigo = 'ADM-301';
    SELECT id INTO cur_fis301 FROM cursos WHERE codigo = 'FIS-301'; SELECT id INTO cur_psi301 FROM cursos WHERE codigo = 'PSI-301';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_26_i, cur_is301, 1, 30, 25), (c_26_i, cur_is302, 2, 30, 25), (c_26_i, cur_is303, 3, 30, 25),
    (c_26_i, cur_mat301, 4, 30, 25), (c_26_i, cur_est301, 5, 30, 25), (c_26_i, cur_adm301, 6, 30, 25),
    (c_26_i, cur_fis301, 7, 30, 25), (c_26_i, cur_psi301, 8, 30, 25);

    -- Ciclo V
    SELECT id INTO cur_is501 FROM cursos WHERE codigo = 'IS-501'; SELECT id INTO cur_is502 FROM cursos WHERE codigo = 'IS-502';
    SELECT id INTO cur_is503 FROM cursos WHERE codigo = 'IS-503'; SELECT id INTO cur_is504 FROM cursos WHERE codigo = 'IS-504';
    SELECT id INTO cur_is505 FROM cursos WHERE codigo = 'IS-505'; SELECT id INTO cur_is506 FROM cursos WHERE codigo = 'IS-506';
    SELECT id INTO cur_ind501 FROM cursos WHERE codigo = 'IND-501'; SELECT id INTO cur_cf501 FROM cursos WHERE codigo = 'CF-501';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_26_i, cur_is501, 1, 30, 25), (c_26_i, cur_is502, 2, 30, 25), (c_26_i, cur_is503, 3, 30, 25),
    (c_26_i, cur_is504, 4, 30, 25), (c_26_i, cur_is505, 5, 30, 25), (c_26_i, cur_is506, 6, 30, 25),
    (c_26_i, cur_ind501, 7, 30, 25), (c_26_i, cur_ind501, 8, 30, 25), (c_26_i, cur_ind501, 9, 30, 25),
    (c_26_i, cur_cf501, 10, 30, 25);

    -- Ciclo VII
    SELECT id INTO cur_is701 FROM cursos WHERE codigo = 'IS-701'; SELECT id INTO cur_is702 FROM cursos WHERE codigo = 'IS-702';
    SELECT id INTO cur_is703 FROM cursos WHERE codigo = 'IS-703'; SELECT id INTO cur_is704 FROM cursos WHERE codigo = 'IS-704';
    SELECT id INTO cur_is705 FROM cursos WHERE codigo = 'IS-705'; SELECT id INTO cur_is706 FROM cursos WHERE codigo = 'IS-706';
    SELECT id INTO cur_is707 FROM cursos WHERE codigo = 'IS-707'; SELECT id INTO cur_ind701 FROM cursos WHERE codigo = 'IND-701';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_26_i, cur_is701, 1, 30, 25), (c_26_i, cur_is702, 2, 30, 25), (c_26_i, cur_is703, 3, 30, 25),
    (c_26_i, cur_is704, 4, 30, 25), (c_26_i, cur_is705, 5, 30, 25), (c_26_i, cur_is706, 6, 30, 25),
    (c_26_i, cur_is707, 7, 30, 25), (c_26_i, cur_ind701, 8, 30, 25),
    (c_26_i, cur_is703, 9, 30, 25), (c_26_i, cur_ind701, 10, 30, 25); -- Grupos extra por repetición de curso/profesor

    -- Ciclo IX
    SELECT id INTO cur_is901 FROM cursos WHERE codigo = 'IS-901'; SELECT id INTO cur_is902 FROM cursos WHERE codigo = 'IS-902';
    SELECT id INTO cur_is903 FROM cursos WHERE codigo = 'IS-903'; SELECT id INTO cur_is904 FROM cursos WHERE codigo = 'IS-904';
    SELECT id INTO cur_is905 FROM cursos WHERE codigo = 'IS-905'; SELECT id INTO cur_is906 FROM cursos WHERE codigo = 'IS-906';
    SELECT id INTO cur_is907 FROM cursos WHERE codigo = 'IS-907'; SELECT id INTO cur_is908 FROM cursos WHERE codigo = 'IS-908';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_26_i, cur_is901, 1, 30, 25), (c_26_i, cur_is901, 2, 30, 25), (c_26_i, cur_is902, 3, 30, 25),
    (c_26_i, cur_is903, 4, 30, 25), (c_26_i, cur_is904, 5, 30, 25), (c_26_i, cur_is905, 6, 30, 25),
    (c_26_i, cur_is906, 7, 30, 25), (c_26_i, cur_is907, 8, 30, 25), (c_26_i, cur_is908, 9, 30, 25);


    -- === GRUPOS 2025-II ===
    -- Ciclo II
    SELECT id INTO cur_is201 FROM cursos WHERE codigo = 'IS-201'; SELECT id INTO cur_soc201 FROM cursos WHERE codigo = 'SOC-201';
    SELECT id INTO cur_edu201 FROM cursos WHERE codigo = 'EDU-201'; SELECT id INTO cur_fil201 FROM cursos WHERE codigo = 'FIL-201';
    SELECT id INTO cur_mat201 FROM cursos WHERE codigo = 'MAT-201'; SELECT id INTO cur_fis201 FROM cursos WHERE codigo = 'FIS-201';
    SELECT id INTO cur_fis202 FROM cursos WHERE codigo = 'FIS-202';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_25_ii, cur_is201, 1, 30, 25), (c_25_ii, cur_soc201, 2, 30, 25), (c_25_ii, cur_edu201, 3, 30, 25),
    (c_25_ii, cur_fil201, 4, 30, 25), (c_25_ii, cur_mat201, 5, 30, 25), (c_25_ii, cur_fis201, 6, 30, 25),
    (c_25_ii, cur_fis202, 7, 30, 25);

    -- Ciclo IV
    SELECT id INTO cur_is401 FROM cursos WHERE codigo = 'IS-401'; SELECT id INTO cur_is402 FROM cursos WHERE codigo = 'IS-402';
    SELECT id INTO cur_is403 FROM cursos WHERE codigo = 'IS-403'; SELECT id INTO cur_is404 FROM cursos WHERE codigo = 'IS-404';
    SELECT id INTO cur_is405 FROM cursos WHERE codigo = 'IS-405'; SELECT id INTO cur_is406 FROM cursos WHERE codigo = 'IS-406';
    SELECT id INTO cur_fis401 FROM cursos WHERE codigo = 'FIS-401'; SELECT id INTO cur_eco401 FROM cursos WHERE codigo = 'ECO-401';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_25_ii, cur_is401, 1, 30, 25), (c_25_ii, cur_is402, 2, 30, 25), (c_25_ii, cur_is403, 3, 30, 25),
    (c_25_ii, cur_is404, 4, 30, 25), (c_25_ii, cur_is405, 5, 30, 25), (c_25_ii, cur_is406, 6, 30, 25),
    (c_25_ii, cur_fis401, 7, 30, 25), (c_25_ii, cur_eco401, 8, 30, 25);

    -- Ciclo VI
    SELECT id INTO cur_is601 FROM cursos WHERE codigo = 'IS-601'; SELECT id INTO cur_is602 FROM cursos WHERE codigo = 'IS-602';
    SELECT id INTO cur_is603 FROM cursos WHERE codigo = 'IS-603'; SELECT id INTO cur_is604 FROM cursos WHERE codigo = 'IS-604';
    SELECT id INTO cur_cf601 FROM cursos WHERE codigo = 'CF-601'; SELECT id INTO cur_ind601 FROM cursos WHERE codigo = 'IND-601';
    SELECT id INTO cur_fis601 FROM cursos WHERE codigo = 'FIS-601'; SELECT id INTO cur_amb601 FROM cursos WHERE codigo = 'AMB-601';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_25_ii, cur_is601, 1, 30, 25), (c_25_ii, cur_is602, 2, 30, 25), (c_25_ii, cur_is603, 3, 30, 25),
    (c_25_ii, cur_is604, 4, 30, 25), (c_25_ii, cur_cf601, 5, 30, 25), (c_25_ii, cur_ind601, 6, 30, 25),
    (c_25_ii, cur_fis601, 7, 30, 25), (c_25_ii, cur_amb601, 8, 30, 25);

    -- Ciclo VIII
    SELECT id INTO cur_is801 FROM cursos WHERE codigo = 'IS-801'; SELECT id INTO cur_is802 FROM cursos WHERE codigo = 'IS-802';
    SELECT id INTO cur_is803 FROM cursos WHERE codigo = 'IS-803'; SELECT id INTO cur_is804 FROM cursos WHERE codigo = 'IS-804';
    SELECT id INTO cur_is805 FROM cursos WHERE codigo = 'IS-805'; SELECT id INTO cur_is806 FROM cursos WHERE codigo = 'IS-806';
    SELECT id INTO cur_fis801 FROM cursos WHERE codigo = 'FIS-801'; SELECT id INTO cur_der801 FROM cursos WHERE codigo = 'DER-801';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_25_ii, cur_is801, 1, 30, 25), (c_25_ii, cur_is802, 2, 30, 25), (c_25_ii, cur_is803, 3, 30, 25),
    (c_25_ii, cur_is804, 4, 30, 25), (c_25_ii, cur_is805, 5, 30, 25), (c_25_ii, cur_is806, 6, 30, 25),
    (c_25_ii, cur_fis801, 7, 30, 25), (c_25_ii, cur_der801, 8, 30, 25);

    -- Ciclo X
    SELECT id INTO cur_is1001 FROM cursos WHERE codigo = 'IS-1001'; SELECT id INTO cur_is1002 FROM cursos WHERE codigo = 'IS-1002';
    SELECT id INTO cur_is1003 FROM cursos WHERE codigo = 'IS-1003'; SELECT id INTO cur_is1004 FROM cursos WHERE codigo = 'IS-1004';
    SELECT id INTO cur_is1005 FROM cursos WHERE codigo = 'IS-1005'; SELECT id INTO cur_is1006 FROM cursos WHERE codigo = 'IS-1006';
    SELECT id INTO cur_fis1001 FROM cursos WHERE codigo = 'FIS-1001'; SELECT id INTO cur_ind1001 FROM cursos WHERE codigo = 'IND-1001';
    INSERT INTO grupos (ciclo_id, curso_id, numero_grupo, max_alumnos, num_alumnos) VALUES
    (c_25_ii, cur_is1001, 1, 30, 25), (c_25_ii, cur_is1002, 2, 30, 25), (c_25_ii, cur_is1003, 3, 30, 25),
    (c_25_ii, cur_is1004, 4, 30, 25), (c_25_ii, cur_is1005, 5, 30, 25), (c_25_ii, cur_is1006, 6, 30, 25),
    (c_25_ii, cur_fis1001, 7, 30, 25), (c_25_ii, cur_ind1001, 8, 30, 25);

END $$;

-- ========================================
-- MÓDULO DE PROGRAMACIÓN POR FASES (P4)
-- ========================================

CREATE TABLE IF NOT EXISTS programaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ciclo_id UUID REFERENCES ciclos(id) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  fase INTEGER NOT NULL DEFAULT 1 CHECK (fase BETWEEN 1 AND 4),
  estado VARCHAR(20) DEFAULT 'borrador' CHECK (estado IN ('borrador','en_disponibilidad','en_programacion','publicado','cancelado')),
  config JSONB DEFAULT '{}',
  created_by UUID REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  publicado_at TIMESTAMP,
  publicado_por UUID REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_prog_ciclo ON programaciones(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_prog_estado ON programaciones(estado);

CREATE TABLE IF NOT EXISTS programacion_cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programacion_id UUID REFERENCES programaciones(id) ON DELETE CASCADE,
  curso_id UUID REFERENCES cursos(id),
  grupo_id UUID REFERENCES grupos(id),
  docente_id UUID REFERENCES docentes(id),
  horas_teoria INTEGER NOT NULL DEFAULT 0,
  horas_practica INTEGER NOT NULL DEFAULT 0,
  horas_laboratorio INTEGER NOT NULL DEFAULT 0,
  horas_consejeria INTEGER NOT NULL DEFAULT 0,
  seccion VARCHAR(10),
  notas TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(programacion_id, grupo_id)
);

CREATE INDEX IF NOT EXISTS idx_pc_prog ON programacion_cursos(programacion_id);

CREATE TABLE IF NOT EXISTS disponibilidad_docente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programacion_id UUID REFERENCES programaciones(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES docentes(id),
  slot_id UUID REFERENCES slots_tiempo(id),
  dia dia_semana NOT NULL,
  disponible BOOLEAN DEFAULT true,
  prioridad INTEGER CHECK (prioridad IN (1, 2)),
  registrado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(programacion_id, docente_id, slot_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_disp_prog ON disponibilidad_docente(programacion_id);
CREATE INDEX IF NOT EXISTS idx_disp_doc ON disponibilidad_docente(docente_id);

CREATE TABLE IF NOT EXISTS conflictos_horario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programacion_id UUID REFERENCES programaciones(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  severidad VARCHAR(20) DEFAULT 'error' CHECK (severidad IN ('error','warning','info')),
  descripcion TEXT NOT NULL,
  datos JSONB,
  sugerencia TEXT,
  resuelto BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conf_prog ON conflictos_horario(programacion_id);

-- ========================================
-- SANEAMIENTO: Consolidación preventiva de duplicados
-- (No debería encontrar duplicados con el seed actual, pero se mantiene como safety-net)
-- ========================================

-- 1. Consolidación de duplicados exactos (nombre + apellidos idénticos)
DO $$
DECLARE
    r RECORD;
    keep_id UUID;
    remove_id UUID;
BEGIN
    FOR r IN 
        SELECT nombre, apellidos, COUNT(*) as cnt 
        FROM docentes 
        GROUP BY nombre, apellidos 
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO keep_id 
        FROM docentes 
        WHERE nombre = r.nombre AND apellidos = r.apellidos 
        ORDER BY created_at ASC, id ASC 
        LIMIT 1;

        FOR remove_id IN 
            SELECT id 
            FROM docentes 
            WHERE nombre = r.nombre AND apellidos = r.apellidos AND id <> keep_id
        LOOP
            UPDATE programacion_cursos SET docente_id = keep_id WHERE docente_id = remove_id;
            UPDATE asignaciones SET docente_id = keep_id WHERE docente_id = remove_id;
            UPDATE disponibilidad_docente SET docente_id = keep_id WHERE docente_id = remove_id;
            DELETE FROM docentes WHERE id = remove_id;
        END LOOP;
        
        RAISE NOTICE 'Consolidadas duplicidades para: % %', r.nombre, r.apellidos;
    END LOOP;
END $$;

-- ========================================
-- CREACIÓN DE CUENTAS DE USUARIO Y DISPONIBILIDAD PARA DOCENTES
-- ========================================

-- 1. Crear cuentas de usuario para todos los docentes activos que no las tengan
DO $$
DECLARE
    doc RECORD;
    new_user_id UUID;
BEGIN
    FOR doc IN 
        SELECT * FROM docentes WHERE usuario_id IS NULL AND email IS NOT NULL
    LOOP
        -- Verificar si ya existe un usuario con ese email
        SELECT id INTO new_user_id FROM usuarios WHERE email = doc.email;
        
        IF new_user_id IS NULL THEN
            INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol)
            VALUES (doc.nombre, doc.apellidos, doc.email, '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'docente')
            RETURNING id INTO new_user_id;
        END IF;

        UPDATE docentes SET usuario_id = new_user_id WHERE id = doc.id;
    END LOOP;
    RAISE NOTICE 'Cuentas de usuario creadas para todos los docentes con contraseña: password';
END $$;

-- 2. Disponibilidad de ambientes (base global, no por programación)
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

-- Poblar ambientes: aulas lun-sáb casi completas; labs con mantenimiento sáb tarde
CREATE OR REPLACE FUNCTION poblar_disponibilidad_ambientes()
RETURNS INTEGER AS $$
DECLARE
    amb RECORD;
    dia_val dia_semana;
    dias_lab dia_semana[] := ARRAY['lunes','martes','miercoles','jueves','viernes','sabado']::dia_semana[];
    dias_aula dia_semana[] := ARRAY['lunes','martes','miercoles','jueves','viernes','sabado']::dia_semana[];
    total INTEGER := 0;
    n INTEGER;
    hash_v INTEGER;
BEGIN
    DELETE FROM disponibilidad_ambiente;

    FOR amb IN SELECT id, codigo, tipo FROM ambientes WHERE disponible = true LOOP
        IF amb.tipo = 'auditorio' THEN
            CONTINUE;
        END IF;

        IF amb.tipo = 'laboratorio' THEN
            FOREACH dia_val IN ARRAY dias_lab LOOP
                n := insert_disp_ambiente_rango(amb.id, dia_val, 1, 14, 'disponible', NULL);
                total := total + n;
            END LOOP;
        ELSE
            FOREACH dia_val IN ARRAY dias_aula LOOP
                n := insert_disp_ambiente_rango(amb.id, dia_val, 1, 14, 'disponible', NULL);
                total := total + n;
                hash_v := abs(hashtext(amb.codigo || dia_val::text));
                IF (hash_v % 12) = 0 THEN
                    PERFORM insert_disp_ambiente_rango(amb.id, dia_val, 10, 11, 'mantenimiento', 'Mantenimiento semanal');
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Disponibilidad docente — ALTA FLEXIBILIDAD (mínimo 20h por docente)
-- Todos los perfiles garantizan bloques amplios lun-sáb para que el CSP tenga espacio suficiente
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
            -- PERFIL A (muy flexible): lun-vie mañana + tarde completa + sáb
            -- ~48h disponibles (P1) + sáb (P2)
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 8, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 8, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 8, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 8, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 8, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    9, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    9, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   9, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 6, 2);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    7, 11, 2);

        ELSIF perfil = 1 THEN
            -- PERFIL B (flexible): 5 días mañana + tardes lun/mié/vie + sáb
            -- ~38h disponibles (P1) + extras (P2)
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 6, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 6, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 6, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 6, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 6, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     8, 13, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 8, 13, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   8, 13, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 5, 2);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    6, 10, 2);

        ELSE
            -- PERFIL C (amplio): 5 días mañana + tardes mar/jue + sáb
            -- ~28h disponibles (P1) + extras (P2) — mínimo garantizado
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 5, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 5, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 5, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 5, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 5, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    8, 13, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    8, 13, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 5, 2);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    6, 9, 2);
        END IF;
    END LOOP;

    -- Refuerzo GARANTIZADO: cualquier docente con carga asignada tiene mínimo 20h
    FOR doc IN
        SELECT d.id,
               COALESCE(SUM(pc.horas_teoria + pc.horas_practica + pc.horas_laboratorio), 0) + 2 AS requeridas
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

        -- Garantizar mínimo 20h: rellenar lun-vie completo si hace falta
        IF horas_disp < 20 THEN
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     1, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'martes',    1, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 1, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'jueves',    1, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'viernes',   1, 14, 1);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 8, 2);
        END IF;

        -- Si la carga supera las 20h, agregar más franjas P2
        horas_req := GREATEST(doc.requeridas, 20);
        SELECT COUNT(*) INTO horas_disp
        FROM disponibilidad_docente
        WHERE programacion_id = p_programacion_id AND docente_id = doc.id;

        IF horas_disp < horas_req THEN
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'lunes',     9, 14, 2);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'miercoles', 9, 14, 2);
            insertados := insertados + insert_disp_docente_rango(p_programacion_id, doc.id, 'sabado',    1, 14, 2);
        END IF;
    END LOOP;

    RETURN insertados;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generar_disponibilidad_automatica()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM poblar_disponibilidad_programacion(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_disponibilidad ON programaciones;
CREATE TRIGGER trg_generar_disponibilidad
AFTER INSERT ON programaciones
FOR EACH ROW
EXECUTE FUNCTION generar_disponibilidad_automatica();

-- 3. Programación demo 2026-I + cursos con docentes (necesaria para ver disponibilidad en Fase 2)
DO $$
DECLARE
    c_26_i UUID;
    admin_id UUID;
    prog_id UUID;
    g RECORD;
    docentes_arr UUID[];
    doc_idx INTEGER := 0;
    doc_id UUID;
    n_cursos INTEGER := 0;
BEGIN
    SELECT id INTO c_26_i FROM ciclos WHERE nombre = '2026-I';
    SELECT id INTO admin_id FROM usuarios WHERE email = 'admin@unt.edu.pe' LIMIT 1;

    IF c_26_i IS NULL THEN
        RAISE EXCEPTION 'Ciclo 2026-I no encontrado en seed';
    END IF;

    SELECT id INTO prog_id FROM programaciones WHERE ciclo_id = c_26_i AND nombre = 'HORARIO 2026-I' LIMIT 1;

    IF prog_id IS NULL THEN
        INSERT INTO programaciones (ciclo_id, nombre, fase, estado, created_by)
        VALUES (c_26_i, 'HORARIO 2026-I', 2, 'en_disponibilidad', admin_id)
        RETURNING id INTO prog_id;
    ELSE
        UPDATE programaciones SET fase = 2, estado = 'en_disponibilidad', updated_at = NOW()
        WHERE id = prog_id;
    END IF;

    SELECT ARRAY_AGG(id ORDER BY
        CASE categoria WHEN 'principal' THEN 0 WHEN 'asociado' THEN 1 WHEN 'auxiliar' THEN 2 ELSE 3 END,
        fecha_ingreso
    ) INTO docentes_arr
    FROM docentes WHERE activo = true;

    IF docentes_arr IS NULL OR array_length(docentes_arr, 1) = 0 THEN
        RAISE EXCEPTION 'No hay docentes activos en seed';
    END IF;

    FOR g IN
        SELECT gr.id AS grupo_id, cu.id AS curso_id,
               cu.horas_teoria,
               COALESCE(cu.horas_practica, 0) AS horas_practica,
               COALESCE(cu.horas_laboratorio, 0) AS horas_laboratorio
        FROM grupos gr
        JOIN cursos cu ON cu.id = gr.curso_id
        WHERE gr.ciclo_id = c_26_i
        ORDER BY cu.ciclo_plan, cu.codigo
    LOOP
        doc_id := docentes_arr[1 + (doc_idx % array_length(docentes_arr, 1))];
        doc_idx := doc_idx + 1;

        INSERT INTO programacion_cursos (
            programacion_id, curso_id, grupo_id, docente_id,
            horas_teoria, horas_practica, horas_laboratorio, horas_consejeria
        ) VALUES (
            prog_id, g.curso_id, g.grupo_id, doc_id,
            g.horas_teoria, g.horas_practica, g.horas_laboratorio, 1
        )
        ON CONFLICT (programacion_id, grupo_id) DO UPDATE SET
            docente_id = EXCLUDED.docente_id,
            horas_teoria = EXCLUDED.horas_teoria,
            horas_practica = EXCLUDED.horas_practica,
            horas_laboratorio = EXCLUDED.horas_laboratorio,
            horas_consejeria = EXCLUDED.horas_consejeria;

        UPDATE grupos SET num_alumnos = GREATEST(COALESCE(num_alumnos, 0), 35)
        WHERE id = g.grupo_id AND COALESCE(num_alumnos, 0) < 25;

        n_cursos := n_cursos + 1;
    END LOOP;

    RAISE NOTICE 'Programacion demo: HORARIO 2026-I (% cursos, fase 2)', n_cursos;
END $$;

-- 4. Disponibilidad de ambientes (global)
DO $$
DECLARE
    n_amb INTEGER;
BEGIN
    n_amb := poblar_disponibilidad_ambientes();
    RAISE NOTICE 'Disponibilidad ambientes: % celdas', n_amb;
END $$;

-- 5. Regenerar disponibilidad docente (bloques contiguos) para TODAS las programaciones
DO $$
DECLARE
    prog RECORD;
    total_celdas INTEGER := 0;
    filas INTEGER;
BEGIN
    FOR prog IN SELECT id, nombre FROM programaciones ORDER BY nombre LOOP
        filas := poblar_disponibilidad_programacion(prog.id);
        total_celdas := total_celdas + filas;
        RAISE NOTICE 'Disponibilidad docente: % (% celdas)', prog.nombre, filas;
    END LOOP;

    IF total_celdas = 0 THEN
        RAISE WARNING 'No se genero disponibilidad: no hay programaciones en la BD';
    ELSE
        RAISE NOTICE 'TOTAL disponibilidad docente: % celdas (P1 preferida + P2 aceptable)', total_celdas;
    END IF;
END $$;

-- 6. Vistas de pre-validación CSP
CREATE OR REPLACE VIEW v_docente_bloques_contiguos AS
WITH ordenado AS (
  SELECT
    dd.programacion_id, dd.docente_id, dd.dia, st.orden,
    LAG(st.orden) OVER (PARTITION BY dd.programacion_id, dd.docente_id, dd.dia ORDER BY st.orden) AS orden_prev
  FROM disponibilidad_docente dd
  JOIN slots_tiempo st ON st.id = dd.slot_id
  WHERE dd.disponible = true AND st.hora_inicio <> '13:00'::time
),
grupos AS (
  SELECT *,
    SUM(CASE WHEN orden_prev IS NULL OR orden = orden_prev + 1 THEN 0 ELSE 1 END)
      OVER (PARTITION BY programacion_id, docente_id, dia ORDER BY orden) AS grp
  FROM ordenado
)
SELECT programacion_id, docente_id, dia, grp,
       COUNT(*) AS horas_consecutivas, MIN(orden) AS orden_inicio, MAX(orden) AS orden_fin
FROM grupos
GROUP BY programacion_id, docente_id, dia, grp;

CREATE OR REPLACE VIEW v_docente_resumen_disponibilidad AS
SELECT
  dd.programacion_id, d.id AS docente_id,
  d.nombre || ' ' || d.apellidos AS docente_nombre, d.categoria,
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

-- Catálogo: turnos de laboratorio (horas por turno × cantidad_labs)
UPDATE cursos SET horas_teoria = 2, horas_practica = 0, horas_laboratorio = 4, cantidad_labs = 3, bloque_indivisible = true WHERE codigo = 'IS-201';
UPDATE cursos SET horas_teoria = 1, horas_practica = 0, horas_laboratorio = 3, cantidad_labs = 2, bloque_indivisible = true WHERE codigo = 'IS-401';
UPDATE cursos SET horas_teoria = 2, horas_practica = 0, horas_laboratorio = 2, cantidad_labs = 3, bloque_indivisible = true WHERE codigo = 'FIS-1001';

-- 7. Verificación del seed (≥85% docentes con ventana 4h+)
DO $$
DECLARE
    r RECORD;
    pct_4h NUMERIC;
    problemas INTEGER;
BEGIN
    FOR r IN
        SELECT p.nombre AS prog,
               COUNT(DISTINCT dd.docente_id) AS docentes,
               COUNT(dd.id) AS celdas,
               COUNT(dd.id) FILTER (WHERE dd.prioridad = 1) AS p1
        FROM programaciones p
        LEFT JOIN disponibilidad_docente dd ON dd.programacion_id = p.id
        GROUP BY p.id, p.nombre
    LOOP
        RAISE NOTICE 'CHECK %: % docentes, % celdas (P1=%)', r.prog, r.docentes, r.celdas, r.p1;
    END LOOP;

    FOR r IN SELECT id, nombre FROM programaciones LOOP
        SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE max_bloque_continuo >= 4) / NULLIF(COUNT(*), 0), 1)
        INTO pct_4h
        FROM v_docente_resumen_disponibilidad
        WHERE programacion_id = r.id;

        SELECT COUNT(*) INTO problemas
        FROM v_pre_validacion_csp
        WHERE programacion_id = r.id AND estado <> 'ok';

        RAISE NOTICE 'VALIDACION %: %.1f%% docentes con bloque 4h+ | docentes con alerta CSP: %',
            r.nombre, pct_4h, problemas;
    END LOOP;
END $$;

-- ========================================
-- FIN DEL SCRIPT
-- ========================================

