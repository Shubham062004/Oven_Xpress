'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { verifyPassword, DUMMY_BCRYPT_HASH } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/guards';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '@/lib/validations/auth';
import type { ActionResult } from '@/lib/auth/types';
import { createAuditLog, getClientContext } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import {
  createPasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  consumeEmailVerificationToken,
} from '@/lib/auth/tokens';

import { sanitizeRedirectUrl } from '@/lib/security/url-validation';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { logAuthAttempt, logTrafficAnomaly } from '@/lib/security/security-logger';
import {
  checkLoginAbuse,
  resetLoginRateLimit,
  validateHoneypot,
} from '@/lib/security/abuse-protection';

export interface LoginFormState extends ActionResult {
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
  unverified?: boolean;
}

export interface PasswordResetFormState extends ActionResult<{ devResetUrl?: string }> {
  fieldErrors?: {
    email?: string[];
    token?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
}

export interface EmailVerificationFormState extends ActionResult<{ devVerifyUrl?: string; email?: string }> {
  fieldErrors?: {
    email?: string[];
    token?: string[];
  };
}

function getAppBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

/**
 * Server Action for authenticating users.
 * Validates credentials, checks account status, enforces rate limiting,
 * mitigates user enumeration timing attacks with dummy bcrypt hashing,
 * checks email verification status, establishes a session, and redirects safely.
 */
export async function loginAction(
  _prevState: LoginFormState | null,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const callbackUrl = (formData.get('callbackUrl') as string) || '/';
  const clientCtx = await getClientContext();

  // 1. Anti-Bot Honeypot Protection
  if (!validateHoneypot(formData)) {
    logTrafficAnomaly({
      type: 'BOT_HONEYPOT_TRIGGERED',
      path: '/login',
      method: 'POST',
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      statusCode: 400,
      reason: 'Automated script completed hidden honeypot trap field',
    });

    return {
      success: false,
      error: 'Invalid login request.',
    };
  }

  // 2. Validate form fields
  const validationResult = loginSchema.safeParse({
    email,
    password,
    callbackUrl,
  });

  if (!validationResult.success) {
    const errorFormatted = validationResult.error.flatten();
    return {
      success: false,
      error: 'Please fix the errors below.',
      fieldErrors: {
        email: errorFormatted.fieldErrors.email,
        password: errorFormatted.fieldErrors.password,
      },
    };
  }

  const { email: cleanEmail, password: cleanPassword } = validationResult.data;

  // 3. Abuse Protection: Dual-layer rate limiting (per-email: 5/15m + per-IP: 25/15m)
  const abuseCheck = checkLoginAbuse({
    email: cleanEmail,
    clientIp: clientCtx.ipAddress ?? undefined,
  });

  if (!abuseCheck.allowed) {
    logAuthAttempt({
      event: 'AUTH_LOGIN_THROTTLED',
      success: false,
      email: cleanEmail,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      reason: abuseCheck.reason || 'Login throttled due to excessive failed attempts',
      details: { retryAfterSeconds: abuseCheck.retryAfterSeconds },
    });

    const minutesLeft = Math.ceil(abuseCheck.retryAfterSeconds / 60);
    return {
      success: false,
      error: `Too many login attempts. Account temporarily throttled. Please try again in ${minutesLeft} minute(s).`,
    };
  }

  try {
    // 2. Query user by email (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail.toLowerCase() },
    });

    if (!user) {
      // Execute dummy bcrypt comparison to guarantee constant-time response against timing enumeration
      await verifyPassword(cleanPassword, DUMMY_BCRYPT_HASH);

      logAuthAttempt({
        event: 'AUTH_LOGIN_FAILURE',
        success: false,
        email: cleanEmail,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
        reason: 'USER_NOT_FOUND',
      });

      await createAuditLog({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPES.SESSION,
        description: 'Failed login attempt: User not found',
        metadata: { attemptedEmail: cleanEmail.toLowerCase(), reason: 'USER_NOT_FOUND' },
      }).catch((e) => console.error('Failed to create audit log for failed login:', e));

      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    // 3. Verify user active status
    if (!user.isActive) {
      // Execute dummy compare to preserve timing invariance
      await verifyPassword(cleanPassword, DUMMY_BCRYPT_HASH);

      logAuthAttempt({
        event: 'AUTH_LOGIN_FAILURE',
        success: false,
        email: cleanEmail,
        userId: user.id,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
        reason: 'ACCOUNT_DEACTIVATED',
      });

      await createAuditLog({
        actorUserId: user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPES.SESSION,
        description: `Failed login attempt: Account deactivated for ${user.email}`,
        metadata: { email: user.email, reason: 'ACCOUNT_DEACTIVATED' },
      }).catch((e) => console.error('Failed to create audit log for deactivated login:', e));

      return {
        success: false,
        error: 'Your account is deactivated. Please contact your restaurant administrator.',
      };
    }

    // 4. Verify password hash
    const isPasswordValid = await verifyPassword(cleanPassword, user.passwordHash);
    if (!isPasswordValid) {
      logAuthAttempt({
        event: 'AUTH_LOGIN_FAILURE',
        success: false,
        email: cleanEmail,
        userId: user.id,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
        reason: 'INVALID_CREDENTIALS',
      });

      await createAuditLog({
        actorUserId: user.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPES.SESSION,
        description: `Failed login attempt: Invalid password for ${user.email}`,
        metadata: { email: user.email, reason: 'INVALID_CREDENTIALS' },
      }).catch((e) => console.error('Failed to create audit log for invalid password:', e));

      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    // 5. Enforce email verification if required
    const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
    if (requireEmailVerification && !user.emailVerified) {
      return {
        success: false,
        error: 'Your email address is not verified yet. Please check your email inbox or request a new verification link.',
        unverified: true,
      };
    }

    // Success: clear rate limiter
    resetLoginRateLimit(cleanEmail, clientCtx.ipAddress ?? undefined);

    // 6. Create persistent session and set HTTP-only cookie
    await createSession(user.id);

    // 7. Record successful login audit
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });

    logAuthAttempt({
      event: 'AUTH_LOGIN_SUCCESS',
      success: true,
      email: cleanEmail,
      userId: user.id,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      details: { roleId: user.roleId, branchId: employee?.branchId ?? null },
    });

    await createAuditLog({
      actorUserId: user.id,
      branchId: employee?.branchId ?? null,
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      entityType: AUDIT_ENTITY_TYPES.SESSION,
      entityId: user.id,
      description: `User ${user.name} (${user.email}) signed in successfully`,
      metadata: { roleId: user.roleId },
    }).catch((e) => console.error('Failed to create login audit log:', e));
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'An unexpected authentication error occurred. Please try again later.',
    };
  }

  // 8. Safe redirect on success
  const targetUrl = sanitizeRedirectUrl(callbackUrl, '/');
  redirect(targetUrl);
}

/**
 * Server Action for signing out the current user.
 * Terminates the session in DB, deletes the session cookie, and redirects to /login.
 */
export async function logoutAction(): Promise<void> {
  const clientCtx = await getClientContext();
  let currentUserId: string | undefined;

  try {
    const user = await getCurrentUser();
    if (user) {
      currentUserId = user.id;
      const employee = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: { branchId: true },
      });
      await createAuditLog({
        actorUserId: user.id,
        branchId: employee?.branchId ?? null,
        action: AUDIT_ACTIONS.AUTH_LOGOUT,
        entityType: AUDIT_ENTITY_TYPES.SESSION,
        entityId: user.id,
        description: `User ${user.name} (${user.email}) signed out`,
      });
    }
  } catch (error) {
    console.error('Failed to create logout audit log:', error);
  }

  logAuthAttempt({
    event: 'AUTH_LOGOUT',
    success: true,
    userId: currentUserId,
    clientIp: clientCtx.ipAddress ?? undefined,
    userAgent: clientCtx.userAgent ?? undefined,
  });

  await destroySession();
  redirect('/login');
}

/**
 * Server Action to request a password reset link.
 * Implements rate limiting, uniform responses to prevent user enumeration,
 * and generates high-entropy 15-minute expiring tokens stored as SHA-256 hashes.
 */
export async function requestPasswordResetAction(
  _prevState: PasswordResetFormState | null,
  formData: FormData
): Promise<PasswordResetFormState> {
  const email = formData.get('email');
  const clientCtx = await getClientContext();

  const validationResult = forgotPasswordSchema.safeParse({ email });
  if (!validationResult.success) {
    const errorFormatted = validationResult.error.flatten();
    return {
      success: false,
      error: 'Please enter a valid email address.',
      fieldErrors: {
        email: errorFormatted.fieldErrors.email,
      },
    };
  }

  const cleanEmail = validationResult.data.email.toLowerCase();

  // Rate Limiting: 3 requests per 15 minutes per email
  const rateLimitKey = `pwd-reset-req:${cleanEmail}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
  });

  if (!rateLimitResult.allowed) {
    logAuthAttempt({
      event: 'AUTH_PASSWORD_RESET_FAILED',
      success: false,
      email: cleanEmail,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      reason: 'Rate limit exceeded on password reset request',
    });

    const minutesLeft = Math.ceil(rateLimitResult.retryAfterSeconds / 60);
    return {
      success: false,
      error: `Too many password reset requests. Please wait ${minutesLeft} minute(s) before trying again.`,
    };
  }

  let devResetUrl: string | undefined;

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user && user.isActive) {
      const rawToken = await createPasswordResetToken(user.id);
      const baseUrl = getAppBaseUrl();
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      logAuthAttempt({
        event: 'AUTH_PASSWORD_RESET_REQUESTED',
        success: true,
        email: cleanEmail,
        userId: user.id,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
      });

      await createAuditLog({
        actorUserId: user.id,
        action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_REQUESTED,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: user.id,
        description: `Password reset requested for ${user.email}`,
      }).catch((e) => console.error('Failed to create password reset requested audit log:', e));

      // In development only, expose the reset URL for testing convenience
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AUTH-DEV] Password reset requested for ${cleanEmail}. Link: ${resetUrl}`);
        devResetUrl = resetUrl;
      }
    } else {
      // Execute dummy bcrypt to balance execution timing
      await verifyPassword('dummy_pass', DUMMY_BCRYPT_HASH);

      logAuthAttempt({
        event: 'AUTH_PASSWORD_RESET_REQUESTED',
        success: true, // Non-revealing
        email: cleanEmail,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
        reason: 'User not found or inactive (blinded response)',
      });
    }
  } catch (error) {
    console.error('Failed to process password reset request:', error);
    return {
      success: false,
      error: 'Failed to process request. Please try again later.',
    };
  }

  // Always return the exact same generic message to prevent account enumeration
  return {
    success: true,
    error: undefined,
    data: devResetUrl ? { devResetUrl } : undefined,
  };
}

/**
 * Server Action to finalize password reset using an expiring token.
 * Validates token, enforces strong password complexity, checks for password reuse,
 * terminates all active user sessions across all devices, and redirects to /login.
 */
export async function resetPasswordAction(
  _prevState: PasswordResetFormState | null,
  formData: FormData
): Promise<PasswordResetFormState> {
  const token = formData.get('token');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const clientCtx = await getClientContext();

  const validationResult = resetPasswordSchema.safeParse({
    token,
    password,
    confirmPassword,
  });

  if (!validationResult.success) {
    const errorFormatted = validationResult.error.flatten();
    return {
      success: false,
      error: 'Please fix the errors below.',
      fieldErrors: {
        token: errorFormatted.fieldErrors.token,
        password: errorFormatted.fieldErrors.password,
        confirmPassword: errorFormatted.fieldErrors.confirmPassword,
      },
    };
  }

  const { token: cleanToken, password: cleanPassword } = validationResult.data;

  // Rate Limiting: 5 attempts per 15 minutes on password reset execution
  const rateLimitKey = `pwd-reset-submit:${cleanToken.slice(0, 16)}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!rateLimitResult.allowed) {
    logAuthAttempt({
      event: 'AUTH_PASSWORD_RESET_FAILED',
      success: false,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      reason: 'Rate limit exceeded on password reset submission',
    });

    return {
      success: false,
      error: 'Too many reset attempts for this token. Please request a new password reset link.',
    };
  }

  try {
    const result = await consumePasswordResetToken(cleanToken, cleanPassword);
    if (!result.success) {
      logAuthAttempt({
        event: 'AUTH_PASSWORD_RESET_FAILED',
        success: false,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
        reason: result.error || 'Token consumption rejected',
      });

      return {
        success: false,
        error: result.error || 'Failed to reset password.',
      };
    }

    logAuthAttempt({
      event: 'AUTH_PASSWORD_RESET_SUCCESS',
      success: true,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while resetting your password. Please try again.',
    };
  }

  redirect('/login?reset=success');
}

/**
 * Server Action to dispatch an email verification link.
 * Uses 24-hour expiring tokens stored as SHA-256 hashes.
 */
export async function requestEmailVerificationAction(
  _prevState: EmailVerificationFormState | null,
  formData: FormData
): Promise<EmailVerificationFormState> {
  const email = formData.get('email');
  const clientCtx = await getClientContext();

  const validationResult = resendVerificationSchema.safeParse({ email });
  if (!validationResult.success) {
    return {
      success: false,
      error: 'Please enter a valid email address.',
    };
  }

  const cleanEmail = validationResult.data.email.toLowerCase();

  // Rate Limiting: 3 verification emails per 15 minutes per address
  const rateLimitKey = `email-verify-req:${cleanEmail}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 3,
  });

  if (!rateLimitResult.allowed) {
    logAuthAttempt({
      event: 'AUTH_EMAIL_VERIFICATION_FAILED',
      success: false,
      email: cleanEmail,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      reason: 'Rate limit exceeded on email verification requests',
    });

    const minutesLeft = Math.ceil(rateLimitResult.retryAfterSeconds / 60);
    return {
      success: false,
      error: `Too many verification requests. Please wait ${minutesLeft} minute(s) before requesting again.`,
    };
  }

  let devVerifyUrl: string | undefined;

  try {
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (user && user.isActive && !user.emailVerified) {
      const rawToken = await createEmailVerificationToken(user.id);
      const baseUrl = getAppBaseUrl();
      const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;

      logAuthAttempt({
        event: 'AUTH_EMAIL_VERIFICATION_SENT',
        success: true,
        email: cleanEmail,
        userId: user.id,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
      });

      await createAuditLog({
        actorUserId: user.id,
        action: AUDIT_ACTIONS.AUTH_EMAIL_VERIFICATION_SENT,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: user.id,
        description: `Email verification dispatched for ${user.email}`,
      }).catch((e) => console.error('Failed to create verification sent audit log:', e));

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AUTH-DEV] Email verification link for ${cleanEmail}: ${verifyUrl}`);
        devVerifyUrl = verifyUrl;
      }
    } else {
      await verifyPassword('dummy_pass', DUMMY_BCRYPT_HASH);
    }
  } catch (error) {
    console.error('Failed to dispatch email verification:', error);
    return {
      success: false,
      error: 'Failed to process request. Please try again later.',
    };
  }

  return {
    success: true,
    data: devVerifyUrl ? { devVerifyUrl, email: cleanEmail } : { email: cleanEmail },
  };
}

/**
 * Server Action to verify email using an expiring token.
 */
export async function verifyEmailAction(
  token: string
): Promise<ActionResult<{ email: string }>> {
  const clientCtx = await getClientContext();
  const validationResult = verifyEmailSchema.safeParse({ token });
  if (!validationResult.success) {
    return {
      success: false,
      error: 'Invalid or missing email verification token.',
    };
  }

  // Rate Limiting: 10 attempts per 15 minutes per token prefix
  const rateLimitKey = `email-verify-submit:${token.slice(0, 16)}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  if (!rateLimitResult.allowed) {
    logAuthAttempt({
      event: 'AUTH_EMAIL_VERIFICATION_FAILED',
      success: false,
      clientIp: clientCtx.ipAddress ?? undefined,
      userAgent: clientCtx.userAgent ?? undefined,
      reason: 'Rate limit exceeded on email verification submission',
    });

    return {
      success: false,
      error: 'Too many verification attempts. Please request a new verification email.',
    };
  }

  try {
    const result = await consumeEmailVerificationToken(token);
    if (result.success) {
      logAuthAttempt({
        event: 'AUTH_EMAIL_VERIFIED',
        success: true,
        email: result.data?.email,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
      });
    } else {
      logAuthAttempt({
        event: 'AUTH_EMAIL_VERIFICATION_FAILED',
        success: false,
        clientIp: clientCtx.ipAddress ?? undefined,
        userAgent: clientCtx.userAgent ?? undefined,
        reason: result.error,
      });
    }
    return result;
  } catch (error) {
    console.error('Email verification error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred during email verification.',
    };
  }
}
