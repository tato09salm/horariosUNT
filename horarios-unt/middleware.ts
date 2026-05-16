import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

const publicPaths = ['/', '/api/auth/login'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (publicPaths.some(p => pathname === p)) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) return NextResponse.next();

  const token = req.cookies.get('auth-token')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  const user = verifyToken(token);
  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
