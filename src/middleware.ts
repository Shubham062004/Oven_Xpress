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

// Paths that unauthenticated users can access (auth forms)
const PUBLIC_PATHS = [
  '/login',
  '/unauthorized',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/register',
];

// Customer-facing public paths — accessible without any authentication
const CUSTOMER_PUBLIC_PATHS = [
  '/b',       // /b/[slug], /b/[slug]/menu, etc.
  '/cart',
  '/track',
  '/report-bug',
  '/api/bug-reports',
  '/api/realtime',
];

// Customer-facing paths that require CUSTOMER (or staff) authentication
const CUSTOMER_PROTECTED_PATHS = [
  '/checkout',
  '/account',
];

// Methods that should never be processed by application routes
const DISALLOWED_METHODS = new Set(['TRACE', 'TRACK']);

const ROLE_ALLOWED_SUBPATHS: Record<string, string[]> = {
  owner: [
    'branches',
    'employees',
    'users',
    'attendance',
    'menu',
    'orders',
    'payments',
    'kitchen',
    'inventory',
    'purchases',
    'suppliers',
    'expenses',
    'salary',
    'salaries',
    'customers',
    'reviews',
    'feedback',
    'sales',
    'bug-reports',
    'reports',
    'audit-logs',
    'settings',
    'notifications',
    'profile',
  ],
  admin: [
    'branches',
    'employees',
    'users',
    'attendance',
    'menu',
    'orders',
    'payments',
    'kitchen',
    'inventory',
    'purchases',
    'suppliers',
    'expenses',
    'salary',
    'salaries',
    'customers',
    'reviews',
    'feedback',
    'sales',
    'reports',
    'audit-logs',
    'settings',
    'notifications',
    'profile',
  ],
  manager: [
    'orders',
    'payments',
    'kitchen',
    'menu',
    'inventory',
    'purchases',
    'suppliers',
    'expenses',
    'attendance',
    'employees',
    'customers',
    'reviews',
    'feedback',
    'sales',
    'reports',
    'notifications',
    'profile',
  ],
  staff: [
    'orders',
    'kitchen',
    'attendance',
    'menu',
    'expenses',
    'profile',
    'notifications',
  ],
};

// ERP internal roles (non-customer)
const ERP_ROLES = new Set(['owner', 'admin', 'manager', 'staff']);

export function middleware(request: NextRequest) {
  try {
    const { pathname, search } = request.nextUrl;
    const clientIp =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 1. Enforce HTTPS in production (except on local development / loopback addresses)
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');
    const host = request.headers.get('host') || request.nextUrl.host || '';
    const isLocalhost =
      host.includes('localhost') ||
      host.includes('127.0.0.1') ||
      host.includes('[::1]');
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && proto === 'http' && !isLocalhost) {
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

    // Determine if this is a customer-facing public path (no auth needed)
    const isCustomerPublicPath =
      pathname === '/' ||
      CUSTOMER_PUBLIC_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
      );

    // Determine if this is a customer-facing protected path (needs auth)
    const isCustomerProtectedPath = CUSTOMER_PROTECTED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

    // 6. If user is unauthenticated and attempting to access a protected API route
    if (!sessionCookie && isApiPath && !isCustomerPublicPath) {
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
    // Allow customer public paths and auth pages through without session
    if (!sessionCookie && !isPublicPath && !isCustomerPublicPath && !isApiPath) {
      // Customer protected paths redirect to login with return URL
      if (isCustomerProtectedPath) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        if (pathname !== '/' && isSafeRedirectUrl(pathname)) {
          loginUrl.searchParams.set('callbackUrl', pathname);
          loginUrl.searchParams.set('returnTo', pathname);
        }
        return NextResponse.redirect(loginUrl);
      }

      // ERP paths redirect to login with session-expired
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
        const rawRole = request.cookies.get('ox_user_role')?.value?.toLowerCase();
        // CUSTOMER role goes to homepage, ERP roles go to their dashboard
        const roleHome = rawRole === 'customer' ? '/' : (rawRole ? `/${rawRole}` : '/owner');
        const rawCallback =
          request.nextUrl.searchParams.get('callbackUrl') ||
          request.nextUrl.searchParams.get('returnTo');
        const safeDestination = rawCallback
          ? sanitizeRedirectUrl(rawCallback, roleHome)
          : roleHome;
        const destinationUrl = new URL(safeDestination, request.nextUrl.origin);
        return NextResponse.redirect(destinationUrl);
      }
    }

    // 9. Role-Based Routing & Authorization
    if (request.headers.get('x-role-rewritten') === '1') {
      return NextResponse.next();
    }

    const userRole = (request.cookies.get('ox_user_role')?.value || '').toLowerCase();
    const isCustomerRole = userRole === 'customer';
    const isErpRole = ERP_ROLES.has(userRole);

    // A. Root page — for ERP users redirect to their dashboard, for customers/public let through
    if (pathname === '/' || pathname === '/dashboard') {
      if (sessionCookie && isErpRole) {
        const roleDashboardUrl = new URL(`/${userRole}`, request.nextUrl.origin);
        return NextResponse.redirect(roleDashboardUrl);
      }
      // Customer users and unauthenticated visitors see the customer homepage
      return NextResponse.next();
    }

    // B. Customer public paths — let everyone through (customer, staff, or unauthenticated)
    if (isCustomerPublicPath) {
      return NextResponse.next();
    }

    // C. Customer protected paths — require auth but NOT ERP role check
    if (isCustomerProtectedPath) {
      // Already handled unauthenticated redirect above (step 7)
      // If authenticated customer, let through
      if (isCustomerRole) {
        return NextResponse.next();
      }
      // ERP users accessing customer routes — also let through (they have auth)
      if (isErpRole) {
        return NextResponse.next();
      }
      // Unknown role with session — let through, page will handle authorization
      return NextResponse.next();
    }

    // D. Block CUSTOMER role from accessing ERP routes
    if (sessionCookie && isCustomerRole) {
      const rolePageMatch = pathname.match(/^\/(owner|admin|manager|staff)(?:\/(.*))?$/);
      if (rolePageMatch) {
        // Customer trying to access an ERP dashboard — send to homepage
        return NextResponse.redirect(new URL('/', request.nextUrl.origin));
      }
    }

    // E. Role-based API authorization (/api/owner/..., /api/staff/...)
    const roleApiMatch = pathname.match(/^\/api\/(owner|admin|manager|staff)(?:\/(.*))?$/);
    if (roleApiMatch) {
      // Block customers from ERP API endpoints
      if (isCustomerRole) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Insufficient privileges' },
          { status: 403 }
        );
      }

      const targetApiRole = roleApiMatch[1];
      const isRoleAllowed =
        userRole === 'owner' ||
        userRole === targetApiRole ||
        (targetApiRole === 'staff' && (userRole === 'manager' || userRole === 'admin' || userRole === 'owner')) ||
        (targetApiRole === 'manager' && userRole === 'owner');

      if (!isRoleAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Forbidden: Requires ${targetApiRole.toUpperCase()} role privileges`,
          },
          { status: 403 }
        );
      }
    }

    // F. Role-prefixed page routing (/owner, /owner/branches, /staff/orders)
    const rolePageMatch = pathname.match(/^\/(owner|admin|manager|staff)(?:\/(.*))?$/);
    if (rolePageMatch) {
      // Block customers from ERP workspaces
      if (isCustomerRole) {
        return NextResponse.redirect(new URL('/', request.nextUrl.origin));
      }

      const targetRole = rolePageMatch[1];
      const subpath = rolePageMatch[2] || '';
      const rootSection = subpath.split('/')[0];

      // Verify that user is authorized to enter this role workspace
      const canAccessWorkspace = userRole === 'owner' || userRole === targetRole;
      if (!canAccessWorkspace) {
        // Redirect user to their own role dashboard
        const redirectUrl = new URL(`/${userRole}`, request.nextUrl.origin);
        return NextResponse.redirect(redirectUrl);
      }

      // Verify subpath is permitted for this role
      if (subpath) {
        const allowedSections = ROLE_ALLOWED_SUBPATHS[targetRole] || [];
        if (!allowedSections.includes(rootSection)) {
          // Subpath not allowed for this role (e.g. /staff/branches)
          const fallbackUrl = new URL(`/${targetRole}`, request.nextUrl.origin);
          return NextResponse.redirect(fallbackUrl);
        }

        // Rewrite internal request to the actual page route (e.g. /branches or /orders)
        // while preserving the role-prefixed URL (/owner/branches) in the browser
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-role-rewritten', '1');
        const rewriteUrl = request.nextUrl.clone();
        rewriteUrl.pathname = `/${subpath}`;
        return NextResponse.rewrite(rewriteUrl, {
          request: {
            headers: requestHeaders,
          },
        });
      }

      // If subpath is empty (e.g. /owner, /staff, /manager, /admin), allow request to proceed to dedicated dashboard page!
    }

    // G. Un-prefixed page access (e.g. /branches, /orders, /kitchen directly entered)
    const knownSections = [
      'branches',
      'employees',
      'users',
      'attendance',
      'menu',
      'orders',
      'payments',
      'kitchen',
      'inventory',
      'purchases',
      'suppliers',
      'expenses',
      'salary',
      'salaries',
      'customers',
      'reviews',
      'feedback',
      'sales',
      'reports',
      'audit-logs',
      'settings',
      'notifications',
      'profile',
      'bug-reports',
    ];
    const pathFirstSegment = pathname.replace(/^\//, '').split('/')[0];

    if (knownSections.includes(pathFirstSegment)) {
      // Customers should not access ERP sections directly
      if (isCustomerRole) {
        return NextResponse.redirect(new URL('/', request.nextUrl.origin));
      }

      if (isErpRole) {
        const allowedForUser = ROLE_ALLOWED_SUBPATHS[userRole] || [];
        if (allowedForUser.includes(pathFirstSegment)) {
          const prefixedUrl = new URL(
            `/${userRole}${pathname}`,
            request.nextUrl.origin
          );
          prefixedUrl.search = request.nextUrl.search;
          return NextResponse.redirect(prefixedUrl);
        } else {
          const fallbackUrl = new URL(`/${userRole}`, request.nextUrl.origin);
          return NextResponse.redirect(fallbackUrl);
        }
      }
    }

    const response = NextResponse.next();

    // Prevent stale/bfcache serving of authenticated pages
    if (!isPublicPath && !isApiPath && !isCustomerPublicPath) {
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
    if (isProduction && !isLocalhost && Boolean(process.env.VERCEL)) {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
      );
    }

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
