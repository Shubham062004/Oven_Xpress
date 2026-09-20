import {
  Banknote,
  Smartphone,
  CreditCard,
  Globe,
  HelpCircle,
  Building2,
} from 'lucide-react';
import {
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReconciliationStatus,
} from '@prisma/client';
import type { OrderPaymentDerivedStatus, OrderPaymentSummary } from './types';

export interface PaymentMethodMeta {
  value: PaymentMethod;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  referenceLabel: string;
  referencePlaceholder: string;
  isReferenceRequired: boolean;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodMeta> = {
  [PaymentMethod.CASH]: {
    value: PaymentMethod.CASH,
    label: 'Cash',
    description: 'Physical currency paid at register/counter',
    icon: Banknote,
    referenceLabel: 'Cash Receipt / Voucher # (Optional)',
    referencePlaceholder: 'Optional receipt or drawer identifier',
    isReferenceRequired: false,
  },
  [PaymentMethod.UPI]: {
    value: PaymentMethod.UPI,
    label: 'UPI',
    description: 'Unified Payments Interface (GPay, PhonePe, Paytm, etc.)',
    icon: Smartphone,
    referenceLabel: 'UPI Transaction ID / UTR #',
    referencePlaceholder: 'e.g. 324518729012 or UPI Ref',
    isReferenceRequired: false,
  },
  [PaymentMethod.CARD]: {
    value: PaymentMethod.CARD,
    label: 'Credit / Debit Card',
    description: 'POS terminal card swipe/tap transaction',
    icon: CreditCard,
    referenceLabel: 'Card Auth / POS Approval Code',
    referencePlaceholder: 'e.g. AUTH-98231 or Terminal Txn ID',
    isReferenceRequired: false,
  },
  [PaymentMethod.ONLINE]: {
    value: PaymentMethod.ONLINE,
    label: 'Online Gateway',
    description: 'Web, mobile app, or payment gateway checkout',
    icon: Globe,
    referenceLabel: 'Gateway Transaction Reference',
    referencePlaceholder: 'e.g. pay_9Fk2d8z or online txn ID',
    isReferenceRequired: false,
  },
  [PaymentMethod.BANK_TRANSFER]: {
    value: PaymentMethod.BANK_TRANSFER,
    label: 'Bank Transfer',
    description: 'Direct wire transfer (NEFT / RTGS / IMPS)',
    icon: Building2,
    referenceLabel: 'Bank UTR / Transaction Reference',
    referencePlaceholder: 'e.g. UTR-2026-98124',
    isReferenceRequired: false,
  },
  [PaymentMethod.OTHER]: {
    value: PaymentMethod.OTHER,
    label: 'Other / Voucher',
    description: 'Store credits, corporate vouchers, or meal passes',
    icon: HelpCircle,
    referenceLabel: 'Voucher / Coupon Reference #',
    referencePlaceholder: 'e.g. VCH-0029 or external token',
    isReferenceRequired: false,
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  [PaymentStatus.PENDING]: {
    label: 'Pending',
    variant: 'secondary',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  [PaymentStatus.SUCCESS]: {
    label: 'Success',
    variant: 'secondary',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  [PaymentStatus.FAILED]: {
    label: 'Failed',
    variant: 'destructive',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  [PaymentStatus.CANCELLED]: {
    label: 'Cancelled',
    variant: 'outline',
    className: 'text-muted-foreground border-muted-foreground/30',
  },
  [PaymentStatus.REFUNDED]: {
    label: 'Refunded',
    variant: 'outline',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  [PaymentStatus.PARTIALLY_REFUNDED]: {
    label: 'Partially Refunded',
    variant: 'secondary',
    className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  },
};

export const REFUND_STATUS_META: Record<
  RefundStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  [RefundStatus.PENDING]: {
    label: 'Pending',
    variant: 'secondary',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  [RefundStatus.SUCCESS]: {
    label: 'Refunded',
    variant: 'secondary',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  [RefundStatus.FAILED]: {
    label: 'Failed',
    variant: 'destructive',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  [RefundStatus.CANCELLED]: {
    label: 'Cancelled',
    variant: 'outline',
    className: 'text-muted-foreground border-muted-foreground/30',
  },
};

export const RECONCILIATION_STATUS_META: Record<
  ReconciliationStatus,
  { label: string; className: string }
> = {
  [ReconciliationStatus.OPEN]: {
    label: 'Open',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  [ReconciliationStatus.RECONCILED]: {
    label: 'Reconciled',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
};

export const ORDER_PAYMENT_STATUS_META: Record<
  OrderPaymentDerivedStatus,
  { label: string; className: string }
> = {
  UNPAID: {
    label: 'UNPAID',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  PARTIALLY_PAID: {
    label: 'PARTIALLY PAID',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  PAID: {
    label: 'PAID',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  PARTIALLY_REFUNDED: {
    label: 'PARTIALLY REFUNDED',
    className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
  },
  REFUNDED: {
    label: 'REFUNDED',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
};

/**
 * Centralized state transition validation for Payment status
 */
export const VALID_PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.SUCCESS]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REFUNDED]: [],
};

/**
 * Calculates derived payment summary for an order given its total and payment records
 */
export function deriveOrderPaymentSummary(
  orderTotal: number,
  payments: Array<{
    amount: number;
    status: PaymentStatus;
    refunds?: Array<{ amount: number; status: RefundStatus }>;
  }>
): OrderPaymentSummary {
  let totalPaid = 0;
  let refundedAmount = 0;

  for (const payment of payments) {
    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      totalPaid += payment.amount;

      if (payment.refunds) {
        for (const refund of payment.refunds) {
          if (refund.status === RefundStatus.SUCCESS) {
            refundedAmount += refund.amount;
          }
        }
      }
    }
  }

  // Round to 2 decimals
  totalPaid = Math.round(totalPaid * 100) / 100;
  refundedAmount = Math.round(refundedAmount * 100) / 100;
  const netPaid = Math.round((totalPaid - refundedAmount) * 100) / 100;
  const remainingAmount = Math.max(0, Math.round((orderTotal - totalPaid) * 100) / 100);

  let status: OrderPaymentDerivedStatus = 'UNPAID';
  if (totalPaid === 0) {
    status = 'UNPAID';
  } else if (refundedAmount > 0 && refundedAmount >= totalPaid) {
    status = 'REFUNDED';
  } else if (refundedAmount > 0 && refundedAmount < totalPaid) {
    status = 'PARTIALLY_REFUNDED';
  } else if (totalPaid >= orderTotal) {
    status = 'PAID';
  } else {
    status = 'PARTIALLY_PAID';
  }

  return {
    orderTotal,
    totalPaid,
    remainingAmount,
    refundedAmount,
    netPaid,
    status,
  };
}
