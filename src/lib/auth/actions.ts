'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { getCurrentUser } from '@/lib/auth/guards';
import { loginSchema } from '@/lib/validations/auth';
import type { ActionResult } from '@/lib/auth/types';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';

export interface LoginFormState extends ActionResult {
  fieldErrors?: {
    email?: string[];
    password?: string[];
  };
}

/**
 * Server Action for authenticating users.
 * Validates credentials, checks account status, establishes a session, and redirects.
 */
export async function loginAction(
  _prevState: LoginFormState | null,
  formData: FormData
): Promise<LoginFormState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const callbackUrl = (formData.get('callbackUrl') as string) || '/';

  // 1. Validate form fields
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

  try {
    // 2. Query user by email (case-insensitive)
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail.toLowerCase() },
    });

    if (!user) {
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

    // 5. Create persistent session and set HTTP-only cookie
    await createSession(user.id);

    // 6. Record successful login audit
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
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

  // 7. Safe redirect on success
  const targetUrl = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
    ? callbackUrl
    : '/';

  redirect(targetUrl);
}

/**
 * Server Action for signing out the current user.
 * Terminates the session in DB, deletes the session cookie, and redirects to /login.
 */
export async function logoutAction(): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (user) {
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

  await destroySession();
  redirect('/login');
}
