import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const accessToken = req.cookies.get('accessToken')?.value;
  const refreshToken = req.cookies.get('refreshToken')?.value;

  // An expired access token is still refreshable while the refresh cookie exists.
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(
      new URL('/', req.url)
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};