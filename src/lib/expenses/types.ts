import {
  ExpenseStatus,
  ExpenseCategoryStatus,
  ExpenseFrequency,
  ExpenseTemplateStatus,
  PaymentMethod,
} from '@prisma/client';

export interface ExpenseListItem {
  id: string;
  expenseNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  description: string;
  vendorName: string | null;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  status: ExpenseStatus;
  receiptUrl: string | null;
  createdBy: string;
  createdByName?: string;
  approvedBy: string | null;
  approvedByName?: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface ExpenseAuditLogItem {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  amount: number | null;
  performedBy: string;
  performedByName?: string;
  notes: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ExpenseDetail extends ExpenseListItem {
  notes: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  cancelledByName?: string;
  cancelledAt: string | null;
  templateId: string | null;
  templateDescription?: string | null;
  auditLogs: ExpenseAuditLogItem[];
  updatedAt: string;
}

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  description: string | null;
  status: ExpenseCategoryStatus;
  expenseCount: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseTemplateItem {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  frequency: ExpenseFrequency;
  nextDueDate: string; // YYYY-MM-DD
  status: ExpenseTemplateStatus;
  vendorName: string | null;
  paymentMethod: PaymentMethod | null;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseStats {
  todayTotal: number;
  todayCount: number;
  monthTotal: number;
  monthCount: number;
  pendingTotal: number;
  pendingCount: number;
  approvedTotal: number;
  approvedCount: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
