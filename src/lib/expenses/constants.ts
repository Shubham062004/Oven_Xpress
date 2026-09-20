import {
  ExpenseStatus,
  ExpenseCategoryStatus,
  ExpenseFrequency,
  PaymentMethod,
} from '@prisma/client';

export interface ExpenseStatusMeta {
  label: string;
  description: string;
  badgeClass: string;
  allowedTransitions: ExpenseStatus[];
}

export const EXPENSE_STATUS_META: Record<ExpenseStatus, ExpenseStatusMeta> = {
  [ExpenseStatus.DRAFT]: {
    label: 'Draft',
    description: 'Expense record saved in draft. Can be edited or submitted for approval.',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    allowedTransitions: [ExpenseStatus.PENDING_APPROVAL, ExpenseStatus.CANCELLED],
  },
  [ExpenseStatus.PENDING_APPROVAL]: {
    label: 'Pending Approval',
    description: 'Awaiting manager or admin review and verification.',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    allowedTransitions: [
      ExpenseStatus.APPROVED,
      ExpenseStatus.REJECTED,
      ExpenseStatus.CANCELLED,
    ],
  },
  [ExpenseStatus.APPROVED]: {
    label: 'Approved',
    description: 'Verified and authorized. Immutable operational financial record.',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    allowedTransitions: [], // Immutable!
  },
  [ExpenseStatus.REJECTED]: {
    label: 'Rejected',
    description: 'Declined by reviewer. Preserved permanently in audit history.',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    allowedTransitions: [], // Cannot be mutated; must create a corrected new expense
  },
  [ExpenseStatus.CANCELLED]: {
    label: 'Cancelled',
    description: 'Voided before approval with documented operational reason.',
    badgeClass: 'bg-stone-500/15 text-stone-700 dark:text-stone-400 border-stone-500/30',
    allowedTransitions: [], // Immutable!
  },
};

export interface ExpenseFrequencyMeta {
  label: string;
  daysInterval: number;
}

export const EXPENSE_FREQUENCY_META: Record<ExpenseFrequency, ExpenseFrequencyMeta> = {
  [ExpenseFrequency.WEEKLY]: {
    label: 'Weekly',
    daysInterval: 7,
  },
  [ExpenseFrequency.MONTHLY]: {
    label: 'Monthly',
    daysInterval: 30,
  },
  [ExpenseFrequency.YEARLY]: {
    label: 'Yearly',
    daysInterval: 365,
  },
};

export interface PaymentMethodMeta {
  label: string;
  shortLabel: string;
  description: string;
}

export const EXPENSE_PAYMENT_METHOD_META: Record<PaymentMethod, PaymentMethodMeta> = {
  [PaymentMethod.CASH]: {
    label: 'Cash (Petty Cash)',
    shortLabel: 'Cash',
    description: 'Disbursed directly from physical restaurant petty cash drawer',
  },
  [PaymentMethod.UPI]: {
    label: 'UPI / QR Code',
    shortLabel: 'UPI',
    description: 'Instant bank transfer via UPI QR code or VPA',
  },
  [PaymentMethod.CARD]: {
    label: 'Corporate Card / Debit',
    shortLabel: 'Card',
    description: 'Commercial credit or debit card swipe / online checkout',
  },
  [PaymentMethod.BANK_TRANSFER]: {
    label: 'Bank Transfer (NEFT/RTGS/IMPS)',
    shortLabel: 'Bank Transfer',
    description: 'Direct wire transfer to vendor bank account',
  },
  [PaymentMethod.ONLINE]: {
    label: 'Online Portal / Net Banking',
    shortLabel: 'Online',
    description: 'Vendor payment gateway or municipal utility portal',
  },
  [PaymentMethod.OTHER]: {
    label: 'Other Tender / Cheque',
    shortLabel: 'Other',
    description: 'Paper cheques, vendor vouchers, or barter settlements',
  },
};

export const INITIAL_EXPENSE_CATEGORIES = [
  { name: 'RAW_MATERIAL', description: 'Direct kitchen food ingredients, spices, and supplies' },
  { name: 'PACKAGING', description: 'Takeaway boxes, paper bags, cups, cutlery, and wrapping' },
  { name: 'UTILITIES', description: 'Electricity, commercial gas cylinders, water supply, internet' },
  { name: 'RENT', description: 'Branch commercial lease and property occupancy rental fees' },
  { name: 'SALARY', description: 'Staff wages, stipends, bonuses, and contractual payments' },
  { name: 'MAINTENANCE', description: 'Regular servicing of kitchen hoods, freezers, and ovens' },
  { name: 'REPAIRS', description: 'Emergency repairs for plumbing, electricals, and appliances' },
  { name: 'MARKETING', description: 'Local flyers, online campaigns, social media promotions' },
  { name: 'DELIVERY', description: 'Delivery fleet fuel, third-party logistics, vehicle repairs' },
  { name: 'CLEANING', description: 'Commercial sanitizers, degreasers, trash bags, mop service' },
  { name: 'EQUIPMENT', description: 'Purchase of small kitchen tools, pans, blenders, utensils' },
  { name: 'LICENSES', description: 'FSSAI food license, fire NOC, municipal health certificates' },
  { name: 'TRANSPORT', description: 'Market procurement trips, employee local transit fares' },
  { name: 'MISCELLANEOUS', description: 'Uncategorized petty expenses and contingency cash outflows' },
] as const;

/**
 * Format currency amount safely in Indian Rupee format
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
