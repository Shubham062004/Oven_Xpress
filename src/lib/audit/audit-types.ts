/**
 * Audit Logs & System Activity Tracking — Type Definitions
 *
 * Provides typed contracts for audit log creation, retrieval, filtering,
 * diff calculations, and CSV export.
 */

export const AUDIT_ACTIONS = {
  // Authentication
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  AUTH_PASSWORD_RESET_COMPLETED: 'AUTH_PASSWORD_RESET_COMPLETED',
  AUTH_EMAIL_VERIFICATION_SENT: 'AUTH_EMAIL_VERIFICATION_SENT',
  AUTH_EMAIL_VERIFIED: 'AUTH_EMAIL_VERIFIED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  OTHER_SESSIONS_REVOKED: 'OTHER_SESSIONS_REVOKED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',

  // Generic Operations
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ACTIVATE: 'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CANCEL: 'CANCEL',
  REFUND: 'REFUND',
  STATUS_CHANGE: 'STATUS_CHANGE',

  // Inventory & Stock
  INVENTORY_RECEIVE: 'INVENTORY_RECEIVE',
  INVENTORY_CONSUME: 'INVENTORY_CONSUME',
  INVENTORY_ADJUST: 'INVENTORY_ADJUST',
  INVENTORY_TRANSFER: 'INVENTORY_TRANSFER',
  INVENTORY_WASTAGE: 'INVENTORY_WASTAGE',
  INVENTORY_RECONCILE: 'INVENTORY_RECONCILE',

  // Financial & Purchases
  PAYMENT_CREATE: 'PAYMENT_CREATE',
  PAYMENT_UPDATE: 'PAYMENT_UPDATE',
  PAYMENT_REFUND: 'PAYMENT_REFUND',
  EXPENSE_CREATE: 'EXPENSE_CREATE',
  EXPENSE_UPDATE: 'EXPENSE_UPDATE',
  EXPENSE_APPROVE: 'EXPENSE_APPROVE',
  EXPENSE_REJECT: 'EXPENSE_REJECT',
  EXPENSE_CANCEL: 'EXPENSE_CANCEL',
  PURCHASE_CREATE: 'PURCHASE_CREATE',
  PURCHASE_UPDATE: 'PURCHASE_UPDATE',
  PURCHASE_RECEIVE: 'PURCHASE_RECEIVE',
  PURCHASE_CANCEL: 'PURCHASE_CANCEL',

  // Orders
  ORDER_CREATE: 'ORDER_CREATE',
  ORDER_UPDATE: 'ORDER_UPDATE',
  ORDER_STATUS_CHANGE: 'ORDER_STATUS_CHANGE',

  // Workforce & Payroll
  ATTENDANCE_MARK: 'ATTENDANCE_MARK',
  ATTENDANCE_UPDATE: 'ATTENDANCE_UPDATE',
  SALARY_CREATE: 'SALARY_CREATE',
  SALARY_UPDATE: 'SALARY_UPDATE',
  BONUS_CREATE: 'BONUS_CREATE',
  BONUS_APPROVE: 'BONUS_APPROVE',
  BONUS_REJECT: 'BONUS_REJECT',

  // Administration & Config
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DEACTIVATE: 'USER_DEACTIVATE',
  ROLE_UPDATE: 'ROLE_UPDATE',
  PERMISSION_UPDATE: 'PERMISSION_UPDATE',
  BRANCH_CREATE: 'BRANCH_CREATE',
  BRANCH_UPDATE: 'BRANCH_UPDATE',
  BRANCH_ACTIVATE: 'BRANCH_ACTIVATE',
  BRANCH_DEACTIVATE: 'BRANCH_DEACTIVATE',
  MENU_CREATE: 'MENU_CREATE',
  MENU_UPDATE: 'MENU_UPDATE',
  MENU_DEACTIVATE: 'MENU_DEACTIVATE',
  CUSTOMER_UPDATE: 'CUSTOMER_UPDATE',
  REVIEW_MODERATE: 'REVIEW_MODERATE',
  ISSUE_UPDATE: 'ISSUE_UPDATE',
  SETTING_UPDATE: 'SETTING_UPDATE',
  SETTING_RESET: 'SETTING_RESET',
  USER_PREFERENCE_UPDATE: 'USER_PREFERENCE_UPDATE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  USER: 'USER',
  SESSION: 'SESSION',
  BRANCH: 'BRANCH',
  EMPLOYEE: 'EMPLOYEE',
  ATTENDANCE: 'ATTENDANCE',
  SHIFT: 'SHIFT',
  MENU_ITEM: 'MENU_ITEM',
  MENU_CATEGORY: 'MENU_CATEGORY',
  INGREDIENT: 'INGREDIENT',
  RECIPE: 'RECIPE',
  INVENTORY_ITEM: 'INVENTORY_ITEM',
  STOCK_TRANSACTION: 'STOCK_TRANSACTION',
  PURCHASE_ORDER: 'PURCHASE_ORDER',
  PURCHASE_RECEIVING: 'PURCHASE_RECEIVING',
  ORDER: 'ORDER',
  ORDER_ITEM: 'ORDER_ITEM',
  PAYMENT: 'PAYMENT',
  PAYMENT_REFUND: 'PAYMENT_REFUND',
  EXPENSE: 'EXPENSE',
  EXPENSE_CATEGORY: 'EXPENSE_CATEGORY',
  SALARY: 'SALARY',
  SALARY_STRUCTURE: 'SALARY_STRUCTURE',
  SALARY_RECORD: 'SALARY_RECORD',
  BONUS: 'BONUS',
  CUSTOMER: 'CUSTOMER',
  REVIEW: 'REVIEW',
  CUSTOMER_ISSUE: 'CUSTOMER_ISSUE',
  SYSTEM: 'SYSTEM',
  SYSTEM_SETTING: 'SYSTEM_SETTING',
  USER_PREFERENCE: 'USER_PREFERENCE',
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  branchId?: string | null;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId?: string | null;
  description: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type AuditDatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export interface AuditFilterParams {
  branchId?: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  search?: string;
  preset?: AuditDatePreset | string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogListItem {
  id: string;
  createdAt: string; // ISO string
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  ipAddress: string | null;
}

export interface FieldChange {
  from: unknown;
  to: unknown;
}

export type FieldChangeDiff = Record<string, FieldChange>;

export interface AuditLogDetail extends AuditLogListItem {
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  diff: FieldChangeDiff;
  userAgent: string | null;
}

export interface AuditSummaryStats {
  totalLogs: number;
  uniqueActors: number;
  uniqueBranches: number;
  topAction: string;
}
