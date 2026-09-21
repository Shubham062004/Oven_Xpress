/**
 * Step 18 — Centralized Report Service Layer
 *
 * Provides database-side aggregations, server-side pagination, strict branch authorization,
 * summary calculations, and RFC-4180 CSV generation across all 14 business reports.
 *
 * Primary Sources of Truth:
 * - Orders & OrderItems (Sales, Orders, Products, Customer spend)
 * - Payments & PaymentRefunds (Payment tenders, settled cash/UPI/card)
 * - Expenses (Approved operating costs)
 * - SalaryRecords (Approved payroll costs)
 * - StockTransactions & InventoryItems (Ledger-derived current stock, movements, wastage)
 * - PurchaseOrders (Vendor orders & receiving fulfillment)
 * - Attendance (Scheduled vs actual attendance, lateness)
 * - Customers & Reviews (Customer directory, star ratings, moderation)
 */

import { prisma } from '@/lib/db/prisma';
import type { AuthUser } from '@/lib/auth/types';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  parseDateRange,
  getDateRangeFromPreset,
  formatDateLocal,
  safeDivide,
  toCSV,
  REVENUE_ORDER_STATUSES,
} from './constants';
import type {
  ReportDateRange,
  ReportFilterParams,
  PaginationMeta,
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
} from './types';
import { calculateBatchStock } from '@/lib/inventory/actions';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  ExpenseStatus,
  PurchaseOrderStatus,
  AttendanceStatus,
  SalaryRecordStatus,
  StockTransactionType,
  ReviewStatus,
} from '@prisma/client';

// ─── Scope & Branch Authorization ───────────────────────────────────────────

export async function getAuthorizedBranchScope(
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

export async function resolveBranchFilter(
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
  // Anti-tamper: if user requested a branch they don't own, reject access
  if (requestedBranchId && requestedBranchId !== 'all' && !scope.branchIds.includes(requestedBranchId)) {
    return { error: 'Unauthorized branch access' };
  }

  return { branchId: userBranchId };
}

export function resolveReportDates(params: ReportFilterParams): {
  range: ReportDateRange;
  startDateTime: Date;
  endDateTime: Date;
} {
  let range: ReportDateRange;
  if (params.startDate && params.endDate) {
    range = { startDate: params.startDate, endDate: params.endDate };
  } else if (params.preset) {
    range = getDateRangeFromPreset(params.preset);
  } else {
    range = getDateRangeFromPreset('today');
  }

  // Cap date range to 366 days max to prevent runaway unbounded queries
  const { startDateTime, endDateTime } = parseDateRange(range);
  const diffDays = Math.ceil((endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 366) {
    const cappedStart = new Date(endDateTime);
    cappedStart.setDate(cappedStart.getDate() - 365);
    range = {
      startDate: formatDateLocal(cappedStart),
      endDate: range.endDate,
    };
    return { range, ...parseDateRange(range) };
  }

  return { range, startDateTime, endDateTime };
}

// ─── 1. Sales Report ────────────────────────────────────────────────────────

export async function getSalesReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: SalesReportRow[];
  summary: SalesReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const orderWhere: Record<string, unknown> = {
    createdAt: { gte: startDateTime, lte: endDateTime },
    status: { in: [...REVENUE_ORDER_STATUSES] },
  };
  if (effectiveBranchId) {
    orderWhere.branchId = effectiveBranchId;
  }

  const [orders, refunds, branches] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        createdAt: true,
        branchId: true,
        totalAmount: true,
        discountAmount: true,
        branch: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.paymentRefund.findMany({
      where: {
        createdAt: { gte: startDateTime, lte: endDateTime },
        status: 'SUCCESS',
        ...(effectiveBranchId
          ? { payment: { branchId: effectiveBranchId } }
          : {}),
      },
      select: {
        amount: true,
        createdAt: true,
        payment: { select: { branchId: true } },
      },
    }),
    prisma.branch.findMany({
      where: effectiveBranchId ? { id: effectiveBranchId } : { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const branchMap = new Map(branches.map((b) => [b.id, b]));

  // Group by date + branch
  const groupMap = new Map<string, {
    date: string;
    branchId: string;
    orderCount: number;
    grossSales: number;
    discounts: number;
    refunds: number;
  }>();

  for (const o of orders) {
    const dateStr = formatDateLocal(o.createdAt);
    const key = `${dateStr}_${o.branchId}`;
    const existing = groupMap.get(key) || {
      date: dateStr,
      branchId: o.branchId,
      orderCount: 0,
      grossSales: 0,
      discounts: 0,
      refunds: 0,
    };
    existing.orderCount += 1;
    existing.grossSales += Number(o.totalAmount);
    existing.discounts += Number(o.discountAmount);
    groupMap.set(key, existing);
  }

  for (const r of refunds) {
    const bId = r.payment.branchId;
    const dateStr = formatDateLocal(r.createdAt);
    const key = `${dateStr}_${bId}`;
    const existing = groupMap.get(key) || {
      date: dateStr,
      branchId: bId,
      orderCount: 0,
      grossSales: 0,
      discounts: 0,
      refunds: 0,
    };
    existing.refunds += Number(r.amount);
    groupMap.set(key, existing);
  }

  const allRows: SalesReportRow[] = Array.from(groupMap.values()).map((g) => {
    const branch = branchMap.get(g.branchId) || { name: 'Unknown', code: 'UNK' };
    const netSales = Math.max(0, g.grossSales - g.discounts - g.refunds);
    return {
      date: g.date,
      branchId: g.branchId,
      branchName: branch.name,
      branchCode: branch.code,
      orderCount: g.orderCount,
      grossSales: Number(g.grossSales.toFixed(2)),
      discounts: Number(g.discounts.toFixed(2)),
      refunds: Number(g.refunds.toFixed(2)),
      netSales: Number(netSales.toFixed(2)),
      averageOrderValue: Number(safeDivide(netSales, g.orderCount).toFixed(2)),
    };
  });

  // Sort by date desc, then branch name asc
  allRows.sort((a, b) => b.date.localeCompare(a.date) || a.branchName.localeCompare(b.branchName));

  // Compute summary
  let sumOrders = 0;
  let sumGross = 0;
  let sumDiscounts = 0;
  let sumRefunds = 0;
  let sumNet = 0;

  for (const r of allRows) {
    sumOrders += r.orderCount;
    sumGross += r.grossSales;
    sumDiscounts += r.discounts;
    sumRefunds += r.refunds;
    sumNet += r.netSales;
  }

  const summary: SalesReportSummary = {
    totalOrders: sumOrders,
    grossSales: Number(sumGross.toFixed(2)),
    discounts: Number(sumDiscounts.toFixed(2)),
    refunds: Number(sumRefunds.toFixed(2)),
    netSales: Number(sumNet.toFixed(2)),
    averageOrderValue: Number(safeDivide(sumNet, sumOrders).toFixed(2)),
  };

  // Pagination
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedRows = allRows.slice((page - 1) * limit, page * limit);

  return {
    rows: paginatedRows,
    summary,
    pagination: { page, limit, total, totalPages },
  };
}

// ─── 2. Orders Report ───────────────────────────────────────────────────────

export async function getOrdersReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: OrdersReportRow[];
  summary: OrdersReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    createdAt: { gte: startDateTime, lte: endDateTime },
  };

  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as OrderStatus;
  }
  if (params.orderType && params.orderType !== 'all') {
    where.orderType = params.orderType as OrderType;
  }
  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search, mode: 'insensitive' } },
      { customer: { name: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const canViewCustomerPII = hasPermission(user, PERMISSIONS.CUSTOMER_READ);

  const [total, orders, aggregates] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        branchId: true,
        branch: { select: { name: true, code: true } },
        orderType: true,
        status: true,
        customer: { select: { name: true, phone: true } },
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
        deliveryCharge: true,
        totalAmount: true,
        payments: {
          select: {
            status: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.aggregate({
      where,
      _sum: {
        totalAmount: true,
        discountAmount: true,
      },
      _count: { id: true },
    }),
  ]);

  const [completedCount, cancelledCount] = await Promise.all([
    prisma.order.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
  ]);

  const rows: OrdersReportRow[] = orders.map((o) => {
    const customerName = o.customer?.name || 'Walk-in Guest';
    let customerPhone: string | undefined = undefined;
    if (o.customer?.phone) {
      customerPhone = canViewCustomerPII
        ? o.customer.phone
        : o.customer.phone.replace(/.(?=.{4})/g, '*');
    }

    const totalPaid = o.payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const orderTotal = Number(o.totalAmount);
    let paymentStatus = 'PENDING';
    if (totalPaid >= orderTotal && orderTotal > 0) {
      paymentStatus = 'PAID';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIAL';
    } else if (o.payments.some((p) => p.status === 'FAILED')) {
      paymentStatus = 'FAILED';
    }

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      createdAt: o.createdAt.toISOString(),
      branchId: o.branchId,
      branchName: o.branch.name,
      branchCode: o.branch.code,
      orderType: o.orderType,
      status: o.status,
      customerName,
      customerPhone,
      subtotal: Number(Number(o.subtotal).toFixed(2)),
      discountAmount: Number(Number(o.discountAmount).toFixed(2)),
      taxAmount: Number(Number(o.taxAmount).toFixed(2)),
      deliveryCharge: Number(Number(o.deliveryCharge).toFixed(2)),
      totalAmount: Number(Number(o.totalAmount).toFixed(2)),
      paymentStatus,
    };
  });

  const totalAmountSum = Number(aggregates._sum.totalAmount || 0);
  const totalDiscountSum = Number(aggregates._sum.discountAmount || 0);
  const totalNet = Math.max(0, totalAmountSum - totalDiscountSum);

  const summary: OrdersReportSummary = {
    totalOrders: total,
    completedOrders: completedCount,
    cancelledOrders: cancelledCount,
    totalAmount: Number(totalAmountSum.toFixed(2)),
    totalDiscounts: Number(totalDiscountSum.toFixed(2)),
    totalNet: Number(totalNet.toFixed(2)),
    averageOrderTotal: Number(safeDivide(totalAmountSum, total).toFixed(2)),
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 3. Products Sales Report ───────────────────────────────────────────────

export async function getProductSalesReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: ProductsReportRow[];
  summary: ProductsReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const orderWhere: Record<string, unknown> = {
    createdAt: { gte: startDateTime, lte: endDateTime },
    status: { in: [...REVENUE_ORDER_STATUSES] },
  };
  if (effectiveBranchId) {
    orderWhere.branchId = effectiveBranchId;
  }

  const itemWhere: Record<string, unknown> = {
    order: orderWhere,
  };
  if (params.categoryId && params.categoryId !== 'all') {
    itemWhere.menuItem = { categoryId: params.categoryId };
  }
  if (params.search) {
    itemWhere.menuItem = {
      ...(itemWhere.menuItem as object || {}),
      name: { contains: params.search, mode: 'insensitive' },
    };
  }

  const orderItems = await prisma.orderItem.findMany({
    where: itemWhere,
    select: {
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      menuItemId: true,
      menuItem: {
        select: {
          name: true,
          category: { select: { name: true } },
        },
      },
      order: {
        select: {
          branch: { select: { name: true } },
        },
      },
    },
  });

  // Group by menuItemId + branchName
  const productMap = new Map<string, {
    menuItemId: string;
    menuItemName: string;
    categoryName: string;
    branchName: string;
    quantitySold: number;
    grossSales: number;
    discounts: number;
    netSales: number;
  }>();

  for (const item of orderItems) {
    const key = `${item.menuItemId}_${item.order.branch.name}`;
    const existing = productMap.get(key) || {
      menuItemId: item.menuItemId,
      menuItemName: item.menuItem?.name || 'Unknown Item',
      categoryName: item.menuItem?.category?.name || 'Uncategorized',
      branchName: item.order.branch.name,
      quantitySold: 0,
      grossSales: 0,
      discounts: 0,
      netSales: 0,
    };
    const gross = Number(item.totalPrice);
    existing.quantitySold += item.quantity;
    existing.grossSales += gross;
    existing.netSales += gross;
    productMap.set(key, existing);
  }

  const allRows: ProductsReportRow[] = Array.from(productMap.values()).map((p) => ({
    ...p,
    grossSales: Number(p.grossSales.toFixed(2)),
    discounts: Number(p.discounts.toFixed(2)),
    netSales: Number(p.netSales.toFixed(2)),
  }));

  allRows.sort((a, b) => b.quantitySold - a.quantitySold || b.netSales - a.netSales);

  let totalQty = 0;
  let totalGross = 0;
  let totalDiscounts = 0;
  let totalNet = 0;

  for (const r of allRows) {
    totalQty += r.quantitySold;
    totalGross += r.grossSales;
    totalDiscounts += r.discounts;
    totalNet += r.netSales;
  }

  const summary: ProductsReportSummary = {
    totalQuantitySold: totalQty,
    grossSales: Number(totalGross.toFixed(2)),
    discounts: Number(totalDiscounts.toFixed(2)),
    netSales: Number(totalNet.toFixed(2)),
    uniqueItemsCount: new Set(allRows.map((r) => r.menuItemId)).size,
  };

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const total = allRows.length;
  const paginatedRows = allRows.slice((page - 1) * limit, page * limit);

  return {
    rows: paginatedRows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 4. Branch Performance Report ───────────────────────────────────────────

export async function getBranchesReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: BranchReportRow[];
  summary: BranchReportSummary;
}> {
  const scope = await getAuthorizedBranchScope(user);
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const branches = await prisma.branch.findMany({
    where: scope.isAllBranches ? { status: 'ACTIVE' } : { id: { in: scope.branchIds } },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });

  const branchIds = branches.map((b) => b.id);

  const [orderGroups, refunds, paymentGroups, expenseGroups, salaryRecords] = await Promise.all([
    prisma.order.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: branchIds },
        createdAt: { gte: startDateTime, lte: endDateTime },
        status: { in: [...REVENUE_ORDER_STATUSES] },
      },
      _count: { id: true },
      _sum: { totalAmount: true, discountAmount: true },
    }),
    prisma.paymentRefund.findMany({
      where: {
        payment: { branchId: { in: branchIds } },
        createdAt: { gte: startDateTime, lte: endDateTime },
        status: 'SUCCESS',
      },
      select: {
        amount: true,
        payment: { select: { branchId: true } },
      },
    }),
    prisma.payment.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: branchIds },
        createdAt: { gte: startDateTime, lte: endDateTime },
        status: 'SUCCESS',
      },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ['branchId'],
      where: {
        branchId: { in: branchIds },
        expenseDate: { gte: startDateTime, lte: endDateTime },
        status: 'APPROVED',
      },
      _sum: { amount: true },
    }),
    prisma.salaryRecord.findMany({
      where: {
        employee: { branchId: { in: branchIds } },
        status: { in: ['APPROVED', 'PAID'] },
        periodStart: { lte: endDateTime },
        periodEnd: { gte: startDateTime },
      },
      select: {
        grossAmount: true,
        employee: { select: { branchId: true } },
      },
    }),
  ]);

  const refundMap = new Map<string, number>();
  for (const r of refunds) {
    const bId = r.payment.branchId;
    refundMap.set(bId, (refundMap.get(bId) || 0) + Number(r.amount));
  }

  const orderMap = new Map(orderGroups.map((g) => [g.branchId, g]));
  const paymentMap = new Map(paymentGroups.map((g) => [g.branchId, Number(g._sum.amount || 0)]));
  const expenseMap = new Map(expenseGroups.map((g) => [g.branchId, Number(g._sum.amount || 0)]));

  const salaryMap = new Map<string, number>();
  for (const s of salaryRecords) {
    const bId = s.employee.branchId;
    salaryMap.set(bId, (salaryMap.get(bId) || 0) + Number(s.grossAmount));
  }

  const rows: BranchReportRow[] = branches.map((b) => {
    const og = orderMap.get(b.id);
    const orderCount = og?._count.id || 0;
    const grossSales = Number(og?._sum.totalAmount || 0);
    const discounts = Number(og?._sum.discountAmount || 0);
    const refunds = refundMap.get(b.id) || 0;
    const netSales = Math.max(0, grossSales - discounts - refunds);
    const aov = safeDivide(netSales, orderCount);
    const payments = paymentMap.get(b.id) || 0;
    const expenses = expenseMap.get(b.id) || 0;
    const salary = salaryMap.get(b.id) || 0;
    const operatingResult = netSales - expenses - salary;

    return {
      branchId: b.id,
      branchName: b.name,
      branchCode: b.code,
      orderCount,
      netSales: Number(netSales.toFixed(2)),
      averageOrderValue: Number(aov.toFixed(2)),
      successfulPayments: Number(payments.toFixed(2)),
      approvedExpenses: Number(expenses.toFixed(2)),
      operatingResult: Number(operatingResult.toFixed(2)),
    };
  });

  let totOrders = 0;
  let totSales = 0;
  let totPay = 0;
  let totExp = 0;
  let totRes = 0;

  for (const r of rows) {
    totOrders += r.orderCount;
    totSales += r.netSales;
    totPay += r.successfulPayments;
    totExp += r.approvedExpenses;
    totRes += r.operatingResult;
  }

  const summary: BranchReportSummary = {
    branchCount: branches.length,
    totalOrders: totOrders,
    totalNetSales: Number(totSales.toFixed(2)),
    totalPayments: Number(totPay.toFixed(2)),
    totalExpenses: Number(totExp.toFixed(2)),
    totalOperatingResult: Number(totRes.toFixed(2)),
  };

  return { rows, summary };
}

// ─── 5. Payment Report ──────────────────────────────────────────────────────

export async function getPaymentsReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: PaymentsReportRow[];
  summary: PaymentsReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    createdAt: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.paymentMethod && params.paymentMethod !== 'all') {
    where.method = params.paymentMethod as PaymentMethod;
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as PaymentStatus;
  }
  if (params.search) {
    where.OR = [
      { paymentNumber: { contains: params.search, mode: 'insensitive' } },
      { referenceNumber: { contains: params.search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, payments, statsGroups, refundsSum] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        paymentNumber: true,
        orderId: true,
        order: { select: { orderNumber: true } },
        branchId: true,
        branch: { select: { name: true, code: true } },
        createdAt: true,
        amount: true,
        method: true,
        status: true,
        referenceNumber: true,
        processedBy: true,
        refunds: {
          where: { status: 'SUCCESS' },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.paymentRefund.aggregate({
      where: {
        createdAt: { gte: startDateTime, lte: endDateTime },
        status: 'SUCCESS',
        ...(effectiveBranchId ? { payment: { branchId: effectiveBranchId } } : {}),
      },
      _sum: { amount: true },
    }),
  ]);

  const rows: PaymentsReportRow[] = payments.map((p) => {
    const refunded = p.refunds.reduce((acc, r) => acc + Number(r.amount), 0);
    return {
      id: p.id,
      paymentNumber: p.paymentNumber,
      orderId: p.orderId,
      orderNumber: p.order.orderNumber,
      branchId: p.branchId,
      branchName: p.branch.name,
      branchCode: p.branch.code,
      createdAt: p.createdAt.toISOString(),
      amount: Number(Number(p.amount).toFixed(2)),
      method: p.method,
      status: p.status,
      referenceNumber: p.referenceNumber,
      processedBy: p.processedBy || 'System Operator',
      refundedAmount: Number(refunded.toFixed(2)),
    };
  });

  const successGroup = statsGroups.find((g) => g.status === 'SUCCESS');
  const failedGroup = statsGroups.find((g) => g.status === 'FAILED');

  const summary: PaymentsReportSummary = {
    totalPaymentsCount: total,
    successfulCount: successGroup?._count.id || 0,
    successfulAmount: Number(Number(successGroup?._sum.amount || 0).toFixed(2)),
    failedCount: failedGroup?._count.id || 0,
    failedAmount: Number(Number(failedGroup?._sum.amount || 0).toFixed(2)),
    refundedAmount: Number(Number(refundsSum._sum.amount || 0).toFixed(2)),
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 6. Expense Report ──────────────────────────────────────────────────────

export async function getExpensesReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: ExpensesReportRow[];
  summary: ExpensesReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  if (branchRes.error) throw new Error(branchRes.error);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    expenseDate: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.categoryId && params.categoryId !== 'all') {
    where.categoryId = params.categoryId;
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as ExpenseStatus;
  }
  if (params.search) {
    where.OR = [
      { expenseNumber: { contains: params.search, mode: 'insensitive' } },
      { vendorName: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, expenses, statsGroups] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      select: {
        id: true,
        expenseNumber: true,
        expenseDate: true,
        branchId: true,
        branch: { select: { name: true, code: true } },
        category: { select: { name: true } },
        amount: true,
        paymentMethod: true,
        vendorName: true,
        status: true,
        description: true,
      },
      orderBy: { expenseDate: 'desc' },
      skip,
      take: limit,
    }),
    prisma.expense.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
  ]);

  const rows: ExpensesReportRow[] = expenses.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    date: formatDateLocal(e.expenseDate),
    branchId: e.branchId,
    branchName: e.branch.name,
    branchCode: e.branch.code,
    categoryName: e.category.name,
    amount: Number(Number(e.amount).toFixed(2)),
    paymentMethod: e.paymentMethod,
    vendor: e.vendorName,
    status: e.status,
    description: e.description,
  }));

  const appGroup = statsGroups.find((g) => g.status === 'APPROVED');
  const pendGroup = statsGroups.find((g) => g.status === 'PENDING_APPROVAL');
  const rejGroup = statsGroups.find((g) => g.status === 'REJECTED');

  const summary: ExpensesReportSummary = {
    totalExpensesCount: total,
    approvedCount: appGroup?._count.id || 0,
    approvedAmount: Number(Number(appGroup?._sum.amount || 0).toFixed(2)),
    pendingCount: pendGroup?._count.id || 0,
    pendingAmount: Number(Number(pendGroup?._sum.amount || 0).toFixed(2)),
    rejectedCount: rejGroup?._count.id || 0,
    rejectedAmount: Number(Number(rejGroup?._sum.amount || 0).toFixed(2)),
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 7. Inventory Report ────────────────────────────────────────────────────

export async function getInventoryReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: InventoryReportRow[];
  summary: InventoryReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;

  const where: Record<string, unknown> = {};
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.search) {
    where.ingredient = {
      name: { contains: params.search, mode: 'insensitive' },
    };
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    select: {
      id: true,
      branchId: true,
      branch: { select: { name: true } },
      ingredientId: true,
      ingredient: {
        select: {
          name: true,
          unit: true,
        },
      },
      minimumStock: true,
      reorderLevel: true,
    },
    orderBy: { ingredient: { name: 'asc' } },
  });

  const branchIdsToCalc = effectiveBranchId
    ? [effectiveBranchId]
    : Array.from(new Set(items.map((i) => i.branchId)));

  const stockMap = await calculateBatchStock(branchIdsToCalc);

  let inStock = 0;
  let lowStock = 0;
  let outOfStock = 0;

  const allRows: InventoryReportRow[] = items.map((i) => {
    const key = `${i.branchId}_${i.ingredientId}`;
    const currentStock = stockMap.get(key) || 0;
    const minStock = Number(i.minimumStock);
    const reorderLevel = Number(i.reorderLevel);

    let status = 'IN_STOCK';
    if (currentStock <= 0) {
      status = 'OUT_OF_STOCK';
      outOfStock++;
    } else if (currentStock <= minStock) {
      status = 'LOW_STOCK';
      lowStock++;
    } else {
      inStock++;
    }

    return {
      id: i.id,
      branchId: i.branchId,
      branchName: i.branch.name,
      ingredientId: i.ingredientId,
      ingredientName: i.ingredient.name,
      categoryName: 'Ingredients',
      unit: i.ingredient.unit,
      currentStock: Number(currentStock.toFixed(2)),
      minStock: Number(minStock.toFixed(2)),
      reorderLevel: Number(reorderLevel.toFixed(2)),
      status,
      lastMovementDate: null,
    };
  });

  let filteredRows = allRows;
  if (params.status && params.status !== 'all') {
    filteredRows = allRows.filter((r) => r.status === params.status);
  }

  const movementsCount = await prisma.stockTransaction.count({
    where: effectiveBranchId ? { branchId: effectiveBranchId } : {},
  });

  const summary: InventoryReportSummary = {
    totalIngredients: items.length,
    inStockCount: inStock,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    totalMovementsCount: movementsCount,
  };

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const total = filteredRows.length;
  const paginatedRows = filteredRows.slice((page - 1) * limit, page * limit);

  return {
    rows: paginatedRows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getStockMovementsReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: StockMovementReportRow[];
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    createdAt: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.status && params.status !== 'all') {
    where.type = params.status as StockTransactionType;
  }
  if (params.search) {
    where.ingredient = {
      name: { contains: params.search, mode: 'insensitive' },
    };
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, transactions] = await Promise.all([
    prisma.stockTransaction.count({ where }),
    prisma.stockTransaction.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        branch: { select: { name: true } },
        ingredient: { select: { name: true, unit: true } },
        type: true,
        quantity: true,
        referenceId: true,
        note: true,
        performedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const rows: StockMovementReportRow[] = transactions.map((t) => ({
    id: t.id,
    date: formatDateLocal(t.createdAt),
    branchName: t.branch.name,
    ingredientName: t.ingredient.name,
    unit: t.ingredient.unit,
    type: t.type,
    quantity: Number(Number(t.quantity).toFixed(2)),
    referenceId: t.referenceId,
    notes: t.note,
    createdBy: t.performedBy || 'System',
  }));

  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 8. Purchase Report ─────────────────────────────────────────────────────

export async function getPurchasesReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: PurchasesReportRow[];
  summary: PurchasesReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    orderDate: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as PurchaseOrderStatus;
  }
  if (params.supplierId && params.supplierId !== 'all') {
    where.supplierId = params.supplierId;
  }
  if (params.search) {
    where.OR = [
      { purchaseNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { name: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, orders] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      select: {
        id: true,
        purchaseNumber: true,
        supplier: { select: { name: true } },
        branch: { select: { name: true, code: true } },
        orderDate: true,
        expectedDate: true,
        status: true,
        items: {
          select: {
            orderedQuantity: true,
            receivedQuantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { orderDate: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const [receivedCount, pendingCount] = await Promise.all([
    prisma.purchaseOrder.count({ where: { ...where, status: 'RECEIVED' } }),
    prisma.purchaseOrder.count({ where: { ...where, status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } } }),
  ]);

  const rows: PurchasesReportRow[] = orders.map((o) => {
    let orderedAmt = 0;
    let receivedAmt = 0;
    for (const item of o.items) {
      orderedAmt += Number(item.orderedQuantity) * Number(item.unitPrice);
      receivedAmt += Number(item.receivedQuantity) * Number(item.unitPrice);
    }
    return {
      id: o.id,
      purchaseNumber: o.purchaseNumber,
      supplierName: o.supplier.name,
      branchName: o.branch.name,
      branchCode: o.branch.code,
      orderDate: formatDateLocal(o.orderDate),
      expectedDate: o.expectedDate ? formatDateLocal(o.expectedDate) : null,
      status: o.status,
      totalAmount: Number(orderedAmt.toFixed(2)),
      receivedAmount: Number(receivedAmt.toFixed(2)),
      itemCount: o.items.length,
    };
  });

  // Calculate totals across all matching purchase orders
  const allMatchingOrders = await prisma.purchaseOrder.findMany({
    where,
    select: {
      items: {
        select: {
          orderedQuantity: true,
          receivedQuantity: true,
          unitPrice: true,
        },
      },
    },
  });

  let totalOrderedAmount = 0;
  let totalReceivedAmount = 0;
  for (const o of allMatchingOrders) {
    for (const it of o.items) {
      totalOrderedAmount += Number(it.orderedQuantity) * Number(it.unitPrice);
      totalReceivedAmount += Number(it.receivedQuantity) * Number(it.unitPrice);
    }
  }

  const summary: PurchasesReportSummary = {
    totalOrders: total,
    totalOrderedAmount: Number(totalOrderedAmount.toFixed(2)),
    totalReceivedAmount: Number(totalReceivedAmount.toFixed(2)),
    receivedOrders: receivedCount,
    pendingOrders: pendingCount,
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 9. Wastage Report ──────────────────────────────────────────────────────

export async function getWastageReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: WastageReportRow[];
  summary: WastageReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    type: { in: ['DAMAGE', 'WASTAGE'] },
    createdAt: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.reason && params.reason !== 'all') {
    where.wastageReason = params.reason;
  }
  if (params.search) {
    where.ingredient = {
      name: { contains: params.search, mode: 'insensitive' },
    };
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, transactions] = await Promise.all([
    prisma.stockTransaction.count({ where }),
    prisma.stockTransaction.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        branch: { select: { name: true } },
        ingredient: { select: { name: true, unit: true } },
        quantity: true,
        reason: true,
        note: true,
        performedBy: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const rows: WastageReportRow[] = transactions.map((t) => ({
    id: t.id,
    date: formatDateLocal(t.createdAt),
    branchName: t.branch.name,
    ingredientName: t.ingredient.name,
    quantity: Number(Number(t.quantity).toFixed(2)),
    unit: t.ingredient.unit,
    reason: t.reason || 'UNSPECIFIED',
    notes: t.note,
    createdBy: t.performedBy || 'Kitchen Staff',
  }));

  // Aggregate breakdown across all matching records
  const allMatching = await prisma.stockTransaction.findMany({
    where,
    select: {
      quantity: true,
      reason: true,
      ingredient: { select: { name: true, unit: true } },
    },
  });

  const reasonMap = new Map<string, { quantity: number; count: number }>();
  const ingMap = new Map<string, { unit: string; quantity: number }>();
  let totalQty = 0;

  for (const m of allMatching) {
    const qty = Number(m.quantity);
    totalQty += qty;

    const rKey = m.reason || 'UNSPECIFIED';
    const existingR = reasonMap.get(rKey) || { quantity: 0, count: 0 };
    existingR.quantity += qty;
    existingR.count += 1;
    reasonMap.set(rKey, existingR);

    const iKey = m.ingredient.name;
    const existingI = ingMap.get(iKey) || { unit: m.ingredient.unit, quantity: 0 };
    existingI.quantity += qty;
    ingMap.set(iKey, existingI);
  }

  const byReason = Array.from(reasonMap.entries())
    .map(([reason, val]) => ({
      reason,
      quantity: Number(val.quantity.toFixed(2)),
      count: val.count,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const byIngredient = Array.from(ingMap.entries())
    .map(([name, val]) => ({
      ingredientName: name,
      unit: val.unit,
      quantity: Number(val.quantity.toFixed(2)),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const summary: WastageReportSummary = {
    totalEvents: total,
    totalQuantity: Number(totalQty.toFixed(2)),
    byReason,
    byIngredient,
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 10. Attendance Report ──────────────────────────────────────────────────

export async function getAttendanceReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: AttendanceReportRow[];
  summary: AttendanceReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    date: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as AttendanceStatus;
  }
  if (params.shiftId && params.shiftId !== 'all') {
    where.shiftId = params.shiftId;
  }
  if (params.employeeId) {
    where.employeeId = params.employeeId;
  }
  if (params.search) {
    where.employee = {
      OR: [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { employeeCode: { contains: params.search, mode: 'insensitive' } },
      ],
    };
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, records, statsGroups, lateCount, earlyCount] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      select: {
        id: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        lateMinutes: true,
        earlyDepartureMinutes: true,
        branch: { select: { name: true } },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        shift: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.attendance.count({ where: { ...where, lateMinutes: { gt: 0 } } }),
    prisma.attendance.count({ where: { ...where, earlyDepartureMinutes: { gt: 0 } } }),
  ]);

  const rows: AttendanceReportRow[] = records.map((r) => ({
    id: r.id,
    date: formatDateLocal(r.date),
    branchName: r.branch.name,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
    employeeCode: r.employee.employeeCode,
    designation: r.employee.designation,
    shiftName: r.shift?.name || 'General Shift',
    status: r.status,
    checkInTime: r.checkIn ? r.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
    checkOutTime: r.checkOut ? r.checkOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
    lateMinutes: r.lateMinutes,
    earlyDepartureMinutes: r.earlyDepartureMinutes,
  }));

  const present = statsGroups.find((g) => g.status === 'PRESENT')?._count.id || 0;
  const absent = statsGroups.find((g) => g.status === 'ABSENT')?._count.id || 0;
  const halfDay = statsGroups.find((g) => g.status === 'HALF_DAY')?._count.id || 0;
  const leave = statsGroups.find((g) => g.status === 'LEAVE')?._count.id || 0;

  const summary: AttendanceReportSummary = {
    totalRecords: total,
    presentCount: present,
    absentCount: absent,
    halfDayCount: halfDay,
    leaveCount: leave,
    lateArrivalsCount: lateCount,
    earlyDeparturesCount: earlyCount,
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 11. Compensation Report ────────────────────────────────────────────────

export async function getCompensationReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: CompensationReportRow[];
  summary: CompensationReportSummary;
  pagination: PaginationMeta;
}> {
  // Strict authorization check: Only users with SALARY_READ or REPORT_COMPENSATION_READ
  if (!hasPermission(user, PERMISSIONS.SALARY_READ) && !hasPermission(user, PERMISSIONS.REPORT_COMPENSATION_READ)) {
    throw new Error('Forbidden: You do not have permission to view employee compensation records.');
  }

  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;

  const where: Record<string, unknown> = {};
  if (effectiveBranchId) {
    where.employee = { branchId: effectiveBranchId };
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as SalaryRecordStatus;
  }
  if (params.search) {
    where.employee = {
      ...(where.employee as object || {}),
      OR: [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { employeeCode: { contains: params.search, mode: 'insensitive' } },
      ],
    };
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, records, aggregates] = await Promise.all([
    prisma.salaryRecord.count({ where }),
    prisma.salaryRecord.findMany({
      where,
      select: {
        id: true,
        salaryNumber: true,
        periodStart: true,
        periodEnd: true,
        baseSalary: true,
        bonusAmount: true,
        incentiveAmount: true,
        adjustmentAmount: true,
        grossAmount: true,
        status: true,
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: { periodStart: 'desc' },
      skip,
      take: limit,
    }),
    prisma.salaryRecord.aggregate({
      where,
      _sum: {
        baseSalary: true,
        bonusAmount: true,
        incentiveAmount: true,
        grossAmount: true,
      },
      _count: { id: true },
    }),
  ]);

  const rows: CompensationReportRow[] = records.map((r) => {
    const month = r.periodStart.getMonth() + 1;
    const year = r.periodStart.getFullYear();
    const gross = Number(r.grossAmount);
    return {
      id: r.id,
      salaryRecordNumber: r.salaryNumber,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      employeeCode: r.employee.employeeCode,
      branchName: r.employee.branch.name,
      periodMonth: month,
      periodYear: year,
      baseSalary: Number(Number(r.baseSalary).toFixed(2)),
      bonus: Number(Number(r.bonusAmount).toFixed(2)),
      incentive: Number(Number(r.incentiveAmount).toFixed(2)),
      adjustment: Number(Number(r.adjustmentAmount).toFixed(2)),
      grossAmount: Number(gross.toFixed(2)),
      netAmount: Number(gross.toFixed(2)),
      status: r.status,
    };
  });

  const summary: CompensationReportSummary = {
    totalRecords: total,
    totalBaseSalary: Number(Number(aggregates._sum?.baseSalary || 0).toFixed(2)),
    totalBonus: Number(Number(aggregates._sum?.bonusAmount || 0).toFixed(2)),
    totalIncentive: Number(Number(aggregates._sum?.incentiveAmount || 0).toFixed(2)),
    totalGrossAmount: Number(Number(aggregates._sum?.grossAmount || 0).toFixed(2)),
    totalNetAmount: Number(Number(aggregates._sum?.grossAmount || 0).toFixed(2)),
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 12. Customers Report ───────────────────────────────────────────────────

export async function getCustomersReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: CustomersReportRow[];
  summary: CustomersReportSummary;
  pagination: PaginationMeta;
}> {
  const canViewPII = hasPermission(user, PERMISSIONS.CUSTOMER_READ);
  const where: Record<string, unknown> = {};

  if (params.status && params.status !== 'all') {
    where.status = params.status;
  }
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      ...(canViewPII
        ? [
            { phone: { contains: params.search, mode: 'insensitive' } },
            { email: { contains: params.search, mode: 'insensitive' } },
          ]
        : []),
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        orders: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const rows: CustomersReportRow[] = customers.map((c) => {
    const completedOrders = c.orders.filter((o) => o.status === 'COMPLETED' || o.status === 'REFUNDED');
    const totalSpend = completedOrders.reduce((acc, o) => acc + Number(o.totalAmount), 0);
    const avgRating =
      c.reviews.length > 0
        ? c.reviews.reduce((acc, r) => acc + r.rating, 0) / c.reviews.length
        : 0;

    let lastDate: string | null = null;
    if (c.orders.length > 0) {
      const sorted = [...c.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      lastDate = formatDateLocal(sorted[0].createdAt);
    }

    let phone: string | null = c.phone;
    let email: string | null = c.email;
    if (!canViewPII) {
      if (phone) phone = phone.replace(/.(?=.{4})/g, '*');
      if (email) email = '***@***.***';
    }

    return {
      id: c.id,
      name: c.name,
      phone,
      email,
      status: c.status,
      totalOrders: c.orders.length,
      completedOrders: completedOrders.length,
      totalSpend: Number(totalSpend.toFixed(2)),
      reviewCount: c.reviews.length,
      averageRating: Number(avgRating.toFixed(1)),
      lastOrderDate: lastDate,
    };
  });

  const activeCount = await prisma.customer.count({ where: { status: 'ACTIVE' } });
  const customersWithOrdersCount = rows.filter((r) => r.completedOrders > 0).length;
  const totSpend = rows.reduce((acc, r) => acc + r.totalSpend, 0);
  const avgRate = rows.filter((r) => r.averageRating > 0).length > 0
    ? rows.filter((r) => r.averageRating > 0).reduce((acc, r) => acc + r.averageRating, 0) /
      rows.filter((r) => r.averageRating > 0).length
    : 0;

  const summary: CustomersReportSummary = {
    totalCustomers: total,
    activeCustomers: activeCount,
    customersWithOrders: customersWithOrdersCount,
    totalSpend: Number(totSpend.toFixed(2)),
    averageRating: Number(avgRate.toFixed(1)),
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── 13. Reviews Report ─────────────────────────────────────────────────────

export async function getReviewsReportData(
  params: ReportFilterParams,
  user: AuthUser
): Promise<{
  rows: ReviewsReportRow[];
  summary: ReviewsReportSummary;
  pagination: PaginationMeta;
}> {
  const branchRes = await resolveBranchFilter(user, params.branchId);
  const effectiveBranchId = branchRes.branchId;
  const { startDateTime, endDateTime } = resolveReportDates(params);

  const where: Record<string, unknown> = {
    createdAt: { gte: startDateTime, lte: endDateTime },
  };
  if (effectiveBranchId) {
    where.branchId = effectiveBranchId;
  }
  if (params.rating) {
    where.rating = Number(params.rating);
  }
  if (params.status && params.status !== 'all') {
    where.status = params.status as ReviewStatus;
  }
  if (params.search) {
    where.OR = [
      { comment: { contains: params.search, mode: 'insensitive' } },
      { customer: { name: { contains: params.search, mode: 'insensitive' } } },
      { order: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const skip = (page - 1) * limit;

  const [total, reviews, aggregates, statusCounts] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        branch: { select: { name: true } },
        rating: true,
        status: true,
        customer: { select: { name: true } },
        order: { select: { orderNumber: true } },
        comment: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.aggregate({
      where,
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.review.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
  ]);

  const rows: ReviewsReportRow[] = reviews.map((r) => ({
    id: r.id,
    createdAt: formatDateLocal(r.createdAt),
    branchName: r.branch.name,
    rating: r.rating,
    status: r.status,
    customerName: r.customer?.name || 'Anonymous Guest',
    orderNumber: r.order?.orderNumber || null,
    comment: r.comment,
    isPublished: r.status === 'PUBLISHED',
  }));

  const ratingCounts = await prisma.review.groupBy({
    by: ['rating'],
    where,
    _count: { id: true },
  });

  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const rc of ratingCounts) {
    ratingBreakdown[rc.rating] = rc._count.id;
  }

  const pub = statusCounts.find((s) => s.status === 'PUBLISHED')?._count.id || 0;
  const pend = statusCounts.find((s) => s.status === 'PENDING')?._count.id || 0;
  const hid = statusCounts.find((s) => s.status === 'HIDDEN')?._count.id || 0;

  const summary: ReviewsReportSummary = {
    totalReviews: total,
    averageRating: Number(Number(aggregates._avg.rating || 0).toFixed(2)),
    ratingBreakdown,
    publishedCount: pub,
    pendingCount: pend,
    hiddenCount: hid,
  };

  return {
    rows,
    summary,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

// ─── CSV Export Factory ─────────────────────────────────────────────────────

export function generateGenericCSV<T extends object>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  return toCSV(data, columns);
}
