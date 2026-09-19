import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'ox_session';

// Paths that unauthenticated users can access
const PUBLIC_PATHS = ['/login', '/unauthorized'];

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

    // If user is not authenticated and trying to access a protected path
    if (!sessionCookie && !isPublicPath) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      if (pathname !== '/') {
        loginUrl.searchParams.set('callbackUrl', pathname);
      } else {
        loginUrl.searchParams.delete('callbackUrl');
      }
      return NextResponse.redirect(loginUrl);
    }

    // If user is already authenticated and visits login page, redirect to home
    if (sessionCookie && pathname === '/login') {
      const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/';
      const destinationUrl = request.nextUrl.clone();
      destinationUrl.pathname = callbackUrl.startsWith('/') ? callbackUrl : '/';
      destinationUrl.search = '';
      return NextResponse.redirect(destinationUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware execution error:', error);
    return NextResponse.next();
  }
}

// Support Next.js 16 Proxy convention
export { middleware as proxy };

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - static image and asset extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

