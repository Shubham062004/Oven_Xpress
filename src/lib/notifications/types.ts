import type { NotificationType, NotificationSeverity } from '@prisma/client';

export type { NotificationType, NotificationSeverity };

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  branchId: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  isDismissed: boolean;
  dismissedAt: string | null;
  dedupeKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSummaryStats {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  stats: NotificationSummaryStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationFilterParams {
  type?: NotificationType | 'ALL';
  severity?: NotificationSeverity | 'ALL';
  branchId?: string;
  isRead?: boolean;
  isDismissed?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateNotificationInput {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  branchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  requiredPermission: string;
}

export interface AlertEvaluationResult {
  evaluatedCount: number;
  generatedCount: number;
  resolvedCount: number;
  alerts: {
    type: NotificationType;
    title: string;
    branchId: string | null;
    severity: NotificationSeverity;
  }[];
}
