'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  openingStockSchema,
  stockReceiptSchema,
  wastageDamageSchema,
  stockAdjustmentSchema,
  stockTransferSchema,
  stockReconciliationSchema,
  updateInventoryItemSchema,
  inventoryFilterSchema,
  WASTAGE_REASON_LABELS,
  TRANSACTION_TYPE_LABELS,
  type OpeningStockInput,
  type StockReceiptInput,
  type WastageDamageInput,
  type StockAdjustmentInput,
  type StockTransferInput,
  type StockReconciliationInput,
  type UpdateInventoryItemInput,
  type InventoryFilterInput,
} from '@/lib/validations/inventory';
import type { ActionResult } from '@/lib/auth/types';
import {
  calculateStockHealth,
  getTransactionDirection,
  IN_TRANSACTION_TYPES,
  OUT_TRANSACTION_TYPES,
  type InventoryDashboardData,
  type InventoryItemDetail,
  type InventoryItemListItem,
  type StockTransactionItem,
} from '@/lib/inventory/types';
import { InventoryStatus, StockTransactionType, Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit/audit-types';

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
 * Calculates current stock for a single (branchId, ingredientId) using Prisma groupBy aggregation.
 * Supports passing (tx, branchId, ingredientId) or (branchId, ingredientId).
 */
export async function calculateCurrentStock(
  branchOrTx: Prisma.TransactionClient | typeof prisma | string,
  branchOrIngredient: string,
  maybeIngredient?: string
): Promise<number> {
  let tx: Prisma.TransactionClient | typeof prisma = prisma;
  let branchId: string;
  let ingredientId: string;

  if (typeof branchOrTx === 'string') {
    branchId = branchOrTx;
    ingredientId = branchOrIngredient;
  } else {
    tx = branchOrTx;
    branchId = branchOrIngredient;
    ingredientId = maybeIngredient!;
  }

  const groups = await tx.stockTransaction.groupBy({
    by: ['type'],
    where: { branchId, ingredientId },
    _sum: { quantity: true },
  });

  let currentStock = 0;
  for (const group of groups) {
    const qty = Number(group._sum.quantity || 0);
    if (IN_TRANSACTION_TYPES.includes(group.type)) {
      currentStock += qty;
    } else if (OUT_TRANSACTION_TYPES.includes(group.type)) {
      currentStock -= qty;
    }
  }

  return Math.round(currentStock * 1000) / 1000;
}

/**
 * Batch stock calculation across multiple branches and ingredients.
 * Uses a single database query avoiding N+1 performance penalties.
 */
export async function calculateBatchStock(
  branchIds: string | string[],
  ingredientIds?: string[]
): Promise<Map<string, number>> {
  const branches = Array.isArray(branchIds) ? branchIds : [branchIds];
  const where: Prisma.StockTransactionWhereInput = {};
  if (branches.length > 0) {
    where.branchId = { in: branches };
  }
  if (ingredientIds && ingredientIds.length > 0) {
    where.ingredientId = { in: ingredientIds };
  }

  const groups = await prisma.stockTransaction.groupBy({
    by: ['branchId', 'ingredientId', 'type'],
    where,
    _sum: { quantity: true },
  });

  const stockMap = new Map<string, number>();
  for (const group of groups) {
    const key = `${group.branchId}:${group.ingredientId}`;
    const qty = Number(group._sum.quantity || 0);
    const existing = stockMap.get(key) || 0;
    if (IN_TRANSACTION_TYPES.includes(group.type)) {
      stockMap.set(key, existing + qty);
    } else {
      stockMap.set(key, existing - qty);
    }
  }

  // Round stock values to avoid floating point precision issues
  for (const [key, val] of stockMap.entries()) {
    stockMap.set(key, Math.round(val * 1000) / 1000);
  }

  return stockMap;
}

// ─── Dashboard & Read Actions ───────────────────────────────────────────────

export async function getInventoryDashboardData(
  params?: InventoryFilterInput
): Promise<ActionResult<InventoryDashboardData>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ);
    const scope = await getAuthorizedBranchScope(user);

    const validated = inventoryFilterSchema.parse(params ?? {});
    const { branchId, stockStatus, status, search, page = 1, limit = 50 } = validated;

    // Resolve branch filtering
    let targetBranchIds: string[] = [];
    if (scope.isAllBranches) {
      if (branchId && branchId !== 'ALL') {
        targetBranchIds = [branchId];
      }
    } else {
      targetBranchIds = scope.branchIds;
    }

    // Build Prisma query for inventory items
    const itemWhere: Prisma.InventoryItemWhereInput = {};
    if (targetBranchIds.length > 0) {
      itemWhere.branchId = { in: targetBranchIds };
    }
    if (status && status !== 'ALL') {
      itemWhere.status = status as InventoryStatus;
    }
    if (search && search.trim().length > 0) {
      itemWhere.ingredient = {
        name: { contains: search.trim(), mode: 'insensitive' },
      };
    }

    // Fetch items with relations
    const [rawItems, allBranches, allIngredients] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: itemWhere,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          ingredient: { select: { id: true, name: true, unit: true } },
        },
        orderBy: [{ branch: { name: 'asc' } }, { ingredient: { name: 'asc' } }],
      }),
      prisma.branch.findMany({
        where: scope.isAllBranches ? { status: 'ACTIVE' } : { id: { in: scope.branchIds }, status: 'ACTIVE' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.ingredient.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, unit: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    // Calculate stock across all retrieved items
    const distinctBranchIds = Array.from(new Set(rawItems.map((i) => i.branchId)));
    const distinctIngIds = Array.from(new Set(rawItems.map((i) => i.ingredientId)));
    const stockMap = await calculateBatchStock(distinctBranchIds, distinctIngIds);

    // Map into list items with derived health status
    let mappedItems: InventoryItemListItem[] = rawItems.map((item) => {
      const stock = stockMap.get(`${item.branchId}:${item.ingredientId}`) || 0;
      const minStock = Number(item.minimumStock);
      const reorder = Number(item.reorderLevel);
      const health = calculateStockHealth(stock, minStock, reorder);

      return {
        id: item.id,
        branchId: item.branchId,
        branchName: item.branch.name,
        branchCode: item.branch.code,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        unit: item.ingredient.unit,
        currentStock: stock,
        minimumStock: minStock,
        reorderLevel: reorder,
        healthStatus: health,
        status: item.status,
        updatedAt: item.updatedAt.toISOString(),
      };
    });

    // Apply stock health filter if requested
    if (stockStatus && stockStatus !== 'ALL') {
      mappedItems = mappedItems.filter((i) => i.healthStatus === stockStatus);
    }

    // KPI Metrics calculation
    const totalTrackedItems = mappedItems.length;
    const lowStockItems = mappedItems.filter((i) => i.healthStatus === 'LOW_STOCK').length;
    const outOfStockItems = mappedItems.filter((i) => i.healthStatus === 'OUT_OF_STOCK').length;

    // Today's transaction stats
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayReceipts, todayWastage, recentTransactionsRaw] = await Promise.all([
      prisma.stockTransaction.count({
        where: {
          type: StockTransactionType.RECEIPT,
          createdAt: { gte: startOfToday },
          ...(targetBranchIds.length > 0 ? { branchId: { in: targetBranchIds } } : {}),
        },
      }),
      prisma.stockTransaction.count({
        where: {
          type: { in: [StockTransactionType.DAMAGE, StockTransactionType.WASTAGE] },
          createdAt: { gte: startOfToday },
          ...(targetBranchIds.length > 0 ? { branchId: { in: targetBranchIds } } : {}),
        },
      }),
      prisma.stockTransaction.findMany({
        where: targetBranchIds.length > 0 ? { branchId: { in: targetBranchIds } } : {},
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          branch: { select: { name: true } },
          ingredient: { select: { name: true } },
        },
      }),
    ]);

    const recentTransactions: StockTransactionItem[] = recentTransactionsRaw.map((tx) => ({
      id: tx.id,
      branchId: tx.branchId,
      branchName: tx.branch.name,
      ingredientId: tx.ingredientId,
      ingredientName: tx.ingredient.name,
      type: tx.type,
      typeLabel: TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
      direction: getTransactionDirection(tx.type),
      quantity: Number(tx.quantity),
      unit: tx.unit,
      referenceId: tx.referenceId,
      reason: tx.reason,
      reasonLabel: tx.reason ? WASTAGE_REASON_LABELS[tx.reason] || tx.reason : null,
      note: tx.note,
      performedBy: tx.performedBy,
      createdAt: tx.createdAt.toISOString(),
    }));

    // Pagination
    const total = mappedItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = mappedItems.slice((page - 1) * limit, page * limit);

    return {
      success: true,
      data: {
        stats: {
          totalTrackedItems,
          lowStockItems,
          outOfStockItems,
          todayReceiptsCount: todayReceipts,
          todayWastageCount: todayWastage,
          activeBranchesCount: allBranches.length,
        },
        items: paginatedItems,
        recentTransactions,
        branches: allBranches,
        ingredients: allIngredients,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getInventoryDashboardData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory dashboard data',
    };
  }
}

export async function getInventoryItemDetail(
  id: string
): Promise<ActionResult<InventoryItemDetail>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_READ);
    const scope = await getAuthorizedBranchScope(user);

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        ingredient: { select: { id: true, name: true, description: true, unit: true } },
      },
    });

    if (!item) {
      return { success: false, error: 'Inventory item not found' };
    }

    if (!isBranchAuthorized(scope, item.branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    // Fetch full transaction history for this item
    const transactionsRaw = await prisma.stockTransaction.findMany({
      where: {
        branchId: item.branchId,
        ingredientId: item.ingredientId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        branch: { select: { name: true } },
        ingredient: { select: { name: true } },
      },
    });

    // Compute totals per type
    const summary = {
      totalReceipts: 0,
      totalConsumption: 0,
      totalTransfersIn: 0,
      totalTransfersOut: 0,
      totalDamage: 0,
      totalWastage: 0,
      totalAdjustmentsIn: 0,
      totalAdjustmentsOut: 0,
    };

    let currentStock = 0;

    for (const tx of transactionsRaw) {
      const qty = Number(tx.quantity);
      switch (tx.type) {
        case 'OPENING':
        case 'RECEIPT':
          summary.totalReceipts += qty;
          currentStock += qty;
          break;
        case 'TRANSFER_IN':
          summary.totalTransfersIn += qty;
          currentStock += qty;
          break;
        case 'ADJUSTMENT_IN':
          summary.totalAdjustmentsIn += qty;
          currentStock += qty;
          break;
        case 'CONSUMPTION':
          summary.totalConsumption += qty;
          currentStock -= qty;
          break;
        case 'TRANSFER_OUT':
          summary.totalTransfersOut += qty;
          currentStock -= qty;
          break;
        case 'DAMAGE':
          summary.totalDamage += qty;
          currentStock -= qty;
          break;
        case 'WASTAGE':
          summary.totalWastage += qty;
          currentStock -= qty;
          break;
        case 'ADJUSTMENT_OUT':
          summary.totalAdjustmentsOut += qty;
          currentStock -= qty;
          break;
      }
    }

    currentStock = Math.round(currentStock * 1000) / 1000;
    const minStock = Number(item.minimumStock);
    const reorder = Number(item.reorderLevel);
    const health = calculateStockHealth(currentStock, minStock, reorder);

    const transactions: StockTransactionItem[] = transactionsRaw.map((tx) => ({
      id: tx.id,
      branchId: tx.branchId,
      branchName: tx.branch.name,
      ingredientId: tx.ingredientId,
      ingredientName: tx.ingredient.name,
      type: tx.type,
      typeLabel: TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
      direction: getTransactionDirection(tx.type),
      quantity: Number(tx.quantity),
      unit: tx.unit,
      referenceId: tx.referenceId,
      reason: tx.reason,
      reasonLabel: tx.reason ? WASTAGE_REASON_LABELS[tx.reason] || tx.reason : null,
      note: tx.note,
      performedBy: tx.performedBy,
      createdAt: tx.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        id: item.id,
        branchId: item.branchId,
        branchName: item.branch.name,
        branchCode: item.branch.code,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        ingredientDescription: item.ingredient.description,
        unit: item.ingredient.unit,
        currentStock,
        minimumStock: minStock,
        reorderLevel: reorder,
        healthStatus: health,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        summary,
        transactions,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getInventoryItemDetail error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory item details',
    };
  }
}

// ─── Stock Transaction Workflows ────────────────────────────────────────────

/**
 * Records Opening Stock for a branch + ingredient.
 * Blocks accidental duplicate opening stock records.
 */
export async function recordOpeningStock(
  input: OpeningStockInput
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_CREATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = openingStockSchema.parse(input);
    const { branchId, ingredientId, quantity, minimumStock, reorderLevel, note } = parsed;

    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, name: true, unit: true, status: true },
    });

    if (!ingredient || ingredient.status !== 'ACTIVE') {
      return { success: false, error: 'Ingredient not found or inactive' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check for duplicate opening transaction
      const existingOpening = await tx.stockTransaction.findFirst({
        where: { branchId, ingredientId, type: StockTransactionType.OPENING },
      });

      if (existingOpening) {
        throw new Error(
          'Opening stock has already been initialized for this item at this branch. Use Stock Adjustment to record counts or corrections.'
        );
      }

      // Upsert InventoryItem
      await tx.inventoryItem.upsert({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        create: {
          branchId,
          ingredientId,
          minimumStock: minimumStock ?? 0,
          reorderLevel: reorderLevel ?? 0,
          status: InventoryStatus.ACTIVE,
        },
        update: {
          minimumStock: minimumStock !== undefined ? minimumStock : undefined,
          reorderLevel: reorderLevel !== undefined ? reorderLevel : undefined,
          status: InventoryStatus.ACTIVE,
        },
      });

      // Create transaction
      const txRecord = await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId,
          type: StockTransactionType.OPENING,
          quantity: new Prisma.Decimal(quantity),
          unit: ingredient.unit,
          note: note && note.trim().length > 0 ? note.trim() : 'Initial Opening Stock',
          performedBy: user.name,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId,
          action: AUDIT_ACTIONS.CREATE,
          entityType: AUDIT_ENTITY_TYPES.INVENTORY_ITEM,
          entityId: ingredientId,
          description: `Initialized opening stock of ${quantity} ${ingredient.unit} for ${ingredient.name}`,
          afterData: {
            ingredientName: ingredient.name,
            quantity,
            unit: ingredient.unit,
            minimumStock,
            reorderLevel,
          },
          metadata: { transactionId: txRecord.id },
        },
        tx
      );

      return { transactionId: txRecord.id };
    });

    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('recordOpeningStock error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record opening stock',
    };
  }
}

/**
 * Records manual stock receipt.
 */
export async function recordStockReceipt(
  input: StockReceiptInput
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_CREATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = stockReceiptSchema.parse(input);
    const { branchId, ingredientId, quantity, referenceId, note } = parsed;

    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, name: true, unit: true, status: true },
    });

    if (!ingredient || ingredient.status !== 'ACTIVE') {
      return { success: false, error: 'Ingredient not found or inactive' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Ensure InventoryItem is active/tracked
      await tx.inventoryItem.upsert({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        create: {
          branchId,
          ingredientId,
          minimumStock: 0,
          reorderLevel: 0,
          status: InventoryStatus.ACTIVE,
        },
        update: {
          status: InventoryStatus.ACTIVE,
        },
      });

      const txRecord = await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId,
          type: StockTransactionType.RECEIPT,
          quantity: new Prisma.Decimal(quantity),
          unit: ingredient.unit,
          referenceId: referenceId?.trim() || null,
          note: note?.trim() || null,
          performedBy: user.name,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId,
          action: AUDIT_ACTIONS.INVENTORY_RECEIVE,
          entityType: AUDIT_ENTITY_TYPES.INVENTORY_ITEM,
          entityId: ingredientId,
          description: `Received ${quantity} ${ingredient.unit} of ${ingredient.name}`,
          afterData: {
            ingredientName: ingredient.name,
            quantity,
            unit: ingredient.unit,
            referenceId: referenceId?.trim() || null,
          },
          metadata: { transactionId: txRecord.id },
        },
        tx
      );

      return { transactionId: txRecord.id };
    });

    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('recordStockReceipt error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record stock receipt',
    };
  }
}

/**
 * Records damage or kitchen wastage with structured reason.
 * Validates sufficient stock exists.
 */
export async function recordWastageDamage(
  input: WastageDamageInput
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_WASTAGE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = wastageDamageSchema.parse(input);
    const { branchId, ingredientId, type, reason, quantity, note } = parsed;

    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, name: true, unit: true },
    });

    if (!ingredient) {
      return { success: false, error: 'Ingredient not found' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentStock = await calculateCurrentStock(tx, branchId, ingredientId);

      if (currentStock < quantity) {
        throw new Error(
          `Insufficient stock: current stock is ${currentStock} ${ingredient.unit}, cannot record loss of ${quantity} ${ingredient.unit}.`
        );
      }

      const txRecord = await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId,
          type,
          quantity: new Prisma.Decimal(quantity),
          unit: ingredient.unit,
          reason,
          note: note?.trim() || null,
          performedBy: user.name,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId,
          action: AUDIT_ACTIONS.INVENTORY_WASTAGE,
          entityType: AUDIT_ENTITY_TYPES.INVENTORY_ITEM,
          entityId: ingredientId,
          description: `Recorded ${quantity} ${ingredient.unit} ${type.toLowerCase()} for ${ingredient.name}. Reason: ${reason}`,
          afterData: {
            ingredientName: ingredient.name,
            type,
            quantity,
            unit: ingredient.unit,
            reason,
          },
          metadata: { transactionId: txRecord.id },
        },
        tx
      );

      return { transactionId: txRecord.id };
    });

    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('recordWastageDamage error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record wastage/damage',
    };
  }
}

/**
 * Records manual stock adjustment (ADJUSTMENT_IN or ADJUSTMENT_OUT).
 */
export async function recordStockAdjustment(
  input: StockAdjustmentInput
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = stockAdjustmentSchema.parse(input);
    const { branchId, ingredientId, direction, quantity, reason } = parsed;

    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, name: true, unit: true },
    });

    if (!ingredient) {
      return { success: false, error: 'Ingredient not found' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const type =
        direction === 'IN'
          ? StockTransactionType.ADJUSTMENT_IN
          : StockTransactionType.ADJUSTMENT_OUT;

      if (direction === 'OUT') {
        const currentStock = await calculateCurrentStock(tx, branchId, ingredientId);
        if (currentStock < quantity) {
          throw new Error(
            `Insufficient stock: current stock is ${currentStock} ${ingredient.unit}, cannot deduct ${quantity} ${ingredient.unit}.`
          );
        }
      }

      // Ensure item is tracked
      await tx.inventoryItem.upsert({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        create: {
          branchId,
          ingredientId,
          minimumStock: 0,
          reorderLevel: 0,
          status: InventoryStatus.ACTIVE,
        },
        update: { status: InventoryStatus.ACTIVE },
      });

      const txRecord = await tx.stockTransaction.create({
        data: {
          branchId,
          ingredientId,
          type,
          quantity: new Prisma.Decimal(quantity),
          unit: ingredient.unit,
          note: reason.trim(),
          performedBy: user.name,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId,
          action: AUDIT_ACTIONS.INVENTORY_ADJUST,
          entityType: AUDIT_ENTITY_TYPES.INVENTORY_ITEM,
          entityId: ingredientId,
          description: `Stock adjustment (${direction}) of ${quantity} ${ingredient.unit} for ${ingredient.name}. Reason: ${reason}`,
          afterData: {
            ingredientName: ingredient.name,
            direction,
            quantity,
            unit: ingredient.unit,
            reason,
          },
          metadata: { transactionId: txRecord.id },
        },
        tx
      );

      return { transactionId: txRecord.id };
    });

    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('recordStockAdjustment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record stock adjustment',
    };
  }
}

/**
 * Executes an atomic branch-to-branch stock transfer.
 * Generates linked TRANSFER_OUT and TRANSFER_IN transactions with common referenceId.
 */
export async function recordBranchTransfer(
  input: StockTransferInput
): Promise<ActionResult<{ referenceId: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_TRANSFER);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = stockTransferSchema.parse(input);
    const { sourceBranchId, destinationBranchId, ingredientId, quantity, note } = parsed;

    // Validate user access to source branch
    if (!isBranchAuthorized(scope, sourceBranchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to transfer stock out of the source branch',
      };
    }

    const [sourceBranch, destBranch, ingredient] = await Promise.all([
      prisma.branch.findUnique({ where: { id: sourceBranchId }, select: { name: true } }),
      prisma.branch.findUnique({ where: { id: destinationBranchId }, select: { name: true } }),
      prisma.ingredient.findUnique({
        where: { id: ingredientId },
        select: { id: true, name: true, unit: true, status: true },
      }),
    ]);

    if (!sourceBranch || !destBranch) {
      return { success: false, error: 'Source or destination branch not found' };
    }

    if (!ingredient || ingredient.status !== 'ACTIVE') {
      return { success: false, error: 'Ingredient not found or inactive' };
    }

    // Generate unique transfer reference ID
    const referenceId = `TRF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      // Check current stock at source branch
      const currentSourceStock = await calculateCurrentStock(tx, sourceBranchId, ingredientId);
      if (currentSourceStock < quantity) {
        throw new Error(
          `Insufficient stock at ${sourceBranch.name}. Current stock is ${currentSourceStock} ${ingredient.unit}, requested transfer is ${quantity} ${ingredient.unit}.`
        );
      }

      // Ensure destination branch has InventoryItem tracked
      await tx.inventoryItem.upsert({
        where: {
          branchId_ingredientId: {
            branchId: destinationBranchId,
            ingredientId,
          },
        },
        create: {
          branchId: destinationBranchId,
          ingredientId,
          minimumStock: 0,
          reorderLevel: 0,
          status: InventoryStatus.ACTIVE,
        },
        update: { status: InventoryStatus.ACTIVE },
      });

      // 1. Create TRANSFER_OUT at source branch
      await tx.stockTransaction.create({
        data: {
          branchId: sourceBranchId,
          ingredientId,
          type: StockTransactionType.TRANSFER_OUT,
          quantity: new Prisma.Decimal(quantity),
          unit: ingredient.unit,
          referenceId,
          note: `Transfer to ${destBranch.name}${note ? ' - ' + note.trim() : ''}`,
          performedBy: user.name,
        },
      });

      // 2. Create TRANSFER_IN at destination branch
      await tx.stockTransaction.create({
        data: {
          branchId: destinationBranchId,
          ingredientId,
          type: StockTransactionType.TRANSFER_IN,
          quantity: new Prisma.Decimal(quantity),
          unit: ingredient.unit,
          referenceId,
          note: `Transfer from ${sourceBranch.name}${note ? ' - ' + note.trim() : ''}`,
          performedBy: user.name,
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: sourceBranchId,
          action: AUDIT_ACTIONS.INVENTORY_TRANSFER,
          entityType: AUDIT_ENTITY_TYPES.INVENTORY_ITEM,
          entityId: ingredientId,
          description: `Transferred ${quantity} ${ingredient.unit} of ${ingredient.name} from ${sourceBranch.name} to ${destBranch.name}`,
          afterData: {
            sourceBranchId,
            sourceBranchName: sourceBranch.name,
            destinationBranchId,
            destinationBranchName: destBranch.name,
            ingredientName: ingredient.name,
            quantity,
            unit: ingredient.unit,
            referenceId,
          },
          metadata: { referenceId },
        },
        tx
      );
    });

    revalidatePath('/inventory');
    return { success: true, data: { referenceId } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('recordBranchTransfer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute stock transfer',
    };
  }
}

/**
 * Executes physical stock count reconciliation.
 * Derives variance and records appropriate ADJUSTMENT_IN or ADJUSTMENT_OUT.
 */
export async function recordStockReconciliation(
  input: StockReconciliationInput
): Promise<ActionResult<{ variance: number; message: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_RECONCILE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = stockReconciliationSchema.parse(input);
    const { branchId, ingredientId, physicalCount, reason } = parsed;

    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { id: true, name: true, unit: true },
    });

    if (!ingredient) {
      return { success: false, error: 'Ingredient not found' };
    }

    const result = await prisma.$transaction(async (tx) => {
      const systemStock = await calculateCurrentStock(tx, branchId, ingredientId);
      const variance = Math.round((physicalCount - systemStock) * 1000) / 1000;

      if (variance === 0) {
        return {
          variance: 0,
          message: `Stock count is exact (${physicalCount} ${ingredient.unit}). No adjustment was required.`,
        };
      }

      // Ensure item is tracked
      await tx.inventoryItem.upsert({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        create: {
          branchId,
          ingredientId,
          minimumStock: 0,
          reorderLevel: 0,
          status: InventoryStatus.ACTIVE,
        },
        update: { status: InventoryStatus.ACTIVE },
      });

      const auditNote = `Physical Reconciliation: Count=${physicalCount}, System=${systemStock}, Variance=${variance > 0 ? '+' : ''}${variance} ${ingredient.unit}${reason ? ' | Note: ' + reason.trim() : ''}`;

      if (variance > 0) {
        // Physical count exceeds system stock -> Surplus (ADJUSTMENT_IN)
        await tx.stockTransaction.create({
          data: {
            branchId,
            ingredientId,
            type: StockTransactionType.ADJUSTMENT_IN,
            quantity: new Prisma.Decimal(variance),
            unit: ingredient.unit,
            note: auditNote,
            performedBy: user.name,
          },
        });
      } else {
        // Physical count lower than system stock -> Deficit (ADJUSTMENT_OUT)
        await tx.stockTransaction.create({
          data: {
            branchId,
            ingredientId,
            type: StockTransactionType.ADJUSTMENT_OUT,
            quantity: new Prisma.Decimal(Math.abs(variance)),
            unit: ingredient.unit,
            note: auditNote,
            performedBy: user.name,
          },
        });
      }

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId,
          action: AUDIT_ACTIONS.INVENTORY_RECONCILE,
          entityType: AUDIT_ENTITY_TYPES.INVENTORY_ITEM,
          entityId: ingredientId,
          description: `Reconciled stock for ${ingredient.name}: System=${systemStock} ${ingredient.unit}, Physical=${physicalCount} ${ingredient.unit}, Variance=${variance > 0 ? '+' : ''}${variance} ${ingredient.unit}`,
          afterData: {
            ingredientName: ingredient.name,
            systemStock,
            physicalCount,
            variance,
            unit: ingredient.unit,
          },
          metadata: { reason: reason || null },
        },
        tx
      );

      return {
        variance,
        message: `Reconciliation complete. Adjusted stock by ${variance > 0 ? '+' : ''}${variance} ${ingredient.unit} to match physical count of ${physicalCount} ${ingredient.unit}.`,
      };
    });

    revalidatePath('/inventory');
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('recordStockReconciliation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reconcile stock',
    };
  }
}

/**
 * Updates an inventory item's minimum stock, reorder level, and status.
 */
export async function updateInventoryItem(
  id: string,
  input: UpdateInventoryItemInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_UPDATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = updateInventoryItemSchema.parse(input);

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      select: { branchId: true },
    });

    if (!existing) {
      return { success: false, error: 'Inventory item not found' };
    }

    if (!isBranchAuthorized(scope, existing.branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        minimumStock: new Prisma.Decimal(parsed.minimumStock),
        reorderLevel: new Prisma.Decimal(parsed.reorderLevel),
        status: parsed.status,
      },
    });

    revalidatePath('/inventory');
    return { success: true, data: { id: updated.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('updateInventoryItem error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update inventory item',
    };
  }
}

/**
 * Soft-toggles inventory item status without deleting historical records.
 */
export async function toggleInventoryItemStatus(
  id: string,
  status: 'ACTIVE' | 'INACTIVE'
): Promise<ActionResult<{ id: string; status: InventoryStatus }>> {
  try {
    const user = await requirePermission(PERMISSIONS.INVENTORY_DEACTIVATE);
    const scope = await getAuthorizedBranchScope(user);

    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
      select: { branchId: true },
    });

    if (!existing) {
      return { success: false, error: 'Inventory item not found' };
    }

    if (!isBranchAuthorized(scope, existing.branchId)) {
      return { success: false, error: 'Unauthorized: You do not have access to this branch' };
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: { status: status as InventoryStatus },
    });

    revalidatePath('/inventory');
    return { success: true, data: { id: updated.id, status: updated.status } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('toggleInventoryItemStatus error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to toggle inventory item status',
    };
  }
}
