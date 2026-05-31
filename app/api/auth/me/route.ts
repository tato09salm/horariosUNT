import { NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/auth';

export async function GET() {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
