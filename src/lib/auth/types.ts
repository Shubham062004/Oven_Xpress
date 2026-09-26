import type { RoleName } from '@/lib/permissions/definitions';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: RoleName | string;
  permissions: string[];
  isActive: boolean;
  emailVerified?: Date | null;
  branchName?: string | null;
  branchId?: string | null;
  designation?: string | null;
  employeeCode?: string | null;
}

export interface SessionData {
  sessionToken: string;
  user: AuthUser;
  expiresAt: Date;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  code?: string;
  message?: string;
  data?: T;
}

export type SessionValidationStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'UNAUTHENTICATED'
  | 'USER_INACTIVE';

export interface SessionValidationResult {
  status: SessionValidationStatus;
  session: SessionData | null;
  user: AuthUser | null;
  expiresAt?: Date | null;
  error?: string;
  code?: string;
  remainingSeconds?: number;
}

export interface LoginFormData {
  email: string;
  password: string;
  callbackUrl?: string;
}
