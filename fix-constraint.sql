-- Fix unique constraint to include ciclo_plan
ALTER TABLE carga_horaria DROP CONSTRAINT IF EXISTS unique_docente_ciclo_academico;
ALTER TABLE carga_horaria ADD CONSTRAINT unique_docente_ciclo_academico_ciclo_plan UNIQUE (docente_id, ciclo_academico_id, ciclo_plan);
