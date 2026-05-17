module.exports = {
      up: async (qi, S) => {
        await qi.sequelize.query(`
          CREATE OR REPLACE FUNCTION insert_disp_docente_rango(
            p_programacion_id UUID, p_docente_id UUID, p_dia dia_semana, p_orden_ini INTEGER, p_orden_fin INTEGER, p_prioridad INTEGER
          ) RETURNS INTEGER AS $$
          DECLARE n INTEGER;
          BEGIN
            INSERT INTO disponibilidad_docente (programacion_id, docente_id, slot_id, dia, disponible, prioridad)
            SELECT p_programacion_id, p_docente_id, st.id, p_dia, true, p_prioridad
            FROM slots_tiempo st
            WHERE st.orden BETWEEN p_orden_ini AND p_orden_fin AND st.hora_inicio <> '13:00'::time
            ON CONFLICT (programacion_id, docente_id, slot_id, dia) DO UPDATE
              SET disponible = true, prioridad = EXCLUDED.prioridad, updated_at = NOW();
            GET DIAGNOSTICS n = ROW_COUNT;
            RETURN n;
          END;
          $$ LANGUAGE plpgsql;
        `);

        await qi.sequelize.query(`
          CREATE OR REPLACE FUNCTION insert_disp_ambiente_rango(
            p_ambiente_id UUID, p_dia dia_semana, p_orden_ini INTEGER, p_orden_fin INTEGER, p_estado VARCHAR DEFAULT 'disponible', p_motivo VARCHAR DEFAULT NULL
          ) RETURNS INTEGER AS $$
          DECLARE n INTEGER;
          BEGIN
            INSERT INTO disponibilidad_ambiente (ambiente_id, slot_id, dia, estado, motivo)
            SELECT p_ambiente_id, st.id, p_dia, p_estado, p_motivo
            FROM slots_tiempo st
            WHERE st.orden BETWEEN p_orden_ini AND p_orden_fin AND st.hora_inicio <> '13:00'::time
            ON CONFLICT (ambiente_id, slot_id, dia) DO UPDATE
              SET estado = EXCLUDED.estado, motivo = EXCLUDED.motivo;
            GET DIAGNOSTICS n = ROW_COUNT;
            RETURN n;
          END;
          $$ LANGUAGE plpgsql;
        `);
      },
      down: async qi => {
        await qi.sequelize.query('DROP FUNCTION IF EXISTS insert_disp_docente_rango');
        await qi.sequelize.query('DROP FUNCTION IF EXISTS insert_disp_ambiente_rango');
      }
    };