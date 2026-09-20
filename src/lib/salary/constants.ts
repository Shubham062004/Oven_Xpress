import {
  SalaryType,
  BonusType,
  BonusStatus,
  SalaryRecordStatus,
} from '@prisma/client';

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateRange(
  start: Date | string,
  end: Date | string
): string {
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

export interface StatusMeta {
  label: string;
  badgeClass: string;
}

export const SALARY_RECORD_STATUS_META: Record<SalaryRecordStatus, StatusMeta> = {
  [SalaryRecordStatus.DRAFT]: {
    label: 'Draft',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  [SalaryRecordStatus.PENDING_REVIEW]: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  [SalaryRecordStatus.APPROVED]: {
    label: 'Approved',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  [SalaryRecordStatus.PAID]: {
    label: 'Paid',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  [SalaryRecordStatus.CANCELLED]: {
    label: 'Cancelled',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  },
};

export const BONUS_STATUS_META: Record<BonusStatus, StatusMeta> = {
  [BonusStatus.DRAFT]: {
    label: 'Draft',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
  [BonusStatus.PENDING_APPROVAL]: {
    label: 'Pending Approval',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  [BonusStatus.APPROVED]: {
    label: 'Approved',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  [BonusStatus.REJECTED]: {
    label: 'Rejected',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  },
  [BonusStatus.CANCELLED]: {
    label: 'Cancelled',
    badgeClass: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20',
  },
};

export const BONUS_TYPE_LABELS: Record<BonusType, string> = {
  [BonusType.PERFORMANCE]: 'Performance Bonus',
  [BonusType.FESTIVAL]: 'Festival Bonus',
  [BonusType.ATTENDANCE]: 'Attendance Bonus',
  [BonusType.SALES_INCENTIVE]: 'Sales Incentive',
  [BonusType.SPECIAL]: 'Special Recognition',
  [BonusType.OTHER]: 'Other Compensation',
};

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  [SalaryType.MONTHLY]: 'Monthly',
  [SalaryType.DAILY]: 'Daily Wage',
  [SalaryType.HOURLY]: 'Hourly Rate',
};
