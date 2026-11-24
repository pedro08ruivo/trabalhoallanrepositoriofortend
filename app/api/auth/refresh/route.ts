import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE_URL = (process.env.API_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');
const ACCESS_MAX_AGE = 30;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  if (!refreshToken) {
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    return NextResponse.json({ error: 'Refresh token is missing.' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    const data = await response.json();

    if (!response.ok || !data.accessToken || !data.refreshToken) {
      cookieStore.delete('accessToken');
      cookieStore.delete('refreshToken');
      cookieStore.delete('accessExpiresAt');
      return NextResponse.json(
        { error: data.error || 'Session expired. Please sign in again.' },
        { status: response.status === 401 ? 401 : 502 },
      );
    }

    cookieStore.set('accessToken', data.accessToken, cookieOptions(ACCESS_MAX_AGE));
    cookieStore.set('refreshToken', data.refreshToken, cookieOptions(REFRESH_MAX_AGE));
    cookieStore.set('accessExpiresAt', String(Date.now() + ACCESS_MAX_AGE * 1000), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_MAX_AGE,
    });
    return NextResponse.json({ refreshed: true });
  } catch {
    return NextResponse.json({ error: 'The authentication API is unavailable.' }, { status: 502 });
  }
}
