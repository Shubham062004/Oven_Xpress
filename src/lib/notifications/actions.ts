'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { ActionResult } from '@/lib/auth/types';
import {
  notificationFilterSchema,
  markAsReadSchema,
  markAllAsReadSchema,
  dismissNotificationSchema,
  evaluateAlertsSchema,
  type NotificationFilterInput,
} from '@/lib/validations/notifications';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  dismissNotification,
} from './notification-service';
import { evaluateAlerts } from './alert-service';
import { getUserBranchScope } from './recipient-resolver';
import type {
  NotificationListResponse,
  NotificationItem,
  AlertEvaluationResult,
} from './types';

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as Record<string, unknown>).digest === 'string' &&
    ((error as Record<string, string>).digest.startsWith('NEXT_REDIRECT') ||
      (error as Record<string, string>).digest === 'DYNAMIC_SERVER_USAGE')
  );
}

/**
 * Retrieves paginated notifications for the authenticated user.
 * Enforces branch scoping if user is restricted to a specific branch.
 */
export async function getNotificationsAction(
  input?: Partial<NotificationFilterInput>
): Promise<ActionResult<NotificationListResponse>> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const scope = await getUserBranchScope(user.id);

    const parsed = notificationFilterSchema.parse(input || {});

    // If user is restricted to a branch, constrain branch filter to their branch
    let effectiveBranchId = parsed.branchId;
    if (!scope.isAllBranches) {
      if (scope.branchIds.length > 0) {
        effectiveBranchId = scope.branchIds[0];
      }
    }

    const data = await getNotifications(user.id, {
      ...parsed,
      branchId: effectiveBranchId,
    });

    return { success: true, data };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getNotificationsAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve notifications',
    };
  }
}

/**
 * Retrieves unread notification count for the authenticated user.
 */
export async function getUnreadNotificationCountAction(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const count = await getUnreadNotificationCount(user.id);
    return { success: true, data: { count } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getUnreadNotificationCountAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve unread count',
    };
  }
}

/**
 * Retrieves recent notifications for the header dropdown bell.
 */
export async function getRecentNotificationsAction(
  limit = 5
): Promise<ActionResult<{ notifications: NotificationItem[]; unreadCount: number }>> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const [listRes, count] = await Promise.all([
      getNotifications(user.id, {
        limit,
        page: 1,
        isDismissed: false,
      }),
      getUnreadNotificationCount(user.id),
    ]);

    return {
      success: true,
      data: {
        notifications: listRes.notifications,
        unreadCount: count,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getRecentNotificationsAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve recent notifications',
    };
  }
}

/**
 * Marks a single notification as read for the authenticated user.
 */
export async function markNotificationAsReadAction(
  notificationId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const parsed = markAsReadSchema.parse({ notificationId });

    const updated = await markNotificationAsRead(user.id, parsed.notificationId);

    revalidatePath('/notifications');
    revalidatePath('/');
    return { success: true, data: { success: updated } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('markNotificationAsReadAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark notification as read',
    };
  }
}

/**
 * Marks all notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsReadAction(
  branchId?: string
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const parsed = markAllAsReadSchema.parse({ branchId });

    const count = await markAllNotificationsAsRead(user.id, parsed.branchId);

    revalidatePath('/notifications');
    revalidatePath('/');
    return { success: true, data: { count } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('markAllNotificationsAsReadAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark all as read',
    };
  }
}

/**
 * Dismisses a notification for the authenticated user.
 */
export async function dismissNotificationAction(
  notificationId: string
): Promise<ActionResult<{ success: boolean }>> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_DISMISS);
    const parsed = dismissNotificationSchema.parse({ notificationId });

    const dismissed = await dismissNotification(user.id, parsed.notificationId);

    revalidatePath('/notifications');
    revalidatePath('/');
    return { success: true, data: { success: dismissed } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('dismissNotificationAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dismiss notification',
    };
  }
}

/**
 * Evaluates alerts on-demand (e.g. on dashboard load or manual refresh).
 */
export async function evaluateAlertsAction(
  branchId?: string
): Promise<ActionResult<AlertEvaluationResult>> {
  try {
    const user = await requirePermission(PERMISSIONS.NOTIFICATION_READ);
    const scope = await getUserBranchScope(user.id);

    const parsed = evaluateAlertsSchema.parse({ branchId });

    let effectiveBranchId = parsed.branchId;
    if (!scope.isAllBranches) {
      if (scope.branchIds.length > 0) {
        effectiveBranchId = scope.branchIds[0];
      }
    }

    const result = await evaluateAlerts({ branchId: effectiveBranchId });

    revalidatePath('/notifications');
    revalidatePath('/');
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('evaluateAlertsAction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to evaluate alerts',
    };
  }
}
