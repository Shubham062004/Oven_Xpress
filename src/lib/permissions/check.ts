import type { AuthUser } from '@/lib/auth/types';
import type { PermissionCode, RoleName } from '@/lib/permissions/definitions';

/**
 * Checks if an authenticated user has a specific permission.
 * OWNER always has all permissions by default.
 */
export function hasPermission(
  user: AuthUser | null | undefined,
  permission: PermissionCode | string
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  // Owner has universal access
  if (user.role === 'OWNER') {
    return true;
  }

  return user.permissions.includes(permission);
}

/**
 * Checks if an authenticated user has any of the specified permissions.
 */
export function hasAnyPermission(
  user: AuthUser | null | undefined,
  permissions: (PermissionCode | string)[]
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  if (user.role === 'OWNER') {
    return true;
  }

  return permissions.some((permission) => user.permissions.includes(permission));
}

/**
 * Checks if an authenticated user has one of the allowed roles.
 */
export function hasRole(
  user: AuthUser | null | undefined,
  roles: RoleName | string | (RoleName | string)[]
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(user.role);
}
