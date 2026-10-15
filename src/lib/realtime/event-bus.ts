import type {
  RealtimeEventType,
  RealtimeMessage,
  RealtimePayloadMap,
  OrderCreatedPayload,
  OrderStatusChangedPayload,
  KitchenStatusChangedPayload,
  PaymentUpdatedPayload,
  InventoryUpdatedPayload,
  AttendanceUpdatedPayload,
  NotificationNewPayload,
  BugReportCreatedPayload,
} from './types';

type Listener = (message: RealtimeMessage) => void;

class RealtimeEventBus {
  private channelSubscribers: Map<string, Set<Listener>> = new Map();

  /**
   * Subscribes a listener to one or more channels.
   * Returns an unsubscribe function.
   */
  public subscribe(channels: string[], listener: Listener): () => void {
    for (const channel of channels) {
      if (!this.channelSubscribers.has(channel)) {
        this.channelSubscribers.set(channel, new Set());
      }
      this.channelSubscribers.get(channel)!.add(listener);
    }

    return () => {
      for (const channel of channels) {
        const subs = this.channelSubscribers.get(channel);
        if (subs) {
          subs.delete(listener);
          if (subs.size === 0) {
            this.channelSubscribers.delete(channel);
          }
        }
      }
    };
  }

  /**
   * Publishes an event to specified channel(s).
   * Dispatches to all active listeners matching any of the target channels.
   */
  public publish<T extends RealtimeEventType>(
    channels: string | string[],
    type: T,
    payload: RealtimePayloadMap[T]
  ): void {
    const targetChannels = Array.isArray(channels) ? channels : [channels];
    const message: RealtimeMessage<T> = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      channel: targetChannels[0],
      payload,
      timestamp: Date.now(),
    };

    const notifiedListeners = new Set<Listener>();

    for (const channel of targetChannels) {
      const listeners = this.channelSubscribers.get(channel);
      if (listeners) {
        for (const listener of listeners) {
          if (!notifiedListeners.has(listener)) {
            notifiedListeners.add(listener);
            try {
              listener(message);
            } catch (err) {
              console.error(`[RealtimeEventBus] Error dispatching to listener on ${channel}:`, err);
            }
          }
        }
      }
    }
  }

  public getSubscriberCount(channel: string): number {
    return this.channelSubscribers.get(channel)?.size ?? 0;
  }
}

// Global singleton across Next.js dev server reloads
const globalForRealtime = globalThis as unknown as {
  __oxRealtimeBus?: RealtimeEventBus;
};

export const realtimeBus = globalForRealtime.__oxRealtimeBus ?? new RealtimeEventBus();

if (process.env.NODE_ENV !== 'production') {
  globalForRealtime.__oxRealtimeBus = realtimeBus;
}

// ─── DOMAIN EVENT HELPER PUBLISHERS ──────────────────────────────────────────

/**
 * Publishes an order creation event to:
 * - The branch channel (`branch:${branchId}`)
 * - The kitchen queue channel (`kitchen:${branchId}`)
 * - The executive owner channel (`owner`)
 * - The customer tracking channel (`order:${orderNumber}`)
 */
export function publishOrderCreated(payload: OrderCreatedPayload): void {
  const channels = [
    `branch:${payload.branchId}`,
    `kitchen:${payload.branchId}`,
    'owner',
    `order:${payload.orderNumber}`,
  ];
  realtimeBus.publish(channels, 'order:created', payload);
}

/**
 * Publishes an order status update to branch, kitchen, owner, and customer.
 */
export function publishOrderStatusChanged(payload: OrderStatusChangedPayload): void {
  const channels = [
    `branch:${payload.branchId}`,
    `kitchen:${payload.branchId}`,
    'owner',
    `order:${payload.orderNumber}`,
  ];
  realtimeBus.publish(channels, 'order:status_changed', payload);
}

/**
 * Publishes a kitchen status update (started, ready, completed) to branch, kitchen, and customer.
 */
export function publishKitchenStatusChanged(payload: KitchenStatusChangedPayload): void {
  const channels = [
    `branch:${payload.branchId}`,
    `kitchen:${payload.branchId}`,
    'owner',
    `order:${payload.orderNumber}`,
  ];
  realtimeBus.publish(channels, 'kitchen:status_changed', payload);
}

/**
 * Publishes a payment recorded or refunded event.
 */
export function publishPaymentUpdated(payload: PaymentUpdatedPayload): void {
  const channels = [
    `branch:${payload.branchId}`,
    'owner',
    `order:${payload.orderNumber}`,
  ];
  realtimeBus.publish(channels, 'payment:updated', payload);
}

/**
 * Publishes inventory stock changes / consumption.
 */
export function publishInventoryUpdated(payload: InventoryUpdatedPayload): void {
  const channels = [`branch:${payload.branchId}`, 'owner'];
  realtimeBus.publish(channels, 'inventory:updated', payload);
}

/**
 * Publishes employee shift and attendance updates.
 */
export function publishAttendanceUpdated(payload: AttendanceUpdatedPayload): void {
  const channels = [`branch:${payload.branchId}`, 'owner'];
  realtimeBus.publish(channels, 'attendance:updated', payload);
}

/**
 * Publishes user notification (or global alert).
 */
export function publishNotification(payload: NotificationNewPayload): void {
  const channels: string[] = ['owner'];
  if (payload.targetUserId) {
    channels.push(`user:${payload.targetUserId}`);
  }
  realtimeBus.publish(channels, 'notification:new', payload);
}

/**
 * Publishes a new customer bug report strictly to the OWNER channel.
 * Never broadcasts to branches, managers, or general staff.
 */
export function publishBugReport(payload: BugReportCreatedPayload): void {
  realtimeBus.publish(['owner'], 'bug_report:created', payload);
}
