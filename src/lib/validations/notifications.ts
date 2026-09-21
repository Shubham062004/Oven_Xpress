import { z } from 'zod';
import { NotificationType, NotificationSeverity } from '@prisma/client';

export const notificationFilterSchema = z.object({
  type: z.nativeEnum(NotificationType).or(z.literal('ALL')).optional().default('ALL'),
  severity: z.nativeEnum(NotificationSeverity).or(z.literal('ALL')).optional().default('ALL'),
  branchId: z.string().optional(),
  isRead: z.boolean().optional(),
  isDismissed: z.boolean().optional().default(false),
  search: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
});

export const markAsReadSchema = z.object({
  notificationId: z.string().min(1, 'Notification ID is required'),
});

export const markAllAsReadSchema = z.object({
  branchId: z.string().optional(),
});

export const dismissNotificationSchema = z.object({
  notificationId: z.string().min(1, 'Notification ID is required'),
});

export const evaluateAlertsSchema = z.object({
  branchId: z.string().optional(),
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type MarkAllAsReadInput = z.infer<typeof markAllAsReadSchema>;
export type DismissNotificationInput = z.infer<typeof dismissNotificationSchema>;
export type EvaluateAlertsInput = z.infer<typeof evaluateAlertsSchema>;
