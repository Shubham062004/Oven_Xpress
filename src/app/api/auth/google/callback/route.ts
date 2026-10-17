import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import {
  createSession,
  CUSTOMER_SESSION_TTL_SECONDS,
  ROLE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '@/lib/auth/session';
import {
  exchangeGoogleCodeForToken,
  fetchGoogleUserProfile,
  getGoogleOAuthRedirectUri,
} from '@/lib/auth/google';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import { logAuthAttempt } from '@/lib/security/security-logger';
import { sanitizeRedirectUrl } from '@/lib/security/url-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const errorParam = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieState = request.cookies.get('ox_oauth_state')?.value;
  const cookieCallback = request.cookies.get('ox_oauth_callback')?.value;
  const targetCallback = sanitizeRedirectUrl(cookieCallback || '/', '/');

  // Handle user cancellation or OAuth error from Google
  if (errorParam) {
    const loginUrl = new URL('/login', request.url);
    if (errorParam !== 'access_denied') {
      loginUrl.searchParams.set('error', 'google-auth-failed');
    }
    if (targetCallback && targetCallback !== '/') {
      loginUrl.searchParams.set('callbackUrl', targetCallback);
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('ox_oauth_state');
    response.cookies.delete('ox_oauth_callback');
    return response;
  }

  // Verify state against CSRF cookie and ensure code is present
  if (!code || !state || !cookieState || state !== cookieState) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'invalid-state');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('ox_oauth_state');
    response.cookies.delete('ox_oauth_callback');
    return response;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google-not-configured');
    return NextResponse.redirect(loginUrl);
  }

  const redirectUri = getGoogleOAuthRedirectUri(request);

  // Exchange code for tokens
  const tokenData = await exchangeGoogleCodeForToken({
    code,
    clientId,
    clientSecret,
    redirectUri,
  });

  if (!tokenData?.access_token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google-token-failed');
    return NextResponse.redirect(loginUrl);
  }

  // Fetch Google user profile
  const googleProfile = await fetchGoogleUserProfile(tokenData.access_token);
  if (!googleProfile?.email) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google-missing-email');
    return NextResponse.redirect(loginUrl);
  }

  const email = googleProfile.email.toLowerCase().trim();
  const name = googleProfile.name?.trim() || email.split('@')[0];
  const avatarUrl = googleProfile.picture || null;

  try {
    // 1. Check if user already exists
    let user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (user) {
      if (!user.isActive) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', 'account-inactive');
        return NextResponse.redirect(loginUrl);
      }

      // Update avatar or emailVerified if missing
      if (!user.avatarUrl && avatarUrl) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            avatarUrl,
            emailVerified: user.emailVerified || new Date(),
          },
        }).catch(() => {});
      }
    } else {
      // 2. Locate or create CUSTOMER role
      let customerRole = await prisma.role.findUnique({
        where: { name: 'CUSTOMER' },
      });

      if (!customerRole) {
        customerRole = await prisma.role.create({
          data: {
            name: 'CUSTOMER',
            description: 'Self-service customer ordering account',
          },
        });
      }

      // Generate a strong random dummy password hash so account cannot be accessed with empty password
      const dummySecret = crypto.randomBytes(32).toString('hex');
      const dummyPasswordHash = await hashPassword(dummySecret);

      user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            name,
            email,
            passwordHash: dummyPasswordHash,
            avatarUrl,
            roleId: customerRole.id,
            isActive: true,
            emailVerified: new Date(),
          },
          include: { role: true },
        });

        // Link with existing customer record or create one
        const existingCustomer = await tx.customer.findFirst({
          where: { email },
        });

        if (existingCustomer) {
          await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              userId: newUser.id,
              name: existingCustomer.name || name,
            },
          });
        } else {
          await tx.customer.create({
            data: {
              name,
              email,
              userId: newUser.id,
            },
          });
        }

        return newUser;
      });
    }

    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIp = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Create session in database
    const sessionToken = await createSession(user.id, {
      ipAddress: clientIp,
      userAgent,
    });

    // Security audit logging
    logAuthAttempt({
      event: 'AUTH_LOGIN_SUCCESS',
      success: true,
      email,
      userId: user.id,
      clientIp,
      userAgent,
      details: { roleId: user.roleId, provider: 'google' },
    });

    await createAuditLog({
      actorUserId: user.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      entityType: AUDIT_ENTITY_TYPES.SESSION,
      entityId: user.id,
      description: `User ${user.name} (${user.email}) signed in via Google OAuth`,
      metadata: { roleId: user.roleId, provider: 'google' },
    }).catch(() => {});

    // Determine target redirect based on role
    const roleSlug = (user.role?.name || 'CUSTOMER').toLowerCase();
    const isCustomer = roleSlug === 'customer';
    const defaultRolePath = isCustomer ? '/' : `/${roleSlug}`;

    let destinationPath: string;
    if (isCustomer) {
      destinationPath =
        targetCallback && targetCallback !== '/dashboard'
          ? sanitizeRedirectUrl(targetCallback, '/')
          : '/';
    } else {
      destinationPath =
        targetCallback && targetCallback !== '/' && targetCallback !== '/dashboard'
          ? sanitizeRedirectUrl(targetCallback, defaultRolePath)
          : defaultRolePath;
    }

    const response = NextResponse.redirect(new URL(destinationPath, request.url));
    const isProduction = process.env.NODE_ENV === 'production';
    const ttl = isCustomer ? CUSTOMER_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    // Set HTTP-only session cookies
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ttl,
      expires: expiresAt,
    });

    response.cookies.set(ROLE_COOKIE_NAME, roleSlug, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ttl,
      expires: expiresAt,
    });

    // Clean up one-time OAuth state cookies
    response.cookies.delete('ox_oauth_state');
    response.cookies.delete('ox_oauth_callback');

    return response;
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google-auth-failed');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('ox_oauth_state');
    response.cookies.delete('ox_oauth_callback');
    return response;
  }
}
