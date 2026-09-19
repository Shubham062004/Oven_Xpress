import type { RoleName } from '@/lib/permissions/definitions';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName | string;
  permissions: string[];
  isActive: boolean;
}

export interface SessionData {
  sessionToken: string;
  user: AuthUser;
  expiresAt: Date;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface LoginFormData {
  email: string;
  password: string;
  callbackUrl?: string;
}
