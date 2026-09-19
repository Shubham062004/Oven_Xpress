'use server';

import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession } from '@/lib/auth/session';
import { loginSchema } from '@/lib/validations/auth';
import type { ActionResult } from '@/lib/auth/types';

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
      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    // 3. Verify user active status
    if (!user.isActive) {
      return {
        success: false,
        error: 'Your account is deactivated. Please contact your restaurant administrator.',
      };
    }

    // 4. Verify password hash
    const isPasswordValid = await verifyPassword(cleanPassword, user.passwordHash);
    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    // 5. Create persistent session and set HTTP-only cookie
    await createSession(user.id);
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'An unexpected authentication error occurred. Please try again later.',
    };
  }

  // 6. Safe redirect on success
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
  await destroySession();
  redirect('/login');
}
