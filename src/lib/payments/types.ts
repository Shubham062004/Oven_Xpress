import type {
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReconciliationStatus,
} from '@prisma/client';

export type {
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReconciliationStatus,
};

export type OrderPaymentDerivedStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED';

export interface OrderPaymentSummary {
  orderTotal: number;
  totalPaid: number;
  remainingAmount: number;
  refundedAmount: number;
  netPaid: number;
  status: OrderPaymentDerivedStatus;
}

export interface PaymentRefundItem {
  id: string;
  refundNumber: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  processedBy: string;
  processedAt: string;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNumber: string | null;
  notes: string | null;
  processedBy: string;
  processedAt: string;
  refundedAmount: number;
  refundableAmount: number;
  refunds: PaymentRefundItem[];
  createdAt: string;
}

export interface PaymentStats {
  totalSuccessfulPayments: { count: number; amount: number };
  cash: { count: number; amount: number };
  upi: { count: number; amount: number };
  card: { count: number; amount: number };
  online: { count: number; amount: number };
  other: { count: number; amount: number };
  failed: { count: number; amount: number };
  refunded: { count: number; amount: number };
}

export interface PaymentListResponse {
  payments: PaymentRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DailyReconciliationData {
  branchId: string;
  branchName: string;
  branchCode: string;
  date: string;
  systemCash: number;
  systemUpi: number;
  systemCard: number;
  systemOnline: number;
  systemOther: number;
  systemTotal: number;
  totalRefunds: number;
  cashPaymentCount: number;
  existingReconciliation: {
    id: string;
    actualCash: number;
    variance: number;
    note: string | null;
    reconciledBy: string;
    reconciledAt: string;
    status: ReconciliationStatus;
  } | null;
}

export interface ReconciliationHistoryItem {
  id: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  date: string;
  systemCash: number;
  actualCash: number;
  variance: number;
  note: string | null;
  reconciledBy: string;
  reconciledAt: string;
  status: ReconciliationStatus;
  createdAt: string;
}
