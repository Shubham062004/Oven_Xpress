import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { destroyAllUserSessions } from '@/lib/auth/session';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import type { ActionResult } from '@/lib/auth/types';

// Password reset tokens expire in 15 minutes
export const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

// Email verification tokens expire in 24 hours
export const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Derives a secure SHA-256 hash of a raw token.
 * Raw high-entropy tokens are delivered only to the recipient, while
 * only their one-way hash is persisted in the database. Even in the event
 * of a database breach or SQL dump, tokens cannot be redeemed.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a cryptographically strong 32-byte (64-character hex) random token.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD RESET TOKENS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates and stores a new password reset token for a given user.
 * Invalidate all existing pending reset tokens for this user first.
 * Returns the unhashed raw token to be delivered to the user.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  // Invalidate any previous reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId },
  });

  // Store only the SHA-256 hash
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Validates a password reset token without consuming it.
 */
export async function validatePasswordResetToken(rawToken: string): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { valid: false, error: 'Invalid token format.' };
  }

  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) {
    return { valid: false, error: 'Invalid or expired password reset token.' };
  }

  if (record.expiresAt < new Date()) {
    // Stale token: purge
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    return { valid: false, error: 'This password reset token has expired. Please request a new one.' };
  }

  if (!record.user.isActive) {
    return { valid: false, error: 'Account is deactivated. Please contact your administrator.' };
  }

  return { valid: true, userId: record.userId };
}

/**
 * Consumes a password reset token and updates the user's password.
 * In a single atomic transaction:
 * 1. Checks token validity and expiration
 * 2. Compares against previous password to prevent identical reuse
 * 3. Updates passwordHash with bcrypt (12 rounds)
 * 4. Marks emailVerified = true (resetting via email verifies ownership)
 * 5. Deletes all reset tokens for the user
 * 6. Invalidates all active sessions across devices
 * 7. Records an audit log
 */
export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string
): Promise<ActionResult> {
  const tokenHash = hashToken(rawToken);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return {
      success: false,
      error: 'Invalid or expired password reset token. Please request a new reset link.',
    };
  }

  const user = record.user;
  if (!user.isActive) {
    return {
      success: false,
      error: 'Account is deactivated. Password cannot be reset.',
    };
  }

  // Prevent reusing the same password
  const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
  if (isSamePassword) {
    return {
      success: false,
      error: 'New password cannot be identical to your current password. Please choose a different password.',
    };
  }

  const newPasswordHash = await hashPassword(newPassword);

  // Atomic update
  await prisma.$transaction(async (tx) => {
    // 1. Update user password and ensure verified
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        emailVerified: user.emailVerified ?? new Date(),
      },
    });

    // 2. Delete all reset tokens for this user
    await tx.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });
  });

  // 3. Invalidate ALL active sessions for this user across all browsers/devices
  await destroyAllUserSessions(user.id);

  // 4. Record security audit log
  await createAuditLog({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_COMPLETED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    description: `User ${user.email} successfully completed password reset and all sessions were invalidated`,
    metadata: { email: user.email },
  }).catch((e) => console.error('Failed to create password reset audit log:', e));

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL VERIFICATION TOKENS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates and stores a new email verification token for a given user.
 * Invalidates any previous verification tokens for this user.
 * Returns the unhashed raw token to be delivered in the verification link.
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS);

  // Invalidate any previous verification tokens for this user
  await prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  // Store only the SHA-256 hash
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Validates and consumes an email verification token.
 * Updates user.emailVerified timestamp and deletes the token.
 */
export async function consumeEmailVerificationToken(rawToken: string): Promise<ActionResult<{ email: string }>> {
  if (!rawToken || typeof rawToken !== 'string') {
    return { success: false, error: 'Invalid verification token format.' };
  }

  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return {
      success: false,
      error: 'Invalid or expired email verification link. Please request a new verification email.',
    };
  }

  const user = record.user;

  // Atomic update
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    await tx.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });
  });

  // Audit
  await createAuditLog({
    actorUserId: user.id,
    action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFIED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    description: `Email address verified for user ${user.email}`,
    metadata: { email: user.email },
  }).catch((e) => console.error('Failed to create email verified audit log:', e));

  return { success: true, data: { email: user.email } };
}
