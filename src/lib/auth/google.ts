import type { NextRequest } from 'next/server';

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export function isGoogleAuthAvailable(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Derives the canonical OAuth redirect URI.
 * Priority:
 * 1. GOOGLE_REDIRECT_URI environment variable (if explicitly defined)
 * 2. Host and protocol derived from forwarded headers (works dynamically across localhost and Vercel)
 */
export function getGoogleOAuthRedirectUri(request: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = forwardedHost || request.headers.get('host') || request.nextUrl.host;

  const isLocal =
    host.includes('localhost') ||
    host.includes('127.0.0.1') ||
    host.includes('[::1]');
  const proto = forwardedProto || (isLocal ? 'http' : 'https');

  return `${proto}://${host}/api/auth/google/callback`;
}

/**
 * Builds the Google OAuth 2.0 authorization URL.
 */
export function buildGoogleAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', options.state);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/**
 * Exchanges the authorization code received from Google for access tokens.
 */
export async function exchangeGoogleCodeForToken(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string; id_token?: string; expires_in?: number } | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: options.code,
        client_id: options.clientId,
        client_secret: options.clientSecret,
        redirect_uri: options.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google token exchange failed:', response.status, errorText);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Error contacting Google OAuth token endpoint:', err);
    return null;
  }
}

/**
 * Retrieves the authenticated user's profile information from Google.
 */
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google profile fetch failed:', response.status, errorText);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Error fetching Google user profile:', err);
    return null;
  }
}
