'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeEventType, RealtimeMessage } from './types';

export interface UseRealtimeOptions {
  orderNumber?: string;
  branchId?: string;
  enabled?: boolean;
  onEvent?: (message: RealtimeMessage) => void;
  eventTypes?: RealtimeEventType[];
}

/**
 * Reusable React hook for subscribing to application-wide real-time events via SSE.
 *
 * Features:
 * - Automatic connection establishment with same-origin credentials (HTTP-only cookies).
 * - Automatic reconnection with exponential backoff on temporary network disconnection.
 * - Clean teardown of EventSource connection on component unmount.
 * - Selective event filtering or broad reception.
 */
export function useRealtime({
  orderNumber,
  branchId,
  enabled = true,
  onEvent,
  eventTypes,
}: UseRealtimeOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
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

    function connect() {
      if (!isMounted) return;

      const params = new URLSearchParams();
      if (orderNumber) params.set('orderNumber', orderNumber);
      if (branchId) params.set('branchId', branchId);

      const qs = params.toString();
      const url = `/api/realtime/stream${qs ? `?${qs}` : ''}`;

      try {
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          retryDelay = 2000;
        };

        es.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
          es.close();

          // Exponential backoff up to 30s
          retryTimeout = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 1.5, 30000);
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
          } catch (err) {
            console.error('[useRealtime] Failed to parse message JSON:', err);
          }
        };

        const targetEventTypes: RealtimeEventType[] = eventTypes || [
          'order:created',
          'order:status_changed',
          'kitchen:status_changed',
          'payment:updated',
          'inventory:updated',
          'attendance:updated',
          'notification:new',
          'bug_report:created',
        ];

        for (const type of targetEventTypes) {
          es.addEventListener(type, handleMessage);
        }
      } catch (err) {
        console.error('[useRealtime] EventSource initialization failed:', err);
        retryTimeout = setTimeout(() => {
          connect();
        }, 5000);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, orderNumber, branchId, eventTypes]);

  return { isConnected };
}
