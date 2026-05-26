import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/jwt';
import LoginPageClient from '@/components/login-page-client';

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (token) {
    const session = await verifyToken(token);
    if (session) {
      redirect('/dashboard');
    }
  }

  return <LoginPageClient />;
}