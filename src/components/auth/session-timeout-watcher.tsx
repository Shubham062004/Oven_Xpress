'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Clock, Lock, LogIn } from 'lucide-react';

import { useAuthContext } from '@/providers/auth-provider';
import { checkSessionStatusAction } from '@/lib/auth/session-actions';
import { Button } from '@/components/ui/button';

const BROADCAST_CHANNEL_NAME = 'ox_session_sync';
const STORAGE_EVENT_KEY = 'ox_session_expired_event';

export function SessionTimeoutWatcher() {
  const { expiresAt } = useAuthContext();
  const [isExpired, setIsExpired] = React.useState(() => {
    return Boolean(expiresAt && Date.now() >= expiresAt);
  });
  const router = useRouter();
  const pathname = usePathname();

  // Helper to trigger expiration state and sync across browser tabs
  const triggerExpiration = React.useCallback(() => {
    setIsExpired(true);

    // Notify other tabs via BroadcastChannel if available
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.postMessage({ type: 'SESSION_EXPIRED', timestamp: Date.now() });
        channel.close();
      }
    } catch {
      // Fallback: storage event
      try {
        localStorage.setItem(STORAGE_EVENT_KEY, Date.now().toString());
      } catch {}
    }
  }, []);

  // 1. Primary timer based on server-provided session expiresAt timestamp
  React.useEffect(() => {
    if (!expiresAt) return;

    const remainingMs = expiresAt - Date.now();

    const timer = setTimeout(() => {
      triggerExpiration();
    }, Math.max(0, remainingMs));

    return () => clearTimeout(timer);
  }, [expiresAt, triggerExpiration]);

  // 2. Visibility and tab focus watcher (Requirement 8)
  React.useEffect(() => {
    const handleCheck = async () => {
      if (isExpired) return;

      // Quick local check if 10-minute window has passed
      if (expiresAt && Date.now() >= expiresAt) {
        triggerExpiration();
        return;
      }

      // Authoritative server check on tab return / window focus
      try {
        const status = await checkSessionStatusAction();
        if (!status.valid) {
          triggerExpiration();
        }
      } catch {
        // If network or server action rejects, trigger expiration
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleCheck();
      }
    };

    const onFocus = () => {
      handleCheck();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // Handles browser Back / Forward restoration (bfcache)
      if (event.persisted || (expiresAt && Date.now() >= expiresAt)) {
        handleCheck();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [expiresAt, isExpired, triggerExpiration]);

  // 3. Cross-tab synchronization via BroadcastChannel & Storage Event (Requirement 19)
  React.useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = (event) => {
          if (event.data?.type === 'SESSION_EXPIRED') {
            setIsExpired(true);
          } else if (event.data?.type === 'LOGOUT') {
            router.push('/login');
          }
        };
      }
    } catch {}

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_EVENT_KEY) {
        setIsExpired(true);
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      channel?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [router]);

  // 4. Global fetch interceptor to catch 401 AUTH_SESSION_EXPIRED responses (Requirement 9)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 401) {
        try {
          const clone = response.clone();
          const json = await clone.json();
          if (json?.code === 'AUTH_SESSION_EXPIRED' || json?.error?.includes('session has expired')) {
            triggerExpiration();
          }
        } catch {}
      }

      return response;
    };

    const onCustomExpireEvent = () => {
      triggerExpiration();
    };

    window.addEventListener('ox:session-expired', onCustomExpireEvent);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener('ox:session-expired', onCustomExpireEvent);
    };
  }, [triggerExpiration]);

  const handleLoginRedirect = () => {
    const returnPath = pathname || '/';
    const params = new URLSearchParams();
    params.set('reason', 'session-expired');
    params.set('callbackUrl', returnPath);
    params.set('returnTo', returnPath);

    router.push(`/login?${params.toString()}`);
  };

  if (!isExpired) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl transition-all">
        {/* Warning Icon Badge */}
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Clock className="size-7 animate-pulse" />
        </div>

        {/* Content */}
        <div className="mt-4 text-center space-y-2">
          <h2 id="session-expired-title" className="text-xl font-semibold tracking-tight text-foreground">
            Session Expired
          </h2>
          <p id="session-expired-description" className="text-sm text-muted-foreground leading-relaxed">
            Your session expired after 10 minutes for security. Please log in again to continue.
          </p>
        </div>

        {/* Security Info Pill */}
        <div className="mt-5 rounded-lg border border-border/60 bg-muted/40 p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-primary" />
            <span>Strict multi-branch session timeout policy (10 mins)</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex flex-col gap-2">
          <Button
            onClick={handleLoginRedirect}
            className="w-full gap-2 font-medium"
            size="lg"
            autoFocus
          >
            <LogIn className="size-4" />
            Log in again
          </Button>
        </div>
      </div>
    </div>
  );
}
