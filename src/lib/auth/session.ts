import crypto from 'crypto';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/db/prisma';
import type { AuthUser, SessionData, SessionValidationResult } from '@/lib/auth/types';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import { logAuthAttempt } from '@/lib/security/security-logger';

export const SESSION_COOKIE_NAME = 'ox_session';
export const SESSION_TTL_SECONDS = 10 * 60; // Exactly 10 minutes (600 seconds)

/**
 * Creates a new session in the database and writes the secure HTTP-only cookie.
 * Absolute 10-minute lifetime is enforced.
 */
export async function createSession(
  userId: string,
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  // Store in database
  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    },
  });

  // Opportunistic cleanup of expired sessions
  cleanupExpiredSessions().catch(() => {});

  // Set HTTP-only cookie with strict 10-minute maxAge
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
 * Centrally validates the current session from the HTTP-only cookie.
 * Enforces strict server-side 10-minute expiration, user active status,
 * revokes expired sessions in DB, and emits security audit events.
 */
export async function validateSession(): Promise<SessionValidationResult> {
  try {
    let cookieStore;
    try {
      cookieStore = await cookies();
    } catch {
      return { status: 'UNAUTHENTICATED', session: null, user: null };
    }

    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return { status: 'UNAUTHENTICATED', session: null, user: null };
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
            employee: {
              include: {
                branch: true,
              },
            },
          },
        },
      },
    });

    if (!sessionRecord) {
      // Stale or revoked cookie, delete it
      cookieStore.delete(SESSION_COOKIE_NAME);
      return {
        status: 'EXPIRED',
        session: null,
        user: null,
        code: 'AUTH_SESSION_EXPIRED',
        error: 'Your session has expired. Please log in again.',
      };
    }

    // Check expiration (Strict 10 minutes enforced by server)
    const now = new Date();
    if (sessionRecord.expiresAt <= now) {
      await prisma.session.deleteMany({ where: { sessionToken } });
      cookieStore.delete(SESSION_COOKIE_NAME);

      try {
        await createAuditLog({
          actorUserId: sessionRecord.userId,
          branchId: sessionRecord.user.employee?.branchId ?? null,
          action: AUDIT_ACTIONS.AUTH_SESSION_EXPIRED,
          entityType: AUDIT_ENTITY_TYPES.SESSION,
          entityId: sessionRecord.userId,
          description: `User session expired after 10 minutes for ${sessionRecord.user.name} (${sessionRecord.user.email})`,
        });
      } catch (auditErr) {
        console.error('Failed to log session expiration audit:', auditErr);
      }

      logAuthAttempt({
        event: 'AUTH_SESSION_EXPIRED',
        success: false,
        userId: sessionRecord.userId,
      });

      return {
        status: 'EXPIRED',
        session: null,
        user: null,
        code: 'AUTH_SESSION_EXPIRED',
        error: 'Your session has expired. Please log in again.',
      };
    }

    // Check active status
    if (!sessionRecord.user.isActive) {
      await prisma.session.deleteMany({ where: { sessionToken } });
      cookieStore.delete(SESSION_COOKIE_NAME);
      return {
        status: 'USER_INACTIVE',
        session: null,
        user: null,
        code: 'AUTH_USER_INACTIVE',
        error: 'Your account is currently inactive.',
      };
    }

    // Flatten permissions
    const permissions = sessionRecord.user.role.permissions.map(
      (rp: { permission: { code: string } }) => rp.permission.code
    );

    const employee = sessionRecord.user.employee;

    const user: AuthUser = {
      id: sessionRecord.user.id,
      name: sessionRecord.user.name,
      email: sessionRecord.user.email,
      phone: sessionRecord.user.phone ?? employee?.phone ?? null,
      avatarUrl: sessionRecord.user.avatarUrl ?? null,
      role: sessionRecord.user.role.name,
      permissions,
      isActive: sessionRecord.user.isActive,
      emailVerified: sessionRecord.user.emailVerified,
      branchName: employee?.branch?.name ?? null,
      branchId: employee?.branchId ?? null,
      designation: employee?.designation ?? null,
      employeeCode: employee?.employeeCode ?? null,
    };

    const session: SessionData = {
      sessionToken: sessionRecord.sessionToken,
      user,
      expiresAt: sessionRecord.expiresAt,
    };

    const remainingSeconds = Math.max(
      0,
      Math.floor((sessionRecord.expiresAt.getTime() - now.getTime()) / 1000)
    );

    return {
      status: 'VALID',
      session,
      user,
      expiresAt: sessionRecord.expiresAt,
      remainingSeconds,
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
    console.error('Failed to validate session:', error);
    return { status: 'UNAUTHENTICATED', session: null, user: null };
  }
}

/**
 * Retrieves and validates the current session from the HTTP-only cookie.
 * Backwards compatible helper delegating to authoritative validateSession().
 */
export async function getSession(): Promise<SessionData | null> {
  const result = await validateSession();
  return result.session;
}

/**
 * Opportunistically purges expired sessions from the database.
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
    return 0;
  }
}

/**
 * Destroys the current session in both the database and the client cookie.
 */
export async function destroySession(): Promise<void> {
  try {
    let sessionToken: string | undefined;
    try {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      if (sessionToken) {
        cookieStore.delete(SESSION_COOKIE_NAME);
      }
    } catch {
      // Cookies are unavailable when invoked outside request context (e.g. CLI, scripts, tasks)
    }

    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { sessionToken },
      });
    }
  } catch (error) {
    console.error('Failed to destroy session:', error);
  }
}

/**
 * Destroys all active sessions for a specific user.
 * Used during password reset, account deactivation, or security incidents to
 * guarantee immediate termination of all active client sessions across devices.
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  try {
    await prisma.session.deleteMany({
      where: { userId },
    });

    try {
      const cookieStore = await cookies();
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {
      // Cookies are unavailable outside request context
    }
  } catch (error) {
    console.error(`Failed to destroy all sessions for user ${userId}:`, error);
  }
}

/**
 * Destroys all other active sessions for a specific user, preserving the current session.
 */
export async function destroyOtherUserSessions(
  userId: string,
  currentSessionToken: string
): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        userId,
        sessionToken: { not: currentSessionToken },
      },
    });
    return result.count;
  } catch (error) {
    console.error(`Failed to destroy other sessions for user ${userId}:`, error);
    return 0;
  }
}

export interface SanitizedSessionInfo {
  id: string;
  isCurrent: boolean;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Retrieves all active sessions for a user safely without exposing tokens or secrets.
 */
export async function getUserActiveSessions(
  userId: string,
  currentSessionToken?: string
): Promise<SanitizedSessionInfo[]> {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sessionToken: true,
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    return sessions.map((s) => {
      const record = s as unknown as {
        id: string;
        sessionToken: string;
        createdAt: Date;
        expiresAt: Date;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
      return {
        id: record.id,
        isCurrent: record.sessionToken === currentSessionToken,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        ipAddress: record.ipAddress ?? null,
        userAgent: record.userAgent ?? null,
      };
    });
  } catch (error) {
    console.error(`Failed to get active sessions for user ${userId}:`, error);
    return [];
  }
}

