'use server';

import axios, { isAxiosError } from 'axios';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE_URL = (process.env.API_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');
const ACCESS_MAX_AGE = 30;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

export async function login(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Informe e-mail e senha.' };
  }

  try {
    const { data } = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
    if (!data.accessToken || !data.refreshToken) {
      return { error: 'A API retornou uma sessão incompleta.' };
    }

    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    cookieStore.set('accessToken', data.accessToken, { ...cookieOptions, maxAge: ACCESS_MAX_AGE });
    cookieStore.set('refreshToken', data.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
    cookieStore.set('accessExpiresAt', String(Date.now() + ACCESS_MAX_AGE * 1000), {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_MAX_AGE,
    });
  } catch (error: unknown) {
    const responseData = isAxiosError<{ error?: string; message?: string }>(error)
      ? error.response?.data
      : undefined;
    return { error: responseData?.error || responseData?.message || 'Erro ao fazer login.' };
  }

  redirect('/dashboard');
}