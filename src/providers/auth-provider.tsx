'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@/lib/auth/types';

export interface AuthContextValue {
  user: AuthUser;
  expiresAt: number | null;
  isExpired: boolean;
  setExpired: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  user,
  expiresAt,
  children,
}: {
  user: AuthUser;
  expiresAt?: number | null;
  children: React.ReactNode;
}) {
  const [isExpired, setIsExpired] = useState<boolean>(() => {
    return Boolean(expiresAt && Date.now() >= expiresAt);
  });

  const setExpired = useCallback(() => {
    setIsExpired(true);
    if (typeof window !== 'undefined') {
      window.__ox_session_expired = true;
      window.dispatchEvent(new CustomEvent('ox:session-expired'));
    }
  }, []);

  useEffect(() => {
    const handleExpiredEvent = () => {
      setIsExpired(true);
    };

    window.addEventListener('ox:session-expired', handleExpiredEvent);
    return () => {
      window.removeEventListener('ox:session-expired', handleExpiredEvent);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        expiresAt: expiresAt ?? null,
        isExpired,
        setExpired,
      }}
    >
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
