import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { registrarAuditoria } from './auditoria';
import { generateToken, verifyToken, UserSession } from './jwt';

export { type UserSession };

export interface UserRoleProfile {
  codigo: UserSession['rol'];
  nombre: string;
}

export interface UserProfile extends Omit<UserSession, 'rol'> {
  rol: UserRoleProfile;
  docente_id?: string;
}

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

export async function getSessionProfile(): Promise<UserProfile | null> {
  const session = await getSession();
  if (!session) return null;

  const nombresRoles: Record<string, string> = {
    admin: 'Administrador',
    secretaria: 'Secretaria',
    docente: 'Docente',
    director_escuela: 'Director de Escuela',
  };

  let docente_id: string | undefined;
  if (session.rol === 'docente' && session.email) {
    const d = await queryOne<{ id: string }>(
      'SELECT id FROM docentes WHERE email = $1 AND activo = true',
      [session.email]
    );
    if (d) docente_id = d.id;
  }

  return {
    ...session,
    rol: {
      codigo: session.rol,
      nombre: nombresRoles[session.rol] || session.rol,
    },
    docente_id,
  };
}

export async function login(email: string, password: string, ip?: string): Promise<{ user: UserSession; token: string } | null> {
  const user = await queryOne<any>(
    'SELECT * FROM usuarios WHERE email = $1 AND activo = true',
    [email]
  );
  if (!user) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  let docente_id: string | undefined;
  if (user.rol === 'docente') {
    const d = await queryOne<{ id: string }>(
      'SELECT id FROM docentes WHERE email = $1 AND activo = true',
      [user.email]
    );
    if (d) docente_id = d.id;
  }

  const session: UserSession = {
    id: user.id,
    nombre: user.nombre,
    apellidos: user.apellidos,
    email: user.email,
    rol: user.rol,
    docente_id,
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

export function requireRole(session: UserSession | UserProfile | null, roles: string[]): boolean {
  if (!session) return false;
  const rolCode = typeof session.rol === 'string' ? session.rol : session.rol.codigo;
  return roles.includes(rolCode);
}
