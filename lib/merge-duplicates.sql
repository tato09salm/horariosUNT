-- SQL to clean up duplicate teachers and consolidate them into a single row per real-life person.
-- We will consolidate to the first record inserted (by DNI or lowest UUID) and update all references.
DO $$
DECLARE
    r RECORD;
    keep_id UUID;
    remove_id UUID;
BEGIN
    -- We identify duplicates by first name + last name
    FOR r IN 
        SELECT nombre, apellidos, COUNT(*) as cnt 
        FROM docentes 
        GROUP BY nombre, apellidos 
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the one with the lowest ID (usually the 2026-I one or the first one inserted)
        SELECT id INTO keep_id 
        FROM docentes 
        WHERE nombre = r.nombre AND apellidos = r.apellidos 
        ORDER BY created_at ASC, id ASC 
        LIMIT 1;

        -- Update all references for the other duplicates to point to keep_id, then delete them
        FOR remove_id IN 
            SELECT id 
            FROM docentes 
            WHERE nombre = r.nombre AND apellidos = r.apellidos AND id <> keep_id
        LOOP
            -- Update programacion_cursos
            UPDATE programacion_cursos SET docente_id = keep_id WHERE docente_id = remove_id;
            
            -- Update asignaciones
            UPDATE asignaciones SET docente_id = keep_id WHERE docente_id = remove_id;
            
            -- Update disponibilidad_docente
            UPDATE disponibilidad_docente SET docente_id = keep_id WHERE docente_id = remove_id;
            
            -- Delete from docentes
            DELETE FROM docentes WHERE id = remove_id;
        END LOOP;
        
        RAISE NOTICE 'Consolidadas duplicidades para: % %', r.nombre, r.apellidos;
    END LOOP;
END $$;
