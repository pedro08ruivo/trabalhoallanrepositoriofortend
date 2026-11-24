import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ path: string[] }> };

const API_BASE_URL = (process.env.API_URL || 'http://localhost:3000/v1').replace(/\/+$/, '');

async function proxyToApi(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: 'Access token is missing.' }, { status: 401 });
  }

  const apiUrl = `${API_BASE_URL}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;
  const headers = new Headers({
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  });
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  if (body) headers.set('Content-Type', request.headers.get('content-type') || 'application/json');

  try {
    const response = await fetch(apiUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    });

    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'The API is unavailable.' }, { status: 502 });
  }
}

export const GET = proxyToApi;
export const POST = proxyToApi;
export const PUT = proxyToApi;
export const PATCH = proxyToApi;
export const DELETE = proxyToApi;
