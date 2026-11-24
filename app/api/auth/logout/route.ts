import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE_URL = (process.env.API_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  const refreshToken = cookieStore.get('refreshToken')?.value;

  if (!accessToken || !refreshToken) {
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    cookieStore.delete('accessExpiresAt');
    return NextResponse.json({ error: 'Session is missing.' }, { status: 401 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    cookieStore.delete('accessExpiresAt');
    return NextResponse.json({ message: 'Logout successful.' });
  } catch {
    return NextResponse.json({ error: 'The authentication API is unavailable.' }, { status: 502 });
  }
}
