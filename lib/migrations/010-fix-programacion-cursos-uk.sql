-- ========================================
-- FIX: Restablecer constraint UNIQUE en programacion_cursos
-- ========================================

-- Eliminar constraint incorrecta (si existe)
ALTER TABLE programacion_cursos DROP CONSTRAINT IF EXISTS programacion_cursos_prog_grupo_docente_uk;

-- Eliminar índice incorrecto (si existe)
DROP INDEX IF EXISTS programacion_cursos_prog_grupo_docente_uk;

-- Agregar constraint correcta: UNIQUE(programacion_id, grupo_id), pero solo si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'programacion_cursos'
        AND constraint_name = 'programacion_cursos_programacion_id_grupo_id_uk'
    ) THEN
        ALTER TABLE programacion_cursos ADD CONSTRAINT programacion_cursos_programacion_id_grupo_id_uk UNIQUE(programacion_id, grupo_id);
    END IF;
END $$;
