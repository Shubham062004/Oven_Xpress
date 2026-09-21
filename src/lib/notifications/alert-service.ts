import { prisma } from '@/lib/db/prisma';
import {
  ExpenseStatus,
  BonusStatus,
  SalaryRecordStatus,
  PaymentStatus,
  OrderStatus,
  StockTransactionType,
} from '@prisma/client';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { calculateBatchStock } from '@/lib/inventory/actions';
import { deriveOrderPaymentSummary } from '@/lib/payments/constants';
import {
  createNotificationsForEligibleUsers,
  resolveNotificationsForEntity,
} from './notification-service';
import type { AlertEvaluationResult } from './types';

/**
 * Centralized, idempotent, permission-aware operational alert evaluation engine.
 * Scans operational records within the target branch (or all branches for owner/admin),
 * derives active alerts, prevents duplicates via deterministic keys,
 * and auto-resolves cleared alerts.
 */
export async function evaluateAlerts(options?: {
  branchId?: string;
}): Promise<AlertEvaluationResult> {
  const branchId = options?.branchId;
  const branchWhere = branchId ? { branchId } : {};

  let evaluatedCount = 0;
  let generatedCount = 0;
  let resolvedCount = 0;
  const alerts: AlertEvaluationResult['alerts'] = [];

  // ─── 1. Low Stock & Out of Stock Alerts ────────────────────────────────────
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: {
      status: 'ACTIVE',
      ...branchWhere,
    },
    include: {
      ingredient: { select: { id: true, name: true, unit: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  if (inventoryItems.length > 0) {
    const branchIds = Array.from(new Set(inventoryItems.map((i) => i.branchId)));
    const ingredientIds = Array.from(new Set(inventoryItems.map((i) => i.ingredientId)));
    const stockMap = await calculateBatchStock(branchIds, ingredientIds);

    for (const item of inventoryItems) {
      evaluatedCount++;
      const currentStock = stockMap.get(`${item.branchId}:${item.ingredientId}`) ?? 0;
      const minStock = Number(item.minimumStock);
      const reorderLvl = Number(item.reorderLevel);

      if (currentStock <= 0) {
        // OUT OF STOCK
        const created = await createNotificationsForEligibleUsers({
          type: 'OUT_OF_STOCK',
          severity: 'CRITICAL',
          title: `Out of Stock: ${item.ingredient.name}`,
          message: `Stock for ${item.ingredient.name} at ${item.branch.name} is depleted (Current: ${currentStock} ${item.ingredient.unit}, Reorder level: ${reorderLvl} ${item.ingredient.unit}). Immediate replenishment needed.`,
          branchId: item.branchId,
          entityType: 'InventoryItem',
          entityId: item.id,
          actionUrl: '/inventory',
          requiredPermission: PERMISSIONS.INVENTORY_READ,
        });

        if (created > 0) {
          generatedCount += created;
          alerts.push({
            type: 'OUT_OF_STOCK',
            title: `Out of Stock: ${item.ingredient.name}`,
            branchId: item.branchId,
            severity: 'CRITICAL',
          });
        }
      } else if (currentStock <= minStock || currentStock <= reorderLvl) {
        // LOW STOCK
        const created = await createNotificationsForEligibleUsers({
          type: 'LOW_STOCK',
          severity: 'WARNING',
          title: `Low Stock: ${item.ingredient.name}`,
          message: `Stock for ${item.ingredient.name} at ${item.branch.name} is low (Current: ${currentStock} ${item.ingredient.unit}, Reorder level: ${reorderLvl} ${item.ingredient.unit}). Reorder recommended.`,
          branchId: item.branchId,
          entityType: 'InventoryItem',
          entityId: item.id,
          actionUrl: '/inventory',
          requiredPermission: PERMISSIONS.INVENTORY_READ,
        });

        if (created > 0) {
          generatedCount += created;
          alerts.push({
            type: 'LOW_STOCK',
            title: `Low Stock: ${item.ingredient.name}`,
            branchId: item.branchId,
            severity: 'WARNING',
          });
        }
      } else {
        // Stock is healthy -> auto-resolve existing low-stock/out-of-stock notifications
        const resolved = await resolveNotificationsForEntity('InventoryItem', item.id);
        resolvedCount += resolved;
      }
    }
  }

  // ─── 2. Pending Approvals: Expenses ───────────────────────────────────────
  const pendingExpenses = await prisma.expense.findMany({
    where: {
      status: ExpenseStatus.PENDING_APPROVAL,
      ...branchWhere,
    },
    include: {
      category: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  for (const exp of pendingExpenses) {
    evaluatedCount++;
    const created = await createNotificationsForEligibleUsers({
      type: 'PENDING_EXPENSE_APPROVAL',
      severity: 'WARNING',
      title: `Expense Pending Approval: ${exp.expenseNumber}`,
      message: `Expense of ₹${Number(exp.amount).toFixed(2)} (${exp.category.name}) at ${exp.branch.name} requires verification.`,
      branchId: exp.branchId,
      entityType: 'Expense',
      entityId: exp.id,
      actionUrl: '/expenses',
      requiredPermission: PERMISSIONS.EXPENSE_APPROVE,
    });

    if (created > 0) {
      generatedCount += created;
      alerts.push({
        type: 'PENDING_EXPENSE_APPROVAL',
        title: `Expense Pending Approval: ${exp.expenseNumber}`,
        branchId: exp.branchId,
        severity: 'WARNING',
      });
    }
  }

  // ─── 3. Pending Approvals: Bonuses ─────────────────────────────────────────
  const pendingBonuses = await prisma.bonus.findMany({
    where: {
      status: BonusStatus.PENDING_APPROVAL,
      ...branchWhere,
    },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
  });

  for (const bonus of pendingBonuses) {
    evaluatedCount++;
    const created = await createNotificationsForEligibleUsers({
      type: 'PENDING_BONUS_APPROVAL',
      severity: 'INFO',
      title: `Bonus Pending Approval: ${bonus.employee.firstName} ${bonus.employee.lastName}`,
      message: `Bonus of ₹${Number(bonus.amount).toFixed(2)} (${bonus.type}) for ${bonus.employee.firstName} at ${bonus.branch.name} requires review.`,
      branchId: bonus.branchId,
      entityType: 'Bonus',
      entityId: bonus.id,
      actionUrl: '/salary',
      requiredPermission: PERMISSIONS.BONUS_APPROVE,
    });

    if (created > 0) {
      generatedCount += created;
      alerts.push({
        type: 'PENDING_BONUS_APPROVAL',
        title: `Bonus Pending Approval: ${bonus.employee.firstName} ${bonus.employee.lastName}`,
        branchId: bonus.branchId,
        severity: 'INFO',
      });
    }
  }

  // ─── 4. Pending Approvals: Salary Records ─────────────────────────────────
  const pendingSalaries = await prisma.salaryRecord.findMany({
    where: {
      status: SalaryRecordStatus.PENDING_REVIEW,
      ...branchWhere,
    },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
  });

  for (const sr of pendingSalaries) {
    evaluatedCount++;
    const created = await createNotificationsForEligibleUsers({
      type: 'PENDING_SALARY_REVIEW',
      severity: 'WARNING',
      title: `Salary Record Pending Review: ${sr.salaryNumber}`,
      message: `Salary record of ₹${Number(sr.grossAmount).toFixed(2)} for ${sr.employee.firstName} ${sr.employee.lastName} at ${sr.branch.name} requires executive review.`,
      branchId: sr.branchId,
      entityType: 'SalaryRecord',
      entityId: sr.id,
      actionUrl: '/salary/records',
      requiredPermission: PERMISSIONS.SALARY_APPROVE,
    });

    if (created > 0) {
      generatedCount += created;
      alerts.push({
        type: 'PENDING_SALARY_REVIEW',
        title: `Salary Record Pending Review: ${sr.salaryNumber}`,
        branchId: sr.branchId,
        severity: 'WARNING',
      });
    }
  }

  // ─── 5. Payment Alerts: Failed Payments ───────────────────────────────────
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failedPayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.FAILED,
      createdAt: { gte: oneDayAgo },
      ...branchWhere,
    },
    include: {
      order: { select: { orderNumber: true } },
      branch: { select: { name: true } },
    },
    take: 20,
  });

  for (const p of failedPayments) {
    evaluatedCount++;
    const created = await createNotificationsForEligibleUsers({
      type: 'FAILED_PAYMENT',
      severity: 'CRITICAL',
      title: `Failed Payment: ${p.paymentNumber}`,
      message: `Payment attempt of ₹${Number(p.amount).toFixed(2)} for Order #${p.order.orderNumber} at ${p.branch.name} failed via ${p.method}.`,
      branchId: p.branchId,
      entityType: 'Payment',
      entityId: p.id,
      actionUrl: '/payments',
      requiredPermission: PERMISSIONS.PAYMENT_READ,
    });

    if (created > 0) {
      generatedCount += created;
      alerts.push({
        type: 'FAILED_PAYMENT',
        title: `Failed Payment: ${p.paymentNumber}`,
        branchId: p.branchId,
        severity: 'CRITICAL',
      });
    }
  }

  // ─── 6. Unpaid Completed Orders ───────────────────────────────────────────
  const completedOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.COMPLETED,
      createdAt: { gte: oneDayAgo },
      ...branchWhere,
    },
    include: {
      branch: { select: { name: true } },
      payments: {
        select: {
          amount: true,
          status: true,
          refunds: { select: { amount: true, status: true } },
        },
      },
    },
    take: 50,
  });

  for (const order of completedOrders) {
    evaluatedCount++;
    const totalAmount = Number(order.totalAmount);
    const mappedPayments = order.payments.map((pm) => ({
      amount: Number(pm.amount),
      status: pm.status,
      refunds: pm.refunds.map((r) => ({
        amount: Number(r.amount),
        status: r.status,
      })),
    }));

    const paymentSummary = deriveOrderPaymentSummary(totalAmount, mappedPayments);

    if (paymentSummary.status === 'UNPAID' || paymentSummary.status === 'PARTIALLY_PAID') {
      const created = await createNotificationsForEligibleUsers({
        type: 'UNPAID_ORDER',
        severity: 'WARNING',
        title: `Unpaid Order: #${order.orderNumber}`,
        message: `Order #${order.orderNumber} is ${order.status.toLowerCase()} at ${order.branch.name} but has ₹${paymentSummary.remainingAmount.toFixed(2)} outstanding balance.`,
        branchId: order.branchId,
        entityType: 'Order',
        entityId: order.id,
        actionUrl: '/orders',
        requiredPermission: PERMISSIONS.ORDER_READ,
      });

      if (created > 0) {
        generatedCount += created;
        alerts.push({
          type: 'UNPAID_ORDER',
          title: `Unpaid Order: #${order.orderNumber}`,
          branchId: order.branchId,
          severity: 'WARNING',
        });
      }
    } else {
      // Order is fully paid -> auto-resolve any previous unpaid order notification
      const resolved = await resolveNotificationsForEntity('Order', order.id);
      resolvedCount += resolved;
    }
  }

  // ─── 7. Stock Variance Alerts ──────────────────────────────────────────────
  const reconciliationTxs = await prisma.stockTransaction.findMany({
    where: {
      createdAt: { gte: oneDayAgo },
      note: { startsWith: 'Physical Reconciliation:' },
      type: { in: [StockTransactionType.ADJUSTMENT_IN, StockTransactionType.ADJUSTMENT_OUT] },
      ...branchWhere,
    },
    include: {
      ingredient: { select: { name: true } },
      branch: { select: { name: true } },
    },
    take: 20,
  });

  for (const tx of reconciliationTxs) {
    evaluatedCount++;
    const created = await createNotificationsForEligibleUsers({
      type: 'STOCK_VARIANCE',
      severity: 'WARNING',
      title: `Stock Variance: ${tx.ingredient.name}`,
      message: `Stock variance detected for ${tx.ingredient.name} at ${tx.branch.name}. ${tx.note}. Review the reconciliation record.`,
      branchId: tx.branchId,
      entityType: 'StockTransaction',
      entityId: tx.id,
      actionUrl: '/inventory',
      requiredPermission: PERMISSIONS.INVENTORY_RECONCILE,
    });

    if (created > 0) {
      generatedCount += created;
      alerts.push({
        type: 'STOCK_VARIANCE',
        title: `Stock Variance: ${tx.ingredient.name}`,
        branchId: tx.branchId,
        severity: 'WARNING',
      });
    }
  }

  return {
    evaluatedCount,
    generatedCount,
    resolvedCount,
    alerts,
  };
}
