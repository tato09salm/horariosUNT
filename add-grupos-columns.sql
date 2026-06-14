ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS teoria_grupos INTEGER DEFAULT 1;
ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS practica_grupos INTEGER DEFAULT 1;
ALTER TABLE carga_horaria_cursos ADD COLUMN IF NOT EXISTS laboratorio_grupos INTEGER DEFAULT 1;
