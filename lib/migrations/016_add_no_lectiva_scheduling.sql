-- Migración: Agregar columnas de horario a tablas de carga no lectiva
-- Permite asignar día y hora a cada actividad no lectiva

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'carga_horaria_preparacion',
    'carga_horaria_consejeria',
    'carga_horaria_investigacion',
    'carga_horaria_capacitacion',
    'carga_horaria_gobierno',
    'carga_horaria_administracion',
    'carga_horaria_asesoria',
    'carga_horaria_rsu',
    'carga_horaria_comites'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop UNIQUE constraint on carga_horaria_id to allow multiple items
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I_carga_horaria_id_key', t, t);
    
    -- Add dia column
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS dia VARCHAR(10)', t);
    
    -- Add hora_inicio column
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS hora_inicio TIME', t);
    
    -- Add hora_fin column
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS hora_fin TIME', t);
    
    -- Add orden column for item ordering
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0', t);
  END LOOP;
END $$;
