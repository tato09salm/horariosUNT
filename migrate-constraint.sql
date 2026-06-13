
-- Step 1: Drop the old unique constraint
ALTER TABLE carga_horaria DROP CONSTRAINT IF EXISTS unique_docente_ciclo_academico;

-- Step 2: Add new unique constraint that includes ciclo_plan
ALTER TABLE carga_horaria ADD CONSTRAINT unique_docente_ciclo_academico_ciclo_plan UNIQUE (docente_id, ciclo_academico_id, ciclo_plan);
