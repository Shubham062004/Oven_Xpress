'use client';

import { createContext, useContext } from 'react';
import type { AuthUser } from '@/lib/auth/types';

interface AuthContextValue {
  user: AuthUser;
  expiresAt: number | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  user,
  expiresAt,
  children,
}: {
  user: AuthUser;
  expiresAt?: number | null;
  children: React.ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user, expiresAt: expiresAt ?? null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthUser {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context.user;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
