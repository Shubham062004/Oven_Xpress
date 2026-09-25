'use server';

import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, getAuthorizedBranchScope } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { AuthUser } from '@/lib/auth/types';
import type {
  DashboardDatePreset,
  ExecutiveKPIs,
  SalesTrendPoint,
  BranchPerformanceItem,
  OrderOverviewStats,
  PaymentOverviewStats,
  TopProductItem,
  InventoryHealthStats,
  RecentInventoryIssue,
  AttendanceOverviewStats,
  PendingApprovalsStats,
  CustomerFeedbackStats,
  RecentActivityItem,
  ExecutiveDashboardData,
} from './dashboard-types';
import {
  formatDateLocal,
  formatCurrency,
  formatNumber,
  safeDivide,
} from './constants';
import { calculateBatchStock } from '@/lib/inventory/actions';
import { StockTransactionType } from '@prisma/client';

export type DashboardResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Scoping & Authorization Helpers ─────────────────────────────────────────



// ─── Date Range Resolution ──────────────────────────────────────────────────

function resolveDashboardDates(
  preset: DashboardDatePreset,
  customFrom?: string,
  customTo?: string
): {
  current: { startDate: string; endDate: string; startDateTime: Date; endDateTime: Date };
  previous: { startDate: string; endDate: string; startDateTime: Date; endDateTime: Date };
} {
  const now = new Date();
  const todayStr = formatDateLocal(now);

  let curStart = todayStr;
  let curEnd = todayStr;
  let prevStart = todayStr;
  let prevEnd = todayStr;

  switch (preset) {
    case 'today': {
      curStart = todayStr;
      curEnd = todayStr;
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      prevStart = formatDateLocal(y);
      prevEnd = prevStart;
      break;
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      curStart = formatDateLocal(y);
      curEnd = curStart;

      const dby = new Date(now);
      dby.setDate(dby.getDate() - 2);
      prevStart = formatDateLocal(dby);
      prevEnd = prevStart;
      break;
    }
    case '7d': {
      curEnd = todayStr;
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 6);
      curStart = formatDateLocal(d7);

      const pEnd = new Date(d7);
      pEnd.setDate(pEnd.getDate() - 1);
      prevEnd = formatDateLocal(pEnd);
      const pStart = new Date(pEnd);
      pStart.setDate(pStart.getDate() - 6);
      prevStart = formatDateLocal(pStart);
      break;
    }
    case '30d': {
      curEnd = todayStr;
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 29);
      curStart = formatDateLocal(d30);

      const pEnd = new Date(d30);
      pEnd.setDate(pEnd.getDate() - 1);
      prevEnd = formatDateLocal(pEnd);
      const pStart = new Date(pEnd);
      pStart.setDate(pStart.getDate() - 29);
      prevStart = formatDateLocal(pStart);
      break;
    }
    case 'month': {
      curEnd = todayStr;
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
      curStart = formatDateLocal(mStart);

      // Previous month
      const pmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      prevEnd = formatDateLocal(pmEnd);
      const pmStart = new Date(pmEnd.getFullYear(), pmEnd.getMonth(), 1);
      prevStart = formatDateLocal(pmStart);
      break;
    }
    case 'custom': {
      if (customFrom && customTo) {
        curStart = customFrom;
        curEnd = customTo;

        const sDate = new Date(customFrom);
        const eDate = new Date(customTo);
        const diffMs = eDate.getTime() - sDate.getTime();
        const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

        const pEndDate = new Date(sDate);
        pEndDate.setDate(pEndDate.getDate() - 1);
        prevEnd = formatDateLocal(pEndDate);

        const pStartDate = new Date(pEndDate);
        pStartDate.setDate(pStartDate.getDate() - (diffDays - 1));
        prevStart = formatDateLocal(pStartDate);
      } else {
        curStart = todayStr;
        curEnd = todayStr;
        prevStart = todayStr;
        prevEnd = todayStr;
      }
      break;
    }
  }

  const [csy, csm, csd] = curStart.split('-').map(Number);
  const [cey, cem, ced] = curEnd.split('-').map(Number);
  const curStartDT = new Date(csy, csm - 1, csd, 0, 0, 0, 0);
  const curEndDT = new Date(cey, cem - 1, ced, 23, 59, 59, 999);

  const [psy, psm, psd] = prevStart.split('-').map(Number);
  const [pey, pem, ped] = prevEnd.split('-').map(Number);
  const prevStartDT = new Date(psy, psm - 1, psd, 0, 0, 0, 0);
  const prevEndDT = new Date(pey, pem - 1, ped, 23, 59, 59, 999);

  return {
    current: {
      startDate: curStart,
      endDate: curEnd,
      startDateTime: curStartDT,
      endDateTime: curEndDT,
    },
    previous: {
      startDate: prevStart,
      endDate: prevEnd,
      startDateTime: prevStartDT,
      endDateTime: prevEndDT,
    },
  };
}

// ─── Comparison Metric Helper ────────────────────────────────────────────────

function computeDelta(
  current: number,
  previous: number | undefined
): { changePercentage: number | null; trend: 'up' | 'down' | 'neutral' } {
  if (previous === undefined || previous === 0) {
    return { changePercentage: null, trend: 'neutral' };
  }
  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta * 10) / 10;
  if (rounded > 0) return { changePercentage: rounded, trend: 'up' };
  if (rounded < 0) return { changePercentage: rounded, trend: 'down' };
  return { changePercentage: 0, trend: 'neutral' };
}

// ─── Core Service: getExecutiveDashboardData ────────────────────────────────

export async function getExecutiveDashboardData(
  params?: {
    branchId?: string;
    preset?: DashboardDatePreset;
    from?: string;
    to?: string;
  },
  userOverride?: AuthUser
): Promise<DashboardResult<ExecutiveDashboardData>> {
  try {
    const user = userOverride || (await getCurrentUser());
    if (!user) {
      return { success: false, error: 'Unauthorized: Authentication required' };
    }

    if (!hasPermission(user, PERMISSIONS.DASHBOARD_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions for dashboard' };
    }

    // Branch scoping
    const scope = await getAuthorizedBranchScope(user);
    let effectiveBranchId: string | undefined;

    if (scope.isAllBranches) {
      if (params?.branchId && params.branchId !== 'all') {
        effectiveBranchId = params.branchId;
      }
    } else {
      if (scope.branchIds.length === 0) {
        return { success: false, error: 'No branch assigned to your account' };
      }
      effectiveBranchId = scope.branchIds[0];
    }

    // Accessible branches list
    const branchWhere = scope.isAllBranches
      ? { status: 'ACTIVE' as const }
      : { id: { in: scope.branchIds }, status: 'ACTIVE' as const };

    const accessibleBranches = await prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const accessibleBranchIds = accessibleBranches.map((b) => b.id);
    if (accessibleBranchIds.length === 0) {
      return { success: false, error: 'No active branch available' };
    }

    // Determine target branches for queries
    const queryBranchIds = effectiveBranchId ? [effectiveBranchId] : accessibleBranchIds;

    // Date range resolution
    const activePreset = params?.preset || 'today';
    const { current, previous } = resolveDashboardDates(activePreset, params?.from, params?.to);

    // Permission checks for role-based gating
    const canViewFinancials = hasPermission(user, PERMISSIONS.REPORT_SALES_READ);
    const canViewBranches = hasPermission(user, PERMISSIONS.REPORT_BRANCH_READ);
    const canViewExpenses = hasPermission(user, PERMISSIONS.EXPENSE_READ);
    const canViewSalary = hasPermission(user, PERMISSIONS.SALARY_READ);
    const canViewAttendance = hasPermission(user, PERMISSIONS.ATTENDANCE_READ);
    const canViewInventory = hasPermission(user, PERMISSIONS.INVENTORY_READ);
    const canViewCustomers = hasPermission(user, PERMISSIONS.CUSTOMER_READ);
    const canViewPurchases = hasPermission(user, PERMISSIONS.PURCHASE_READ);

    // Where clauses for primary queries
    const currentOrderWhere = {
      branchId: { in: queryBranchIds },
      createdAt: { gte: current.startDateTime, lte: current.endDateTime },
    };

    const prevOrderWhere = {
      branchId: { in: queryBranchIds },
      createdAt: { gte: previous.startDateTime, lte: previous.endDateTime },
    };

    // Parallel Server Queries
    const [
      // 1. Current Orders Summary
      currentOrdersTotal,
      currentOrdersCompletedAgg,
      // 2. Previous Orders Summary
      prevOrdersCompletedAgg,
      // 3. Current & Previous Refunds
      currentRefundsAgg,
      prevRefundsAgg,
      // 4. Current & Previous Payments
      currentPaymentsSuccessAgg,
      prevPaymentsSuccessAgg,
      currentPaymentsFailedAgg,
      // 5. Current & Previous Expenses
      currentExpensesAgg,
      prevExpensesAgg,
      // 6. Current & Previous Salaries
      currentSalaryAgg,
      prevSalaryAgg,
      // 7. Order Status breakdown
      orderStatusCounts,
      // 8. Order Type breakdown
      orderTypeCounts,
      // 9. Payment Methods breakdown
      paymentMethodsBreakdown,
      // 10. Top Products order items
      topOrderItems,
      // 11. Attendance summary
      attendanceCounts,
      attendanceLateCount,
      attendanceEarlyCount,
      totalActiveEmployees,
      // 12. Pending Approvals
      pendingExpenseCount,
      pendingBonusCount,
      pendingSalaryCount,
      pendingPurchaseCount,
      // 13. Customer & Feedback
      newCustomersCount,
      completedCustomerOrdersCount,
      reviewsAgg,
      openIssuesCount,
      urgentIssuesCount,
      // 14. Stock Transactions (damage & wastage & variances)
      wastageAgg,
      stockVarianceCount,
      // 15. Raw records for trend
      completedOrdersRaw,
      // 16. Branch-level aggregations
      branchOrdersAgg,
      branchPaymentsAgg,
      branchExpensesAgg,
      branchSalaryAgg,
    ] = await Promise.all([
      // 1. Current Orders Summary
      prisma.order.count({ where: currentOrderWhere }),
      prisma.order.aggregate({
        where: { ...currentOrderWhere, status: { in: ['COMPLETED', 'REFUNDED'] } },
        _count: { id: true },
        _sum: { totalAmount: true, discountAmount: true },
      }),
      // 2. Previous Orders Summary
      prisma.order.aggregate({
        where: { ...prevOrderWhere, status: { in: ['COMPLETED', 'REFUNDED'] } },
        _count: { id: true },
        _sum: { totalAmount: true, discountAmount: true },
      }),
      // 3. Refunds
      prisma.paymentRefund.aggregate({
        where: {
          status: 'SUCCESS',
          processedAt: { gte: current.startDateTime, lte: current.endDateTime },
          payment: { branchId: { in: queryBranchIds } },
        },
        _sum: { amount: true },
      }),
      prisma.paymentRefund.aggregate({
        where: {
          status: 'SUCCESS',
          processedAt: { gte: previous.startDateTime, lte: previous.endDateTime },
          payment: { branchId: { in: queryBranchIds } },
        },
        _sum: { amount: true },
      }),
      // 4. Payments
      prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          processedAt: { gte: current.startDateTime, lte: current.endDateTime },
          branchId: { in: queryBranchIds },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'SUCCESS',
          processedAt: { gte: previous.startDateTime, lte: previous.endDateTime },
          branchId: { in: queryBranchIds },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'FAILED',
          processedAt: { gte: current.startDateTime, lte: current.endDateTime },
          branchId: { in: queryBranchIds },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // 5. Expenses
      canViewExpenses || canViewFinancials
        ? prisma.expense.aggregate({
            where: {
              status: 'APPROVED',
              expenseDate: { gte: current.startDateTime, lte: current.endDateTime },
              branchId: { in: queryBranchIds },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      canViewExpenses || canViewFinancials
        ? prisma.expense.aggregate({
            where: {
              status: 'APPROVED',
              expenseDate: { gte: previous.startDateTime, lte: previous.endDateTime },
              branchId: { in: queryBranchIds },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      // 6. Salaries
      canViewSalary || canViewFinancials
        ? prisma.salaryRecord.aggregate({
            where: {
              status: { in: ['APPROVED', 'PAID'] },
              periodStart: { lte: current.endDateTime },
              periodEnd: { gte: current.startDateTime },
              branchId: { in: queryBranchIds },
            },
            _sum: { grossAmount: true },
          })
        : Promise.resolve({ _sum: { grossAmount: 0 } }),
      canViewSalary || canViewFinancials
        ? prisma.salaryRecord.aggregate({
            where: {
              status: { in: ['APPROVED', 'PAID'] },
              periodStart: { lte: previous.endDateTime },
              periodEnd: { gte: previous.startDateTime },
              branchId: { in: queryBranchIds },
            },
            _sum: { grossAmount: true },
          })
        : Promise.resolve({ _sum: { grossAmount: 0 } }),
      // 7. Order Status breakdown
      prisma.order.groupBy({
        by: ['status'],
        where: currentOrderWhere,
        _count: { id: true },
      }),
      // 8. Order Type breakdown
      prisma.order.groupBy({
        by: ['orderType'],
        where: currentOrderWhere,
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      // 9. Payment Methods breakdown
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          status: 'SUCCESS',
          processedAt: { gte: current.startDateTime, lte: current.endDateTime },
          branchId: { in: queryBranchIds },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
      // 10. Top Products order items
      prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          order: {
            ...currentOrderWhere,
            status: { in: ['COMPLETED', 'REFUNDED'] },
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
      // 11. Attendance summary
      canViewAttendance
        ? prisma.attendance.groupBy({
            by: ['status'],
            where: {
              branchId: { in: queryBranchIds },
              date: { gte: current.startDateTime, lte: current.endDateTime },
            },
            _count: { id: true },
          })
        : Promise.resolve([]),
      canViewAttendance
        ? prisma.attendance.count({
            where: {
              branchId: { in: queryBranchIds },
              date: { gte: current.startDateTime, lte: current.endDateTime },
              lateMinutes: { gt: 0 },
            },
          })
        : Promise.resolve(0),
      canViewAttendance
        ? prisma.attendance.count({
            where: {
              branchId: { in: queryBranchIds },
              date: { gte: current.startDateTime, lte: current.endDateTime },
              earlyDepartureMinutes: { gt: 0 },
            },
          })
        : Promise.resolve(0),
      prisma.employee.count({
        where: {
          employmentStatus: 'ACTIVE',
          branchId: { in: queryBranchIds },
        },
      }),
      // 12. Pending Approvals
      canViewExpenses
        ? prisma.expense.count({
            where: { branchId: { in: queryBranchIds }, status: 'PENDING_APPROVAL' },
          })
        : Promise.resolve(0),
      canViewSalary
        ? prisma.bonus.count({
            where: { branchId: { in: queryBranchIds }, status: 'PENDING_APPROVAL' },
          })
        : Promise.resolve(0),
      canViewSalary
        ? prisma.salaryRecord.count({
            where: { branchId: { in: queryBranchIds }, status: 'PENDING_REVIEW' },
          })
        : Promise.resolve(0),
      canViewPurchases
        ? prisma.purchaseOrder.count({
            where: {
              branchId: { in: queryBranchIds },
              status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] },
            },
          })
        : Promise.resolve(0),
      // 13. Customer & Feedback
      canViewCustomers
        ? prisma.customer.count({
            where: {
              createdAt: { gte: current.startDateTime, lte: current.endDateTime },
            },
          })
        : Promise.resolve(0),
      prisma.order.count({
        where: {
          ...currentOrderWhere,
          status: { in: ['COMPLETED', 'REFUNDED'] },
          customerId: { not: null },
        },
      }),
      prisma.review.aggregate({
        where: {
          branchId: { in: queryBranchIds },
          createdAt: { gte: current.startDateTime, lte: current.endDateTime },
        },
        _count: { id: true },
        _avg: { rating: true },
      }),
      prisma.customerIssue.count({
        where: {
          branchId: { in: queryBranchIds },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      prisma.customerIssue.count({
        where: {
          branchId: { in: queryBranchIds },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          priority: { in: ['HIGH', 'URGENT'] },
        },
      }),
      // 14. Stock Transactions (damage & wastage & variances)
      canViewInventory
        ? prisma.stockTransaction.aggregate({
            where: {
              branchId: { in: queryBranchIds },
              createdAt: { gte: current.startDateTime, lte: current.endDateTime },
              type: { in: [StockTransactionType.DAMAGE, StockTransactionType.WASTAGE] },
            },
            _sum: { quantity: true },
            _count: { id: true },
          })
        : Promise.resolve({ _sum: { quantity: 0 }, _count: { id: 0 } }),
      canViewInventory
        ? prisma.stockTransaction.count({
            where: {
              branchId: { in: queryBranchIds },
              createdAt: { gte: current.startDateTime, lte: current.endDateTime },
              type: {
                in: [StockTransactionType.ADJUSTMENT_IN, StockTransactionType.ADJUSTMENT_OUT],
              },
            },
          })
        : Promise.resolve(0),
      // 15. Raw records for trend
      prisma.order.findMany({
        where: {
          ...currentOrderWhere,
          status: { in: ['COMPLETED', 'REFUNDED'] },
        },
        select: {
          createdAt: true,
          totalAmount: true,
          discountAmount: true,
        },
      }),
      // 16. Branch-level aggregations
      prisma.order.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: accessibleBranchIds },
          createdAt: { gte: current.startDateTime, lte: current.endDateTime },
          status: { in: ['COMPLETED', 'REFUNDED'] },
        },
        _count: { id: true },
        _sum: { totalAmount: true, discountAmount: true },
      }),
      prisma.payment.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: accessibleBranchIds },
          processedAt: { gte: current.startDateTime, lte: current.endDateTime },
          status: 'SUCCESS',
        },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: accessibleBranchIds },
          expenseDate: { gte: current.startDateTime, lte: current.endDateTime },
          status: 'APPROVED',
        },
        _sum: { amount: true },
      }),
      prisma.salaryRecord.groupBy({
        by: ['branchId'],
        where: {
          branchId: { in: accessibleBranchIds },
          periodStart: { lte: current.endDateTime },
          periodEnd: { gte: current.startDateTime },
          status: { in: ['APPROVED', 'PAID'] },
        },
        _sum: { grossAmount: true },
      }),
    ]);

    // ─── Financial Calculations: Current Period ─────────────────────────────
    const curGrossSales = Number(currentOrdersCompletedAgg._sum.totalAmount || 0);
    const curDiscounts = Number(currentOrdersCompletedAgg._sum.discountAmount || 0);
    const curRefunds = Number(currentRefundsAgg._sum.amount || 0);
    const curNetRevenue = Math.max(0, curGrossSales - curDiscounts - curRefunds);
    const curCompletedOrders = currentOrdersCompletedAgg._count.id;
    const curAov = safeDivide(curNetRevenue, curCompletedOrders);
    const curSuccessfulPayments = Number(currentPaymentsSuccessAgg._sum.amount || 0);
    const curApprovedExpenses = Number(currentExpensesAgg._sum?.amount || 0);
    const curApprovedSalary = Number(currentSalaryAgg._sum?.grossAmount || 0);
    const curOperatingResult = curNetRevenue - curApprovedExpenses - curApprovedSalary;

    // ─── Financial Calculations: Previous Period ────────────────────────────
    const prevGrossSales = Number(prevOrdersCompletedAgg._sum.totalAmount || 0);
    const prevDiscounts = Number(prevOrdersCompletedAgg._sum.discountAmount || 0);
    const prevRefunds = Number(prevRefundsAgg._sum.amount || 0);
    const prevNetRevenue = Math.max(0, prevGrossSales - prevDiscounts - prevRefunds);
    const prevCompletedOrders = prevOrdersCompletedAgg._count.id;
    const prevAov = safeDivide(prevNetRevenue, prevCompletedOrders);
    const prevSuccessfulPayments = Number(prevPaymentsSuccessAgg._sum.amount || 0);
    const prevApprovedExpenses = Number(prevExpensesAgg._sum?.amount || 0);
    const prevApprovedSalary = Number(prevSalaryAgg._sum?.grossAmount || 0);
    const prevOperatingResult = prevNetRevenue - prevApprovedExpenses - prevApprovedSalary;

    // KPI Deltas
    const netSalesDelta = computeDelta(curNetRevenue, prevNetRevenue);
    const ordersDelta = computeDelta(curCompletedOrders, prevCompletedOrders);
    const aovDelta = computeDelta(curAov, prevAov);
    const paymentsDelta = computeDelta(curSuccessfulPayments, prevSuccessfulPayments);
    const expensesDelta = computeDelta(curApprovedExpenses, prevApprovedExpenses);
    const opResultDelta = computeDelta(curOperatingResult, prevOperatingResult);

    const kpis: ExecutiveKPIs = {
      netSales: {
        label: 'Net Sales',
        value: canViewFinancials ? curNetRevenue : 0,
        formattedValue: canViewFinancials ? formatCurrency(curNetRevenue) : 'Restricted',
        previousValue: canViewFinancials ? prevNetRevenue : undefined,
        changePercentage: canViewFinancials ? netSalesDelta.changePercentage : null,
        trend: netSalesDelta.trend,
        helperText: 'Gross sales minus discounts & refunds',
        isFinancial: true,
      },
      orderCount: {
        label: 'Completed Orders',
        value: curCompletedOrders,
        formattedValue: formatNumber(curCompletedOrders),
        previousValue: prevCompletedOrders,
        changePercentage: ordersDelta.changePercentage,
        trend: ordersDelta.trend,
        helperText: `${currentOrdersTotal} total received`,
        isFinancial: false,
      },
      averageOrderValue: {
        label: 'Average Order Value',
        value: canViewFinancials ? curAov : 0,
        formattedValue: canViewFinancials ? formatCurrency(curAov) : 'Restricted',
        previousValue: canViewFinancials ? prevAov : undefined,
        changePercentage: canViewFinancials ? aovDelta.changePercentage : null,
        trend: aovDelta.trend,
        helperText: 'Net revenue per completed order',
        isFinancial: true,
      },
      successfulPayments: {
        label: 'Successful Payments',
        value: canViewFinancials ? curSuccessfulPayments : 0,
        formattedValue: canViewFinancials ? formatCurrency(curSuccessfulPayments) : 'Restricted',
        previousValue: canViewFinancials ? prevSuccessfulPayments : undefined,
        changePercentage: canViewFinancials ? paymentsDelta.changePercentage : null,
        trend: paymentsDelta.trend,
        helperText: `${currentPaymentsSuccessAgg._count.id} transactions`,
        isFinancial: true,
      },
      approvedExpenses: {
        label: 'Approved Expenses',
        value: canViewFinancials ? curApprovedExpenses : 0,
        formattedValue: canViewFinancials ? formatCurrency(curApprovedExpenses) : 'Restricted',
        previousValue: canViewFinancials ? prevApprovedExpenses : undefined,
        changePercentage: canViewFinancials ? expensesDelta.changePercentage : null,
        trend: expensesDelta.trend,
        helperText: 'Excludes inventory purchases',
        isFinancial: true,
      },
      operatingResult: {
        label: 'Operating Result',
        value: canViewFinancials ? curOperatingResult : 0,
        formattedValue: canViewFinancials ? formatCurrency(curOperatingResult) : 'Restricted',
        previousValue: canViewFinancials ? prevOperatingResult : undefined,
        changePercentage: canViewFinancials ? opResultDelta.changePercentage : null,
        trend: opResultDelta.trend,
        helperText: 'Net Revenue − Expenses − Salary',
        isFinancial: true,
      },
    };

    // ─── Sales Trend Processing ─────────────────────────────────────────────
    const isSingleDay = current.startDate === current.endDate;
    const trendGrouping: 'hourly' | 'daily' = isSingleDay ? 'hourly' : 'daily';
    const salesTrend: SalesTrendPoint[] = [];

    if (isSingleDay) {
      const hoursMap = new Map<number, { netSales: number; orderCount: number }>();
      for (let h = 0; h < 24; h++) {
        hoursMap.set(h, { netSales: 0, orderCount: 0 });
      }

      for (const order of completedOrdersRaw) {
        const orderHour = new Date(order.createdAt).getHours();
        const existing = hoursMap.get(orderHour) || { netSales: 0, orderCount: 0 };
        const orderNet = Math.max(
          0,
          Number(order.totalAmount || 0) - Number(order.discountAmount || 0)
        );
        hoursMap.set(orderHour, {
          netSales: existing.netSales + orderNet,
          orderCount: existing.orderCount + 1,
        });
      }

      for (let h = 8; h <= 23; h++) {
        const d = hoursMap.get(h)!;
        const displayLabel = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`;
        salesTrend.push({
          key: `${String(h).padStart(2, '0')}:00`,
          label: displayLabel,
          netSales: canViewFinancials ? Math.round(d.netSales) : 0,
          orderCount: d.orderCount,
        });
      }
    } else {
      // Multi-day
      const daysMap = new Map<string, { netSales: number; orderCount: number }>();

      // Initialize all dates in range
      const curIter = new Date(current.startDateTime);
      while (curIter <= current.endDateTime) {
        daysMap.set(formatDateLocal(curIter), { netSales: 0, orderCount: 0 });
        curIter.setDate(curIter.getDate() + 1);
      }

      for (const order of completedOrdersRaw) {
        const dayKey = formatDateLocal(new Date(order.createdAt));
        if (daysMap.has(dayKey)) {
          const existing = daysMap.get(dayKey)!;
          const orderNet = Math.max(
            0,
            Number(order.totalAmount || 0) - Number(order.discountAmount || 0)
          );
          daysMap.set(dayKey, {
            netSales: existing.netSales + orderNet,
            orderCount: existing.orderCount + 1,
          });
        }
      }

      for (const [dayKey, stats] of daysMap.entries()) {
        const parts = dayKey.split('-');
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const displayLabel = dateObj.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        });
        salesTrend.push({
          key: dayKey,
          label: displayLabel,
          netSales: canViewFinancials ? Math.round(stats.netSales) : 0,
          orderCount: stats.orderCount,
        });
      }
    }

    // ─── Branch Performance Table ───────────────────────────────────────────
    const orderMapByBranch = new Map(branchOrdersAgg.map((b) => [b.branchId, b]));
    const paymentMapByBranch = new Map(branchPaymentsAgg.map((b) => [b.branchId, b]));
    const expenseMapByBranch = new Map(branchExpensesAgg.map((b) => [b.branchId, b]));
    const salaryMapByBranch = new Map(branchSalaryAgg.map((b) => [b.branchId, b]));

    const branchPerformance: BranchPerformanceItem[] = accessibleBranches.map((branch) => {
      const o = orderMapByBranch.get(branch.id);
      const p = paymentMapByBranch.get(branch.id);
      const e = expenseMapByBranch.get(branch.id);
      const s = salaryMapByBranch.get(branch.id);

      const bGross = Number(o?._sum.totalAmount || 0);
      const bDiscounts = Number(o?._sum.discountAmount || 0);
      const bNet = Math.max(0, bGross - bDiscounts);
      const bCount = o?._count.id || 0;
      const bAov = safeDivide(bNet, bCount);
      const bPayments = Number(p?._sum.amount || 0);
      const bExpenses = Number(e?._sum.amount || 0);
      const bSalary = Number(s?._sum.grossAmount || 0);
      const bOperatingResult = bNet - bExpenses - bSalary;

      return {
        branchId: branch.id,
        branchName: branch.name,
        branchCode: branch.code,
        orderCount: bCount,
        grossSales: canViewFinancials ? bGross : 0,
        netSales: canViewFinancials ? bNet : 0,
        averageOrderValue: canViewFinancials ? bAov : 0,
        successfulPayments: canViewFinancials ? bPayments : 0,
        approvedExpenses: canViewFinancials ? bExpenses : 0,
        operatingResult: canViewFinancials ? bOperatingResult : 0,
      };
    });

    // ─── Order Overview Breakdown ───────────────────────────────────────────
    const statusMap = new Map(orderStatusCounts.map((s) => [s.status, s._count.id]));
    const orderTypesMap = orderTypeCounts.map((ot) => ({
      type: ot.orderType,
      count: ot._count.id,
      amount: canViewFinancials ? Number(ot._sum.totalAmount || 0) : 0,
    }));

    const orderOverview: OrderOverviewStats = {
      totalOrders: currentOrdersTotal,
      pending: statusMap.get('PENDING') || 0,
      confirmed: statusMap.get('CONFIRMED') || 0,
      preparing: statusMap.get('PREPARING') || 0,
      ready: statusMap.get('READY') || 0,
      completed: statusMap.get('COMPLETED') || 0,
      cancelled: statusMap.get('CANCELLED') || 0,
      refunded: statusMap.get('REFUNDED') || 0,
      orderTypes: orderTypesMap,
    };

    // ─── Payment Overview Breakdown ─────────────────────────────────────────
    const paymentMethods = paymentMethodsBreakdown.map((pm) => ({
      method: pm.method,
      count: pm._count?.id || 0,
      amount: canViewFinancials ? Number(pm._sum?.amount || 0) : 0,
    }));

    const paymentOverview: PaymentOverviewStats = {
      methods: paymentMethods,
      totalSuccessfulAmount: canViewFinancials ? curSuccessfulPayments : 0,
      totalSuccessfulCount: currentPaymentsSuccessAgg._count.id,
      failedCount: currentPaymentsFailedAgg._count.id,
      failedAmount: canViewFinancials ? Number(currentPaymentsFailedAgg._sum.amount || 0) : 0,
      refundedAmount: canViewFinancials ? curRefunds : 0,
    };

    // ─── Top Products ───────────────────────────────────────────────────────
    let topProducts: TopProductItem[] = [];
    if (topOrderItems.length > 0) {
      const itemIds = topOrderItems.map((i) => i.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
        select: {
          id: true,
          name: true,
          category: { select: { name: true } },
        },
      });

      const menuMap = new Map(menuItems.map((m) => [m.id, m]));
      topProducts = topOrderItems.map((item) => {
        const mi = menuMap.get(item.menuItemId);
        return {
          menuItemId: item.menuItemId,
          menuItemName: mi?.name || 'Unknown Item',
          categoryName: mi?.category?.name || 'General',
          quantitySold: Number(item._sum?.quantity || 0),
          netSales: canViewFinancials ? Number(item._sum?.totalPrice || 0) : 0,
        };
      });
    }

    // ─── Inventory Health ───────────────────────────────────────────────────
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const recentIssues: RecentInventoryIssue[] = [];

    if (canViewInventory) {
      const stockMap = await calculateBatchStock(queryBranchIds);
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          branchId: { in: queryBranchIds },
          status: 'ACTIVE',
        },
        include: {
          ingredient: { select: { id: true, name: true, unit: true } },
          branch: { select: { name: true } },
        },
      });

      for (const item of inventoryItems) {
        const key = `${item.branchId}:${item.ingredientId}`;
        const currentStock = stockMap.get(key) || 0;
        const minStock = Number(item.minimumStock);

        if (currentStock <= 0) {
          outOfStockCount++;
          if (recentIssues.length < 5) {
            recentIssues.push({
              id: item.id,
              itemName: item.ingredient.name,
              type: 'OUT_OF_STOCK',
              message: `Out of stock (${currentStock} ${item.ingredient.unit})`,
              branchName: item.branch.name,
              createdAt: item.updatedAt.toISOString(),
            });
          }
        } else if (currentStock <= minStock) {
          lowStockCount++;
          if (recentIssues.length < 5) {
            recentIssues.push({
              id: item.id,
              itemName: item.ingredient.name,
              type: 'LOW_STOCK',
              message: `Low stock: ${currentStock}/${minStock} ${item.ingredient.unit}`,
              branchName: item.branch.name,
              createdAt: item.updatedAt.toISOString(),
            });
          }
        }
      }
    }

    const inventoryHealth: InventoryHealthStats = {
      lowStockCount,
      outOfStockCount,
      stockVarianceCount,
      damageWastageQty: Number(wastageAgg._sum?.quantity || 0),
      damageWastageCost: 0,
      recentIssues,
    };

    // ─── Attendance Overview ────────────────────────────────────────────────
    const attendanceMap = new Map(attendanceCounts.map((a) => [a.status, a._count.id]));
    const attendanceOverview: AttendanceOverviewStats = {
      totalEmployees: totalActiveEmployees,
      present: attendanceMap.get('PRESENT') || 0,
      absent: attendanceMap.get('ABSENT') || 0,
      halfDay: attendanceMap.get('HALF_DAY') || 0,
      leave: attendanceMap.get('LEAVE') || 0,
      lateArrivals: attendanceLateCount,
      earlyDepartures: attendanceEarlyCount,
    };

    // ─── Pending Approvals ──────────────────────────────────────────────────
    const pendingApprovals: PendingApprovalsStats = {
      expenseApprovals: pendingExpenseCount,
      bonusApprovals: pendingBonusCount,
      salaryReviews: pendingSalaryCount,
      purchaseOrdersRequiringAction: pendingPurchaseCount,
      totalPendingCount:
        pendingExpenseCount + pendingBonusCount + pendingSalaryCount + pendingPurchaseCount,
    };

    // ─── Customer & Feedback ────────────────────────────────────────────────
    const customerFeedback: CustomerFeedbackStats = {
      newCustomers: newCustomersCount,
      completedCustomerOrders: completedCustomerOrdersCount,
      reviewCount: reviewsAgg._count.id,
      averageRating: reviewsAgg._avg.rating ? Math.round(reviewsAgg._avg.rating * 10) / 10 : 0,
      openIssuesCount,
      highUrgentIssuesCount: urgentIssuesCount,
    };

    // ─── Recent Activity Feed ───────────────────────────────────────────────
    // Query a small, bounded set of real recent records across primary models
    const [recentOrders, recentPayments, recentPurchases, recentWastage, recentReviews] =
      await Promise.all([
        prisma.order.findMany({
          where: { branchId: { in: queryBranchIds }, status: 'COMPLETED' },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            updatedAt: true,
            branch: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 3,
        }),
        prisma.payment.findMany({
          where: { branchId: { in: queryBranchIds }, status: 'SUCCESS' },
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            method: true,
            processedAt: true,
            branch: { select: { name: true } },
          },
          orderBy: { processedAt: 'desc' },
          take: 3,
        }),
        canViewPurchases
          ? prisma.purchaseOrder.findMany({
              where: { branchId: { in: queryBranchIds }, status: 'RECEIVED' },
              select: {
                id: true,
                purchaseNumber: true,
                updatedAt: true,
                branch: { select: { name: true } },
                supplier: { select: { name: true } },
              },
              orderBy: { updatedAt: 'desc' },
              take: 2,
            })
          : Promise.resolve([]),
        canViewInventory
          ? prisma.stockTransaction.findMany({
              where: {
                branchId: { in: queryBranchIds },
                type: { in: [StockTransactionType.DAMAGE, StockTransactionType.WASTAGE] },
              },
              select: {
                id: true,
                type: true,
                quantity: true,
                unit: true,
                createdAt: true,
                branch: { select: { name: true } },
                ingredient: { select: { name: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 2,
            })
          : Promise.resolve([]),
        prisma.review.findMany({
          where: { branchId: { in: queryBranchIds } },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            branch: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 2,
        }),
      ]);

    const activityList: RecentActivityItem[] = [];

    for (const ord of recentOrders) {
      activityList.push({
        id: `ord-${ord.id}`,
        type: 'ORDER_COMPLETED',
        title: `Order ${ord.orderNumber} completed`,
        description: canViewFinancials
          ? `Value: ${formatCurrency(Number(ord.totalAmount))}`
          : 'Order successfully fulfilled',
        timestamp: ord.updatedAt.toISOString(),
        branchName: ord.branch.name,
        amount: canViewFinancials ? Number(ord.totalAmount) : undefined,
        link: `/orders/${ord.id}`,
      });
    }

    for (const pay of recentPayments) {
      activityList.push({
        id: `pay-${pay.id}`,
        type: 'PAYMENT_RECEIVED',
        title: `Payment received (${pay.method})`,
        description: canViewFinancials
          ? `Amount: ${formatCurrency(Number(pay.amount))}`
          : 'Transaction settled',
        timestamp: (pay.processedAt || new Date()).toISOString(),
        branchName: pay.branch.name,
        amount: canViewFinancials ? Number(pay.amount) : undefined,
        link: '/payments',
      });
    }

    for (const po of recentPurchases) {
      activityList.push({
        id: `po-${po.id}`,
        type: 'PURCHASE_RECEIVED',
        title: `PO ${po.purchaseNumber} stock received`,
        description: `Supplier: ${po.supplier.name}`,
        timestamp: po.updatedAt.toISOString(),
        branchName: po.branch.name,
        link: `/purchases/${po.id}`,
      });
    }

    for (const wst of recentWastage) {
      activityList.push({
        id: `wst-${wst.id}`,
        type: 'WASTAGE_RECORDED',
        title: `${wst.type === 'DAMAGE' ? 'Stock Damage' : 'Kitchen Wastage'} recorded`,
        description: `${Number(wst.quantity)} ${wst.unit} of ${wst.ingredient.name}`,
        timestamp: wst.createdAt.toISOString(),
        branchName: wst.branch.name,
        link: '/inventory',
      });
    }

    for (const rev of recentReviews) {
      activityList.push({
        id: `rev-${rev.id}`,
        type: 'REVIEW_SUBMITTED',
        title: `Customer review: ${rev.rating}★`,
        description: rev.comment || 'No review comments provided',
        timestamp: rev.createdAt.toISOString(),
        branchName: rev.branch.name,
        link: '/reviews',
      });
    }

    // Sort recent activity chronologically descending
    activityList.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const recentActivity = activityList.slice(0, 8);

    return {
      success: true,
      data: {
        dateRange: {
          startDate: current.startDate,
          endDate: current.endDate,
        },
        preset: activePreset,
        selectedBranchId: params?.branchId || (effectiveBranchId ? effectiveBranchId : 'all'),
        effectiveBranchId,
        isAllBranches: scope.isAllBranches && (!params?.branchId || params.branchId === 'all'),
        isBranchRestricted: !scope.isAllBranches,
        canViewFinancials,
        canViewBranches,
        userRole: user.role,
        userName: user.name,
        accessibleBranches,
        kpis,
        salesTrend,
        salesTrendGrouping: trendGrouping,
        branchPerformance,
        orderOverview,
        paymentOverview,
        topProducts,
        inventoryHealth,
        attendanceOverview,
        pendingApprovals,
        customerFeedback,
        recentActivity,
      },
    };
  } catch (error) {
    console.error('Error in getExecutiveDashboardData:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compile dashboard data',
    };
  }
}

// ─── CSV Export Functionality ────────────────────────────────────────────────

export async function exportDashboardSummaryCSV(
  params?: {
    branchId?: string;
    preset?: DashboardDatePreset;
    from?: string;
    to?: string;
  },
  userOverride?: AuthUser
): Promise<DashboardResult<string>> {
  try {
    const dashRes = await getExecutiveDashboardData(params, userOverride);
    if (!dashRes.success) return dashRes;

    const data = dashRes.data;
    const lines: string[] = [];

    // Header Metadata
    lines.push(`"Oven Xpress - Executive Business Dashboard Summary"`);
    lines.push(`"Period:","${data.dateRange.startDate} to ${data.dateRange.endDate}"`);
    lines.push(`"Branch:","${data.isAllBranches ? 'All Accessible Branches' : data.selectedBranchId}"`);
    lines.push(`"Generated At:","${new Date().toISOString()}"`);
    lines.push('');

    // Executive KPIs
    lines.push('"EXECUTIVE KPIS"');
    lines.push('"Metric","Current Value","Previous Value","Change %"');
    const kpis = [
      data.kpis.netSales,
      data.kpis.orderCount,
      data.kpis.averageOrderValue,
      data.kpis.successfulPayments,
      data.kpis.approvedExpenses,
      data.kpis.operatingResult,
    ];
    for (const kpi of kpis) {
      lines.push(
        `"${kpi.label}","${kpi.formattedValue}","${kpi.previousValue !== undefined ? kpi.previousValue : 'N/A'}","${
          kpi.changePercentage !== null && kpi.changePercentage !== undefined
            ? `${kpi.changePercentage}%`
            : 'N/A'
        }"`
      );
    }
    lines.push('');

    // Branch Performance
    if (data.branchPerformance.length > 0) {
      lines.push('"BRANCH PERFORMANCE"');
      lines.push(
        '"Branch Name","Code","Orders","Net Sales","Avg Order Value","Successful Payments","Expenses","Operating Result"'
      );
      for (const bp of data.branchPerformance) {
        lines.push(
          `"${bp.branchName}","${bp.branchCode}","${bp.orderCount}","${bp.netSales}","${bp.averageOrderValue.toFixed(
            2
          )}","${bp.successfulPayments}","${bp.approvedExpenses}","${bp.operatingResult}"`
        );
      }
      lines.push('');
    }

    // Top Products
    if (data.topProducts.length > 0) {
      lines.push('"TOP SELLING PRODUCTS"');
      lines.push('"Item Name","Category","Quantity Sold","Net Sales"');
      for (const prod of data.topProducts) {
        lines.push(
          `"${prod.menuItemName}","${prod.categoryName}","${prod.quantitySold}","${prod.netSales}"`
        );
      }
    }

    return { success: true, data: lines.join('\n') };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export dashboard CSV',
    };
  }
}
