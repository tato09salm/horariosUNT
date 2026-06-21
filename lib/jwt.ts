import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'jwt-horarios-unt-2024'
);

export interface UserSession {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: 'admin' | 'director_escuela' | 'secretaria' | 'docente';
  docente_id?: string;
}

export async function generateToken(user: UserSession): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}
