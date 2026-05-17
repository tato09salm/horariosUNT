-- ========================================
-- MIGRACIÓN 001: Sistema de Horarios por Fases
-- Persona 4 — NO modifica schema.sql (P1)
-- Ejecutar: psql -U postgres -d horariosUNT -f lib/migrations/001_horarios_phases.sql
-- ========================================

-- Programaciones: sesión de creación de horario (4 fases)
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

-- Cursos incluidos en una programación (con atributos modificables)
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

-- Disponibilidad docente para una programación
CREATE TABLE IF NOT EXISTS disponibilidad_docente (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  programacion_id UUID REFERENCES programaciones(id) ON DELETE CASCADE,
  docente_id UUID REFERENCES docentes(id),
  slot_id UUID REFERENCES slots_tiempo(id),
  dia dia_semana NOT NULL,
  disponible BOOLEAN DEFAULT true,
  registrado_por UUID REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(programacion_id, docente_id, slot_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_disp_prog ON disponibilidad_docente(programacion_id);
CREATE INDEX IF NOT EXISTS idx_disp_doc ON disponibilidad_docente(docente_id);

-- Conflictos detectados por el solver
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
