-- ========================================
-- SISTEMA DE HORARIOS - UNIVERSIDAD NACIONAL DE TRUJILLO
-- Escuela de Ingeniería de Sistemas
-- ========================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============= TABLAS BASE =============

-- Roles del sistema
CREATE TYPE rol_usuario AS ENUM ('admin', 'secretaria', 'docente', 'director_escuela');

-- Usuarios del sistema
CREATE TABLE usuarios (
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
CREATE TYPE categoria_docente AS ENUM ('principal', 'asociado', 'auxiliar', 'jefe_practica');
CREATE TYPE condicion_docente AS ENUM ('nombrado', 'contratado');
CREATE TYPE tipo_grado AS ENUM ('bachiller', 'licenciado', 'magister', 'doctor');

-- Docentes
CREATE TABLE docentes (
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

-- Tipos de ciclo
CREATE TYPE tipo_ciclo AS ENUM ('regular', 'extraordinario');

-- Ciclos académicos
CREATE TABLE ciclos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(50) NOT NULL,
  año INTEGER NOT NULL,
  semestre VARCHAR(3) NOT NULL,
  tipo tipo_ciclo DEFAULT 'regular',
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (
    (tipo = 'regular' AND semestre IN ('I', 'II')) OR
    (tipo = 'extraordinario' AND semestre IN ('EXT'))
  )
);

-- Tipos de ambiente
CREATE TYPE tipo_ambiente AS ENUM ('aula', 'laboratorio', 'auditorio');

-- Aulas y laboratorios
CREATE TABLE ambientes (
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
CREATE TABLE escuelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(200) NOT NULL,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cursos
CREATE TABLE cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escuela_id UUID REFERENCES escuelas(id),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  creditos INTEGER NOT NULL DEFAULT 3,
  horas_teoria INTEGER NOT NULL DEFAULT 3,
  horas_practica INTEGER NOT NULL DEFAULT 0,
  ciclo_plan INTEGER,
  semestre INTEGER,
  prerequisitos UUID[],
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Grupos de cursos por ciclo
CREATE TABLE grupos (
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
CREATE TYPE dia_semana AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado');
CREATE TYPE tipo_sesion AS ENUM ('teoria', 'practica', 'laboratorio');

-- Slots de tiempo disponibles
CREATE TABLE slots_tiempo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  orden INTEGER NOT NULL,
  UNIQUE(hora_inicio, hora_fin)
);

-- ============= HORARIOS =============

-- Asignaciones de horario
CREATE TABLE asignaciones (
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

CREATE TYPE accion_auditoria AS ENUM (
  'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 
  'GENERATE_SCHEDULE', 'EXPORT_REPORT', 'ASSIGN', 'UNASSIGN'
);

CREATE TABLE auditoria (
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

CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);
CREATE INDEX idx_auditoria_fecha ON auditoria(created_at);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla_afectada);

-- ============= DATOS INICIALES =============

-- Escuela
INSERT INTO escuelas (nombre, codigo) VALUES 
('Escuela de Ingeniería de Sistemas', 'EIS');

-- Ciclo activo
INSERT INTO ciclos (nombre, año, semestre, fecha_inicio, fecha_fin, activo) VALUES
('2024-I', 2024, 'I', '2024-04-01', '2024-07-31', false),
('2024-II', 2024, 'II', '2024-08-01', '2024-11-30', true);

-- Slots de tiempo
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
('20:00 - 21:00', '20:00', '21:00', 14);

-- Ambientes
INSERT INTO ambientes (codigo, nombre, tipo, capacidad, piso, edificio) VALUES
('A-101', 'Aula 101', 'aula', 40, 1, 'Pabellón A'),
('A-102', 'Aula 102', 'aula', 40, 1, 'Pabellón A'),
('A-201', 'Aula 201', 'aula', 35, 2, 'Pabellón A'),
('A-202', 'Aula 202', 'aula', 35, 2, 'Pabellón A'),
('A-301', 'Aula 301', 'aula', 30, 3, 'Pabellón A'),
('B-101', 'Aula B-101', 'aula', 45, 1, 'Pabellón B'),
('B-201', 'Aula B-201', 'aula', 40, 2, 'Pabellón B'),
('L-101', 'Lab. Computación I', 'laboratorio', 30, 1, 'Laboratorios'),
('L-102', 'Lab. Computación II', 'laboratorio', 30, 1, 'Laboratorios'),
('L-201', 'Lab. Redes', 'laboratorio', 25, 2, 'Laboratorios'),
('L-202', 'Lab. Software', 'laboratorio', 28, 2, 'Laboratorios'),
('L-301', 'Lab. Base de Datos', 'laboratorio', 30, 3, 'Laboratorios');

-- Usuario admin por defecto (password: admin123)
INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol) VALUES
('Administrador', 'Sistema', 'admin@unt.edu.pe', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),
('María', 'García López', 'secretaria@unt.edu.pe', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'secretaria'),
('Sanchez', 'Perez, Roberto', 'director@unitru.edu.pe', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'director_escuela');

-- Cursos EIS
INSERT INTO cursos (escuela_id, codigo, nombre, creditos, horas_teoria, horas_practica, ciclo_plan) 
SELECT e.id, c.codigo, c.nombre, c.cred, c.ht, c.hp, c.ciclo
FROM escuelas e,
(VALUES
  ('EIS-101', 'Fundamentos de Programación', 4, 3, 2, 1),
  ('EIS-102', 'Matemática I', 4, 4, 0, 1),
  ('EIS-103', 'Física I', 4, 3, 2, 1),
  ('EIS-104', 'Introducción a Ingeniería de Sistemas', 3, 3, 0, 1),
  ('EIS-201', 'Programación Orientada a Objetos', 4, 3, 2, 2),
  ('EIS-202', 'Matemática II', 4, 4, 0, 2),
  ('EIS-203', 'Estructura de Datos', 4, 3, 2, 3),
  ('EIS-204', 'Base de Datos I', 4, 3, 2, 3),
  ('EIS-205', 'Sistemas Operativos', 4, 3, 2, 4),
  ('EIS-206', 'Redes de Computadoras', 4, 3, 2, 4),
  ('EIS-301', 'Ingeniería de Software I', 4, 3, 2, 5),
  ('EIS-302', 'Inteligencia Artificial', 4, 3, 2, 5),
  ('EIS-303', 'Seguridad Informática', 3, 3, 0, 6),
  ('EIS-304', 'Desarrollo Web', 4, 2, 4, 6),
  ('EIS-401', 'Proyecto de Tesis I', 3, 2, 2, 9),
  ('EIS-402', 'Proyecto de Tesis II', 3, 2, 2, 10)
) AS c(codigo, nombre, cred, ht, hp, ciclo)
WHERE e.codigo = 'EIS';

-- Docentes de ejemplo
INSERT INTO docentes (codigo, nombre, apellidos, dni, email, categoria, condicion, fecha_ingreso, grado_academico, horas_max_semana)
VALUES
('D001', 'Carlos', 'Mendoza Ríos', '12345678', 'cmendoza@unt.edu.pe', 'principal', 'nombrado', '1995-03-15', 'doctor', 20),
('D002', 'Ana', 'Torres Vásquez', '23456789', 'atorres@unt.edu.pe', 'principal', 'nombrado', '1998-08-01', 'doctor', 20),
('D003', 'Roberto', 'Silva Paredes', '34567890', 'rsilva@unt.edu.pe', 'asociado', 'nombrado', '2002-03-10', 'magister', 20),
('D004', 'Patricia', 'Luján Castro', '45678901', 'plujan@unt.edu.pe', 'asociado', 'nombrado', '2005-04-20', 'magister', 20),
('D005', 'Jorge', 'Ramírez Flores', '56789012', 'jramirez@unt.edu.pe', 'auxiliar', 'nombrado', '2010-03-01', 'magister', 20),
('D006', 'Carmen', 'Díaz Morales', '67890123', 'cdiaz@unt.edu.pe', 'auxiliar', 'nombrado', '2012-08-15', 'licenciado', 20),
('D007', 'Luis', 'Pérez Anticona', '78901234', 'lperez@unt.edu.pe', 'jefe_practica', 'nombrado', '2015-03-01', 'licenciado', 18),
('D008', 'María', 'Reyes Gutiérrez', '89012345', 'mreyes@unt.edu.pe', 'principal', 'contratado', '2003-01-10', 'doctor', 16),
('D009', 'Pedro', 'Aguilar Herrera', '90123456', 'paguilar@unt.edu.pe', 'asociado', 'contratado', '2008-03-01', 'magister', 16),
('D010', 'Rosa', 'Infante Quiñones', '01234567', 'rinfante@unt.edu.pe', 'auxiliar', 'contratado', '2018-08-01', 'bachiller', 16);
