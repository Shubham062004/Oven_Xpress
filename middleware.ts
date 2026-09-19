import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'ox_session';

// Paths that unauthenticated users can access
const PUBLIC_PATHS = ['/login', '/unauthorized'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  // If user is not authenticated and trying to access a protected path
  if (!sessionCookie && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('callbackUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If user is already authenticated and visits login page, redirect to home
  if (sessionCookie && pathname === '/login') {
    const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/';
    return NextResponse.redirect(new URL(callbackUrl, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (*.svg, *.png, *.jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
