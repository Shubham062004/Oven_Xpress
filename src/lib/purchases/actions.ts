'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  createPurchaseOrderSchema,
  receiveStockSchema,
  cancelPurchaseOrderSchema,
  purchaseFilterSchema,
  type CreatePurchaseOrderInput,
  type ReceiveStockInput,
  type CancelPurchaseOrderInput,
  type PurchaseFilterInput,
} from '@/lib/validations/purchases';
import type { ActionResult, AuthUser } from '@/lib/auth/types';
import type {
  PurchaseOrderListItem,
  PurchaseOrderDetail,
  PurchaseOrderItemDetail,
  PurchaseReceivingLog,
  PurchaseStats,
} from '@/lib/purchases/types';
import {
  PurchaseOrderStatus,
  StockTransactionType,
  InventoryStatus,
  Prisma,
} from '@prisma/client';
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
 * Resolves authorized branch scope for the authenticated user.
 * OWNER and ADMIN have access across all branches.
 * MANAGER is restricted to their assigned branch.
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

function isBranchAuthorized(
  scope: { isAllBranches: boolean; branchIds: string[] },
  branchId: string
): boolean {
  return scope.isAllBranches || scope.branchIds.includes(branchId);
}

/**
 * Generates the next sequential purchase order number server-side.
 * Format: PO-YYYY-000001
 */
async function generatePurchaseNumber(
  tx: Prisma.TransactionClient | typeof prisma
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;

  const latestPO = await tx.purchaseOrder.findFirst({
    where: {
      purchaseNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      purchaseNumber: 'desc',
    },
    select: {
      purchaseNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestPO?.purchaseNumber) {
    const parts = latestPO.purchaseNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(6, '0')}`;
}

/**
 * Generates the next sequential receiving log number for a PO.
 * Format: RCV-PO-YYYY-000001-01
 */
async function generateReceivingNumber(
  tx: Prisma.TransactionClient | typeof prisma,
  purchaseNumber: string
): Promise<string> {
  const prefix = `RCV-${purchaseNumber}-`;

  const count = await tx.purchaseReceiving.count({
    where: {
      receivingNumber: {
        startsWith: prefix,
      },
    },
  });

  return `${prefix}${(count + 1).toString().padStart(2, '0')}`;
}

/**
 * Retrieves purchase orders with branch scoping, filtering, and search.
 */
export async function getPurchases(
  filter?: Partial<PurchaseFilterInput>
): Promise<ActionResult<PurchaseOrderListItem[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const parsedFilter = purchaseFilterSchema.safeParse(filter || {});
    const { branchId, supplierId, status, search, startDate, endDate } =
      parsedFilter.success
        ? parsedFilter.data
        : {
            branchId: undefined,
            supplierId: undefined,
            status: 'ALL' as const,
            search: undefined,
            startDate: undefined,
            endDate: undefined,
          };

    const where: Prisma.PurchaseOrderWhereInput = {};

    // Branch authorization check
    if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    } else if (branchId && branchId !== 'ALL') {
      where.branchId = branchId;
    }

    if (supplierId && supplierId !== 'ALL') {
      where.supplierId = supplierId;
    }

    if (status && status !== 'ALL') {
      where.status = status as PurchaseOrderStatus;
    }

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.orderDate.lte = end;
      }
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.OR = [
        { purchaseNumber: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { branch: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const purchases = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true, code: true } },
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

    const items: PurchaseOrderListItem[] = purchases.map((po) => {
      let totalAmount = 0;
      let totalOrderedQuantity = 0;
      let totalReceivedQuantity = 0;

      for (const item of po.items) {
        const ordQty = Number(item.orderedQuantity);
        const recQty = Number(item.receivedQuantity);
        const price = Number(item.unitPrice);

        totalAmount += ordQty * price;
        totalOrderedQuantity += ordQty;
        totalReceivedQuantity += recQty;
      }

      return {
        id: po.id,
        purchaseNumber: po.purchaseNumber,
        supplierId: po.supplier.id,
        supplierName: po.supplier.name,
        branchId: po.branch.id,
        branchName: po.branch.name,
        branchCode: po.branch.code,
        status: po.status,
        orderDate: po.orderDate,
        expectedDate: po.expectedDate,
        totalAmount: Math.round(totalAmount * 100) / 100,
        itemsCount: po.items.length,
        totalOrderedQuantity: Math.round(totalOrderedQuantity * 1000) / 1000,
        totalReceivedQuantity: Math.round(totalReceivedQuantity * 1000) / 1000,
        createdBy: po.createdBy,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
      };
    });

    return { success: true, data: items };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getPurchases error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch purchase orders',
    };
  }
}

/**
 * Retrieves summary statistics for purchase orders within user's branch scope.
 */
export async function getPurchaseStats(
  branchIdFilter?: string
): Promise<ActionResult<PurchaseStats>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const where: Prisma.PurchaseOrderWhereInput = {};

    if (!scope.isAllBranches) {
      where.branchId = { in: scope.branchIds };
    } else if (branchIdFilter && branchIdFilter !== 'ALL') {
      where.branchId = branchIdFilter;
    }

    const [
      totalOrders,
      draftOrders,
      orderedOrders,
      partiallyReceivedOrders,
      receivedOrders,
      cancelledOrders,
      allValidOrders,
    ] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.count({ where: { ...where, status: PurchaseOrderStatus.DRAFT } }),
      prisma.purchaseOrder.count({ where: { ...where, status: PurchaseOrderStatus.ORDERED } }),
      prisma.purchaseOrder.count({
        where: { ...where, status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
      }),
      prisma.purchaseOrder.count({ where: { ...where, status: PurchaseOrderStatus.RECEIVED } }),
      prisma.purchaseOrder.count({ where: { ...where, status: PurchaseOrderStatus.CANCELLED } }),
      prisma.purchaseOrder.findMany({
        where: {
          ...where,
          status: { not: PurchaseOrderStatus.CANCELLED },
        },
        select: {
          items: {
            select: {
              orderedQuantity: true,
              unitPrice: true,
            },
          },
        },
      }),
    ]);

    let totalSpend = 0;
    for (const po of allValidOrders) {
      for (const item of po.items) {
        totalSpend += Number(item.orderedQuantity) * Number(item.unitPrice);
      }
    }

    return {
      success: true,
      data: {
        totalOrders,
        draftOrders,
        orderedOrders,
        partiallyReceivedOrders,
        receivedOrders,
        cancelledOrders,
        totalSpend: Math.round(totalSpend * 100) / 100,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getPurchaseStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch purchase stats',
    };
  }
}

/**
 * Retrieves a single purchase order by ID with complete items and receiving logs.
 */
export async function getPurchaseById(
  id: string
): Promise<ActionResult<PurchaseOrderDetail>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_READ);
    const scope = await getAuthorizedBranchScope(user);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
            address: true,
            city: true,
          },
        },
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
          },
        },
        items: {
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        receivingLogs: {
          include: {
            items: {
              include: {
                ingredient: { select: { id: true, name: true, unit: true } },
              },
            },
          },
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!po) {
      return { success: false, error: 'Purchase order not found' };
    }

    // Branch authorization check
    if (!isBranchAuthorized(scope, po.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have access to purchase orders for this branch',
      };
    }

    let subtotal = 0;
    let totalOrderedQuantity = 0;
    let totalReceivedQuantity = 0;

    const items: PurchaseOrderItemDetail[] = po.items.map((item) => {
      const ord = Number(item.orderedQuantity);
      const rec = Number(item.receivedQuantity);
      const rem = Math.max(0, ord - rec);
      const price = Number(item.unitPrice);
      const lineTotal = ord * price;

      subtotal += lineTotal;
      totalOrderedQuantity += ord;
      totalReceivedQuantity += rec;

      return {
        id: item.id,
        ingredientId: item.ingredientId,
        ingredientName: item.ingredient.name,
        unit: item.unit,
        orderedQuantity: ord,
        receivedQuantity: rec,
        remainingQuantity: Math.round(rem * 1000) / 1000,
        unitPrice: price,
        lineTotal: Math.round(lineTotal * 100) / 100,
      };
    });

    const receivingLogs: PurchaseReceivingLog[] = po.receivingLogs.map((log) => ({
      id: log.id,
      receivingNumber: log.receivingNumber,
      receivedBy: log.receivedBy,
      receivedAt: log.receivedAt,
      notes: log.notes,
      items: log.items.map((it) => ({
        id: it.id,
        purchaseOrderItemId: it.purchaseOrderItemId,
        ingredientId: it.ingredientId,
        ingredientName: it.ingredient.name,
        quantity: Number(it.quantity),
        unit: it.unit,
      })),
    }));

    const fulfillmentPercentage =
      totalOrderedQuantity > 0
        ? Math.min(100, Math.round((totalReceivedQuantity / totalOrderedQuantity) * 100))
        : 0;

    const data: PurchaseOrderDetail = {
      id: po.id,
      purchaseNumber: po.purchaseNumber,
      status: po.status,
      orderDate: po.orderDate,
      expectedDate: po.expectedDate,
      notes: po.notes,
      createdBy: po.createdBy,
      createdAt: po.createdAt,
      updatedAt: po.updatedAt,
      supplier: po.supplier,
      branch: po.branch,
      items,
      receivingLogs,
      subtotal: Math.round(subtotal * 100) / 100,
      totalOrderedQuantity: Math.round(totalOrderedQuantity * 1000) / 1000,
      totalReceivedQuantity: Math.round(totalReceivedQuantity * 1000) / 1000,
      fulfillmentPercentage,
    };

    return { success: true, data };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('getPurchaseById error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch purchase order details',
    };
  }
}

/**
 * Creates a new purchase order with multiple items and server-recalculated values.
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<ActionResult<{ id: string; purchaseNumber: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_CREATE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = createPurchaseOrderSchema.parse(input);

    // Branch authorization check
    if (!isBranchAuthorized(scope, parsed.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to create purchase orders for this branch',
      };
    }

    // Verify supplier exists and is active
    const supplier = await prisma.supplier.findUnique({
      where: { id: parsed.supplierId },
      select: { id: true, status: true, name: true },
    });
    if (!supplier || supplier.status !== 'ACTIVE') {
      return { success: false, error: 'Selected supplier is invalid or inactive' };
    }

    // Verify branch exists and is active
    const branch = await prisma.branch.findUnique({
      where: { id: parsed.branchId },
      select: { id: true, status: true, name: true },
    });
    if (!branch || branch.status !== 'ACTIVE') {
      return { success: false, error: 'Selected branch is invalid or inactive' };
    }

    // Verify all ingredients exist, are active, and have compatible units
    const ingredientIds = parsed.items.map((i) => i.ingredientId);
    const ingredients = await prisma.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: { id: true, name: true, unit: true, status: true },
    });

    if (ingredients.length !== ingredientIds.length) {
      return { success: false, error: 'One or more selected ingredients do not exist' };
    }

    for (const item of parsed.items) {
      const matched = ingredients.find((ing) => ing.id === item.ingredientId);
      if (!matched || matched.status !== 'ACTIVE') {
        return {
          success: false,
          error: `Ingredient "${matched?.name || item.ingredientId}" is inactive or unavailable`,
        };
      }
      if (matched.unit !== item.unit) {
        return {
          success: false,
          error: `Unit mismatch for "${matched.name}". Master unit is ${matched.unit}, but ${item.unit} was provided`,
        };
      }
    }

    // Execute creation in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const purchaseNumber = await generatePurchaseNumber(tx);

      const created = await tx.purchaseOrder.create({
        data: {
          purchaseNumber,
          supplierId: parsed.supplierId,
          branchId: parsed.branchId,
          status: parsed.status,
          orderDate: parsed.orderDate ? new Date(parsed.orderDate) : new Date(),
          expectedDate: parsed.expectedDate ? new Date(parsed.expectedDate) : null,
          notes: parsed.notes || null,
          createdBy: user.name,
          items: {
            create: parsed.items.map((item) => ({
              ingredientId: item.ingredientId,
              orderedQuantity: new Prisma.Decimal(item.orderedQuantity),
              unit: item.unit,
              unitPrice: new Prisma.Decimal(item.unitPrice),
              receivedQuantity: new Prisma.Decimal(0),
            })),
          },
        },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: parsed.branchId,
          action: AUDIT_ACTIONS.PURCHASE_CREATE,
          entityType: AUDIT_ENTITY_TYPES.PURCHASE_ORDER,
          entityId: created.id,
          description: `Created purchase order ${created.purchaseNumber} for supplier ${supplier.name} with ${parsed.items.length} item(s).`,
          afterData: {
            purchaseNumber: created.purchaseNumber,
            supplierId: parsed.supplierId,
            status: parsed.status,
            itemCount: parsed.items.length,
          },
          metadata: {
            supplierName: supplier.name,
            branchName: branch.name,
          },
        },
        tx
      );

      return { id: created.id, purchaseNumber: created.purchaseNumber };
    });

    revalidatePath('/purchases');
    revalidatePath(`/suppliers/${parsed.supplierId}`);
    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('createPurchaseOrder error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create purchase order',
    };
  }
}

/**
 * Receives stock for a purchase order, updating received quantities and creating
 * immutable stock ledger entries in a single database transaction.
 */
export async function receivePurchaseOrderItems(
  input: ReceiveStockInput
): Promise<ActionResult<{ receivingNumber: string; newStatus: PurchaseOrderStatus }>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_RECEIVE);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = receiveStockSchema.parse(input);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: parsed.purchaseOrderId },
      include: {
        items: {
          include: {
            ingredient: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });

    if (!po) {
      return { success: false, error: 'Purchase order not found' };
    }

    // Branch authorization check
    if (!isBranchAuthorized(scope, po.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to receive stock for this branch',
      };
    }

    // Status check
    if (po.status === PurchaseOrderStatus.DRAFT) {
      return {
        success: false,
        error: 'Cannot receive items on a DRAFT purchase order. Please mark as ORDERED first.',
      };
    }
    if (po.status === PurchaseOrderStatus.RECEIVED) {
      return {
        success: false,
        error: 'Purchase order has already been fully received.',
      };
    }
    if (po.status === PurchaseOrderStatus.CANCELLED) {
      return {
        success: false,
        error: 'Cannot receive items on a CANCELLED purchase order.',
      };
    }

    // Validate each receiving item
    for (const itemInput of parsed.items) {
      const poItem = po.items.find((it) => it.id === itemInput.purchaseOrderItemId);
      if (!poItem) {
        return {
          success: false,
          error: `Purchase item "${itemInput.purchaseOrderItemId}" does not belong to this purchase order`,
        };
      }

      const ord = Number(poItem.orderedQuantity);
      const rec = Number(poItem.receivedQuantity);
      const remaining = ord - rec;

      if (itemInput.receivedNow <= 0) {
        return {
          success: false,
          error: `Received quantity for ${poItem.ingredient.name} must be greater than 0`,
        };
      }

      // Requirement 7: Prevent over-receiving
      if (itemInput.receivedNow > remaining + 0.0001) {
        return {
          success: false,
          error: `Over-receiving rejected: Cannot receive ${itemInput.receivedNow} ${poItem.unit} of ${poItem.ingredient.name}. Only ${remaining} ${poItem.unit} remaining.`,
        };
      }
    }

    // Execute atomic receiving transaction
    const result = await prisma.$transaction(async (tx) => {
      const receivingNumber = await generateReceivingNumber(tx, po.purchaseNumber);
      const receivedAt = parsed.receivedDate ? new Date(parsed.receivedDate) : new Date();

      // 1. Create PurchaseReceiving log
      const receivingLog = await tx.purchaseReceiving.create({
        data: {
          purchaseOrderId: po.id,
          receivingNumber,
          receivedBy: user.name,
          receivedAt,
          notes: parsed.note || null,
        },
      });

      // 2. Process each item receiving and create inventory stock ledger transaction
      for (const itemInput of parsed.items) {
        const poItem = po.items.find((it) => it.id === itemInput.purchaseOrderItemId)!;
        const receivedDecimal = new Prisma.Decimal(itemInput.receivedNow);

        // Record receiving item log
        await tx.purchaseReceivingItem.create({
          data: {
            receivingId: receivingLog.id,
            purchaseOrderItemId: poItem.id,
            ingredientId: poItem.ingredientId,
            quantity: receivedDecimal,
            unit: poItem.unit,
          },
        });

        // Update purchase order item received quantity
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQuantity: {
              increment: receivedDecimal,
            },
          },
        });

        // Ensure InventoryItem exists and is active for this branch
        await tx.inventoryItem.upsert({
          where: {
            branchId_ingredientId: {
              branchId: po.branchId,
              ingredientId: poItem.ingredientId,
            },
          },
          create: {
            branchId: po.branchId,
            ingredientId: poItem.ingredientId,
            minimumStock: 0,
            reorderLevel: 0,
            status: InventoryStatus.ACTIVE,
          },
          update: {
            status: InventoryStatus.ACTIVE,
          },
        });

        // Create immutable StockTransaction in inventory ledger
        await tx.stockTransaction.create({
          data: {
            branchId: po.branchId,
            ingredientId: poItem.ingredientId,
            type: StockTransactionType.RECEIPT,
            quantity: receivedDecimal,
            unit: poItem.unit,
            referenceId: `${po.purchaseNumber}`,
            note: `PO Receipt ${po.purchaseNumber} (${receivingNumber})${parsed.note ? ` - ${parsed.note}` : ''}`,
            performedBy: user.name,
            createdAt: receivedAt,
          },
        });
      }

      // 3. Determine new PO status based on all items
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: po.id },
        select: { orderedQuantity: true, receivedQuantity: true },
      });

      const allFullyReceived = updatedItems.every(
        (it) => Number(it.receivedQuantity) >= Number(it.orderedQuantity) - 0.0001
      );

      const newStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : PurchaseOrderStatus.PARTIALLY_RECEIVED;

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: newStatus },
      });

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: po.branchId,
          action: AUDIT_ACTIONS.PURCHASE_RECEIVE,
          entityType: AUDIT_ENTITY_TYPES.PURCHASE_ORDER,
          entityId: po.id,
          description: `Received stock for purchase order ${po.purchaseNumber} (Receipt: ${receivingNumber}). Status: ${newStatus}.`,
          afterData: {
            purchaseNumber: po.purchaseNumber,
            receivingNumber,
            status: newStatus,
          },
          metadata: {
            receivingNumber,
            itemsCount: parsed.items.length,
          },
        },
        tx
      );

      return { receivingNumber, newStatus };
    });

    revalidatePath('/purchases');
    revalidatePath(`/purchases/${po.id}`);
    revalidatePath('/inventory');
    revalidatePath(`/suppliers/${po.supplierId}`);

    return { success: true, data: result };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('receivePurchaseOrderItems error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to receive stock',
    };
  }
}

/**
 * Cancels a purchase order according to strict business logic.
 * DRAFT -> can cancel
 * ORDERED -> can cancel (if zero stock has been received)
 * PARTIALLY_RECEIVED / RECEIVED -> cannot silently cancel without an explicit return workflow.
 */
export async function cancelPurchaseOrder(
  input: CancelPurchaseOrderInput
): Promise<ActionResult<void>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_CANCEL);
    const scope = await getAuthorizedBranchScope(user);

    const parsed = cancelPurchaseOrderSchema.parse(input);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: parsed.purchaseOrderId },
      include: {
        items: {
          select: {
            receivedQuantity: true,
          },
        },
      },
    });

    if (!po) {
      return { success: false, error: 'Purchase order not found' };
    }

    // Branch authorization check
    if (!isBranchAuthorized(scope, po.branchId)) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to cancel purchase orders for this branch',
      };
    }

    if (po.status === PurchaseOrderStatus.CANCELLED) {
      return { success: false, error: 'Purchase order is already cancelled' };
    }

    if (po.status === PurchaseOrderStatus.RECEIVED) {
      return {
        success: false,
        error: 'Cannot cancel a fully received purchase order.',
      };
    }

    // Requirement 9: Do not silently cancel received stock
    const hasAnyReceived = po.items.some((it) => Number(it.receivedQuantity) > 0);
    if (hasAnyReceived || po.status === PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      return {
        success: false,
        error:
          'Cannot cancel this purchase order: Stock has already been received into inventory. Reversal requires a formal goods return workflow.',
      };
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        notes: parsed.reason
          ? po.notes
            ? `${po.notes} | Cancellation Reason: ${parsed.reason}`
            : `Cancellation Reason: ${parsed.reason}`
          : po.notes,
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      branchId: po.branchId,
      action: AUDIT_ACTIONS.PURCHASE_CANCEL,
      entityType: AUDIT_ENTITY_TYPES.PURCHASE_ORDER,
      entityId: po.id,
      description: `Cancelled purchase order ${po.purchaseNumber}. Reason: ${parsed.reason || 'None provided'}`,
      beforeData: { status: po.status },
      afterData: { status: PurchaseOrderStatus.CANCELLED },
      metadata: { reason: parsed.reason || null },
    }).catch((e: unknown) => console.error('Failed to create purchase cancel audit log:', e));

    revalidatePath('/purchases');
    revalidatePath(`/purchases/${po.id}`);
    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('cancelPurchaseOrder error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel purchase order',
    };
  }
}

/**
 * Updates status of a DRAFT order to ORDERED.
 */
export async function markPurchaseOrderAsOrdered(
  id: string
): Promise<ActionResult<void>> {
  try {
    const user = await requirePermission(PERMISSIONS.PURCHASE_UPDATE);
    const scope = await getAuthorizedBranchScope(user);

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { branchId: true, status: true },
    });

    if (!po) {
      return { success: false, error: 'Purchase order not found' };
    }

    if (!isBranchAuthorized(scope, po.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      return { success: false, error: 'Only DRAFT purchase orders can be marked as ORDERED' };
    }

    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.ORDERED },
    });

    revalidatePath('/purchases');
    revalidatePath(`/purchases/${id}`);
    return { success: true };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('markPurchaseOrderAsOrdered error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update purchase order status',
    };
  }
}
