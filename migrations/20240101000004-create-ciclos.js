module.exports = {
      up: async (qi, S) => {
        // Primero creamos el tipo
        await qi.sequelize.query(`
          DO $$ BEGIN
            CREATE TYPE tipo_ciclo AS ENUM ('regular', 'extraordinario');
          EXCEPTION WHEN duplicate_object THEN null;
          END $$;
        `);

        await qi.createTable('ciclos', {
          id: { type: S.UUID, defaultValue: S.literal('uuid_generate_v4()'), primaryKey: true },
          nombre: { type: S.STRING(50), allowNull: false, unique: true },
          "año": { type: S.INTEGER, allowNull: false },
          semestre: { type: S.STRING(3), allowNull: false },
          tipo: { type: S.ENUM('regular', 'extraordinario'), allowNull: false, defaultValue: 'regular' },
          fecha_inicio: { type: S.DATEONLY },
          fecha_fin: { type: S.DATEONLY },
          activo: { type: S.BOOLEAN, defaultValue: false },
          created_at: { type: S.DATE, defaultValue: S.literal('NOW()') }
        });
        
        await qi.addConstraint('ciclos', { 
          fields: ['semestre', 'tipo'], 
          type: 'check', 
          where: S.where(S.literal(`
            (tipo = 'regular' AND semestre IN ('I', 'II')) OR
            (tipo = 'extraordinario' AND semestre IN ('EXT'))
          `))
        });
      },
      down: async qi => {
        await qi.dropTable('ciclos');
        await qi.sequelize.query('DROP TYPE IF EXISTS tipo_ciclo CASCADE;');
      }
    };