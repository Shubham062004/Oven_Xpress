import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildGoogleAuthUrl,
  getGoogleOAuthRedirectUri,
} from '@/lib/auth/google';
import { sanitizeRedirectUrl } from '@/lib/security/url-validation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawCallback = searchParams.get('callbackUrl') || searchParams.get('returnTo') || '/';
  const callbackUrl = sanitizeRedirectUrl(rawCallback, '/');

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  // If credentials are not yet supplied in .env, redirect back gracefully with an error indicator
  if (!clientId || !clientSecret) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'google-not-configured');
    if (callbackUrl && callbackUrl !== '/') {
      loginUrl.searchParams.set('callbackUrl', callbackUrl);
    }
    return NextResponse.redirect(loginUrl);
  }

  const redirectUri = getGoogleOAuthRedirectUri(request);
  const state = crypto.randomBytes(32).toString('hex');

  const authUrl = buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authUrl);
  const isProduction = process.env.NODE_ENV === 'production';

  // Secure CSRF state cookie (10 minute lifespan)
  response.cookies.set('ox_oauth_state', state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  // Preserve desired destination post-authentication
  response.cookies.set('ox_oauth_callback', callbackUrl, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}
