'use client';

import { useEffect, useRef, useState, useContext } from 'react';
import type { RealtimeEventType, RealtimeMessage } from './types';
import { AuthContext } from '@/providers/auth-provider';
import { checkSessionStatusAction } from '@/lib/auth/session-actions';

export interface UseRealtimeOptions {
  orderNumber?: string;
  token?: string;
  branchId?: string;
  enabled?: boolean;
  onEvent?: (message: RealtimeMessage) => void;
  eventTypes?: RealtimeEventType[];
}

/**
 * Robust, production-grade React hook for subscribing to application-wide real-time events via SSE.
 *
 * Features:
 * - Session-aware: Halts all connection attempts and retries immediately when session expires.
 * - Stable: Serializes eventTypes into a primitive dependency key to avoid infinite reconnect loops.
 * - Automatic exponential backoff (2s -> 30s) on temporary network interruptions.
 * - Automatic termination on 401 Unauthorized / session termination.
 * - Clean teardown on unmount.
 */
export function useRealtime({
  orderNumber,
  token,
  branchId,
  enabled = true,
  onEvent,
  eventTypes,
}: UseRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const eventTypesRef = useRef(eventTypes);

  // Consume AuthContext if within AuthProvider
  const authContext = useContext(AuthContext);
  const isSessionExpired = Boolean(
    authContext?.isExpired ||
      (typeof window !== 'undefined' && window.__ox_session_expired)
  );

  // Keep callback and eventTypes refs updated without re-triggering connection teardown
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    eventTypesRef.current = eventTypes;
  }, [eventTypes]);

  // Compute a stable primitive string key for eventTypes array to avoid re-triggering effect on every render
  const eventTypesKey =
    eventTypes && eventTypes.length > 0
      ? [...eventTypes].sort().join(',')
      : '__all__';

  const shouldConnect = enabled && !isSessionExpired;

  useEffect(() => {
    if (!shouldConnect) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    let isMounted = true;
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryDelay = 2000;
    let consecutiveErrors = 0;

    const stopAndHalt = () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };

    // Listen to global session expiration event
    const handleGlobalSessionExpired = () => {
      stopAndHalt();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ox:session-expired', handleGlobalSessionExpired);
    }

    async function connect() {
      if (!isMounted) return;

      // Global session check
      if (
        typeof window !== 'undefined' &&
        window.__ox_session_expired
      ) {
        stopAndHalt();
        return;
      }

      // If in browser without order tracking token and without session cookie, don't attempt
      if (
        !orderNumber &&
        !token &&
        typeof document !== 'undefined' &&
        !document.cookie.includes('ox_session')
      ) {
        stopAndHalt();
        return;
      }

      const params = new URLSearchParams();
      if (orderNumber) params.set('orderNumber', orderNumber);
      if (token) params.set('token', token);
      if (branchId) params.set('branchId', branchId);

      const qs = params.toString();
      const url = `/api/realtime/stream${qs ? `?${qs}` : ''}`;

      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          consecutiveErrors = 0;
          retryDelay = 2000;
        };

        es.onerror = async () => {
          if (!isMounted) return;
          setIsConnected(false);
          consecutiveErrors++;

          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          // Check if session has expired
          if (
            typeof window !== 'undefined' &&
            window.__ox_session_expired
          ) {
            stopAndHalt();
            return;
          }

          // If authenticated stream (not guest order tracking), check cookie immediately
          if (!token && !orderNumber) {
            if (typeof document !== 'undefined' && !document.cookie.includes('ox_session')) {
              if (typeof window !== 'undefined') {
                window.__ox_session_expired = true;
                window.dispatchEvent(new CustomEvent('ox:session-expired'));
              }
              stopAndHalt();
              return;
            }

            // Check session validity after 2 errors or cap at 5 retries max
            if (consecutiveErrors >= 2) {
              try {
                const status = await checkSessionStatusAction();
                if (!status.valid) {
                  if (typeof window !== 'undefined') {
                    window.__ox_session_expired = true;
                    window.dispatchEvent(new CustomEvent('ox:session-expired'));
                  }
                  stopAndHalt();
                  return;
                }
              } catch {
                // Network error
              }
            }

            if (consecutiveErrors >= 5) {
              stopAndHalt();
              return;
            }
          }

          // Exponential backoff up to 30s
          retryTimeout = setTimeout(() => {
            if (!isMounted) return;
            retryDelay = Math.min(retryDelay * 2, 30000);
            connect();
          }, retryDelay);
        };

        const handleMessage = (e: MessageEvent) => {
          if (!isMounted || !e.data) return;
          try {
            const parsed = JSON.parse(e.data) as RealtimeMessage;
            if (onEventRef.current) {
              onEventRef.current(parsed);
            }
          } catch {
            // Ignore parse errors on malformed chunks
          }
        };

        const activeEventTypes: RealtimeEventType[] = eventTypesRef.current || [
          'order:created',
          'order:status_changed',
          'kitchen:status_changed',
          'payment:updated',
          'inventory:updated',
          'attendance:updated',
          'notification:new',
          'bug_report:created',
        ];

        for (const type of activeEventTypes) {
          es.addEventListener(type, handleMessage);
        }
      } catch {
        if (!isMounted) return;
        consecutiveErrors++;
        retryTimeout = setTimeout(() => {
          if (isMounted) connect();
        }, 5000);
      }
    }

    connect();

    return () => {
      stopAndHalt();
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'ox:session-expired',
          handleGlobalSessionExpired
        );
      }
    };
  }, [shouldConnect, orderNumber, token, branchId, eventTypesKey]);

  return { isConnected };
}
