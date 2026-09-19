import crypto from 'crypto';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/db/prisma';
import type { AuthUser, SessionData } from '@/lib/auth/types';

export const SESSION_COOKIE_NAME = 'ox_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Creates a new session in the database and writes the secure HTTP-only cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  // Store in database
  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
    },
  });

  // Set HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    expires: expiresAt,
  });

  return sessionToken;
}

/**
 * Retrieves and validates the current session from the HTTP-only cookie.
 * Verifies active status, expiration, and loads user role and permissions.
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return null;
    }

    const sessionRecord = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sessionRecord) {
      // Stale or invalid cookie, delete it
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    // Check expiration
    if (sessionRecord.expiresAt < new Date()) {
      await prisma.session.deleteMany({ where: { sessionToken } });
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    // Check active status
    if (!sessionRecord.user.isActive) {
      await prisma.session.deleteMany({ where: { sessionToken } });
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    // Flatten permissions
    const permissions = sessionRecord.user.role.permissions.map(
      (rp: { permission: { code: string } }) => rp.permission.code
    );

    const user: AuthUser = {
      id: sessionRecord.user.id,
      name: sessionRecord.user.name,
      email: sessionRecord.user.email,
      role: sessionRecord.user.role.name,
      permissions,
      isActive: sessionRecord.user.isActive,
    };

    return {
      sessionToken: sessionRecord.sessionToken,
      user,
      expiresAt: sessionRecord.expiresAt,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'digest' in error &&
      (error as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
    ) {
      throw error;
    }
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Destroys the current session in both the database and the client cookie.
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { sessionToken },
      });
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
  } catch (error) {
    console.error('Failed to destroy session:', error);
  }
}
