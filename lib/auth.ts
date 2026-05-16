import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { registrarAuditoria } from './auditoria';
import { generateToken, verifyToken, UserSession } from './jwt';

export { type UserSession };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function login(email: string, password: string, ip?: string): Promise<{ user: UserSession; token: string } | null> {
  const user = await queryOne<any>(
    'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
    [email]
  );
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const session: UserSession = {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    email: user.email,
    rol: user.rol,
  };

  const token = await generateToken(session);

  await registrarAuditoria({
    usuario_id: user.id,
    usuario_nombre: `${user.nombre} ${user.apellidos}`,
    usuario_email: user.email,
    accion: 'LOGIN',
    descripcion: `Inicio de sesión`,
    ip_address: ip,
  });

  return { user: session, token };
}

export function requireRole(session: UserSession | null, roles: string[]): boolean {
  if (!session) return false;
  return roles.includes(session.rol);
}
