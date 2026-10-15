import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validateSession } from '@/lib/auth/session';
import { realtimeBus } from '@/lib/realtime/event-bus';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-Sent Events (SSE) Route Handler for Oven Xpress.
 *
 * Provides live, low-latency push updates to authorized clients.
 * Authorization & scoping are strictly enforced server-side from session:
 * - OWNER / ADMIN: authorized for 'owner', 'all-branches', and specific branch channels.
 * - BRANCH_MANAGER / STAFF: authorized strictly for their assigned branch and personal user channel.
 * - CUSTOMER: authorized strictly for their personal user channel and their verified orders.
 * - GUEST TRACKING: authorized strictly for the single orderNumber requested if verified.
 */
export async function GET(request: NextRequest) {
  const { user } = await validateSession();
  const searchParams = request.nextUrl.searchParams;
  const orderNumber = searchParams.get('orderNumber');
  const requestedBranch = searchParams.get('branchId');

  const channels: string[] = [];

  if (user) {
    // 1. Personal user notification channel
    channels.push(`user:${user.id}`);

    const roleUpper = user.role.toUpperCase();

    // 2. Executive / Admin channels
    if (roleUpper === 'OWNER' || roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN') {
      channels.push('owner');
      channels.push('all-branches');
      if (requestedBranch && requestedBranch !== 'ALL' && requestedBranch !== 'all') {
        channels.push(`branch:${requestedBranch}`);
        channels.push(`kitchen:${requestedBranch}`);
      }
    }
    // 3. Branch-scoped staff / manager channels
    else if (user.branchId) {
      channels.push(`branch:${user.branchId}`);
      channels.push(`kitchen:${user.branchId}`);
    }

    // 4. Order tracking channel for authenticated users
    if (orderNumber) {
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true, branchId: true, customerId: true, customerPhone: true },
      });

      if (order) {
        const isAuthorizedStaff =
          roleUpper === 'OWNER' ||
          roleUpper === 'ADMIN' ||
          (user.branchId && user.branchId === order.branchId);

        const isOrderCustomer =
          order.customerId === user.id ||
          (user.phone && order.customerPhone === user.phone);

        if (isAuthorizedStaff || isOrderCustomer) {
          channels.push(`order:${orderNumber}`);
        }
      }
    }
  } else if (orderNumber) {
    // 5. Guest customer order tracking
    // Verify the order actually exists before granting the channel
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    });

    if (order) {
      channels.push(`order:${orderNumber}`);
    }
  }

  // If no channels could be authorized, reject the connection
  if (channels.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: No accessible real-time channels' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Deduplicate channels
  const uniqueChannels = Array.from(new Set(channels));

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send connection acknowledgement with authorized channels
      const initChunk = `event: system:connected\ndata: ${JSON.stringify({
        channels: uniqueChannels,
        timestamp: Date.now(),
      })}\n\n`;
      controller.enqueue(encoder.encode(initChunk));

      // Subscribe to RealtimeEventBus for the authorized channels
      unsubscribe = realtimeBus.subscribe(uniqueChannels, (message) => {
        try {
          const sseData = `id: ${message.id}\nevent: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch (err) {
          console.error('[SSE Stream] Failed to enqueue event:', err);
        }
      });

      // Periodic heartbeat keepalive every 20 seconds
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        }
      }, 20000);
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    },
  });

  // Also clean up if connection aborts at the request level
  request.signal.addEventListener('abort', () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
