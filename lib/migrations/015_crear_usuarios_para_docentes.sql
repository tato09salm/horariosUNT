-- Crear usuarios para todos los docentes que no tengan uno
-- Password por defecto: "password" (mismo hash que el seed inicial)
-- No envía correo masivo, solo crea registros en la BD

DO $$
DECLARE
  d RECORD;
  v_user_id UUID;
  v_email VARCHAR(200);
  v_count INTEGER := 0;
BEGIN
  FOR d IN SELECT * FROM docentes WHERE activo = true LOOP
    -- Verificar si ya tiene un usuario activo vinculado
    IF d.usuario_id IS NULL OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = d.usuario_id AND activo = true) THEN
      -- Generar email basado en el email del docente o su DNI
      v_email := COALESCE(d.email, d.dni || '@unt.edu.pe');

      -- Evitar duplicado de email
      IF EXISTS (SELECT 1 FROM usuarios WHERE email = v_email) THEN
        v_email := d.dni || '@unt.edu.pe';
      END IF;

      -- Crear el usuario
      INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol, activo)
      VALUES (
        UPPER(d.nombre),
        UPPER(d.apellidos),
        LOWER(v_email),
        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'docente',
        true
      )
      RETURNING id INTO v_user_id;

      -- Vincular docente con el nuevo usuario
      UPDATE docentes SET usuario_id = v_user_id WHERE id = d.id;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ % usuarios creados para docentes sin cuenta', v_count;
END $$;
