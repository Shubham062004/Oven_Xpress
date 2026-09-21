'use server';

import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { hasPermission, hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { AuthUser } from '@/lib/auth/types';
import type {
  ReportDateRange,
  SalesOverview,
  DailySalesRow,
  OrderTypeSalesRow,
  PaymentMethodBreakdown,
  BranchSalesRow,
  ProductSalesRow,
  CategorySalesRow,
  HourlyBreakdownRow,
  RevenueTimePoint,
  ProfitLossStatement,
  PurchaseReportRow,
  DashboardData,
  ReportFilterParams,
  SalesReportRow,
  SalesReportSummary,
  OrdersReportRow,
  OrdersReportSummary,
  ProductsReportRow,
  ProductsReportSummary,
  BranchReportRow,
  BranchReportSummary,
  PaymentsReportRow,
  PaymentsReportSummary,
  ExpensesReportRow,
  ExpensesReportSummary,
  InventoryReportRow,
  StockMovementReportRow,
  InventoryReportSummary,
  PurchasesReportRow,
  PurchasesReportSummary,
  WastageReportRow,
  WastageReportSummary,
  AttendanceReportRow,
  AttendanceReportSummary,
  CompensationReportRow,
  CompensationReportSummary,
  CustomersReportRow,
  CustomersReportSummary,
  ReviewsReportRow,
  ReviewsReportSummary,
  PaginationMeta,
} from './types';
import {
  getSalesReportData,
  getOrdersReportData,
  getProductSalesReportData,
  getBranchesReportData,
  getPaymentsReportData,
  getExpensesReportData,
  getInventoryReportData,
  getStockMovementsReportData,
  getPurchasesReportData,
  getWastageReportData,
  getAttendanceReportData,
  getCompensationReportData,
  getCustomersReportData,
  getReviewsReportData,
  generateGenericCSV,
} from './report-service';
import {
  getDateRangeFromPreset,
  parseDateRange,
  formatDateLocal,
  safeDivide,
  toCSV,
} from './constants';

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Scoping & Helpers ───────────────────────────────────────────────────────

/**
 * Resolves authorized branch scope for the authenticated user.
 * OWNER and ADMIN have access across all branches.
 * MANAGER and STAFF are restricted to their assigned branch.
 */
async function getAuthorizedBranchScope(
  user: AuthUser
): Promise<{ isAllBranches: boolean; branchIds: string[] }> {
  if (user.role === 'OWNER' || user.role === 'ADMIN') {
    return { isAllBranches: true, branchIds: [] };
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { branchId: true },
  });

  if (employee?.branchId) {
    return { isAllBranches: false, branchIds: [employee.branchId] };
  }

  return { isAllBranches: false, branchIds: [] };
}

/**
 * Validates branch filter against user authorization.
 * Returns the effective branchId to query, or undefined for all branches.
 */
async function resolveBranchFilter(
  user: AuthUser,
  requestedBranchId?: string
): Promise<{ branchId?: string; error?: string }> {
  const scope = await getAuthorizedBranchScope(user);

  if (scope.isAllBranches) {
    if (requestedBranchId && requestedBranchId !== 'all') {
      return { branchId: requestedBranchId };
    }
    return { branchId: undefined };
  }

  if (scope.branchIds.length === 0) {
    return { error: 'No branch assigned to your account' };
  }

  const userBranchId = scope.branchIds[0];
  if (requestedBranchId && requestedBranchId !== 'all' && requestedBranchId !== userBranchId) {
    return { error: 'You are not authorized to view data for this branch' };
  }

  return { branchId: userBranchId };
}

/**
 * Get branches accessible by the current user.
 */
export async function getReportBranches(): Promise<
  ActionResult<Array<{ id: string; name: string; code: string }>>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (scope.isAllBranches) {
      const branches = await prisma.branch.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      });
      return { success: true, data: branches };
    }

    if (scope.branchIds.length === 0) {
      return { success: true, data: [] };
    }

    const branches = await prisma.branch.findMany({
      where: { id: { in: scope.branchIds }, status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });
    return { success: true, data: branches };
  } catch (error) {
    console.error('Error fetching report branches:', error);
    return { success: false, error: 'Failed to fetch branches' };
  }
}

// ─── Component 3: Sales Actions (require report.sales.read) ──────────────────

/**
 * Get Sales Overview KPI metrics.
 */
export async function getSalesOverview(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<SalesOverview>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('today');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const orderWhere: Record<string, unknown> = {
      createdAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) orderWhere.branchId = branchId;

    // 1. Order counts
    const [totalOrders, completedOrders, cancelledOrders] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.count({
        where: { ...orderWhere, status: { in: ['COMPLETED', 'REFUNDED'] } },
      }),
      prisma.order.count({
        where: { ...orderWhere, status: 'CANCELLED' },
      }),
    ]);

    // 2. Completed order financial aggregation
    const orderAgg = await prisma.order.aggregate({
      where: { ...orderWhere, status: { in: ['COMPLETED', 'REFUNDED'] } },
      _sum: {
        totalAmount: true,
        discountAmount: true,
        taxAmount: true,
        deliveryCharge: true,
      },
    });

    const grossSales = Number(orderAgg._sum.totalAmount || 0);
    const discounts = Number(orderAgg._sum.discountAmount || 0);
    const taxCollected = Number(orderAgg._sum.taxAmount || 0);
    const deliveryCharges = Number(orderAgg._sum.deliveryCharge || 0);

    // 3. Refunds aggregation
    const refundWhere: Record<string, unknown> = {
      status: 'SUCCESS',
      processedAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) {
      refundWhere.payment = { branchId };
    }

    const refundAgg = await prisma.paymentRefund.aggregate({
      where: refundWhere,
      _sum: { amount: true },
    });
    const refunds = Number(refundAgg._sum.amount || 0);

    // Net Revenue = Gross Sales - Discounts - Refunds
    const netRevenue = Math.max(0, grossSales - discounts - refunds);
    const averageOrderValue = safeDivide(netRevenue, completedOrders);

    // 4. Payment aggregation
    const paymentWhere: Record<string, unknown> = {
      processedAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) paymentWhere.branchId = branchId;

    const [successPayAgg, failedPayAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...paymentWhere, status: 'FAILED' },
        _sum: { amount: true },
      }),
    ]);

    const successfulPayments = Number(successPayAgg._sum.amount || 0);
    const failedPayments = Number(failedPayAgg._sum.amount || 0);

    // 5. Expenses aggregation (only APPROVED)
    const expenseWhere: Record<string, unknown> = {
      status: 'APPROVED',
      expenseDate: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) expenseWhere.branchId = branchId;

    const expenseAgg = await prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    });
    const approvedExpenses = Number(expenseAgg._sum.amount || 0);

    // 6. Salary aggregation (only APPROVED or PAID with overlapping period)
    const salaryWhere: Record<string, unknown> = {
      status: { in: ['APPROVED', 'PAID'] },
      periodStart: { lte: endDateTime },
      periodEnd: { gte: startDateTime },
    };
    if (branchId) salaryWhere.branchId = branchId;

    const salaryAgg = await prisma.salaryRecord.aggregate({
      where: salaryWhere,
      _sum: { grossAmount: true },
    });
    const approvedSalary = Number(salaryAgg._sum.grossAmount || 0);

    // Operating Result = Net Revenue - Approved Expenses - Approved Salary
    const operatingResult = netRevenue - approvedExpenses - approvedSalary;

    return {
      success: true,
      data: {
        totalOrders,
        completedOrders,
        cancelledOrders,
        grossSales,
        discounts,
        taxCollected,
        deliveryCharges,
        refunds,
        netRevenue,
        successfulPayments,
        failedPayments,
        approvedExpenses,
        approvedSalary,
        operatingResult,
        averageOrderValue,
      },
    };
  } catch (error) {
    console.error('Error in getSalesOverview:', error);
    return { success: false, error: 'Failed to calculate sales overview' };
  }
}

/**
 * Get daily sales metrics table.
 */
export async function getDailySalesMetrics(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<DailySalesRow[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('month');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const orderWhere: Record<string, unknown> = {
      createdAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) orderWhere.branchId = branchId;

    // Fetch all orders in the range
    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        createdAt: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
      },
    });

    // Fetch refunds in the range
    const refundWhere: Record<string, unknown> = {
      status: 'SUCCESS',
      processedAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) refundWhere.payment = { branchId };

    const refunds = await prisma.paymentRefund.findMany({
      where: refundWhere,
      select: {
        processedAt: true,
        amount: true,
      },
    });

    // Group by YYYY-MM-DD
    const dateMap = new Map<
      string,
      {
        totalOrders: number;
        completedOrders: number;
        cancelledOrders: number;
        grossSales: number;
        discounts: number;
        refunds: number;
      }
    >();

    // Initialize all dates in range so there are no gaps
    const current = new Date(startDateTime);
    while (current <= endDateTime) {
      const dateKey = formatDateLocal(current);
      dateMap.set(dateKey, {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
      });
      current.setDate(current.getDate() + 1);
    }

    // Populate order metrics
    for (const order of orders) {
      const dateKey = formatDateLocal(order.createdAt);
      const entry = dateMap.get(dateKey) || {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        grossSales: 0,
        discounts: 0,
        refunds: 0,
      };
      entry.totalOrders += 1;
      if (order.status === 'COMPLETED' || order.status === 'REFUNDED') {
        entry.completedOrders += 1;
        entry.grossSales += Number(order.totalAmount || 0);
        entry.discounts += Number(order.discountAmount || 0);
      } else if (order.status === 'CANCELLED') {
        entry.cancelledOrders += 1;
      }
      dateMap.set(dateKey, entry);
    }

    // Populate refund metrics
    for (const ref of refunds) {
      const dateKey = formatDateLocal(ref.processedAt);
      const entry = dateMap.get(dateKey);
      if (entry) {
        entry.refunds += Number(ref.amount || 0);
      }
    }

    // Convert map to sorted DailySalesRow array (descending date)
    const result: DailySalesRow[] = Array.from(dateMap.entries())
      .map(([date, data]) => {
        const netSales = Math.max(0, data.grossSales - data.discounts - data.refunds);
        const aov = safeDivide(netSales, data.completedOrders);
        return {
          date,
          totalOrders: data.totalOrders,
          completedOrders: data.completedOrders,
          cancelledOrders: data.cancelledOrders,
          grossSales: Math.round(data.grossSales * 100) / 100,
          discounts: Math.round(data.discounts * 100) / 100,
          refunds: Math.round(data.refunds * 100) / 100,
          netSales: Math.round(netSales * 100) / 100,
          averageOrderValue: Math.round(aov * 100) / 100,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getDailySalesMetrics:', error);
    return { success: false, error: 'Failed to fetch daily sales metrics' };
  }
}

/**
 * Get sales breakdown by order type (DINE_IN, TAKEAWAY, DELIVERY).
 */
export async function getOrderTypeSales(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<OrderTypeSalesRow[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('today');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const where: Record<string, unknown> = {
      status: { in: ['COMPLETED', 'REFUNDED'] },
      createdAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) where.branchId = branchId;

    const grouped = await prisma.order.groupBy({
      by: ['orderType'],
      where,
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const totalOrdersCount = grouped.reduce((sum, g) => sum + g._count.id, 0);

    const typeMap = new Map<string, { count: number; revenue: number }>();
    grouped.forEach((g) => {
      typeMap.set(g.orderType, {
        count: g._count.id,
        revenue: Number(g._sum.totalAmount || 0),
      });
    });

    const orderTypes: Array<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'> = [
      'DINE_IN',
      'TAKEAWAY',
      'DELIVERY',
    ];

    const result: OrderTypeSalesRow[] = orderTypes.map((type) => {
      const data = typeMap.get(type) || { count: 0, revenue: 0 };
      return {
        orderType: type,
        orderCount: data.count,
        revenue: Math.round(data.revenue * 100) / 100,
        percentage:
          totalOrdersCount > 0
            ? Math.round((data.count / totalOrdersCount) * 1000) / 10
            : 0,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getOrderTypeSales:', error);
    return { success: false, error: 'Failed to fetch order type breakdown' };
  }
}

/**
 * Get payment method breakdown.
 */
export async function getPaymentMethodBreakdown(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<PaymentMethodBreakdown>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('today');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const paymentWhere: Record<string, unknown> = {
      processedAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) paymentWhere.branchId = branchId;

    // Successful payments grouped by method
    const methodsGrouped = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        ...paymentWhere,
        status: 'SUCCESS',
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const methods = methodsGrouped.map((m) => ({
      method: m.method,
      count: m._count.id,
      amount: Math.round(Number(m._sum.amount || 0) * 100) / 100,
    }));

    // Failed payments
    const failedAgg = await prisma.payment.aggregate({
      where: {
        ...paymentWhere,
        status: 'FAILED',
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    // Refunded payments
    const refundWhere: Record<string, unknown> = {
      status: 'SUCCESS',
      processedAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) refundWhere.payment = { branchId };

    const refundAgg = await prisma.paymentRefund.aggregate({
      where: refundWhere,
      _sum: { amount: true },
    });

    return {
      success: true,
      data: {
        methods,
        failedPayments: {
          count: failedAgg._count.id || 0,
          amount: Math.round(Number(failedAgg._sum.amount || 0) * 100) / 100,
        },
        refundedAmount: Math.round(Number(refundAgg._sum.amount || 0) * 100) / 100,
      },
    };
  } catch (error) {
    console.error('Error in getPaymentMethodBreakdown:', error);
    return { success: false, error: 'Failed to fetch payment method breakdown' };
  }
}

/**
 * Get hourly sales breakdown for a single day or range.
 */
export async function getHourlySalesBreakdown(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<HourlyBreakdownRow[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('today');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const orderWhere: Record<string, unknown> = {
      status: { in: ['COMPLETED', 'REFUNDED'] },
      createdAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) orderWhere.branchId = branchId;

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    // Initialize 24 hours
    const hourlyMap = new Map<number, { count: number; sales: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { count: 0, sales: 0 });
    }

    for (const o of orders) {
      const h = o.createdAt.getHours();
      const current = hourlyMap.get(h)!;
      current.count += 1;
      current.sales += Number(o.totalAmount || 0);
    }

    const result: HourlyBreakdownRow[] = [];
    for (let h = 0; h < 24; h++) {
      const data = hourlyMap.get(h)!;
      result.push({
        hour: h,
        orderCount: data.count,
        sales: Math.round(data.sales * 100) / 100,
      });
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getHourlySalesBreakdown:', error);
    return { success: false, error: 'Failed to fetch hourly sales' };
  }
}

/**
 * Get revenue over time points for trend charting.
 */
export async function getRevenueOverTime(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<RevenueTimePoint[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('month');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const orderWhere: Record<string, unknown> = {
      status: { in: ['COMPLETED', 'REFUNDED'] },
      createdAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) orderWhere.branchId = branchId;

    const orders = await prisma.order.findMany({
      where: orderWhere,
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const timeMap = new Map<string, { revenue: number; orders: number }>();
    const current = new Date(startDateTime);
    while (current <= endDateTime) {
      const key = formatDateLocal(current);
      timeMap.set(key, { revenue: 0, orders: 0 });
      current.setDate(current.getDate() + 1);
    }

    for (const o of orders) {
      const key = formatDateLocal(o.createdAt);
      const entry = timeMap.get(key);
      if (entry) {
        entry.revenue += Number(o.totalAmount || 0);
        entry.orders += 1;
      }
    }

    const result: RevenueTimePoint[] = Array.from(timeMap.entries())
      .map(([date, val]) => ({
        date,
        revenue: Math.round(val.revenue * 100) / 100,
        orders: val.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getRevenueOverTime:', error);
    return { success: false, error: 'Failed to fetch revenue over time' };
  }
}

// ─── Branch Sales Comparison (require report.branch.read) ───────────────────

/**
 * Compare sales performance across branches.
 */
export async function getBranchSalesComparison(params?: {
  dateRange?: ReportDateRange;
}): Promise<ActionResult<BranchSalesRow[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_BRANCH_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const scope = await getAuthorizedBranchScope(user);
    const branchQuery = scope.isAllBranches
      ? { status: 'ACTIVE' as const }
      : { id: { in: scope.branchIds }, status: 'ACTIVE' as const };

    const branches = await prisma.branch.findMany({
      where: branchQuery,
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    const range = params?.dateRange || getDateRangeFromPreset('month');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const rows: BranchSalesRow[] = [];

    for (const b of branches) {
      const [orderAgg, countAgg, refundAgg, expenseAgg] = await Promise.all([
        prisma.order.aggregate({
          where: {
            branchId: b.id,
            status: { in: ['COMPLETED', 'REFUNDED'] },
            createdAt: { gte: startDateTime, lte: endDateTime },
          },
          _sum: { totalAmount: true, discountAmount: true },
        }),
        prisma.order.count({
          where: {
            branchId: b.id,
            status: { in: ['COMPLETED', 'REFUNDED'] },
            createdAt: { gte: startDateTime, lte: endDateTime },
          },
        }),
        prisma.paymentRefund.aggregate({
          where: {
            status: 'SUCCESS',
            payment: { branchId: b.id },
            processedAt: { gte: startDateTime, lte: endDateTime },
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            branchId: b.id,
            status: 'APPROVED',
            expenseDate: { gte: startDateTime, lte: endDateTime },
          },
          _sum: { amount: true },
        }),
      ]);

      const gross = Number(orderAgg._sum.totalAmount || 0);
      const disc = Number(orderAgg._sum.discountAmount || 0);
      const ref = Number(refundAgg._sum.amount || 0);
      const net = Math.max(0, gross - disc - ref);
      const exp = Number(expenseAgg._sum.amount || 0);

      rows.push({
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        orderCount: countAgg,
        grossSales: Math.round(gross * 100) / 100,
        refunds: Math.round(ref * 100) / 100,
        netSales: Math.round(net * 100) / 100,
        expenses: Math.round(exp * 100) / 100,
        operatingResult: Math.round((net - exp) * 100) / 100,
      });
    }

    return { success: true, data: rows };
  } catch (error) {
    console.error('Error in getBranchSalesComparison:', error);
    return { success: false, error: 'Failed to fetch branch comparison' };
  }
}

// ─── Product & Category Sales (require report.product.read) ──────────────────

/**
 * Get product-level sales metrics.
 * Uses OrderItem.unitPrice for historical accuracy.
 */
export async function getProductSales(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
  categoryId?: string;
}): Promise<ActionResult<ProductSalesRow[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_PRODUCT_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('month');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const orderWhere: Record<string, unknown> = {
      status: { in: ['COMPLETED', 'REFUNDED'] },
      createdAt: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) orderWhere.branchId = branchId;

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: orderWhere,
        ...(params?.categoryId ? { menuItem: { categoryId: params.categoryId } } : {}),
      },
      select: {
        orderId: true,
        menuItemId: true,
        itemName: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        totalPrice: true,
        menuItem: {
          select: {
            id: true,
            name: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const itemMap = new Map<
      string,
      {
        menuItemId: string;
        menuItemName: string;
        categoryId: string;
        categoryName: string;
        quantitySold: number;
        grossSales: number;
        discounts: number;
        netSales: number;
        orderIds: Set<string>;
      }
    >();

    for (const oi of orderItems) {
      const mId = oi.menuItemId;
      const entry = itemMap.get(mId) || {
        menuItemId: mId,
        menuItemName: oi.itemName || oi.menuItem?.name || 'Unknown Item',
        categoryId: oi.menuItem?.categoryId || 'uncategorized',
        categoryName: oi.menuItem?.category?.name || 'Uncategorized',
        quantitySold: 0,
        grossSales: 0,
        discounts: 0,
        netSales: 0,
        orderIds: new Set<string>(),
      };

      const qty = Number(oi.quantity);
      const unitP = Number(oi.unitPrice);
      const disc = Number(oi.discountAmount || 0);
      const total = Number(oi.totalPrice);

      entry.quantitySold += qty;
      entry.grossSales += qty * unitP;
      entry.discounts += disc;
      entry.netSales += total;
      entry.orderIds.add(oi.orderId);

      itemMap.set(mId, entry);
    }

    const result: ProductSalesRow[] = Array.from(itemMap.values())
      .map((item) => ({
        menuItemId: item.menuItemId,
        menuItemName: item.menuItemName,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        quantitySold: item.quantitySold,
        grossSales: Math.round(item.grossSales * 100) / 100,
        discounts: Math.round(item.discounts * 100) / 100,
        netSales: Math.round(item.netSales * 100) / 100,
        orderCount: item.orderIds.size,
      }))
      .sort((a, b) => b.netSales - a.netSales);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getProductSales:', error);
    return { success: false, error: 'Failed to fetch product sales' };
  }
}

/**
 * Get category sales summary.
 */
export async function getCategorySales(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<CategorySalesRow[]>> {
  try {
    const prodRes = await getProductSales(params);
    if (!prodRes.success) return { success: false, error: prodRes.error };

    const products = prodRes.data;
    const catMap = new Map<
      string,
      { categoryId: string; categoryName: string; quantitySold: number; revenue: number }
    >();

    let totalRevenue = 0;

    for (const p of products) {
      totalRevenue += p.netSales;
      const c = catMap.get(p.categoryId) || {
        categoryId: p.categoryId,
        categoryName: p.categoryName,
        quantitySold: 0,
        revenue: 0,
      };
      c.quantitySold += p.quantitySold;
      c.revenue += p.netSales;
      catMap.set(p.categoryId, c);
    }

    const result: CategorySalesRow[] = Array.from(catMap.values())
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        quantitySold: c.quantitySold,
        revenue: Math.round(c.revenue * 100) / 100,
        percentage:
          totalRevenue > 0
            ? Math.round((c.revenue / totalRevenue) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error in getCategorySales:', error);
    return { success: false, error: 'Failed to fetch category sales' };
  }
}

// ─── Financial & P&L Reporting (require report.finance.read) ────────────────

/**
 * Get Profit & Loss Statement (Operational Management View).
 */
export async function calculateProfitLossData(
  params: { branchId?: string; dateRange?: ReportDateRange } | undefined,
  user: AuthUser
): Promise<ProfitLossStatement> {
  const branchRes = await resolveBranchFilter(user, params?.branchId);
  if (branchRes.error) throw new Error(branchRes.error);
  const branchId = branchRes.branchId;

  const range = params?.dateRange || getDateRangeFromPreset('month');
  const { startDateTime, endDateTime } = parseDateRange(range);

  let branchName: string | null = null;
  if (branchId) {
    const b = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true },
    });
    branchName = b?.name || null;
  }

  // 1. Revenue components
  const orderWhere: Record<string, unknown> = {
    status: { in: ['COMPLETED', 'REFUNDED'] },
    createdAt: { gte: startDateTime, lte: endDateTime },
  };
  if (branchId) orderWhere.branchId = branchId;

  const orderAgg = await prisma.order.aggregate({
    where: orderWhere,
    _sum: {
      totalAmount: true,
      discountAmount: true,
      taxAmount: true,
      deliveryCharge: true,
    },
  });

  const grossSales = Number(orderAgg._sum.totalAmount || 0);
  const discounts = Number(orderAgg._sum.discountAmount || 0);
  const taxCollected = Number(orderAgg._sum.taxAmount || 0);
  const deliveryCharges = Number(orderAgg._sum.deliveryCharge || 0);

  const refundWhere: Record<string, unknown> = {
    status: 'SUCCESS',
    processedAt: { gte: startDateTime, lte: endDateTime },
  };
  if (branchId) refundWhere.payment = { branchId };

  const refundAgg = await prisma.paymentRefund.aggregate({
    where: refundWhere,
    _sum: { amount: true },
  });
  const refunds = Number(refundAgg._sum.amount || 0);

  const netRevenue = Math.max(0, grossSales - discounts - refunds);

  // 2. Costs components
  const expenseWhere: Record<string, unknown> = {
    status: 'APPROVED',
    expenseDate: { gte: startDateTime, lte: endDateTime },
  };
  if (branchId) expenseWhere.branchId = branchId;

  const expenseByCategory = await prisma.expense.groupBy({
    by: ['categoryId'],
    where: expenseWhere,
    _sum: { amount: true },
  });

  const categoryIds = expenseByCategory.map((e) => e.categoryId);
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

  let approvedExpenses = 0;
  const expenseCategories = expenseByCategory.map((e) => {
    const amt = Number(e._sum.amount || 0);
    approvedExpenses += amt;
    return {
      categoryName: catNameMap.get(e.categoryId) || 'General Expense',
      amount: Math.round(amt * 100) / 100,
    };
  });

  // Salary costs
  const salaryWhere: Record<string, unknown> = {
    status: { in: ['APPROVED', 'PAID'] },
    periodStart: { lte: endDateTime },
    periodEnd: { gte: startDateTime },
  };
  if (branchId) salaryWhere.branchId = branchId;

  const salaryAgg = await prisma.salaryRecord.aggregate({
    where: salaryWhere,
    _sum: { grossAmount: true },
  });
  const approvedSalary = Number(salaryAgg._sum.grossAmount || 0);

  const totalCosts = approvedExpenses + approvedSalary;
  const operatingResult = netRevenue - totalCosts;

  return {
    grossSales: Math.round(grossSales * 100) / 100,
    discounts: Math.round(discounts * 100) / 100,
    refunds: Math.round(refunds * 100) / 100,
    taxCollected: Math.round(taxCollected * 100) / 100,
    deliveryCharges: Math.round(deliveryCharges * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    approvedExpenses: Math.round(approvedExpenses * 100) / 100,
    expenseCategories,
    approvedSalary: Math.round(approvedSalary * 100) / 100,
    totalCosts: Math.round(totalCosts * 100) / 100,
    operatingResult: Math.round(operatingResult * 100) / 100,
    dateRange: range,
    branchName,
  };
}

export async function getProfitLossData(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<ProfitLossStatement>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_FINANCE_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const data = await calculateProfitLossData(params, user);
    return { success: true, data };
  } catch (error) {
    console.error('Error in getProfitLossData:', error);
    return { success: false, error: 'Failed to calculate Profit & Loss statement' };
  }
}

/**
 * Get approved expenses breakdown for reporting.
 */
export async function getExpenseBreakdown(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<
  ActionResult<Array<{ categoryName: string; amount: number; percentage: number }>>
> {
  try {
    const plRes = await getProfitLossData(params);
    if (!plRes.success) return { success: false, error: plRes.error };

    const total = plRes.data.approvedExpenses;
    const list = plRes.data.expenseCategories.map((c) => ({
      categoryName: c.categoryName,
      amount: c.amount,
      percentage:
        total > 0 ? Math.round((c.amount / total) * 1000) / 10 : 0,
    }));

    return { success: true, data: list };
  } catch (error) {
    console.error('Error in getExpenseBreakdown:', error);
    return { success: false, error: 'Failed to fetch expense breakdown' };
  }
}

/**
 * Get salary records included in the financial period.
 */
export async function getSalaryBreakdown(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<
  ActionResult<
    Array<{
      id: string;
      salaryNumber: string;
      employeeName: string;
      branchName: string;
      periodStart: string;
      periodEnd: string;
      baseSalary: number;
      bonusAmount: number;
      incentiveAmount: number;
      grossAmount: number;
      status: string;
    }>
  >
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_FINANCE_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('month');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const salaryWhere: Record<string, unknown> = {
      status: { in: ['APPROVED', 'PAID'] },
      periodStart: { lte: endDateTime },
      periodEnd: { gte: startDateTime },
    };
    if (branchId) salaryWhere.branchId = branchId;

    const records = await prisma.salaryRecord.findMany({
      where: salaryWhere,
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
          },
        },
        branch: { select: { name: true } },
      },
      orderBy: { periodStart: 'desc' },
    });

    const data = records.map((r) => ({
      id: r.id,
      salaryNumber: r.salaryNumber,
      employeeName: r.employee?.user?.name || 'Unknown',
      branchName: r.branch.name,
      periodStart: r.periodStart.toISOString().split('T')[0],
      periodEnd: r.periodEnd.toISOString().split('T')[0],
      baseSalary: Number(r.baseSalary),
      bonusAmount: Number(r.bonusAmount),
      incentiveAmount: Number(r.incentiveAmount),
      grossAmount: Number(r.grossAmount),
      status: r.status,
    }));

    return { success: true, data };
  } catch (error) {
    console.error('Error in getSalaryBreakdown:', error);
    return { success: false, error: 'Failed to fetch salary breakdown' };
  }
}

/**
 * Get purchase order report.
 * Shown separately from P&L per business rules.
 */
export async function getPurchaseReport(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<PurchaseReportRow[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_FINANCE_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const range = params?.dateRange || getDateRangeFromPreset('month');
    const { startDateTime, endDateTime } = parseDateRange(range);

    const purchaseWhere: Record<string, unknown> = {
      orderDate: { gte: startDateTime, lte: endDateTime },
    };
    if (branchId) purchaseWhere.branchId = branchId;

    const purchases = await prisma.purchaseOrder.findMany({
      where: purchaseWhere,
      include: {
        supplier: { select: { name: true } },
        branch: { select: { name: true, code: true } },
        items: {
          select: {
            orderedQuantity: true,
            receivedQuantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    const rows: PurchaseReportRow[] = purchases.map((p) => {
      let totalAmount = 0;
      let receivedAmount = 0;

      for (const item of p.items) {
        const up = Number(item.unitPrice);
        totalAmount += Number(item.orderedQuantity) * up;
        receivedAmount += Number(item.receivedQuantity) * up;
      }

      return {
        purchaseOrderId: p.id,
        purchaseNumber: p.purchaseNumber,
        supplierName: p.supplier.name,
        branchName: p.branch.name,
        branchCode: p.branch.code,
        orderDate: p.orderDate.toISOString().split('T')[0],
        status: p.status,
        totalAmount: Math.round(totalAmount * 100) / 100,
        receivedAmount: Math.round(receivedAmount * 100) / 100,
      };
    });

    return { success: true, data: rows };
  } catch (error) {
    console.error('Error in getPurchaseReport:', error);
    return { success: false, error: 'Failed to fetch purchase report' };
  }
}

// ─── Component 8: Owner Dashboard Data ───────────────────────────────────────

/**
 * Get operational dashboard data for today.
 */
export async function getDashboardData(params?: {
  branchId?: string;
}): Promise<ActionResult<DashboardData>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.DASHBOARD_READ)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const todayRange = getDateRangeFromPreset('today');
    const branchRes = await resolveBranchFilter(user, params?.branchId);
    if (branchRes.error) return { success: false, error: branchRes.error };
    const branchId = branchRes.branchId;

    const [
      salesRes,
      paymentRes,
      orderTypeRes,
      branchCompRes,
      prodRes,
      pendingExpenses,
      pendingSalaries,
      lowStockItems,
    ] = await Promise.all([
      getSalesOverview({ branchId, dateRange: todayRange }),
      getPaymentMethodBreakdown({ branchId, dateRange: todayRange }),
      getOrderTypeSales({ branchId, dateRange: todayRange }),
      hasPermission(user, PERMISSIONS.REPORT_BRANCH_READ)
        ? getBranchSalesComparison({ dateRange: todayRange })
        : Promise.resolve({ success: true, data: [] }),
      getProductSales({ branchId, dateRange: todayRange }),
      prisma.expense.count({
        where: {
          status: 'PENDING_APPROVAL',
          ...(branchId ? { branchId } : {}),
        },
      }),
      prisma.salaryRecord.count({
        where: {
          status: 'PENDING_REVIEW',
          ...(branchId ? { branchId } : {}),
        },
      }),
      // Low stock count: inventory items where minimumStock > 0
      prisma.inventoryItem.count({
        where: {
          status: 'ACTIVE',
          reorderLevel: { gt: 0 },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const sales = salesRes.success ? salesRes.data : null;

    const topSellingItems = prodRes.success
      ? prodRes.data.slice(0, 5).map((p) => ({
          menuItemName: p.menuItemName,
          quantitySold: p.quantitySold,
          revenue: p.netSales,
        }))
      : [];

    return {
      success: true,
      data: {
        todaySales: sales?.netRevenue ?? 0,
        todayOrders: sales?.completedOrders ?? 0,
        todayExpenses: sales?.approvedExpenses ?? 0,
        operatingResult: sales?.operatingResult ?? 0,
        paymentBreakdown: paymentRes.success ? paymentRes.data.methods : [],
        orderTypeBreakdown: orderTypeRes.success ? orderTypeRes.data : [],
        branchOverview: branchCompRes.success ? branchCompRes.data : [],
        topSellingItems,
        lowStockCount: lowStockItems,
        pendingExpenseApprovals: pendingExpenses,
        pendingSalaryReviews: pendingSalaries,
      },
    };
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    return { success: false, error: 'Failed to fetch dashboard data' };
  }
}

// ─── CSV Export Server Actions ──────────────────────────────────────────────

/**
 * Generate CSV string for sales report.
 */
export async function exportSalesCSV(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_EXPORT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to export sales' };
    }

    const res = await getDailySalesMetrics(params);
    if (!res.success) return { success: false, error: res.error };

    const csv = toCSV(res.data, [
      { key: 'date', header: 'Date' },
      { key: 'totalOrders', header: 'Total Orders' },
      { key: 'completedOrders', header: 'Completed Orders' },
      { key: 'cancelledOrders', header: 'Cancelled Orders' },
      { key: 'grossSales', header: 'Gross Sales (INR)' },
      { key: 'discounts', header: 'Discounts (INR)' },
      { key: 'refunds', header: 'Refunds (INR)' },
      { key: 'netSales', header: 'Net Sales (INR)' },
      { key: 'averageOrderValue', header: 'AOV (INR)' },
    ]);

    return { success: true, data: csv };
  } catch (error) {
    console.error('Error in exportSalesCSV:', error);
    return { success: false, error: 'Failed to export sales data' };
  }
}

/**
 * Generate CSV string for product sales report.
 */
export async function exportProductSalesCSV(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_EXPORT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to export sales' };
    }

    const res = await getProductSales(params);
    if (!res.success) return { success: false, error: res.error };

    const csv = toCSV(res.data, [
      { key: 'menuItemName', header: 'Menu Item' },
      { key: 'categoryName', header: 'Category' },
      { key: 'quantitySold', header: 'Quantity Sold' },
      { key: 'grossSales', header: 'Gross Sales (INR)' },
      { key: 'discounts', header: 'Discounts (INR)' },
      { key: 'netSales', header: 'Net Sales (INR)' },
      { key: 'orderCount', header: 'Orders Count' },
    ]);

    return { success: true, data: csv };
  } catch (error) {
    console.error('Error in exportProductSalesCSV:', error);
    return { success: false, error: 'Failed to export product sales data' };
  }
}

/**
 * Generate CSV string for financial P&L report.
 */
export async function exportFinancialReportCSV(params?: {
  branchId?: string;
  dateRange?: ReportDateRange;
}): Promise<ActionResult<string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_FINANCE_EXPORT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions to export finance' };
    }

    const res = await getProfitLossData(params);
    if (!res.success) return { success: false, error: res.error };

    const d = res.data;
    const lines = [
      'Line Item,Amount (INR)',
      `Gross Sales,${d.grossSales}`,
      `Discounts,${d.discounts}`,
      `Refunds,${d.refunds}`,
      `Tax Collected,${d.taxCollected}`,
      `Delivery Charges,${d.deliveryCharges}`,
      `Net Revenue,${d.netRevenue}`,
      `Approved Operating Expenses,${d.approvedExpenses}`,
      ...d.expenseCategories.map((c) => `  - ${c.categoryName},${c.amount}`),
      `Approved Salary Costs,${d.approvedSalary}`,
      `Total Operating Costs,${d.totalCosts}`,
      `Operating Result,${d.operatingResult}`,
    ];

    return { success: true, data: lines.join('\n') };
  } catch (error) {
    console.error('Error in exportFinancialReportCSV:', error);
    return { success: false, error: 'Failed to export financial data' };
  }
}

/**
 * Generate CSV string for branch sales comparison.
 */
export async function exportBranchSummaryCSV(params?: {
  dateRange?: ReportDateRange;
}): Promise<ActionResult<string>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasPermission(user, PERMISSIONS.REPORT_SALES_EXPORT)) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }

    const res = await getBranchSalesComparison(params);
    if (!res.success) return { success: false, error: res.error };

    const csv = toCSV(res.data, [
      { key: 'branchName', header: 'Branch Name' },
      { key: 'branchCode', header: 'Branch Code' },
      { key: 'orderCount', header: 'Orders' },
      { key: 'grossSales', header: 'Gross Sales (INR)' },
      { key: 'refunds', header: 'Refunds (INR)' },
      { key: 'netSales', header: 'Net Sales (INR)' },
      { key: 'expenses', header: 'Expenses (INR)' },
      { key: 'operatingResult', header: 'Operating Result (INR)' },
    ]);

    return { success: true, data: csv };
  } catch (error) {
    console.error('Error in exportBranchSummaryCSV:', error);
    return { success: false, error: 'Failed to export branch summary' };
  }
}

// ─── Step 18: Standardized Report Actions & Exports ──────────────────────────

export type ExportActionResult =
  | { success: true; csv: string; filename: string; error?: undefined }
  | { success: false; error: string; csv?: undefined; filename?: undefined };

async function resolveReportContext(user: AuthUser, requestedBranchId?: string) {
  const [branchesRes, scope] = await Promise.all([
    getReportBranches(),
    getAuthorizedBranchScope(user),
  ]);
  const branches = branchesRes.success ? branchesRes.data : [];
  const isBranchRestricted = !scope.isAllBranches;
  const selectedBranchId = isBranchRestricted
    ? (scope.branchIds[0] || 'all')
    : (requestedBranchId || 'all');

  return { branches, isBranchRestricted, selectedBranchId };
}

// 1. Sales Report Action
export async function getSalesReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: SalesReportRow[];
  summary: SalesReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_SALES_READ, PERMISSIONS.REPORT_FINANCE_READ, PERMISSIONS.ORDER_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getSalesReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    return { success: true, data: { ...data, ...context } };
  } catch (error) {
    console.error('Error in getSalesReportAction:', error);
    return { success: false, error: 'Failed to generate sales report' };
  }
}

// 2. Orders Report Action
export async function getOrdersReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: OrdersReportRow[];
  summary: OrdersReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_ORDERS_READ, PERMISSIONS.ORDER_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getOrdersReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    return { success: true, data: { ...data, ...context } };
  } catch (error) {
    console.error('Error in getOrdersReportAction:', error);
    return { success: false, error: 'Failed to generate orders report' };
  }
}

// 3. Products Report Action
export async function getProductSalesReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: ProductsReportRow[];
  summary: ProductsReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  categories: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_PRODUCT_READ, PERMISSIONS.REPORT_SALES_READ, PERMISSIONS.MENU_ITEM_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context, categories] = await Promise.all([
      getProductSalesReportData(params, user),
      resolveReportContext(user, params.branchId),
      prisma.menuCategory.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return { success: true, data: { ...data, ...context, categories } };
  } catch (error) {
    console.error('Error in getProductSalesReportAction:', error);
    return { success: false, error: 'Failed to generate product sales report' };
  }
}

// 4. Branch Benchmark Report Action
export async function getBranchesReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: BranchReportRow[];
  summary: BranchReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_BRANCH_READ, PERMISSIONS.REPORT_SALES_READ, PERMISSIONS.BRANCH_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getBranchesReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    const pagination: PaginationMeta = {
      page: params.page || 1,
      limit: params.limit || 25,
      total: data.rows.length,
      totalPages: 1,
    };
    return {
      success: true,
      data: {
        rows: data.rows,
        summary: data.summary,
        pagination,
        branches: context.branches,
        isBranchRestricted: context.isBranchRestricted,
      },
    };
  } catch (error) {
    console.error('Error in getBranchesReportAction:', error);
    return { success: false, error: 'Failed to generate branch report' };
  }
}

// 5. Payment Report Action
export async function getPaymentsReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: PaymentsReportRow[];
  summary: PaymentsReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_PAYMENT_READ, PERMISSIONS.REPORT_FINANCE_READ, PERMISSIONS.PAYMENT_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getPaymentsReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    return { success: true, data: { ...data, ...context } };
  } catch (error) {
    console.error('Error in getPaymentsReportAction:', error);
    return { success: false, error: 'Failed to generate payment report' };
  }
}

// 6. Expense Report Action
export async function getExpensesReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: ExpensesReportRow[];
  summary: ExpensesReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  categories: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_EXPENSE_READ, PERMISSIONS.REPORT_FINANCE_READ, PERMISSIONS.EXPENSE_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context, categories] = await Promise.all([
      getExpensesReportData(params, user),
      resolveReportContext(user, params.branchId),
      prisma.expenseCategory.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { success: true, data: { ...data, ...context, categories } };
  } catch (error) {
    console.error('Error in getExpensesReportAction:', error);
    return { success: false, error: 'Failed to generate expense report' };
  }
}

// 7. Inventory Report Action
export async function getInventoryReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  currentStockRows: InventoryReportRow[];
  movementRows: StockMovementReportRow[];
  summary: InventoryReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  categories: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_INVENTORY_READ, PERMISSIONS.INVENTORY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [stockData, movementData, context, categories] = await Promise.all([
      getInventoryReportData(params, user),
      getStockMovementsReportData(params, user),
      resolveReportContext(user, params.branchId),
      prisma.menuCategory.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);
    return {
      success: true,
      data: {
        currentStockRows: stockData.rows,
        movementRows: movementData.rows,
        summary: stockData.summary,
        pagination: stockData.pagination,
        categories,
        ...context,
      },
    };
  } catch (error) {
    console.error('Error in getInventoryReportAction:', error);
    return { success: false, error: 'Failed to generate inventory report' };
  }
}

// 8. Purchase Report Action
export async function getPurchasesReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: PurchasesReportRow[];
  summary: PurchasesReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  suppliers: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_PURCHASE_READ, PERMISSIONS.PURCHASE_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context, suppliers] = await Promise.all([
      getPurchasesReportData(params, user),
      resolveReportContext(user, params.branchId),
      prisma.supplier.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { success: true, data: { ...data, ...context, suppliers } };
  } catch (error) {
    console.error('Error in getPurchasesReportAction:', error);
    return { success: false, error: 'Failed to generate purchase report' };
  }
}

// 9. Wastage Report Action
export async function getWastageReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: WastageReportRow[];
  summary: WastageReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_WASTAGE_READ, PERMISSIONS.INVENTORY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getWastageReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    return { success: true, data: { ...data, ...context } };
  } catch (error) {
    console.error('Error in getWastageReportAction:', error);
    return { success: false, error: 'Failed to generate wastage report' };
  }
}

// 10. Attendance Report Action
export async function getAttendanceReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: AttendanceReportRow[];
  summary: AttendanceReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  shifts: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context, shifts] = await Promise.all([
      getAttendanceReportData(params, user),
      resolveReportContext(user, params.branchId),
      prisma.shift.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { success: true, data: { ...data, ...context, shifts } };
  } catch (error) {
    console.error('Error in getAttendanceReportAction:', error);
    return { success: false, error: 'Failed to generate attendance report' };
  }
}

// 11. Compensation Report Action
export async function getCompensationReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: CompensationReportRow[];
  summary: CompensationReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_COMPENSATION_READ, PERMISSIONS.REPORT_FINANCE_READ, PERMISSIONS.SALARY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getCompensationReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    return { success: true, data: { ...data, ...context } };
  } catch (error) {
    console.error('Error in getCompensationReportAction:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to generate compensation report' };
  }
}

// 12. Customer Report Action
export async function getCustomersReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: CustomersReportRow[];
  summary: CustomersReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_CUSTOMER_READ, PERMISSIONS.CUSTOMER_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, branchesRes] = await Promise.all([
      getCustomersReportData(params, user),
      getReportBranches(),
    ]);
    const branches = branchesRes.success ? branchesRes.data : [];
    return { success: true, data: { ...data, branches } };
  } catch (error) {
    console.error('Error in getCustomersReportAction:', error);
    return { success: false, error: 'Failed to generate customers report' };
  }
}

// 13. Review Report Action
export async function getReviewsReportAction(
  params: ReportFilterParams
): Promise<ActionResult<{
  rows: ReviewsReportRow[];
  summary: ReviewsReportSummary;
  pagination: PaginationMeta;
  branches: Array<{ id: string; name: string; code: string }>;
  selectedBranchId: string;
  isBranchRestricted: boolean;
}>> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_REVIEW_READ, PERMISSIONS.REPORT_CUSTOMER_READ, PERMISSIONS.REVIEW_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const [data, context] = await Promise.all([
      getReviewsReportData(params, user),
      resolveReportContext(user, params.branchId),
    ]);
    return { success: true, data: { ...data, ...context } };
  } catch (error) {
    console.error('Error in getReviewsReportAction:', error);
    return { success: false, error: 'Failed to generate reviews report' };
  }
}

// ─── CSV Export Actions ──────────────────────────────────────────────────────

export async function exportSalesReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_SALES_EXPORT, PERMISSIONS.REPORT_SALES_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getSalesReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'date', header: 'Date' },
      { key: 'branchName', header: 'Branch' },
      { key: 'orderCount', header: 'Orders' },
      { key: 'grossSales', header: 'Gross Sales (INR)' },
      { key: 'discounts', header: 'Discounts (INR)' },
      { key: 'refunds', header: 'Refunds (INR)' },
      { key: 'netSales', header: 'Net Sales (INR)' },
      { key: 'averageOrderValue', header: 'AOV (INR)' },
    ]);
    const filename = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportSalesReportCSVAction:', error);
    return { success: false, error: 'Failed to export sales report CSV' };
  }
}

export async function exportOrdersReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_ORDERS_EXPORT, PERMISSIONS.REPORT_SALES_EXPORT, PERMISSIONS.ORDER_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getOrdersReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'orderNumber', header: 'Order #' },
      { key: 'createdAt', header: 'Date Time' },
      { key: 'branchName', header: 'Branch' },
      { key: 'orderType', header: 'Order Type' },
      { key: 'status', header: 'Status' },
      { key: 'customerName', header: 'Customer' },
      { key: 'subtotal', header: 'Subtotal (INR)' },
      { key: 'discountAmount', header: 'Discount (INR)' },
      { key: 'taxAmount', header: 'Tax (INR)' },
      { key: 'deliveryCharge', header: 'Delivery (INR)' },
      { key: 'totalAmount', header: 'Total (INR)' },
      { key: 'paymentStatus', header: 'Payment Status' },
    ]);
    const filename = `orders-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportOrdersReportCSVAction:', error);
    return { success: false, error: 'Failed to export orders report CSV' };
  }
}

export async function exportProductSalesReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_PRODUCT_EXPORT, PERMISSIONS.REPORT_SALES_EXPORT, PERMISSIONS.REPORT_PRODUCT_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getProductSalesReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'menuItemName', header: 'Menu Item' },
      { key: 'categoryName', header: 'Category' },
      { key: 'branchName', header: 'Branch' },
      { key: 'quantitySold', header: 'Quantity Sold' },
      { key: 'grossSales', header: 'Gross Sales (INR)' },
      { key: 'discounts', header: 'Discounts (INR)' },
      { key: 'netSales', header: 'Net Sales (INR)' },
    ]);
    const filename = `products-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportProductSalesReportCSVAction:', error);
    return { success: false, error: 'Failed to export product sales report CSV' };
  }
}
export const exportProductsReportCSVAction = exportProductSalesReportCSVAction;

export async function exportBranchesReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_BRANCH_EXPORT, PERMISSIONS.REPORT_SALES_EXPORT, PERMISSIONS.REPORT_BRANCH_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getBranchesReportData(params, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'branchName', header: 'Branch Name' },
      { key: 'branchCode', header: 'Branch Code' },
      { key: 'orderCount', header: 'Orders' },
      { key: 'netSales', header: 'Net Sales (INR)' },
      { key: 'averageOrderValue', header: 'AOV (INR)' },
      { key: 'successfulPayments', header: 'Payments Collected (INR)' },
      { key: 'approvedExpenses', header: 'Approved Expenses (INR)' },
      { key: 'operatingResult', header: 'Operating Result (INR)' },
    ]);
    const filename = `branches-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportBranchesReportCSVAction:', error);
    return { success: false, error: 'Failed to export branches report CSV' };
  }
}

export async function exportPaymentsReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_PAYMENT_EXPORT, PERMISSIONS.REPORT_SALES_EXPORT, PERMISSIONS.PAYMENT_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getPaymentsReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'paymentNumber', header: 'Payment #' },
      { key: 'orderNumber', header: 'Order #' },
      { key: 'branchName', header: 'Branch' },
      { key: 'createdAt', header: 'Date Time' },
      { key: 'amount', header: 'Amount (INR)' },
      { key: 'method', header: 'Method' },
      { key: 'status', header: 'Status' },
      { key: 'referenceNumber', header: 'Reference #' },
      { key: 'processedBy', header: 'Processed By' },
      { key: 'refundedAmount', header: 'Refunded (INR)' },
    ]);
    const filename = `payments-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportPaymentsReportCSVAction:', error);
    return { success: false, error: 'Failed to export payments report CSV' };
  }
}

export async function exportExpensesReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_EXPENSE_EXPORT, PERMISSIONS.REPORT_FINANCE_EXPORT, PERMISSIONS.EXPENSE_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getExpensesReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'expenseNumber', header: 'Expense #' },
      { key: 'date', header: 'Date' },
      { key: 'branchName', header: 'Branch' },
      { key: 'categoryName', header: 'Category' },
      { key: 'amount', header: 'Amount (INR)' },
      { key: 'paymentMethod', header: 'Payment Method' },
      { key: 'vendor', header: 'Vendor' },
      { key: 'status', header: 'Status' },
      { key: 'description', header: 'Description' },
    ]);
    const filename = `expenses-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportExpensesReportCSVAction:', error);
    return { success: false, error: 'Failed to export expenses report CSV' };
  }
}

export async function exportInventoryReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_INVENTORY_EXPORT, PERMISSIONS.INVENTORY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getInventoryReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'branchName', header: 'Branch' },
      { key: 'ingredientName', header: 'Ingredient' },
      { key: 'categoryName', header: 'Category' },
      { key: 'unit', header: 'Unit' },
      { key: 'currentStock', header: 'Current Stock' },
      { key: 'minStock', header: 'Min Stock' },
      { key: 'reorderLevel', header: 'Reorder Level' },
      { key: 'status', header: 'Health Status' },
      { key: 'lastMovementDate', header: 'Last Movement' },
    ]);
    const filename = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportInventoryReportCSVAction:', error);
    return { success: false, error: 'Failed to export inventory report CSV' };
  }
}

export async function exportStockMovementsReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_INVENTORY_EXPORT, PERMISSIONS.INVENTORY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getStockMovementsReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'createdAt', header: 'Date/Time' },
      { key: 'branchName', header: 'Branch' },
      { key: 'ingredientName', header: 'Ingredient' },
      { key: 'type', header: 'Type' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'unit', header: 'Unit' },
      { key: 'reference', header: 'Reference' },
      { key: 'notes', header: 'Notes' },
      { key: 'createdBy', header: 'Logged By' },
    ]);
    const filename = `stock-movements-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportStockMovementsReportCSVAction:', error);
    return { success: false, error: 'Failed to export stock movements report CSV' };
  }
}

export async function exportPurchasesReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_PURCHASE_EXPORT, PERMISSIONS.PURCHASE_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getPurchasesReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'purchaseNumber', header: 'PO #' },
      { key: 'supplierName', header: 'Supplier' },
      { key: 'branchName', header: 'Branch' },
      { key: 'orderDate', header: 'Order Date' },
      { key: 'expectedDate', header: 'Expected Date' },
      { key: 'status', header: 'Status' },
      { key: 'totalAmount', header: 'Ordered Value (INR)' },
      { key: 'receivedAmount', header: 'Received Value (INR)' },
      { key: 'itemCount', header: 'Item Lines' },
    ]);
    const filename = `purchases-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportPurchasesReportCSVAction:', error);
    return { success: false, error: 'Failed to export purchases report CSV' };
  }
}

export async function exportWastageReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_WASTAGE_EXPORT, PERMISSIONS.INVENTORY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getWastageReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'date', header: 'Date' },
      { key: 'branchName', header: 'Branch' },
      { key: 'ingredientName', header: 'Ingredient' },
      { key: 'quantity', header: 'Quantity' },
      { key: 'unit', header: 'Unit' },
      { key: 'reason', header: 'Reason' },
      { key: 'notes', header: 'Notes' },
      { key: 'createdBy', header: 'Logged By' },
    ]);
    const filename = `wastage-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportWastageReportCSVAction:', error);
    return { success: false, error: 'Failed to export wastage report CSV' };
  }
}

export async function exportAttendanceReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_ATTENDANCE_EXPORT, PERMISSIONS.ATTENDANCE_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getAttendanceReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'date', header: 'Date' },
      { key: 'branchName', header: 'Branch' },
      { key: 'employeeName', header: 'Employee' },
      { key: 'employeeCode', header: 'Employee Code' },
      { key: 'designation', header: 'Designation' },
      { key: 'shiftName', header: 'Shift' },
      { key: 'status', header: 'Status' },
      { key: 'checkInTime', header: 'Check In' },
      { key: 'checkOutTime', header: 'Check Out' },
      { key: 'lateMinutes', header: 'Late (Mins)' },
      { key: 'earlyDepartureMinutes', header: 'Early Departure (Mins)' },
    ]);
    const filename = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportAttendanceReportCSVAction:', error);
    return { success: false, error: 'Failed to export attendance report CSV' };
  }
}

export async function exportCompensationReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_COMPENSATION_EXPORT, PERMISSIONS.SALARY_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getCompensationReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'salaryRecordNumber', header: 'Salary Record #' },
      { key: 'employeeName', header: 'Employee' },
      { key: 'employeeCode', header: 'Employee Code' },
      { key: 'branchName', header: 'Branch' },
      { key: 'periodMonth', header: 'Month' },
      { key: 'periodYear', header: 'Year' },
      { key: 'baseSalary', header: 'Base Salary (INR)' },
      { key: 'bonus', header: 'Bonus (INR)' },
      { key: 'incentive', header: 'Incentive (INR)' },
      { key: 'adjustment', header: 'Adjustment (INR)' },
      { key: 'grossAmount', header: 'Gross (INR)' },
      { key: 'netAmount', header: 'Net (INR)' },
      { key: 'status', header: 'Status' },
    ]);
    const filename = `compensation-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportCompensationReportCSVAction:', error);
    return { success: false, error: 'Failed to export compensation report CSV' };
  }
}

export async function exportCustomersReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_CUSTOMER_EXPORT, PERMISSIONS.CUSTOMER_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getCustomersReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'name', header: 'Customer Name' },
      { key: 'phone', header: 'Phone' },
      { key: 'email', header: 'Email' },
      { key: 'status', header: 'Status' },
      { key: 'totalOrders', header: 'Total Orders' },
      { key: 'completedOrders', header: 'Completed Orders' },
      { key: 'totalSpend', header: 'Total Spend (INR)' },
      { key: 'reviewCount', header: 'Reviews' },
      { key: 'averageRating', header: 'Avg Rating' },
      { key: 'lastOrderDate', header: 'Last Order' },
    ]);
    const filename = `customers-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportCustomersReportCSVAction:', error);
    return { success: false, error: 'Failed to export customers report CSV' };
  }
}

export async function exportReviewsReportCSVAction(params: ReportFilterParams): Promise<ExportActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };
    if (!hasAnyPermission(user, [PERMISSIONS.REPORT_REVIEW_EXPORT, PERMISSIONS.REVIEW_READ])) {
      return { success: false, error: 'Forbidden: Insufficient permissions' };
    }
    const res = await getReviewsReportData({ ...params, limit: 5000, page: 1 }, user);
    const csv = generateGenericCSV(res.rows, [
      { key: 'createdAt', header: 'Date' },
      { key: 'branchName', header: 'Branch' },
      { key: 'rating', header: 'Rating (1-5)' },
      { key: 'status', header: 'Status' },
      { key: 'customerName', header: 'Customer' },
      { key: 'orderNumber', header: 'Order #' },
      { key: 'comment', header: 'Feedback Comment' },
    ]);
    const filename = `reviews-report-${new Date().toISOString().split('T')[0]}.csv`;
    return { success: true, csv, filename };
  } catch (error) {
    console.error('Error in exportReviewsReportCSVAction:', error);
    return { success: false, error: 'Failed to export reviews report CSV' };
  }
}
