'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { ActionResult } from '@/lib/auth/types';
import {
  createPaymentSchema,
  createRefundSchema,
  submitReconciliationSchema,
  paymentFilterSchema,
  type CreatePaymentInput,
  type CreateRefundInput,
  type SubmitReconciliationInput,
  type PaymentFilterInput,
} from '@/lib/validations/payments';
import type {
  PaymentRecord,
  PaymentListResponse,
  PaymentStats,
  DailyReconciliationData,
  ReconciliationHistoryItem,
} from './types';
import {
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ReconciliationStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';
import { getSetting } from '@/lib/settings/settings-service';

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as Record<string, unknown>).digest === 'string' &&
    ((error as Record<string, string>).digest.startsWith('NEXT_REDIRECT') ||
      (error as Record<string, string>).digest === 'DYNAMIC_SERVER_USAGE')
  );
}



/**
 * Concurrency-safe sequential payment number generator.
 * Format: PAY-YYYY-000001
 * Uses PostgreSQL advisory transaction lock to guarantee uniqueness under concurrent requests.
 */
async function generatePaymentNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PAY-${currentYear}-`;

  const lockKey = `payment_number_seq_${currentYear}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const latestPayment = await tx.payment.findFirst({
    where: {
      paymentNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      paymentNumber: 'desc',
    },
    select: {
      paymentNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestPayment?.paymentNumber) {
    const parts = latestPayment.paymentNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(6, '0')}`;
}

/**
 * Concurrency-safe sequential refund number generator.
 * Format: REF-YYYY-000001
 */
async function generateRefundNumber(
  tx: Prisma.TransactionClient
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REF-${currentYear}-`;

  const lockKey = `refund_number_seq_${currentYear}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const latestRefund = await tx.paymentRefund.findFirst({
    where: {
      refundNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      refundNumber: 'desc',
    },
    select: {
      refundNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestRefund?.refundNumber) {
    const parts = latestRefund.refundNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(6, '0')}`;
}

/**
 * Records a new payment against an order.
 * Follows: auth -> permission -> branch scope -> order check -> payable validation -> db transaction
 */
export async function recordPayment(
  input: CreatePaymentInput
): Promise<ActionResult<PaymentRecord>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_CREATE);
    const parsed = createPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };
    }

    const { orderId, amount, method, referenceNumber, notes, status } = parsed.data;

    // Verify order and branch access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        branchId: true,
        status: true,
        totalAmount: true,
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (order.status === OrderStatus.CANCELLED) {
      return { success: false, error: 'Cannot record payment for a cancelled order' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch existing payments within transaction for strict concurrency & overpayment protection
      const existingPayments = await tx.payment.findMany({
        where: {
          orderId: order.id,
          status: {
            in: [PaymentStatus.SUCCESS, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
          },
        },
        select: {
          amount: true,
        },
      });

      const currentTotalPaid = existingPayments.reduce(
        (sum, p) => sum + p.amount.toNumber(),
        0
      );
      const orderTotal = order.totalAmount.toNumber();
      const remainingPayable = Math.max(0, Math.round((orderTotal - currentTotalPaid) * 100) / 100);

      // Overpayment protection for successful payments
      if (status === PaymentStatus.SUCCESS && amount > remainingPayable + 0.001) {
        throw new Error(
          `Payment amount (₹${amount.toFixed(2)}) exceeds remaining balance (₹${remainingPayable.toFixed(2)})`
        );
      }

      // Partial payment configuration check
      if (status === PaymentStatus.SUCCESS && amount < remainingPayable - 0.001) {
        const allowPartial = await getSetting<boolean>('PAYMENT_ALLOW_PARTIAL', order.branchId);
        if (allowPartial === false) {
          throw new Error('Partial payments are disabled for this branch. Full payment is required.');
        }
      }

      // Receipt reference requirement check for non-cash payments
      if (method !== PaymentMethod.CASH && !referenceNumber) {
        const receiptRequired = await getSetting<boolean>('PAYMENT_RECEIPT_REQUIRED', order.branchId);
        if (receiptRequired === true) {
          throw new Error('Transaction reference number is required for non-cash payments.');
        }
      }

      const paymentNumber = await generatePaymentNumber(tx);

      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          orderId: order.id,
          branchId: order.branchId,
          amount: new Prisma.Decimal(amount),
          method,
          status,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          processedBy: user.name || user.email,
        },
        include: {
          order: { select: { orderNumber: true } },
          branch: { select: { name: true, code: true } },
          refunds: true,
        },
      });

      // Append to audit log
      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: status === PaymentStatus.FAILED ? 'PAYMENT_FAILED' : 'PAYMENT_CREATED',
          toStatus: status,
          amount: new Prisma.Decimal(amount),
          performedBy: user.name || user.email,
          notes: notes || (status === PaymentStatus.FAILED ? 'Payment attempt recorded as FAILED' : null),
        },
      });

      // Append to central audit log
      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: order.branchId,
          action: AUDIT_ACTIONS.PAYMENT_CREATE,
          entityType: AUDIT_ENTITY_TYPES.PAYMENT,
          entityId: payment.id,
          description: `Recorded ₹${amount.toFixed(2)} ${method} payment (${paymentNumber}) for order ${order.orderNumber}`,
          afterData: {
            paymentNumber,
            orderNumber: order.orderNumber,
            amount,
            method,
            status,
          },
          metadata: {
            referenceNumber: referenceNumber || null,
          },
        },
        tx
      );

      return payment;
    });

    revalidatePath(`/orders/${order.id}`);
    revalidatePath('/orders');
    revalidatePath('/payments');
    revalidatePath('/payments/reconciliation');

    return {
      success: true,
      data: {
        id: result.id,
        paymentNumber: result.paymentNumber,
        orderId: result.orderId,
        orderNumber: result.order.orderNumber,
        branchId: result.branchId,
        branchName: result.branch.name,
        branchCode: result.branch.code,
        amount: result.amount.toNumber(),
        method: result.method,
        status: result.status,
        referenceNumber: result.referenceNumber,
        notes: result.notes,
        processedBy: result.processedBy,
        processedAt: result.processedAt.toISOString(),
        refundedAmount: 0,
        refundableAmount: result.status === PaymentStatus.SUCCESS ? result.amount.toNumber() : 0,
        refunds: [],
        createdAt: result.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to record payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payment',
    };
  }
}

/**
 * Creates a refund against a successful payment.
 * Requires PAYMENT_REFUND permission (Restricted to OWNER and ADMIN).
 */
export async function createPaymentRefund(
  input: CreateRefundInput
): Promise<ActionResult<PaymentRecord>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_REFUND);
    const parsed = createRefundSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };
    }

    const { paymentId, amount, reason, referenceNumber, notes } = parsed.data;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: { select: { id: true, orderNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
        refunds: true,
      },
    });

    if (!payment) {
      return { success: false, error: 'Payment not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, payment.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      return {
        success: false,
        error: `Cannot refund payment with status: ${payment.status}`,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-fetch payment inside transaction to guarantee state safety under concurrency
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (
        !currentPayment ||
        (currentPayment.status !== PaymentStatus.SUCCESS &&
          currentPayment.status !== PaymentStatus.PARTIALLY_REFUNDED)
      ) {
        throw new Error(`Cannot refund payment with status: ${currentPayment?.status || 'UNKNOWN'}`);
      }

      // Re-fetch existing refunds inside transaction for strict atomicity
      const existingRefunds = await tx.paymentRefund.findMany({
        where: {
          paymentId: payment.id,
          status: RefundStatus.SUCCESS,
        },
        select: {
          amount: true,
        },
      });

      const previouslyRefunded = existingRefunds.reduce(
        (sum, r) => sum + r.amount.toNumber(),
        0
      );
      const paymentAmount = payment.amount.toNumber();
      const refundableBalance = Math.max(0, Math.round((paymentAmount - previouslyRefunded) * 100) / 100);

      if (amount > refundableBalance + 0.001) {
        throw new Error(
          `Refund amount (₹${amount.toFixed(2)}) exceeds refundable balance (₹${refundableBalance.toFixed(2)})`
        );
      }

      const refundNumber = await generateRefundNumber(tx);

      // Create refund record
      await tx.paymentRefund.create({
        data: {
          refundNumber,
          paymentId: payment.id,
          amount: new Prisma.Decimal(amount),
          reason,
          status: RefundStatus.SUCCESS,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          processedBy: user.name || user.email,
        },
      });

      const newTotalRefunded = Math.round((previouslyRefunded + amount) * 100) / 100;
      const isFullyRefunded = newTotalRefunded >= paymentAmount - 0.001;

      const newStatus = isFullyRefunded
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
        },
        include: {
          order: { select: { orderNumber: true } },
          branch: { select: { name: true, code: true } },
          refunds: { orderBy: { createdAt: 'desc' } },
        },
      });

      // Audit log entry
      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: 'REFUND_CREATED',
          fromStatus: payment.status,
          toStatus: newStatus,
          amount: new Prisma.Decimal(amount),
          performedBy: user.name || user.email,
          notes: `Refund ${refundNumber} issued. Reason: ${reason}`,
        },
      });

      // Append to central audit log
      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: payment.branchId,
          action: AUDIT_ACTIONS.PAYMENT_REFUND,
          entityType: AUDIT_ENTITY_TYPES.PAYMENT_REFUND,
          entityId: payment.id,
          description: `Processed ₹${amount.toFixed(2)} refund (${refundNumber}) for payment ${payment.paymentNumber}. Reason: ${reason}`,
          beforeData: { status: payment.status },
          afterData: { status: newStatus, refundedAmount: amount },
          metadata: {
            refundNumber,
            paymentNumber: payment.paymentNumber,
            reason,
          },
        },
        tx
      );

      return { updatedPayment, newTotalRefunded };
    });

    revalidatePath(`/orders/${payment.orderId}`);
    revalidatePath('/orders');
    revalidatePath('/payments');
    revalidatePath('/payments/reconciliation');

    const updated = result.updatedPayment;
    const paymentAmt = updated.amount.toNumber();
    const totalRef = result.newTotalRefunded;

    return {
      success: true,
      data: {
        id: updated.id,
        paymentNumber: updated.paymentNumber,
        orderId: updated.orderId,
        orderNumber: updated.order.orderNumber,
        branchId: updated.branchId,
        branchName: updated.branch.name,
        branchCode: updated.branch.code,
        amount: paymentAmt,
        method: updated.method,
        status: updated.status,
        referenceNumber: updated.referenceNumber,
        notes: updated.notes,
        processedBy: updated.processedBy,
        processedAt: updated.processedAt.toISOString(),
        refundedAmount: totalRef,
        refundableAmount: Math.max(0, Math.round((paymentAmt - totalRef) * 100) / 100),
        refunds: updated.refunds.map((r) => ({
          id: r.id,
          refundNumber: r.refundNumber,
          paymentId: r.paymentId,
          amount: r.amount.toNumber(),
          reason: r.reason,
          status: r.status,
          processedBy: r.processedBy,
          processedAt: r.processedAt.toISOString(),
          referenceNumber: r.referenceNumber,
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        })),
        createdAt: updated.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to process refund:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process refund',
    };
  }
}

/**
 * Fetches paginated payment records with filtering, searching, and branch authorization.
 */
export async function getPayments(
  filters: PaymentFilterInput = { page: 1, limit: 20 }
): Promise<ActionResult<PaymentListResponse>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_READ);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = paymentFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return { success: false, error: 'Invalid filter parameters' };
    }

    const { branchId, method, status, search, startDate, endDate, page, limit } = parsed.data;

    // Apply branch scoping
    const where: Prisma.PaymentWhereInput = {};

    if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (method) {
      where.method = method;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.processedAt = {};
      if (startDate) {
        where.processedAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.processedAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { paymentNumber: { contains: q, mode: 'insensitive' } },
        { order: { orderNumber: { contains: q, mode: 'insensitive' } } },
        { referenceNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          order: { select: { orderNumber: true } },
          branch: { select: { name: true, code: true } },
          refunds: {
            where: { status: RefundStatus.SUCCESS },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { processedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formattedPayments: PaymentRecord[] = payments.map((p) => {
      const pAmount = p.amount.toNumber();
      const refundedSum = p.refunds.reduce((sum, r) => sum + r.amount.toNumber(), 0);
      const roundedRefunded = Math.round(refundedSum * 100) / 100;
      const refundable =
        p.status === PaymentStatus.SUCCESS || p.status === PaymentStatus.PARTIALLY_REFUNDED
          ? Math.max(0, Math.round((pAmount - roundedRefunded) * 100) / 100)
          : 0;

      return {
        id: p.id,
        paymentNumber: p.paymentNumber,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        branchId: p.branchId,
        branchName: p.branch.name,
        branchCode: p.branch.code,
        amount: pAmount,
        method: p.method,
        status: p.status,
        referenceNumber: p.referenceNumber,
        notes: p.notes,
        processedBy: p.processedBy,
        processedAt: p.processedAt.toISOString(),
        refundedAmount: roundedRefunded,
        refundableAmount: refundable,
        refunds: p.refunds.map((r) => ({
          id: r.id,
          refundNumber: r.refundNumber,
          paymentId: r.paymentId,
          amount: r.amount.toNumber(),
          reason: r.reason,
          status: r.status,
          processedBy: r.processedBy,
          processedAt: r.processedAt.toISOString(),
          referenceNumber: r.referenceNumber,
          notes: r.notes,
          createdAt: r.createdAt.toISOString(),
        })),
        createdAt: p.createdAt.toISOString(),
      };
    });

    return {
      success: true,
      data: {
        payments: formattedPayments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get payments:', error);
    return { success: false, error: 'Failed to retrieve payments' };
  }
}

/**
 * Calculates operational payment statistics and KPI totals.
 */
export async function getPaymentStats(
  branchId?: string,
  startDate?: string,
  endDate?: string
): Promise<ActionResult<PaymentStats>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_READ);
    const scope = await getAuthorizedBranchScope(user);

    const where: Prisma.PaymentWhereInput = {};

    if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (startDate || endDate) {
      where.processedAt = {};
      if (startDate) {
        where.processedAt.gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        where.processedAt.lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        method: true,
        status: true,
        refunds: {
          where: { status: RefundStatus.SUCCESS },
          select: { amount: true },
        },
      },
    });

    const stats: PaymentStats = {
      totalSuccessfulPayments: { count: 0, amount: 0 },
      cash: { count: 0, amount: 0 },
      upi: { count: 0, amount: 0 },
      card: { count: 0, amount: 0 },
      online: { count: 0, amount: 0 },
      other: { count: 0, amount: 0 },
      failed: { count: 0, amount: 0 },
      refunded: { count: 0, amount: 0 },
    };

    for (const p of payments) {
      const amt = p.amount.toNumber();

      if (
        p.status === PaymentStatus.SUCCESS ||
        p.status === PaymentStatus.PARTIALLY_REFUNDED ||
        p.status === PaymentStatus.REFUNDED
      ) {
        stats.totalSuccessfulPayments.count += 1;
        stats.totalSuccessfulPayments.amount += amt;

        switch (p.method) {
          case PaymentMethod.CASH:
            stats.cash.count += 1;
            stats.cash.amount += amt;
            break;
          case PaymentMethod.UPI:
            stats.upi.count += 1;
            stats.upi.amount += amt;
            break;
          case PaymentMethod.CARD:
            stats.card.count += 1;
            stats.card.amount += amt;
            break;
          case PaymentMethod.ONLINE:
            stats.online.count += 1;
            stats.online.amount += amt;
            break;
          case PaymentMethod.OTHER:
            stats.other.count += 1;
            stats.other.amount += amt;
            break;
        }
      } else if (p.status === PaymentStatus.FAILED) {
        stats.failed.count += 1;
        stats.failed.amount += amt;
      }

      // Tally refunds
      for (const r of p.refunds) {
        const rAmt = r.amount.toNumber();
        stats.refunded.count += 1;
        stats.refunded.amount += rAmt;
      }
    }

    // Round amounts to 2 decimal places
    const round2 = (n: number) => Math.round(n * 100) / 100;
    stats.totalSuccessfulPayments.amount = round2(stats.totalSuccessfulPayments.amount);
    stats.cash.amount = round2(stats.cash.amount);
    stats.upi.amount = round2(stats.upi.amount);
    stats.card.amount = round2(stats.card.amount);
    stats.online.amount = round2(stats.online.amount);
    stats.other.amount = round2(stats.other.amount);
    stats.failed.amount = round2(stats.failed.amount);
    stats.refunded.amount = round2(stats.refunded.amount);

    return { success: true, data: stats };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get payment stats:', error);
    return { success: false, error: 'Failed to retrieve payment statistics' };
  }
}

/**
 * Fetches tender totals and reconciliation status for a specific branch and date.
 */
export async function getDailyReconciliationData(
  branchId: string,
  dateStr: string
): Promise<ActionResult<DailyReconciliationData>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_RECONCILE);
    const scope = await getAuthorizedBranchScope(user);

    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, code: true },
    });

    if (!branch) {
      return { success: false, error: 'Branch not found' };
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const nextDate = new Date(`${dateStr}T23:59:59.999Z`);

    // Fetch payments on that date
    const payments = await prisma.payment.findMany({
      where: {
        branchId,
        processedAt: {
          gte: targetDate,
          lte: nextDate,
        },
        status: {
          in: [PaymentStatus.SUCCESS, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
        },
      },
      select: {
        amount: true,
        method: true,
        refunds: {
          where: {
            status: RefundStatus.SUCCESS,
            processedAt: {
              gte: targetDate,
              lte: nextDate,
            },
          },
          select: { amount: true },
        },
      },
    });

    let systemCash = 0;
    let systemUpi = 0;
    let systemCard = 0;
    let systemOnline = 0;
    let systemOther = 0;
    let totalRefunds = 0;
    let cashPaymentCount = 0;

    for (const p of payments) {
      const amt = p.amount.toNumber();
      switch (p.method) {
        case PaymentMethod.CASH:
          systemCash += amt;
          cashPaymentCount += 1;
          break;
        case PaymentMethod.UPI:
          systemUpi += amt;
          break;
        case PaymentMethod.CARD:
          systemCard += amt;
          break;
        case PaymentMethod.ONLINE:
          systemOnline += amt;
          break;
        case PaymentMethod.OTHER:
          systemOther += amt;
          break;
      }

      for (const r of p.refunds) {
        totalRefunds += r.amount.toNumber();
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    systemCash = round2(systemCash);
    systemUpi = round2(systemUpi);
    systemCard = round2(systemCard);
    systemOnline = round2(systemOnline);
    systemOther = round2(systemOther);
    const systemTotal = round2(systemCash + systemUpi + systemCard + systemOnline + systemOther);
    totalRefunds = round2(totalRefunds);

    // Fetch existing reconciliation record for that branch and date if present
    const existingRec = await prisma.paymentReconciliation.findFirst({
      where: {
        branchId,
        date: targetDate,
      },
    });

    return {
      success: true,
      data: {
        branchId: branch.id,
        branchName: branch.name,
        branchCode: branch.code,
        date: dateStr,
        systemCash,
        systemUpi,
        systemCard,
        systemOnline,
        systemOther,
        systemTotal,
        totalRefunds,
        cashPaymentCount,
        existingReconciliation: existingRec
          ? {
              id: existingRec.id,
              actualCash: existingRec.actualCash.toNumber(),
              variance: existingRec.variance.toNumber(),
              note: existingRec.note,
              reconciledBy: existingRec.reconciledBy,
              reconciledAt: existingRec.reconciledAt.toISOString(),
              status: existingRec.status,
            }
          : null,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get reconciliation data:', error);
    return { success: false, error: 'Failed to retrieve daily reconciliation data' };
  }
}

/**
 * Submits or updates daily physical cash reconciliation.
 * Computes Variance = Actual Cash - System Cash objectively.
 */
export async function submitReconciliation(
  input: SubmitReconciliationInput
): Promise<ActionResult<ReconciliationHistoryItem>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_RECONCILE);
    const parsed = submitReconciliationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };
    }

    const { branchId, date, actualCash, note, status } = parsed.data;

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const targetDate = new Date(`${date}T00:00:00.000Z`);
    const nextDate = new Date(`${date}T23:59:59.999Z`);

    const result = await prisma.$transaction(async (tx) => {
      // Re-calculate trusted system cash within transaction
      const cashPayments = await tx.payment.findMany({
        where: {
          branchId,
          method: PaymentMethod.CASH,
          processedAt: {
            gte: targetDate,
            lte: nextDate,
          },
          status: {
            in: [PaymentStatus.SUCCESS, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED],
          },
        },
        select: {
          amount: true,
        },
      });

      const rawSystemCash = cashPayments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      const systemCash = Math.round(rawSystemCash * 100) / 100;
      const variance = Math.round((actualCash - systemCash) * 100) / 100;

      // Upsert reconciliation record
      const reconciliation = await tx.paymentReconciliation.upsert({
        where: {
          branchId_date: {
            branchId,
            date: targetDate,
          },
        },
        update: {
          systemCash: new Prisma.Decimal(systemCash),
          actualCash: new Prisma.Decimal(actualCash),
          variance: new Prisma.Decimal(variance),
          note: note || null,
          reconciledBy: user.name || user.email,
          reconciledAt: new Date(),
          status: status || ReconciliationStatus.RECONCILED,
        },
        create: {
          branchId,
          date: targetDate,
          systemCash: new Prisma.Decimal(systemCash),
          actualCash: new Prisma.Decimal(actualCash),
          variance: new Prisma.Decimal(variance),
          note: note || null,
          reconciledBy: user.name || user.email,
          reconciledAt: new Date(),
          status: status || ReconciliationStatus.RECONCILED,
        },
        include: {
          branch: { select: { name: true, code: true } },
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId,
          action: AUDIT_ACTIONS.STATUS_CHANGE,
          entityType: AUDIT_ENTITY_TYPES.PAYMENT,
          entityId: reconciliation.id,
          description: `Recorded daily cash reconciliation for ${date} (Actual: ₹${actualCash.toFixed(2)}, Variance: ₹${variance.toFixed(2)})`,
          afterData: {
            date,
            systemCash,
            actualCash,
            variance,
            status: reconciliation.status,
          },
        },
        tx
      );

      return reconciliation;
    });

    revalidatePath('/payments/reconciliation');
    revalidatePath('/payments');

    return {
      success: true,
      data: {
        id: result.id,
        branchId: result.branchId,
        branchName: result.branch.name,
        branchCode: result.branch.code,
        date,
        systemCash: result.systemCash.toNumber(),
        actualCash: result.actualCash.toNumber(),
        variance: result.variance.toNumber(),
        note: result.note,
        reconciledBy: result.reconciledBy,
        reconciledAt: result.reconciledAt.toISOString(),
        status: result.status,
        createdAt: result.createdAt.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to submit reconciliation:', error);
    return { success: false, error: 'Failed to record daily reconciliation' };
  }
}

/**
 * Retrieves historical reconciliation records.
 */
export async function getReconciliationHistory(
  branchId?: string,
  limit: number = 30
): Promise<ActionResult<ReconciliationHistoryItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.PAYMENT_RECONCILE);
    const scope = await getAuthorizedBranchScope(user);

    const where: Prisma.PaymentReconciliationWhereInput = {};

    if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    } else if (branchId) {
      where.branchId = branchId;
    }

    const records = await prisma.paymentReconciliation.findMany({
      where,
      include: {
        branch: { select: { name: true, code: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        branchId: r.branchId,
        branchName: r.branch.name,
        branchCode: r.branch.code,
        date: r.date.toISOString().split('T')[0],
        systemCash: r.systemCash.toNumber(),
        actualCash: r.actualCash.toNumber(),
        variance: r.variance.toNumber(),
        note: r.note,
        reconciledBy: r.reconciledBy,
        reconciledAt: r.reconciledAt.toISOString(),
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get reconciliation history:', error);
    return { success: false, error: 'Failed to retrieve reconciliation history' };
  }
}
