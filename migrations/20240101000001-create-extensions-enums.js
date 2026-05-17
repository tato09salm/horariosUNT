module.exports = {
      up: async (qi, Sequelize) => {
        await qi.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
        const enums = [
          "CREATE TYPE rol_usuario AS ENUM ('admin', 'secretaria', 'docente');",
          "CREATE TYPE categoria_docente AS ENUM ('principal', 'asociado', 'auxiliar', 'jefe_practica');",
          "CREATE TYPE condicion_docente AS ENUM ('nombrado', 'contratado');",
          "CREATE TYPE tipo_grado AS ENUM ('bachiller', 'licenciado', 'magister', 'doctor');",
          "CREATE TYPE tipo_ambiente AS ENUM ('aula', 'laboratorio', 'auditorio');",
          "CREATE TYPE dia_semana AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado');",
          "CREATE TYPE tipo_sesion AS ENUM ('teoria', 'practica', 'laboratorio');",
          "CREATE TYPE accion_auditoria AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'GENERATE_SCHEDULE', 'EXPORT_REPORT', 'ASSIGN', 'UNASSIGN');"
        ];
        for (const e of enums) {
          await qi.sequelize.query(`DO $$ BEGIN ${e} EXCEPTION WHEN duplicate_object THEN null; END $$;`);
        }
      },
      down: async (qi) => {
        const enums = ['rol_usuario', 'categoria_docente', 'condicion_docente', 'tipo_grado', 'tipo_ambiente', 'dia_semana', 'tipo_sesion', 'accion_auditoria'];
        for (const e of enums) await qi.sequelize.query(`DROP TYPE IF EXISTS ${e} CASCADE;`);
      }
    };