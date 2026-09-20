/**
 * Sales & Financial Reporting — Constants & Utilities
 *
 * Revenue Calculation Definitions:
 * ────────────────────────────────
 * Gross Sales     = SUM(order.totalAmount) WHERE order.status IN ('COMPLETED', 'REFUNDED')
 * Discounts       = SUM(order.discountAmount) for the same orders
 * Tax Collected   = SUM(order.taxAmount) for the same orders
 * Delivery Charges= SUM(order.deliveryCharge) for the same orders
 * Refunds         = SUM(refund.amount) WHERE refund.status = 'SUCCESS'
 * Net Revenue     = Gross Sales - Discounts - Refunds
 *
 * Payment Aggregation:
 * ────────────────────
 * Successful Payments = SUM(payment.amount) WHERE payment.status = 'SUCCESS'
 * Failed Payments     = SUM(payment.amount) WHERE payment.status = 'FAILED'
 * Refunded Amounts    = SUM(refund.amount) WHERE refund.status = 'SUCCESS'
 *
 * Excluded from revenue:
 * ──────────────────────
 * - Orders with status = 'CANCELLED' (counted separately)
 * - Orders with status = 'PENDING', 'CONFIRMED', 'PREPARING', 'READY' (not yet completed)
 * - Payments with status = 'FAILED' or 'CANCELLED'
 * - Refunds with status = 'FAILED' or 'CANCELLED'
 *
 * Operating Result:
 * ─────────────────
 * Operating Result = Net Revenue - Approved Operating Expenses - Approved Salary Costs
 *
 * Approved Expenses  = SUM(expense.amount) WHERE expense.status = 'APPROVED'
 * Approved Salary    = SUM(salaryRecord.grossAmount) WHERE salaryRecord.status IN ('APPROVED', 'PAID')
 *                      and salaryRecord period overlaps the selected date range
 *
 * Purchase Treatment:
 * ───────────────────
 * Purchases are displayed separately and NOT included in the Operating Result calculation.
 * Inventory purchases and operating expenses are tracked as different concepts.
 *
 * IMPORTANT: This is an operational management calculation, NOT a statutory accounting profit.
 */

import type { DateRangePreset, ReportDateRange } from './types';

// ─── Order statuses that count as "completed" for revenue ───────────────────

/** Orders counted towards revenue metrics */
export const REVENUE_ORDER_STATUSES = ['COMPLETED', 'REFUNDED'] as const;

/** Orders counted as cancelled */
export const CANCELLED_ORDER_STATUS = 'CANCELLED' as const;

// ─── Payment/refund statuses ────────────────────────────────────────────────

/** Payments counted as successful revenue */
export const SUCCESSFUL_PAYMENT_STATUS = 'SUCCESS' as const;

/** Payments counted as failed */
export const FAILED_PAYMENT_STATUS = 'FAILED' as const;

/** Refunds counted towards deductions */
export const SUCCESSFUL_REFUND_STATUS = 'SUCCESS' as const;

// ─── Expense/salary statuses ────────────────────────────────────────────────

/** Expenses included in operating costs */
export const APPROVED_EXPENSE_STATUS = 'APPROVED' as const;

/** Salary records included in operating costs */
export const SALARY_COST_STATUSES = ['APPROVED', 'PAID'] as const;

// ─── Date Utilities ─────────────────────────────────────────────────────────

/**
 * Returns the start and end date for a given preset, based on today's date.
 * All dates are in YYYY-MM-DD format.
 */
export function getDateRangeFromPreset(preset: DateRangePreset): ReportDateRange {
  const now = new Date();
  const today = formatDateLocal(now);

  switch (preset) {
    case 'today':
      return { startDate: today, endDate: today };

    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDateLocal(yesterday);
      return { startDate: yesterdayStr, endDate: yesterdayStr };
    }

    case 'week': {
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      // Monday as start of week
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - diff);
      return { startDate: formatDateLocal(weekStart), endDate: today };
    }

    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDateLocal(monthStart), endDate: today };
    }

    case 'custom':
      // Custom range must be provided externally
      return { startDate: today, endDate: today };
  }
}

/**
 * Format a Date object to YYYY-MM-DD using local timezone.
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to start-of-day and end-of-day Date objects.
 * Uses local timezone to avoid midnight boundary issues.
 */
export function parseDateRange(range: ReportDateRange): {
  startDateTime: Date;
  endDateTime: Date;
} {
  const [sy, sm, sd] = range.startDate.split('-').map(Number);
  const [ey, em, ed] = range.endDate.split('-').map(Number);

  const startDateTime = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  const endDateTime = new Date(ey, em - 1, ed, 23, 59, 59, 999);

  return { startDateTime, endDateTime };
}

// ─── Safe Division ──────────────────────────────────────────────────────────

/**
 * Divide numerator by denominator, returning 0 if denominator is zero.
 * Prevents NaN/Infinity in report calculations.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

// ─── Currency Formatting ────────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees for display.
 * Only used at the presentation layer.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number with commas (no currency symbol).
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

/**
 * Format a percentage value.
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

/**
 * Convert an array of objects to a CSV string.
 * Uses the keys from the first object as headers.
 */
export function toCSV<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) return '';

  const headers = columns.map((col) => escapeCSV(col.header)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = (row as Record<string, unknown>)[col.key as string];
        if (value === null || value === undefined) return '';
        return escapeCSV(String(value));
      })
      .join(',')
  );

  return [headers, ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger a CSV file download on the client.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Hour Formatting ────────────────────────────────────────────────────────

/**
 * Format a 24-hour number (0-23) to a display string like "12 PM".
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}
