import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isSafeRedirectUrl,
  sanitizeRedirectUrl,
} from '@/lib/security/url-validation';
import {
  detectSuspiciousTraffic,
  detectBotOrScraper,
} from '@/lib/security/traffic-detector';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logTrafficAnomaly } from '@/lib/security/security-logger';

const SESSION_COOKIE_NAME = 'ox_session';

// Paths that unauthenticated users can access
const PUBLIC_PATHS = [
  '/login',
  '/unauthorized',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

// Methods that should never be processed by application routes
const DISALLOWED_METHODS = new Set(['TRACE', 'TRACK']);

export function middleware(request: NextRequest) {
  try {
    const { pathname, search } = request.nextUrl;
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 1. Enforce HTTPS in production
    // Checks reverse proxy forwarding header ('x-forwarded-proto') or direct URL protocol
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && proto === 'http') {
      const host = request.headers.get('host') || request.nextUrl.host;
      const secureUrl = new URL(`${pathname}${search}`, `https://${host}`);

      logTrafficAnomaly({
        type: 'HTTP_DOWNGRADE_ATTEMPT',
        path: pathname,
        method: request.method,
        clientIp,
        userAgent,
        statusCode: 308,
        reason:
          'Unencrypted HTTP request received in production environment; redirecting to HTTPS',
      });

      return NextResponse.redirect(secureUrl, 308);
    }

    // 2. Reject unsafe HTTP methods (TRACE, TRACK cross-site tracing)
    if (DISALLOWED_METHODS.has(request.method.toUpperCase())) {
      logTrafficAnomaly({
        type: 'UNUSUAL_TRAFFIC_PATTERN',
        path: pathname,
        method: request.method,
        clientIp,
        userAgent,
        statusCode: 405,
        reason: `Disallowed HTTP method ${request.method} attempted`,
      });
      return new NextResponse('Method Not Allowed', { status: 405 });
    }

    // 3. Detect suspicious probe paths, path traversals, and automated scanner signatures
    const probeCheck = detectSuspiciousTraffic(pathname, userAgent);
    if (probeCheck.isSuspicious) {
      logTrafficAnomaly({
        type: probeCheck.anomalyType || 'SUSPICIOUS_PROBE',
        path: pathname,
        method: request.method,
        clientIp,
        userAgent,
        statusCode: probeCheck.statusCode || 404,
        reason: probeCheck.reason || 'Suspicious request pattern detected',
      });

      return new NextResponse(
        probeCheck.statusCode === 400 ? 'Bad Request' : 'Not Found',
        {
          status: probeCheck.statusCode || 404,
        }
      );
    }

    // 4. Anti-Bot & Scraper Protection (Blocks scrapers on protected data and API endpoints)
    const botCheck = detectBotOrScraper(pathname, userAgent);
    if (botCheck.isBot) {
      logTrafficAnomaly({
        type: 'BOT_SCRAPER_DETECTED',
        path: pathname,
        method: request.method,
        clientIp,
        userAgent,
        statusCode: 403,
        reason:
          botCheck.reason ||
          'Automated scraping tool detected on protected endpoint',
      });

      return new NextResponse(
        'Access Denied: Automated scraping tools and bots are strictly forbidden.',
        {
          status: 403,
        }
      );
    }

    // 5. Multi-tiered API rate limiting and traffic anomaly detection
    const isApiPath = pathname.startsWith('/api');
    if (isApiPath) {
      // Tier A: AI Generation endpoints (10 reqs/min burst per IP)
      if (pathname.startsWith('/api/ai')) {
        const aiRateLimit = checkRateLimit(`ip-ai:${clientIp}`, {
          windowMs: 60 * 1000,
          maxRequests: 10,
        });

        if (!aiRateLimit.allowed) {
          logTrafficAnomaly({
            type: 'AI_RATE_LIMIT_EXCEEDED',
            path: pathname,
            method: request.method,
            clientIp,
            userAgent,
            statusCode: 429,
            reason: `AI generation burst limit exceeded: ${aiRateLimit.retryAfterSeconds}s cooldown`,
          });

          return NextResponse.json(
            { error: 'AI generation rate limit exceeded. Please slow down.' },
            {
              status: 429,
              headers: { 'Retry-After': String(aiRateLimit.retryAfterSeconds) },
            }
          );
        }
      }

      // Tier B: Report / Export endpoints (15 reqs/min per IP)
      if (pathname.startsWith('/api/reports')) {
        const reportRateLimit = checkRateLimit(`ip-reports:${clientIp}`, {
          windowMs: 60 * 1000,
          maxRequests: 15,
        });

        if (!reportRateLimit.allowed) {
          logTrafficAnomaly({
            type: 'RATE_LIMIT_EXCEEDED',
            path: pathname,
            method: request.method,
            clientIp,
            userAgent,
            statusCode: 429,
            reason: `Reports export rate limit exceeded: ${reportRateLimit.retryAfterSeconds}s cooldown`,
          });

          return NextResponse.json(
            {
              error:
                'Too many report requests. Please wait before exporting more data.',
            },
            {
              status: 429,
              headers: {
                'Retry-After': String(reportRateLimit.retryAfterSeconds),
              },
            }
          );
        }
      }

      // Tier C: General API requests (120 reqs/min per IP)
      const apiRateLimit = checkRateLimit(`ip-api:${clientIp}`, {
        windowMs: 60 * 1000,
        maxRequests: 120,
      });

      if (!apiRateLimit.allowed) {
        logTrafficAnomaly({
          type: 'RATE_LIMIT_EXCEEDED',
          path: pathname,
          method: request.method,
          clientIp,
          userAgent,
          statusCode: 429,
          reason: `General API request rate exceeded: ${apiRateLimit.retryAfterSeconds}s cooldown`,
        });

        return NextResponse.json(
          { error: 'Too many API requests. Please slow down.' },
          {
            status: 429,
            headers: { 'Retry-After': String(apiRateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isPublicPath = PUBLIC_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    // 6. If user is unauthenticated and attempting to access a protected API route
    if (!sessionCookie && isApiPath) {
      return NextResponse.json(
        {
          success: false,
          code: 'AUTH_SESSION_EXPIRED',
          error: 'Your session has expired. Please log in again.',
          message: 'Your session has expired. Please log in again.',
        },
        { status: 401 }
      );
    }

    // 7. If user is not authenticated and trying to access a protected page
    if (!sessionCookie && !isPublicPath && !isApiPath) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('reason', 'session-expired');
      if (pathname !== '/' && isSafeRedirectUrl(pathname)) {
        loginUrl.searchParams.set('callbackUrl', pathname);
        loginUrl.searchParams.set('returnTo', pathname);
      } else {
        loginUrl.searchParams.delete('callbackUrl');
        loginUrl.searchParams.delete('returnTo');
      }
      return NextResponse.redirect(loginUrl);
    }

    // 8. Prevent redirect loops: if visiting login page with reason or reset, clear stale cookie and render login
    if (pathname === '/login') {
      const reason = request.nextUrl.searchParams.get('reason');
      const isReset = request.nextUrl.searchParams.has('reset');

      if (reason || isReset) {
        const loginResponse = NextResponse.next();
        if (sessionCookie) {
          loginResponse.cookies.delete(SESSION_COOKIE_NAME);
        }
        return loginResponse;
      }

      if (sessionCookie) {
        const rawCallback =
          request.nextUrl.searchParams.get('callbackUrl') ||
          request.nextUrl.searchParams.get('returnTo');
        const safeDestination = sanitizeRedirectUrl(rawCallback, '/');
        const destinationUrl = new URL(safeDestination, request.nextUrl.origin);
        return NextResponse.redirect(destinationUrl);
      }
    }

    const response = NextResponse.next();

    // Prevent stale/bfcache serving of authenticated pages
    if (!isPublicPath && !isApiPath) {
      response.headers.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      );
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }

    // Defense-in-depth security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );

    return response;
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - static image and asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
