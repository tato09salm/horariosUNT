-- Regenerar disponibilidad (usa la función creada por schema-data-real.sql)
-- Ejecutar tras npm run db:reset o con npm run db:seed

ALTER TABLE disponibilidad_docente
  ADD COLUMN IF NOT EXISTS prioridad INTEGER CHECK (prioridad IN (1, 2));

DO $$
DECLARE
    prog RECORD;
    total INTEGER := 0;
    filas INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'poblar_disponibilidad_programacion'
    ) THEN
        RAISE EXCEPTION 'Ejecuta primero npm run db:reset para cargar schema-data-real.sql';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM programaciones LIMIT 1) THEN
        RAISE EXCEPTION 'No hay programaciones. Ejecuta npm run db:reset.';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'poblar_disponibilidad_ambientes') THEN
        PERFORM poblar_disponibilidad_ambientes();
    END IF;

    FOR prog IN SELECT id, nombre FROM programaciones ORDER BY nombre LOOP
        filas := poblar_disponibilidad_programacion(prog.id);
        total := total + filas;
        RAISE NOTICE 'Regenerado docente: % (% celdas)', prog.nombre, filas;
    END LOOP;

    RAISE NOTICE 'Total celdas docente: %', total;
END $$;
