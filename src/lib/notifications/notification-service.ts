import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { resolveEligibleRecipients } from './recipient-resolver';
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationFilterParams,
  CreateNotificationInput,
  NotificationType,
  NotificationSeverity,
} from './types';

function mapNotificationToItem(notification: {
  id: string;
  recipientUserId: string;
  branchId: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: Date | null;
  isDismissed: boolean;
  dismissedAt: Date | null;
  dedupeKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  branch?: {
    name: string;
    code: string;
  } | null;
}): NotificationItem {
  return {
    id: notification.id,
    recipientUserId: notification.recipientUserId,
    branchId: notification.branchId,
    branchName: notification.branch?.name ?? null,
    branchCode: notification.branch?.code ?? null,
    type: notification.type,
    severity: notification.severity,
    title: notification.title,
    message: notification.message,
    entityType: notification.entityType,
    entityId: notification.entityId,
    actionUrl: notification.actionUrl,
    isRead: notification.isRead,
    readAt: notification.readAt ? notification.readAt.toISOString() : null,
    isDismissed: notification.isDismissed,
    dismissedAt: notification.dismissedAt ? notification.dismissedAt.toISOString() : null,
    dedupeKey: notification.dedupeKey,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
}

/**
 * Creates a single notification with deterministic deduplication check.
 * If an active (non-dismissed) notification with the same dedupeKey exists, returns null.
 */
export async function createNotification(input: {
  recipientUserId: string;
  branchId?: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  dedupeKey?: string | null;
}): Promise<NotificationItem | null> {
  const dedupeKey =
    input.dedupeKey ||
    `${input.recipientUserId}:${input.type}:${input.branchId || 'global'}:${input.entityType || ''}:${input.entityId || ''}`;

  // Check if an active, non-dismissed notification with this exact key already exists
  const existing = await prisma.notification.findFirst({
    where: {
      dedupeKey,
      isDismissed: false,
    },
    select: { id: true },
  });

  if (existing) {
    return null; // Deduplicated: avoid repeated spam
  }

  const notification = await prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      branchId: input.branchId || null,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      actionUrl: input.actionUrl || null,
      dedupeKey,
    },
    include: {
      branch: {
        select: {
          name: true,
          code: true,
        },
      },
    },
  });

  return mapNotificationToItem(notification);
}

/**
 * Resolves all eligible recipients based on required permissions and branch scope,
 * and creates deduplicated notifications for each.
 */
export async function createNotificationsForEligibleUsers(
  input: CreateNotificationInput
): Promise<number> {
  const recipients = await resolveEligibleRecipients(
    input.requiredPermission,
    input.branchId
  );

  let createdCount = 0;
  for (const recipient of recipients) {
    const created = await createNotification({
      recipientUserId: recipient.id,
      branchId: input.branchId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
    });
    if (created) {
      createdCount++;
    }
  }

  return createdCount;
}

/**
 * Automatically marks notifications as dismissed/resolved when the underlying
 * business entity changes state (e.g., expense approved, order paid, stock replenished).
 */
export async function resolveNotificationsForEntity(
  entityType: string,
  entityId: string
): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      entityType,
      entityId,
      isDismissed: false,
    },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Retrieves paginated notifications for an authenticated user with filtering.
 */
export async function getNotifications(
  userId: string,
  params: NotificationFilterParams
): Promise<NotificationListResponse> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = {
    recipientUserId: userId,
  };

  if (params.type && params.type !== 'ALL') {
    where.type = params.type;
  }

  if (params.severity && params.severity !== 'ALL') {
    where.severity = params.severity;
  }

  if (params.branchId) {
    where.branchId = params.branchId;
  }

  if (params.isRead !== undefined) {
    where.isRead = params.isRead;
  }

  if (params.isDismissed !== undefined) {
    where.isDismissed = params.isDismissed;
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { message: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [items, total, statsCounts] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        branch: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.groupBy({
      by: ['severity', 'isRead'],
      where: {
        recipientUserId: userId,
        isDismissed: false,
      },
      _count: true,
    }),
  ]);

  let unread = 0;
  let critical = 0;
  let warning = 0;
  let info = 0;

  for (const group of statsCounts) {
    const count = group._count;
    if (!group.isRead) {
      unread += count;
    }
    if (group.severity === 'CRITICAL') critical += count;
    else if (group.severity === 'WARNING') warning += count;
    else if (group.severity === 'INFO') info += count;
  }

  const notifications = items.map(mapNotificationToItem);

  return {
    notifications,
    stats: {
      total,
      unread,
      critical,
      warning,
      info,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Gets the lightweight unread notification count for the authenticated user.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return await prisma.notification.count({
    where: {
      recipientUserId: userId,
      isRead: false,
      isDismissed: false,
    },
  });
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      recipientUserId: userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count > 0;
}

/**
 * Marks all notifications for a user as read (optional branch filter).
 */
export async function markAllNotificationsAsRead(
  userId: string,
  branchId?: string
): Promise<number> {
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: userId,
    isRead: false,
  };

  if (branchId) {
    where.branchId = branchId;
  }

  const result = await prisma.notification.updateMany({
    where,
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Dismisses a notification.
 */
export async function dismissNotification(
  userId: string,
  notificationId: string
): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      recipientUserId: userId,
      isDismissed: false,
    },
    data: {
      isDismissed: true,
      dismissedAt: new Date(),
    },
  });

  return result.count > 0;
}
