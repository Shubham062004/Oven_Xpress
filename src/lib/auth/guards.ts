import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import type { AuthUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db/prisma';
import { hasPermission, hasRole } from '@/lib/permissions/check';
import type { PermissionCode, RoleName } from '@/lib/permissions/definitions';

/**
 * Returns the currently authenticated user without triggering a redirect.
 * Returns null if no active or valid session exists.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Server guard: Enforces that the user must be authenticated.
 * Redirects to /login if unauthenticated.
 */
export async function requireAuthentication(callbackUrl?: string): Promise<AuthUser> {
  const user = await getCurrentUser();

  if (!user) {
    const loginPath = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : '/login';
    redirect(loginPath);
  }

  return user;
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

