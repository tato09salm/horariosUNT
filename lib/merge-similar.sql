-- SQL script to explicitly consolidate similar/near-duplicate teacher records using their DNI.
-- We will consolidate the secondary record (2025-II, higher DNI) into the primary record (2026-I, lower DNI).
DO $$
DECLARE
    consolidations RECORD;
    keep_id UUID;
    remove_id UUID;
BEGIN
    -- We define our explicit mapping of (keep_dni, remove_dni)
    FOR consolidations IN 
        SELECT * FROM (VALUES
            ('21212121', '59595959'), -- Agreda Gamboa
            ('28282828', '53535353'), -- Boy Chavil
            ('33333333', '63636363'), -- Cotrina Castellanos
            ('38383838', '51515151'), -- Gómez Ávila
            ('37373737', '55555556'), -- Gonzalez Vasquez
            ('22222222', '60606060'), -- Mendoza de los Santos
            ('35353535', '61616161'), -- Mendoza Rivera
            ('29292929', '47474747'), -- Sanchez Ticona
            ('20202020', '39393939')  -- Vidal Melgarejo
        ) AS t(keep_dni, remove_dni)
    LOOP
        -- Get IDs
        SELECT id INTO keep_id FROM docentes WHERE dni = consolidations.keep_dni;
        SELECT id INTO remove_id FROM docentes WHERE dni = consolidations.remove_dni;

        IF keep_id IS NOT NULL AND remove_id IS NOT NULL THEN
            -- Update programacion_cursos
            UPDATE programacion_cursos SET docente_id = keep_id WHERE docente_id = remove_id;
            
            -- Update asignaciones
            UPDATE asignaciones SET docente_id = keep_id WHERE docente_id = remove_id;
            
            -- Update disponibilidad_docente
            UPDATE disponibilidad_docente SET docente_id = keep_id WHERE docente_id = remove_id;
            
            -- Delete from docentes
            DELETE FROM docentes WHERE id = remove_id;
            
            RAISE NOTICE 'Consolidado docente DNI % en DNI %', consolidations.remove_dni, consolidations.keep_dni;
        ELSE
            RAISE WARNING 'No se pudo consolidar: DNI % o DNI % no encontrado', consolidations.keep_dni, consolidations.remove_dni;
        END IF;
    END LOOP;
END $$;
