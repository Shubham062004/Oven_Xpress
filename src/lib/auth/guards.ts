import { redirect } from 'next/navigation';

import { validateSession } from '@/lib/auth/session';
import type { AuthUser, ActionResult } from '@/lib/auth/types';
import { prisma } from '@/lib/db/prisma';
import { hasPermission, hasRole } from '@/lib/permissions/check';
import type { PermissionCode, RoleName } from '@/lib/permissions/definitions';
import { isSafeRedirectUrl } from '@/lib/security/url-validation';

/**
 * Returns the currently authenticated user without triggering a redirect.
 * Returns null if no active or valid session exists.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const result = await validateSession();
  return result.user;
}

/**
 * Server guard: Enforces that the user must be authenticated.
 * Redirects to /login if unauthenticated.
 * If the session has expired, redirects with ?reason=session-expired and safe returnTo.
 */
export async function requireAuthentication(callbackUrl?: string): Promise<AuthUser> {
  const result = await validateSession();

  if (!result.user) {
    const isExpired = result.status === 'EXPIRED';
    const params = new URLSearchParams();

    if (isExpired) {
      params.set('reason', 'session-expired');
    } else if (result.status === 'USER_INACTIVE') {
      params.set('error', 'account-inactive');
    }

    if (callbackUrl && isSafeRedirectUrl(callbackUrl)) {
      params.set('callbackUrl', callbackUrl);
      params.set('returnTo', callbackUrl);
    }

    const qs = params.toString();
    const loginPath = qs ? `/login?${qs}` : '/login';
    redirect(loginPath);
  }

  return result.user;
}

/**
 * Centralized guard for API routes and server actions returning an ActionResult.
 * Returns { ok: true, user } or { ok: false, errorResult: ActionResult }.
 */
export async function requireAuthOrActionError(): Promise<
  | { ok: true; user: AuthUser }
  | { ok: false; errorResult: ActionResult }
> {
  const result = await validateSession();
  if (result.status === 'VALID' && result.user) {
    return { ok: true, user: result.user };
  }

  const code = result.code || (result.status === 'EXPIRED' ? 'AUTH_SESSION_EXPIRED' : 'AUTH_UNAUTHORIZED');
  const message = result.error || 'Your session has expired. Please log in again.';

  return {
    ok: false,
    errorResult: {
      success: false,
      code,
      error: message,
      message,
    },
  };
}

/**
 * Server guard: Enforces that the authenticated user possesses one of the allowed roles.
 * Redirects to /unauthorized (403) if the user lacks the role.
 */
export async function requireRole(
  roles: RoleName | string | (RoleName | string)[]
): Promise<AuthUser> {
  const user = await requireAuthentication();

  if (!hasRole(user, roles)) {
    redirect('/unauthorized');
  }

  return user;
}

/**
 * Server guard: Enforces that the authenticated user possesses the specific permission.
 * Redirects to /unauthorized (403) if the user lacks the permission.
 */
export async function requirePermission(
  permission: PermissionCode | string
): Promise<AuthUser> {
  const user = await requireAuthentication();

  if (!hasPermission(user, permission)) {
    redirect('/unauthorized');
  }

  return user;
}

export interface AuthorizedBranchScope {
  isAllBranches: boolean;
  branchIds: string[];
}

/**
 * Resolves the authoritative branch scope for the authenticated user.
 * - OWNER and ADMIN have universal access across all branches.
 * - MANAGER and STAFF are restricted strictly to their assigned active branch.
 */
export async function getAuthorizedBranchScope(
  user: AuthUser
): Promise<AuthorizedBranchScope> {
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return { isAllBranches: true, branchIds: [] };
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { branchId: true, employmentStatus: true },
  });

  // User must have an active employee record linked to a branch
  if (employee?.branchId && employee.employmentStatus === 'ACTIVE') {
    return { isAllBranches: false, branchIds: [employee.branchId] };
  }

  return { isAllBranches: false, branchIds: [] };
}

/**
 * Verifies whether a given branchId is accessible within the resolved branch scope.
 */
export function isBranchAuthorized(
  scope: AuthorizedBranchScope,
  branchId: string
): boolean {
  if (!branchId) return false;
  return scope.isAllBranches || scope.branchIds.includes(branchId);
}

