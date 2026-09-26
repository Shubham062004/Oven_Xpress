'use server';

import { validateSession } from '@/lib/auth/session';

/**
 * Lightweight session validation server action for client-side heartbeat / visibility checks.
 * Returns valid status, remaining seconds, or AUTH_SESSION_EXPIRED code.
 */
export async function checkSessionStatusAction(): Promise<{
  valid: boolean;
  code?: string;
  error?: string;
  expiresAt?: number;
  remainingSeconds?: number;
}> {
  const result = await validateSession();
  if (result.status === 'VALID' && result.expiresAt) {
    return {
      valid: true,
      expiresAt: result.expiresAt.getTime(),
      remainingSeconds: result.remainingSeconds,
    };
  }
  return {
    valid: false,
    code: result.code || 'AUTH_SESSION_EXPIRED',
    error: result.error || 'Your session has expired. Please log in again.',
  };
}
