'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePermission, getAuthorizedBranchScope, isBranchAuthorized } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import type { ActionResult } from '@/lib/auth/types';
import {
  createOrderSchema,
  updateOrderSchema,
  cancelOrderSchema,
  orderFilterSchema,
  type CreateOrderInput,
  type UpdateOrderInput,
  type CancelOrderInput,
  type OrderFilterInput,
} from '@/lib/validations/orders';
import type {
  OrderListItem,
  OrderDetail,
  OrderStats,
  OrderListResponse,
  BranchMenuItemOption,
} from '@/lib/orders/types';
import {
  OrderType,
  OrderStatus,
  TableStatus,
  PaymentStatus,
  RefundStatus,
  Prisma,
} from '@prisma/client';
import { deriveOrderPaymentSummary } from '@/lib/payments/constants';
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
 * Concurrency-safe sequential order number generator.
 * Format: ORD-YYYY-000001
 * Uses PostgreSQL advisory transaction lock to guarantee uniqueness under concurrent requests.
 */
async function generateOrderNumber(
  tx: Prisma.TransactionClient,
  branchId?: string
): Promise<string> {
  const currentYear = new Date().getFullYear();
  const configuredPrefix = await getSetting<string>('ORDER_NUMBER_PREFIX', branchId);
  const prefixStr = configuredPrefix || 'ORD';
  const prefix = `${prefixStr}-${currentYear}-`;

  // Acquire PostgreSQL transaction-level advisory lock using a hash of the sequence key
  const lockKey = `order_number_seq_${currentYear}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const latestOrder = await tx.order.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: 'desc',
    },
    select: {
      orderNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestOrder?.orderNumber) {
    const parts = latestOrder.orderNumber.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(6, '0')}`;
}

/**
 * Centralized state transition validation.
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

function isValidStatusTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true;
  const allowed = VALID_TRANSITIONS[current];
  return !!allowed && allowed.includes(next);
}

/**
 * Fetches paginated orders with comprehensive filtering and branch security.
 */
export async function getOrders(
  filters: Partial<OrderFilterInput>
): Promise<ActionResult<OrderListResponse>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_READ);
    const parsed = orderFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid filters' };
    }

    const {
      branchId,
      orderType,
      status,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = parsed.data;

    const scope = await getAuthorizedBranchScope(user);

    // Build branch filter
    let branchFilter: Prisma.OrderWhereInput['branchId'] | undefined;
    if (!scope.isAllBranches) {
      if (branchId && !scope.branchIds.includes(branchId)) {
        return { success: false, error: 'Unauthorized branch access' };
      }
      branchFilter = { in: scope.branchIds };
    } else if (branchId && branchId !== 'ALL') {
      branchFilter = branchId;
    }

    // Date range filter
    let dateFilter: Prisma.DateTimeFilter | undefined;
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    }

    const where: Prisma.OrderWhereInput = {
      ...(branchFilter && { branchId: branchFilter }),
      ...(orderType && orderType !== 'ALL' && { orderType: orderType as OrderType }),
      ...(status && status !== 'ALL' && { status: status as OrderStatus }),
      ...(dateFilter && { createdAt: dateFilter }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerPhone: { contains: search } },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: { select: { name: true, code: true } },
          table: { select: { tableNumber: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    type OrderWithRelations = Prisma.OrderGetPayload<{
      include: {
        branch: { select: { name: true; code: true } };
        table: { select: { tableNumber: true } };
        _count: { select: { items: true } };
      };
    }>;

    const items: OrderListItem[] = (orders as OrderWithRelations[]).map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      branchId: o.branchId,
      branchName: o.branch.name,
      branchCode: o.branch.code,
      orderType: o.orderType,
      status: o.status,
      customerId: o.customerId,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      tableId: o.tableId,
      tableNumber: o.table?.tableNumber || null,
      itemCount: o._count.items,
      subtotal: o.subtotal.toNumber(),
      discountAmount: o.discountAmount.toNumber(),
      taxAmount: o.taxAmount.toNumber(),
      deliveryCharge: o.deliveryCharge.toNumber(),
      totalAmount: o.totalAmount.toNumber(),
      notes: o.notes,
      createdBy: o.createdBy,
      createdAt: o.createdAt.toISOString(),
    }));

    return {
      success: true,
      data: {
        orders: items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get orders:', error);
    return { success: false, error: 'Failed to retrieve orders' };
  }
}

/**
 * Aggregates high-level order KPIs for today.
 */
export async function getOrderStats(
  branchId?: string
): Promise<ActionResult<OrderStats>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_READ);
    const scope = await getAuthorizedBranchScope(user);

    let branchWhere: Prisma.OrderWhereInput['branchId'] | undefined;
    if (!scope.isAllBranches) {
      branchWhere = { in: scope.branchIds };
    } else if (branchId && branchId !== 'ALL') {
      branchWhere = branchId;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [todayCount, activeCount, preparingCount, completedTodayOrders] =
      await Promise.all([
        prisma.order.count({
          where: {
            ...(branchWhere && { branchId: branchWhere }),
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
        }),
        prisma.order.count({
          where: {
            ...(branchWhere && { branchId: branchWhere }),
            status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
          },
        }),
        prisma.order.count({
          where: {
            ...(branchWhere && { branchId: branchWhere }),
            status: { in: [OrderStatus.PREPARING, OrderStatus.READY] },
          },
        }),
        prisma.order.findMany({
          where: {
            ...(branchWhere && { branchId: branchWhere }),
            status: OrderStatus.COMPLETED,
            createdAt: { gte: startOfToday, lte: endOfToday },
          },
          select: { totalAmount: true },
        }),
      ]);

    const completedToday = completedTodayOrders.length;
    const todayRevenue = completedTodayOrders.reduce(
      (sum: number, ord) => sum + ord.totalAmount.toNumber(),
      0
    );

    return {
      success: true,
      data: {
        todayOrders: todayCount,
        activeOrders: activeCount,
        preparingOrders: preparingCount,
        completedToday,
        todayRevenue,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get order stats:', error);
    return { success: false, error: 'Failed to retrieve order statistics' };
  }
}

/**
 * Retrieves full order details by ID.
 */
export async function getOrderById(id: string): Promise<ActionResult<OrderDetail>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_READ);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            phone: true,
            address: true,
            city: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        table: {
          select: {
            id: true,
            tableNumber: true,
            capacity: true,
            status: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          include: {
            order: { select: { orderNumber: true } },
            branch: { select: { name: true, code: true } },
            refunds: {
              where: { status: RefundStatus.SUCCESS },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { processedAt: 'desc' },
        },
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const mappedPayments = order.payments.map((p) => {
      const pAmt = p.amount.toNumber();
      const refundedSum = p.refunds.reduce((sum, r) => sum + r.amount.toNumber(), 0);
      const roundedRefunded = Math.round(refundedSum * 100) / 100;
      const isRefundable =
        p.status === PaymentStatus.SUCCESS || p.status === PaymentStatus.PARTIALLY_REFUNDED;
      const refundable = isRefundable
        ? Math.max(0, Math.round((pAmt - roundedRefunded) * 100) / 100)
        : 0;

      return {
        id: p.id,
        paymentNumber: p.paymentNumber,
        orderId: p.orderId,
        orderNumber: p.order.orderNumber,
        branchId: p.branchId,
        branchName: p.branch.name,
        branchCode: p.branch.code,
        amount: pAmt,
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

    const paymentSummary = deriveOrderPaymentSummary(
      order.totalAmount.toNumber(),
      mappedPayments
    );

    return {
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        branchId: order.branchId,
        branch: order.branch,
        orderType: order.orderType,
        status: order.status,
        customerId: order.customerId,
        customer: order.customer,
        tableId: order.tableId,
        table: order.table,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        subtotal: order.subtotal.toNumber(),
        discountAmount: order.discountAmount.toNumber(),
        taxAmount: order.taxAmount.toNumber(),
        deliveryCharge: order.deliveryCharge.toNumber(),
        totalAmount: order.totalAmount.toNumber(),
        notes: order.notes,
        cancellationReason: order.cancellationReason,
        cancelledAt: order.cancelledAt?.toISOString() || null,
        cancelledBy: order.cancelledBy,
        createdBy: order.createdBy,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((i) => ({
          id: i.id,
          orderId: i.orderId,
          menuItemId: i.menuItemId,
          itemName: i.itemName,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toNumber(),
          discountAmount: i.discountAmount.toNumber(),
          totalPrice: i.totalPrice.toNumber(),
          notes: i.notes,
          createdAt: i.createdAt.toISOString(),
        })),
        paymentSummary,
        payments: mappedPayments,
      },
    };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get order by ID:', error);
    return { success: false, error: 'Failed to retrieve order details' };
  }
}

/**
 * Fetches available menu items for a specific branch with branch pricing.
 */
export async function getBranchMenuItems(
  branchId: string
): Promise<ActionResult<BranchMenuItemOption[]>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_READ);
    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        category: { select: { id: true, name: true, sortOrder: true } },
        branchAvailability: {
          where: { branchId },
          select: { price: true, isAvailable: true },
        },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { name: 'asc' },
      ],
    });

    type MenuItemWithBranch = Prisma.MenuItemGetPayload<{
      include: {
        category: { select: { id: true; name: true; sortOrder: true } };
        branchAvailability: { select: { price: true; isAvailable: true } };
      };
    }>;

    const items: BranchMenuItemOption[] = (menuItems as MenuItemWithBranch[]).map((item) => {
      const branchOverride = item.branchAvailability[0];
      const isAvailable = branchOverride ? branchOverride.isAvailable : true;
      const effectivePrice = branchOverride?.price
        ? branchOverride.price.toNumber()
        : item.price.toNumber();

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        price: effectivePrice,
        isAvailable,
        preparationTimeMinutes: item.preparationTimeMinutes,
      };
    });

    return { success: true, data: items };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to get branch menu items:', error);
    return { success: false, error: 'Failed to retrieve menu items' };
  }
}

/**
 * Creates a new restaurant order atomically.
 * Enforces branch scoping, table occupancy rules, menu availability, and server-side recalculations.
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_CREATE);
    const parsed = createOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid order data' };
    }

    const {
      branchId,
      orderType,
      tableId,
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      discountAmount = 0,
      deliveryCharge = 0,
      notes,
      items,
    } = parsed.data;

    // Verify user authorization for this branch
    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // Branch existence check
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, status: true },
    });
    if (!branch || branch.status !== 'ACTIVE') {
      return { success: false, error: 'Selected branch is invalid or inactive' };
    }

    // Branch service availability validation from Settings
    if (orderType === OrderType.DINE_IN) {
      const dineInEnabled = await getSetting<boolean>('ORDER_ENABLE_DINE_IN', branchId);
      if (dineInEnabled === false) {
        return { success: false, error: 'Dine-in service is currently disabled for this branch.' };
      }
    } else if (orderType === OrderType.TAKEAWAY) {
      const takeawayEnabled = await getSetting<boolean>('ORDER_ENABLE_TAKEAWAY', branchId);
      if (takeawayEnabled === false) {
        return { success: false, error: 'Takeaway service is currently disabled for this branch.' };
      }
    } else if (orderType === OrderType.DELIVERY) {
      const deliveryEnabled = await getSetting<boolean>('ORDER_ENABLE_DELIVERY', branchId);
      if (deliveryEnabled === false) {
        return { success: false, error: 'Delivery service is currently disabled for this branch.' };
      }
    }

    // Table validation for DINE_IN
    if (orderType === OrderType.DINE_IN) {
      if (!tableId) {
        return { success: false, error: 'Table is required for Dine-in orders' };
      }
      const table = await prisma.restaurantTable.findUnique({
        where: { id: tableId },
        include: {
          orders: {
            where: {
              status: {
                in: [
                  OrderStatus.PENDING,
                  OrderStatus.CONFIRMED,
                  OrderStatus.PREPARING,
                  OrderStatus.READY,
                ],
              },
            },
          },
        },
      });

      if (!table || table.branchId !== branchId) {
        return { success: false, error: 'Selected table does not belong to this branch' };
      }

      if (table.orders.length > 0) {
        return {
          success: false,
          error: `Table ${table.tableNumber} is currently occupied by active order ${table.orders[0].orderNumber}`,
        };
      }
    }

    // Fetch and validate menu items from database (server-authoritative pricing & availability)
    const menuItemIds = items.map((i) => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        status: 'ACTIVE',
      },
      include: {
        branchAvailability: {
          where: { branchId },
          select: { price: true, isAvailable: true },
        },
      },
    });

    if (dbMenuItems.length !== menuItemIds.length) {
      return { success: false, error: 'One or more selected menu items are invalid or inactive' };
    }

    type DbMenuItemType = Prisma.MenuItemGetPayload<{
      include: {
        branchAvailability: { select: { price: true; isAvailable: true } };
      };
    }>;

    const menuItemMap = new Map<string, DbMenuItemType>(
      (dbMenuItems as DbMenuItemType[]).map((m) => [m.id, m])
    );

    // Check branch availability and calculate server-side line totals
    let calculatedSubtotal = 0;
    const validatedItems: {
      menuItemId: string;
      itemName: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      notes: string | null;
    }[] = [];

    for (const item of items) {
      const dbItem = menuItemMap.get(item.menuItemId);
      if (!dbItem) {
        return { success: false, error: `Menu item not found: ${item.menuItemId}` };
      }

      const branchOverride = dbItem.branchAvailability[0];
      if (branchOverride && !branchOverride.isAvailable) {
        return {
          success: false,
          error: `Menu item "${dbItem.name}" is marked unavailable at this branch`,
        };
      }

      const unitPriceNumber = branchOverride?.price
        ? branchOverride.price.toNumber()
        : dbItem.price.toNumber();

      const itemDiscount = Math.min(item.discountAmount, unitPriceNumber * item.quantity);
      const lineTotalNumber = Math.max(0, unitPriceNumber * item.quantity - itemDiscount);

      calculatedSubtotal += lineTotalNumber;

      validatedItems.push({
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(unitPriceNumber.toFixed(2)),
        discountAmount: new Prisma.Decimal(itemDiscount.toFixed(2)),
        totalPrice: new Prisma.Decimal(lineTotalNumber.toFixed(2)),
        notes: item.notes || null,
      });
    }

    // Server-side financial calculations
    // 5% standard food tax rate
    const calculatedTax = Math.round(calculatedSubtotal * 0.05 * 100) / 100;
    const orderDiscount = Math.min(discountAmount, calculatedSubtotal);
    const effectiveDelivery = orderType === OrderType.DELIVERY ? deliveryCharge : 0;
    const grandTotal = Math.max(
      0,
      calculatedSubtotal - orderDiscount + calculatedTax + effectiveDelivery
    );

    // Concurrency-safe atomic transaction
    let retries = 3;
    while (retries > 0) {
      try {
        const createdOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const orderNumber = await generateOrderNumber(tx, branchId);

          // Handle customer resolution/linking
          let resolvedCustomerId = customerId || null;
          if (!resolvedCustomerId && customerPhone) {
            const existingCustomer = await tx.customer.findUnique({
              where: { phone: customerPhone },
            });
            if (existingCustomer) {
              resolvedCustomerId = existingCustomer.id;
            } else if (customerName) {
              const newCust = await tx.customer.create({
                data: {
                  name: customerName,
                  phone: customerPhone,
                  address: deliveryAddress || null,
                },
              });
              resolvedCustomerId = newCust.id;
            }
          }

          const newOrder = await tx.order.create({
            data: {
              orderNumber,
              branchId,
              orderType,
              status: OrderStatus.CONFIRMED,
              customerId: resolvedCustomerId,
              tableId: orderType === OrderType.DINE_IN ? tableId : null,
              customerName: customerName || null,
              customerPhone: customerPhone || null,
              deliveryAddress: orderType === OrderType.DELIVERY ? deliveryAddress : null,
              deliveryNotes: orderType === OrderType.DELIVERY ? deliveryNotes : null,
              subtotal: new Prisma.Decimal(calculatedSubtotal.toFixed(2)),
              discountAmount: new Prisma.Decimal(orderDiscount.toFixed(2)),
              taxAmount: new Prisma.Decimal(calculatedTax.toFixed(2)),
              deliveryCharge: new Prisma.Decimal(effectiveDelivery.toFixed(2)),
              totalAmount: new Prisma.Decimal(grandTotal.toFixed(2)),
              notes: notes || null,
              createdBy: user.name,
              items: {
                create: validatedItems,
              },
            },
            select: { id: true, orderNumber: true },
          });

          // Sync table occupancy if Dine-in
          if (orderType === OrderType.DINE_IN && tableId) {
            await tx.restaurantTable.update({
              where: { id: tableId },
              data: { status: TableStatus.OCCUPIED },
            });
          }

          await createAuditLog(
            {
              actorUserId: user.id,
              branchId,
              action: AUDIT_ACTIONS.ORDER_CREATE,
              entityType: AUDIT_ENTITY_TYPES.ORDER,
              entityId: newOrder.id,
              description: `Created ${orderType} order ${orderNumber} for ₹${grandTotal.toFixed(2)}`,
              afterData: {
                orderNumber,
                orderType,
                status: OrderStatus.CONFIRMED,
                totalAmount: grandTotal,
                itemCount: validatedItems.length,
              },
            },
            tx
          );

          return newOrder;
        });

        revalidatePath('/orders');
        return { success: true, data: createdOrder };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          retries--;
          if (retries === 0) throw err;
          continue;
        }
        throw err;
      }
    }

    return { success: false, error: 'Could not generate unique order number' };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to create order:', error);
    return { success: false, error: 'Failed to create order' };
  }
}

/**
 * Updates order details for an order still in PENDING state.
 */
export async function updateOrder(
  id: string,
  input: UpdateOrderInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_UPDATE);
    const parsed = updateOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid update data' };
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // Only allow editing orders in PENDING status
    if (order.status !== OrderStatus.PENDING) {
      return {
        success: false,
        error: `Cannot modify order details when status is ${order.status}. Only PENDING orders are editable.`,
      };
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        ...(parsed.data.customerName !== undefined && { customerName: parsed.data.customerName || null }),
        ...(parsed.data.customerPhone !== undefined && { customerPhone: parsed.data.customerPhone || null }),
        ...(parsed.data.deliveryAddress !== undefined && { deliveryAddress: parsed.data.deliveryAddress || null }),
        ...(parsed.data.deliveryNotes !== undefined && { deliveryNotes: parsed.data.deliveryNotes || null }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes || null }),
      },
    });

    await createAuditLog({
      actorUserId: user.id,
      branchId: order.branchId,
      action: AUDIT_ACTIONS.ORDER_UPDATE,
      entityType: AUDIT_ENTITY_TYPES.ORDER,
      entityId: order.id,
      description: `Updated details for order ${order.orderNumber}`,
      beforeData: {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        deliveryNotes: order.deliveryNotes,
        notes: order.notes,
      },
      afterData: {
        customerName: updatedOrder.customerName,
        customerPhone: updatedOrder.customerPhone,
        deliveryAddress: updatedOrder.deliveryAddress,
        deliveryNotes: updatedOrder.deliveryNotes,
        notes: updatedOrder.notes,
      },
    }).catch((e: unknown) => console.error('Failed to create order update audit log:', e));

    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    return { success: true, data: { id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update order:', error);
    return { success: false, error: 'Failed to update order' };
  }
}

/**
 * Advances or transitions order lifecycle status.
 * Enforces valid state machine paths and table status synchronization.
 */
export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<ActionResult<{ id: string; status: OrderStatus }>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_STATUS);
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        branchId: true,
        orderType: true,
        tableId: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    // Validate state machine transition
    if (!isValidStatusTransition(order.status, newStatus)) {
      return {
        success: false,
        error: `Invalid status transition from ${order.status} to ${newStatus}.`,
      };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id },
        data: { status: newStatus },
      });

      // If dine-in order is COMPLETED, table transitions to CLEANING
      if (
        order.orderType === OrderType.DINE_IN &&
        order.tableId &&
        newStatus === OrderStatus.COMPLETED
      ) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.CLEANING },
        });
      }

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: order.branchId,
          action: AUDIT_ACTIONS.ORDER_STATUS_CHANGE,
          entityType: AUDIT_ENTITY_TYPES.ORDER,
          entityId: order.id,
          description: `Changed order ${order.orderNumber} status from ${order.status} to ${newStatus}`,
          beforeData: { status: order.status },
          afterData: { status: newStatus },
        },
        tx
      );
    });

    revalidatePath('/orders');
    revalidatePath(`/orders/${id}`);
    return { success: true, data: { id, status: newStatus } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to update order status:', error);
    return { success: false, error: 'Failed to update order status' };
  }
}

/**
 * Cancels an active order with mandatory documented reason.
 * Enforces cancellation rules and frees occupied tables.
 */
export async function cancelOrder(
  input: CancelOrderInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_CANCEL);
    const parsed = cancelOrderSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid cancellation data' };
    }

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        branchId: true,
        orderType: true,
        tableId: true,
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    const scope = await getAuthorizedBranchScope(user);
    if (!isBranchAuthorized(scope, order.branchId)) {
      return { success: false, error: 'Unauthorized branch access' };
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      return {
        success: false,
        error: `Cannot cancel an order in ${order.status} status`,
      };
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancellationReason: parsed.data.reason,
          cancelledAt: new Date(),
          cancelledBy: user.name,
        },
      });

      // Free table if dine-in
      if (order.orderType === OrderType.DINE_IN && order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      await createAuditLog(
        {
          actorUserId: user.id,
          branchId: order.branchId,
          action: AUDIT_ACTIONS.CANCEL,
          entityType: AUDIT_ENTITY_TYPES.ORDER,
          entityId: order.id,
          description: `Cancelled order ${order.orderNumber}. Reason: ${parsed.data.reason}`,
          beforeData: { status: order.status },
          afterData: { status: OrderStatus.CANCELLED },
          metadata: { cancellationReason: parsed.data.reason },
        },
        tx
      );
    });

    revalidatePath('/orders');
    revalidatePath(`/orders/${order.id}`);
    return { success: true, data: { id: order.id } };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Failed to cancel order:', error);
    return { success: false, error: 'Failed to cancel order' };
  }
}
