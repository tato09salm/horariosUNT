-- Add missing columns to section tables
DO $$
BEGIN
  -- Add dia column to all section tables
  EXECUTE 'ALTER TABLE carga_horaria_preparacion ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_consejeria ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_investigacion ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_capacitacion ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_gobierno ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_administracion ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_asesoria ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_rsu ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';
  EXECUTE 'ALTER TABLE carga_horaria_comites ADD COLUMN IF NOT EXISTS dia VARCHAR(10)';

  -- Add hora_inicio column to all section tables
  EXECUTE 'ALTER TABLE carga_horaria_preparacion ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_consejeria ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_investigacion ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_capacitacion ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_gobierno ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_administracion ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_asesoria ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_rsu ADD COLUMN IF NOT EXISTS hora_inicio TIME';
  EXECUTE 'ALTER TABLE carga_horaria_comites ADD COLUMN IF NOT EXISTS hora_inicio TIME';

  -- Add hora_fin column to all section tables
  EXECUTE 'ALTER TABLE carga_horaria_preparacion ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_consejeria ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_investigacion ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_capacitacion ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_gobierno ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_administracion ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_asesoria ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_rsu ADD COLUMN IF NOT EXISTS hora_fin TIME';
  EXECUTE 'ALTER TABLE carga_horaria_comites ADD COLUMN IF NOT EXISTS hora_fin TIME';

  -- Add orden column to all section tables
  EXECUTE 'ALTER TABLE carga_horaria_preparacion ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_consejeria ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_investigacion ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_capacitacion ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_gobierno ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_administracion ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_asesoria ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_rsu ADD COLUMN IF NOT EXISTS orden INTEGER';
  EXECUTE 'ALTER TABLE carga_horaria_comites ADD COLUMN IF NOT EXISTS orden INTEGER';

  -- Drop UNIQUE constraint on carga_horaria_id for all section tables
  EXECUTE 'ALTER TABLE carga_horaria_preparacion DROP CONSTRAINT IF EXISTS carga_horaria_preparacion_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_consejeria DROP CONSTRAINT IF EXISTS carga_horaria_consejeria_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_investigacion DROP CONSTRAINT IF EXISTS carga_horaria_investigacion_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_capacitacion DROP CONSTRAINT IF EXISTS carga_horaria_capacitacion_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_gobierno DROP CONSTRAINT IF EXISTS carga_horaria_gobierno_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_administracion DROP CONSTRAINT IF EXISTS carga_horaria_administracion_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_asesoria DROP CONSTRAINT IF EXISTS carga_horaria_asesoria_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_rsu DROP CONSTRAINT IF EXISTS carga_horaria_rsu_carga_horaria_id_key';
  EXECUTE 'ALTER TABLE carga_horaria_comites DROP CONSTRAINT IF EXISTS carga_horaria_comites_carga_horaria_id_key';
END $$;
