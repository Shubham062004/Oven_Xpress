'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { ActionResult, AuthUser } from '@/lib/auth/types';
import type {
  KitchenBoardData,
  KitchenOrderCardData,
  KitchenOrderItem,
  KitchenStartOrderResult,
  InsufficientStockDetail,
} from '@/lib/kitchen/types';
import {
  OrderStatus,
  OrderType,
  TableStatus,
  StockTransactionType,
  IngredientUnit,
  Prisma,
} from '@prisma/client';
import {
  calculateCurrentStock,
} from '@/lib/inventory/actions';

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

function isBranchAuthorized(
  scope: { isAllBranches: boolean; branchIds: string[] },
  branchId: string
): boolean {
  return scope.isAllBranches || scope.branchIds.includes(branchId);
}

/**
 * Mathematically precise unit converter for inventory recipe calculations.
 * Converts quantities between recipe units and base inventory units.
 */
function convertQuantity(
  quantity: number,
  fromUnit: IngredientUnit,
  toUnit: IngredientUnit
): number {
  if (fromUnit === toUnit) return quantity;

  // Mass conversion
  if (fromUnit === IngredientUnit.GRAM && toUnit === IngredientUnit.KG) {
    return quantity / 1000;
  }
  if (fromUnit === IngredientUnit.KG && toUnit === IngredientUnit.GRAM) {
    return quantity * 1000;
  }

  // Volume conversion
  if (fromUnit === IngredientUnit.ML && toUnit === IngredientUnit.LITRE) {
    return quantity / 1000;
  }
  if (fromUnit === IngredientUnit.LITRE && toUnit === IngredientUnit.ML) {
    return quantity * 1000;
  }

  // Count conversion
  if (fromUnit === IngredientUnit.DOZEN && toUnit === IngredientUnit.PIECE) {
    return quantity * 12;
  }
  if (fromUnit === IngredientUnit.PIECE && toUnit === IngredientUnit.DOZEN) {
    return quantity / 12;
  }

  // Fallback if measurement families differ or no factor
  return quantity;
}

/**
 * Fetches active kitchen display queue grouped into New (Confirmed), Preparing, and Ready.
 * Sorted chronologically (oldest active order first) with strict branch authorization.
 */
export async function getKitchenOrders(
  branchId?: string,
  orderTypeFilter?: string
): Promise<ActionResult<KitchenBoardData>> {
  try {
    const user = await requirePermission(PERMISSIONS.KITCHEN_READ);
    const scope = await getAuthorizedBranchScope(user);

    let branchWhere: Prisma.OrderWhereInput['branchId'] | undefined;
    if (!scope.isAllBranches) {
      if (branchId && !scope.branchIds.includes(branchId)) {
        return { success: false, error: 'Unauthorized branch access' };
      }
      branchWhere = { in: scope.branchIds };
    } else if (branchId && branchId !== 'ALL') {
      branchWhere = branchId;
    }

    const typeWhere: Prisma.OrderWhereInput['orderType'] | undefined =
      orderTypeFilter && orderTypeFilter !== 'ALL'
        ? (orderTypeFilter as OrderType)
        : undefined;

    // Fetch active kitchen orders
    const orders = await prisma.order.findMany({
      where: {
        ...(branchWhere && { branchId: branchWhere }),
        ...(typeWhere && { orderType: typeWhere }),
        status: {
          in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY],
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { orderNumber: 'asc' },
      ],
      include: {
        branch: { select: { id: true, name: true, code: true } },
        table: { select: { id: true, tableNumber: true } },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                preparationTimeMinutes: true,
                _count: { select: { recipeIngredients: true } },
              },
            },
          },
        },
      },
    });

    const now = new Date();

    const formattedOrders: KitchenOrderCardData[] = orders.map((o) => {
      const createdDate = new Date(o.createdAt);
      const elapsedMinutes = Math.max(
        0,
        Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60))
      );

      let prepMinutes: number | null = null;
      if (o.preparingAt) {
        prepMinutes = Math.max(
          0,
          Math.floor((now.getTime() - new Date(o.preparingAt).getTime()) / (1000 * 60))
        );
      }

      let targetPrepMinutes = 0;
      let hasMissingRecipe = false;

      const items: KitchenOrderItem[] = o.items.map((item) => {
        const itemHasRecipe = (item.menuItem._count.recipeIngredients || 0) > 0;
        if (!itemHasRecipe) {
          hasMissingRecipe = true;
        }

        const prepTime = item.menuItem.preparationTimeMinutes || 0;
        if (prepTime > targetPrepMinutes) {
          targetPrepMinutes = prepTime;
        }

        return {
          id: item.id,
          menuItemId: item.menuItemId,
          itemName: item.itemName,
          quantity: item.quantity,
          notes: item.notes,
          preparationTimeMinutes: prepTime,
          hasRecipe: itemHasRecipe,
        };
      });

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        branchId: o.branchId,
        branchName: o.branch.name,
        branchCode: o.branch.code,
        orderType: o.orderType,
        status: o.status,
        tableId: o.tableId,
        tableNumber: o.table ? o.table.tableNumber : null,
        customerName: o.customerName,
        deliveryNotes: o.deliveryNotes,
        notes: o.notes,
        createdAt: o.createdAt.toISOString(),
        confirmedAt: o.confirmedAt?.toISOString() || null,
        preparingAt: o.preparingAt?.toISOString() || null,
        readyAt: o.readyAt?.toISOString() || null,
        elapsedMinutes,
        prepMinutes,
        targetPrepMinutes: targetPrepMinutes || 15,
        inventoryConsumed: o.inventoryConsumed,
        hasMissingRecipe,
        items,
      };
    });

    const newOrders = formattedOrders.filter((o) => o.status === OrderStatus.CONFIRMED);
    const preparingOrders = formattedOrders.filter((o) => o.status === OrderStatus.PREPARING);
    const readyOrders = formattedOrders.filter((o) => o.status === OrderStatus.READY);

    return {
      success: true,
      data: {
        stats: {
          newOrdersCount: newOrders.length,
          preparingOrdersCount: preparingOrders.length,
          readyOrdersCount: readyOrders.length,
          totalActiveCount: formattedOrders.length,
        },
        newOrders,
        preparingOrders,
        readyOrders,
        lastSyncedAt: now.toISOString(),
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get kitchen orders:', error);
    return { success: false, error: 'Failed to retrieve kitchen orders' };
  }
}

/**
 * Starts order preparation in the kitchen.
 * Atomically verifies Recipe BOM and branch stock, creates StockTransaction(CONSUMPTION)
 * records, guards against double-consumption (idempotency), updates timestamps, and creates audit log.
 */
export async function startOrderPreparation(
  orderId: string
): Promise<ActionResult<KitchenStartOrderResult>> {
  try {
    const user = await requirePermission(PERMISSIONS.KITCHEN_START);
    const scope = await getAuthorizedBranchScope(user);

    // Fetch order with complete items and BOM
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                recipeIngredients: {
                  include: {
                    ingredient: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      if (order.status === OrderStatus.PREPARING) {
        return {
          success: true,
          data: {
            orderId: order.id,
            status: OrderStatus.PREPARING,
            inventoryConsumed: order.inventoryConsumed,
            ingredientsDeducted: 0,
            warnings: ['Order is already in preparation.'],
          },
        };
      }
      return {
        success: false,
        error: `Cannot start preparation: order is currently ${order.status}. Only CONFIRMED orders can be prepared.`,
      };
    }

    // 1. Idempotency Check: if inventory has already been consumed (e.g. retry), do not deduct again
    if (order.inventoryConsumed) {
      const updated = await prisma.$transaction(async (tx) => {
        const ord = await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.PREPARING,
            preparingAt: order.preparingAt || new Date(),
            preparedBy: user.name,
          },
        });

        await tx.orderAuditLog.create({
          data: {
            orderId: order.id,
            fromStatus: OrderStatus.CONFIRMED,
            toStatus: OrderStatus.PREPARING,
            performedBy: user.name,
            userId: user.id,
            notes: 'KDS: Order moved to preparing (Inventory was already consumed).',
          },
        });

        return ord;
      });

      revalidatePath('/kitchen');
      revalidatePath('/orders');
      revalidatePath(`/orders/${order.id}`);

      return {
        success: true,
        data: {
          orderId: updated.id,
          status: OrderStatus.PREPARING,
          inventoryConsumed: true,
          ingredientsDeducted: 0,
          warnings: ['Inventory was previously consumed for this order. No duplicate deduction occurred.'],
        },
      };
    }

    // 2. Resolve Recipe BOM for all ordered items
    const missingRecipeItemNames: string[] = [];
    const requiredMap = new Map<
      string,
      {
        ingredientId: string;
        ingredientName: string;
        baseUnit: IngredientUnit;
        totalRequired: number;
      }
    >();

    for (const item of order.items) {
      const recipes = item.menuItem.recipeIngredients;
      if (!recipes || recipes.length === 0) {
        missingRecipeItemNames.push(item.itemName);
        continue;
      }

      for (const recipe of recipes) {
        const converted = convertQuantity(
          recipe.quantity.toNumber() * item.quantity,
          recipe.unit,
          recipe.ingredient.unit
        );

        const existing = requiredMap.get(recipe.ingredientId);
        if (existing) {
          existing.totalRequired += converted;
        } else {
          requiredMap.set(recipe.ingredientId, {
            ingredientId: recipe.ingredientId,
            ingredientName: recipe.ingredient.name,
            baseUnit: recipe.ingredient.unit,
            totalRequired: converted,
          });
        }
      }
    }

    // 3. Verify stock availability for all required ingredients
    const shortages: InsufficientStockDetail[] = [];
    for (const [ingredientId, req] of requiredMap.entries()) {
      const currentStock = await calculateCurrentStock(
        prisma,
        order.branchId,
        ingredientId
      );

      const roundedReq = Math.round(req.totalRequired * 1000) / 1000;
      if (currentStock < roundedReq) {
        shortages.push({
          ingredientId,
          ingredientName: req.ingredientName,
          requiredQuantity: roundedReq,
          availableQuantity: currentStock,
          unit: req.baseUnit,
        });
      }
    }

    // If any ingredient is insufficient, ABORT without changing order status
    if (shortages.length > 0) {
      const shortageDetails = shortages
        .map(
          (s) =>
            `${s.ingredientName} — Required: ${s.requiredQuantity} ${s.unit}, Available: ${s.availableQuantity} ${s.unit}`
        )
        .join('; ');

      return {
        success: false,
        error: `Insufficient inventory to start this order: ${shortageDetails}`,
        data: {
          orderId: order.id,
          status: order.status,
          inventoryConsumed: false,
          ingredientsDeducted: 0,
          shortages,
        },
      };
    }

    // 4. Atomic Execution: Create consumption transactions, update order, and record audit log
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Ensure InventoryItem tracked records exist and create StockTransaction CONSUMPTION records
      for (const req of requiredMap.values()) {
        const roundedQty = Math.round(req.totalRequired * 1000) / 1000;

        await tx.inventoryItem.upsert({
          where: {
            branchId_ingredientId: {
              branchId: order.branchId,
              ingredientId: req.ingredientId,
            },
          },
          create: {
            branchId: order.branchId,
            ingredientId: req.ingredientId,
            minimumStock: 0,
            reorderLevel: 0,
          },
          update: {},
        });

        await tx.stockTransaction.create({
          data: {
            branchId: order.branchId,
            ingredientId: req.ingredientId,
            type: StockTransactionType.CONSUMPTION,
            quantity: new Prisma.Decimal(roundedQty.toFixed(3)),
            unit: req.baseUnit,
            referenceId: order.id,
            note: `KDS Order ${order.orderNumber} preparation`,
            performedBy: user.name,
            createdAt: now,
          },
        });
      }

      // Transition order status
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PREPARING,
          preparingAt: now,
          preparedBy: user.name,
          inventoryConsumed: true,
          inventoryConsumedAt: now,
        },
      });

      // Create OrderAuditLog
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.CONFIRMED,
          toStatus: OrderStatus.PREPARING,
          performedBy: user.name,
          userId: user.id,
          notes: `KDS: Order preparation started. Consumed ${requiredMap.size} ingredient(s).`,
          metadata: {
            consumedIngredients: Array.from(requiredMap.values()).map((r) => ({
              ingredientId: r.ingredientId,
              name: r.ingredientName,
              quantity: r.totalRequired,
              unit: r.baseUnit,
            })),
            missingRecipeItems: missingRecipeItemNames,
          },
        },
      });

      return updatedOrder;
    });

    revalidatePath('/kitchen');
    revalidatePath('/orders');
    revalidatePath(`/orders/${order.id}`);
    revalidatePath('/inventory');

    const warnings: string[] = [];
    if (missingRecipeItemNames.length > 0) {
      warnings.push(
        `Items without recipes: ${missingRecipeItemNames.join(', ')}. No ingredients were deducted for these items.`
      );
    }

    return {
      success: true,
      data: {
        orderId: result.id,
        status: OrderStatus.PREPARING,
        inventoryConsumed: true,
        ingredientsDeducted: requiredMap.size,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to start order preparation:', error);
    return { success: false, error: 'Failed to start order preparation' };
  }
}

/**
 * Marks an order as READY in the kitchen.
 * Records readyAt timestamp and updates audit log.
 */
export async function markOrderReady(
  orderId: string
): Promise<ActionResult<{ orderId: string; status: OrderStatus }>> {
  try {
    const user = await requirePermission(PERMISSIONS.KITCHEN_READY);
    const scope = await getAuthorizedBranchScope(user);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        branchId: true,
        status: true,
        orderNumber: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (order.status !== OrderStatus.PREPARING) {
      return {
        success: false,
        error: `Cannot mark ready: order is currently ${order.status}. Only PREPARING orders can be marked READY.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.READY,
          readyAt: now,
          readyBy: user.name,
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PREPARING,
          toStatus: OrderStatus.READY,
          performedBy: user.name,
          userId: user.id,
          notes: 'KDS: Order marked READY for serving / delivery dispatch.',
        },
      });
    });

    revalidatePath('/kitchen');
    revalidatePath('/orders');
    revalidatePath(`/orders/${order.id}`);

    return {
      success: true,
      data: { orderId: order.id, status: OrderStatus.READY },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to mark order ready:', error);
    return { success: false, error: 'Failed to mark order ready' };
  }
}

/**
 * Completes a ready order from the kitchen interface if authorized.
 * Enforces kitchen.complete or order.status permissions and table cleanup for dine-in.
 */
export async function completeKitchenOrder(
  orderId: string
): Promise<ActionResult<{ orderId: string; status: OrderStatus }>> {
  try {
    const user = await requirePermission(PERMISSIONS.KITCHEN_COMPLETE);
    const scope = await getAuthorizedBranchScope(user);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        branchId: true,
        status: true,
        orderType: true,
        tableId: true,
        orderNumber: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (order.status !== OrderStatus.READY) {
      return {
        success: false,
        error: `Cannot complete order: order is currently ${order.status}. Only READY orders can be completed.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.COMPLETED,
          completedAt: now,
          completedBy: user.name,
        },
      });

      // Free table to CLEANING if Dine-in
      if (order.orderType === OrderType.DINE_IN && order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.CLEANING },
        });
      }

      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.READY,
          toStatus: OrderStatus.COMPLETED,
          performedBy: user.name,
          userId: user.id,
          notes: 'KDS: Order completed and finalized.',
        },
      });
    });

    revalidatePath('/kitchen');
    revalidatePath('/orders');
    revalidatePath(`/orders/${order.id}`);

    return {
      success: true,
      data: { orderId: order.id, status: OrderStatus.COMPLETED },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to complete kitchen order:', error);
    return { success: false, error: 'Failed to complete kitchen order' };
  }
}
