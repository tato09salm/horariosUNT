import { query } from './db';

interface AuditoriaParams {
  usuario_id?: string;
  usuario_nombre?: string;
  usuario_email?: string;
  accion: string;
  tabla_afectada?: string;
  registro_id?: string;
  datos_anteriores?: any;
  datos_nuevos?: any;
  ip_address?: string;
  user_agent?: string;
  descripcion?: string;
}

export async function registrarAuditoria(params: AuditoriaParams): Promise<void> {
  try {
    await query(
      `INSERT INTO auditoria 
       (usuario_id, usuario_nombre, usuario_email, accion, tabla_afectada, registro_id, 
        datos_anteriores, datos_nuevos, ip_address, user_agent, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        params.usuario_id || null,
        params.usuario_nombre || null,
        params.usuario_email || null,
        params.accion,
        params.tabla_afectada || null,
        params.registro_id || null,
        params.datos_anteriores ? JSON.stringify(params.datos_anteriores) : null,
        params.datos_nuevos ? JSON.stringify(params.datos_nuevos) : null,
        params.ip_address || null,
        params.user_agent || null,
        params.descripcion || null,
      ]
    );
  } catch (error) {
    console.error('Error registrando auditoría:', error);
  }
}

export async function getAuditoria(filtros?: {
  usuario_id?: string;
  accion?: string;
  tabla?: string;
  desde?: string;
  hasta?: string;
  pagina?: number;
  limite?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (filtros?.usuario_id) {
    conditions.push(`usuario_id = $${idx++}`);
    params.push(filtros.usuario_id);
  }
  if (filtros?.accion) {
    conditions.push(`accion = $${idx++}`);
    params.push(filtros.accion);
  }
  if (filtros?.tabla) {
    conditions.push(`tabla_afectada = $${idx++}`);
    params.push(filtros.tabla);
  }
  if (filtros?.desde) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(filtros.desde);
  }
  if (filtros?.hasta) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(filtros.hasta);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limite = filtros?.limite || 50;
  const offset = ((filtros?.pagina || 1) - 1) * limite;

  const data = await query(
    `SELECT * FROM auditoria ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
    [...params, limite, offset]
  );

  const total = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM auditoria ${where}`,
    params
  );

  return { data, total: parseInt(total[0]?.count || '0') };
}
