-- ========================================
-- FIX: Modificar constraint UNIQUE en programacion_cursos para permitir múltiples docentes por grupo
-- ========================================

DO $$
BEGIN
    -- Eliminar la constraint antigua si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'programacion_cursos' 
        AND constraint_name = 'programacion_cursos_programacion_id_grupo_id_uk'
    ) THEN
        ALTER TABLE programacion_cursos DROP CONSTRAINT programacion_cursos_programacion_id_grupo_id_uk;
    END IF;

    -- Agregar nueva constraint que permite múltiples docentes por grupo pero evita duplicados del mismo docente
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'programacion_cursos' 
        AND constraint_name = 'programacion_cursos_programacion_id_grupo_id_docente_id_uk'
    ) THEN
        ALTER TABLE programacion_cursos 
        ADD CONSTRAINT programacion_cursos_programacion_id_grupo_id_docente_id_uk 
        UNIQUE(programacion_id, grupo_id, docente_id);
    END IF;
END $$;
