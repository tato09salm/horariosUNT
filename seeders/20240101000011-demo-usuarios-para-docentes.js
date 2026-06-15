module.exports = {
  up: async (qi) => {
    const prevEmailsDisabled = process.env.EMAILS_DISABLED;
    process.env.EMAILS_DISABLED = 'true';
    try {
      await qi.sequelize.query(`
        DO $$
        DECLARE
          d RECORD;
          v_user_id UUID;
          v_email VARCHAR(200);
          v_count INTEGER := 0;
        BEGIN
          FOR d IN SELECT * FROM docentes WHERE activo = true LOOP
            IF d.usuario_id IS NULL OR NOT EXISTS (SELECT 1 FROM usuarios WHERE id = d.usuario_id AND activo = true) THEN
              v_email := COALESCE(d.email, d.dni || '@unt.edu.pe');
              IF EXISTS (SELECT 1 FROM usuarios WHERE email = v_email) THEN
                v_email := d.dni || '@unt.edu.pe';
              END IF;
              INSERT INTO usuarios (nombre, apellidos, email, password_hash, rol, activo)
              VALUES (UPPER(d.nombre), UPPER(d.apellidos), LOWER(v_email),
                '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'docente', true)
              RETURNING id INTO v_user_id;
              UPDATE docentes SET usuario_id = v_user_id WHERE id = d.id;
              v_count := v_count + 1;
            END IF;
          END LOOP;
          RAISE NOTICE 'Creados % usuarios para docentes', v_count;
        END $$;
      `);
    } finally {
      process.env.EMAILS_DISABLED = prevEmailsDisabled;
    }
  },
  down: async (qi) => {
    await qi.sequelize.query(`
      UPDATE docentes d SET usuario_id = NULL
      FROM usuarios u
      WHERE d.usuario_id = u.id AND u.rol = 'docente'
        AND u.email NOT IN ('admin@unt.edu.pe', 'secretaria@unt.edu.pe', 'director@unitru.edu.pe');
      DELETE FROM usuarios WHERE rol = 'docente'
        AND email NOT IN ('admin@unt.edu.pe', 'secretaria@unt.edu.pe', 'director@unitru.edu.pe');
    `);
  }
};
