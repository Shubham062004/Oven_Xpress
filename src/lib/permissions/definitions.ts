/**
 * System Permission Codes
 * Granular permissions for the authentication and system administration.
 * Future business modules will extend this list.
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_READ: 'dashboard.read',

  // User Management
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',

  // Settings
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * System Role Names
 */
export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/**
 * Default permission matrix for initial seeding and fallback checks.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, readonly PermissionCode[]> = {
  OWNER: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
  ],
  ADMIN: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.SETTINGS_READ,
  ],
  MANAGER: [
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.SETTINGS_READ,
  ],
  STAFF: [
    PERMISSIONS.DASHBOARD_READ,
  ],
};
