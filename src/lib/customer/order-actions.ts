'use server';

import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';
import type { OrderType, PaymentMethod } from '@prisma/client';
import { publishOrderCreated, publishPaymentUpdated } from '@/lib/realtime/event-bus';

export interface CheckoutOrderItem {
  menuItemId: string;
  quantity: number;
}

export interface CheckoutPayload {
  branchId: string;
  orderType: 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN';
  tableNumber?: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
  items: CheckoutOrderItem[];
  couponCode?: string;
  paymentMethod: 'CASH' | 'UPI' | 'ONLINE' | 'CARD';
}

export interface CheckoutResult {
  success: boolean;
  error?: string;
  orderNumber?: string;
  orderId?: string;
}

export async function createCustomerOrderAction(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  try {
    const {
      branchId,
      orderType,
      tableNumber,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      items,
      couponCode,
      paymentMethod,
    } = payload;

    if (!items || items.length === 0) {
      return { success: false, error: 'Your cart is empty. Please add items to order.' };
    }

    if (!customerName?.trim() || !customerPhone?.trim()) {
      return { success: false, error: 'Name and phone number are required.' };
    }

    if (orderType === 'DELIVERY' && !deliveryAddress?.trim()) {
      return { success: false, error: 'Delivery address is required for delivery orders.' };
    }

    // 1. Validate branch
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.status !== 'ACTIVE') {
      return { success: false, error: 'Selected branch is currently unavailable.' };
    }

    // 2. Fetch all menu items from database to verify prices securely
    const itemIds = items.map((i) => i.menuItemId);
    const dbMenuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: itemIds },
        status: 'ACTIVE',
      },
      include: {
        branchAvailability: {
          where: { branchId },
        },
      },
    });

    if (dbMenuItems.length !== itemIds.length) {
      return {
        success: false,
        error: 'Some items in your cart are no longer available. Please review your cart.',
      };
    }

    // 3. Compute item totals & subtotal strictly from DB prices
    let subtotal = 0;
    const validatedOrderItems: {
      menuItemId: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }[] = [];

    for (const cartItem of items) {
      const dbItem = dbMenuItems.find((i) => i.id === cartItem.menuItemId);
      if (!dbItem) continue;

      const branchOverride = dbItem.branchAvailability[0];
      if (branchOverride && !branchOverride.isAvailable) {
        return {
          success: false,
          error: `"${dbItem.name}" is currently sold out at this branch.`,
        };
      }

      const unitPrice = branchOverride?.price
        ? Number(branchOverride.price)
        : Number(dbItem.price);

      const qty = Math.max(1, Math.min(50, cartItem.quantity));
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      subtotal += lineTotal;

      validatedOrderItems.push({
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        quantity: qty,
        unitPrice,
        totalPrice: lineTotal,
      });
    }

    // 4. Calculate Tax, Delivery Charge, Discount
    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const deliveryCharge = orderType === 'DELIVERY' ? (subtotal >= 499 ? 0 : 40) : 0;

    let discountAmount = 0;
    if (couponCode) {
      const cleanCode = couponCode.trim().toUpperCase();
      if (cleanCode === 'WELCOME50' || cleanCode === 'FIRST50') {
        discountAmount = Math.min(50, subtotal);
      } else if (cleanCode === 'OVEN20' || cleanCode === 'PIZZA20') {
        discountAmount = Math.min(Math.round(subtotal * 0.2 * 100) / 100, 150);
      }
    }

    const totalAmount = Math.max(
      0,
      Math.round((subtotal + taxAmount + deliveryCharge - discountAmount) * 100) / 100
    );

    // 5. Check authenticated user
    const currentUser = await getCurrentUser();
    let customerId: string | null = null;

    if (currentUser) {
      // Find or link customer
      let customer = await prisma.customer.findFirst({
        where: {
          OR: [{ userId: currentUser.id }, { phone: customerPhone }],
        },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            userId: currentUser.id,
            name: customerName,
            phone: customerPhone,
            email: currentUser.email,
            address: deliveryAddress || null,
            status: 'ACTIVE',
          },
        });
      } else if (!customer.userId) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { userId: currentUser.id },
        });
      }
      customerId = customer.id;
    } else {
      // Guest or unlinked customer
      let customer = await prisma.customer.findUnique({
        where: { phone: customerPhone },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            address: deliveryAddress || null,
            status: 'ACTIVE',
          },
        });
      }
      customerId = customer.id;
    }

    // 6. Generate unique orderNumber and paymentNumber
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `OX-${datePrefix}-${randomSuffix}`;
    const paymentNumber = `PAY-${datePrefix}-${randomSuffix}`;

    // 7. Atomic transaction to create order, order items, audit log, and payment
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          branchId,
          orderType: orderType as OrderType,
          status: 'CONFIRMED',
          customerId,
          customerName,
          customerPhone,
          deliveryAddress: deliveryAddress || null,
          deliveryNotes: deliveryNotes || (tableNumber ? `Table: ${tableNumber}` : null),
          subtotal,
          discountAmount,
          taxAmount,
          deliveryCharge,
          totalAmount,
          notes: deliveryNotes || null,
          confirmedAt: new Date(),
          createdBy: currentUser ? currentUser.id : 'CUSTOMER_SELF_SERVICE',
          items: {
            create: validatedOrderItems.map((item) => ({
              menuItemId: item.menuItemId,
              itemName: item.itemName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
          auditLogs: {
            create: {
              fromStatus: 'PENDING',
              toStatus: 'CONFIRMED',
              performedBy: 'CUSTOMER',
              userId: currentUser?.id || null,
              notes: 'Customer placed order via online storefront',
            },
          },
        },
      });

      // Create Payment record
      await tx.payment.create({
        data: {
          paymentNumber,
          orderId: order.id,
          branchId,
          amount: totalAmount,
          method: paymentMethod as PaymentMethod,
          status: paymentMethod === 'CASH' ? 'PENDING' : 'SUCCESS',
          processedBy: currentUser ? currentUser.name : customerName,
          notes: `Customer checkout via ${paymentMethod}`,
        },
      });

      return order;
    });

    revalidatePath(`/track/${orderNumber}`);
    revalidatePath('/account/orders');

    // Emit real-time events strictly after transaction commits
    try {
      publishOrderCreated({
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        branchId: createdOrder.branchId,
        orderType: createdOrder.orderType,
        status: createdOrder.status,
        totalAmount: Number(createdOrder.totalAmount),
        customerName: customerName || 'Customer',
        tableNumber: tableNumber || null,
        itemCount: validatedOrderItems.length,
        createdAt: createdOrder.createdAt.toISOString(),
      });

      if (paymentMethod !== 'CASH') {
        publishPaymentUpdated({
          paymentId: paymentNumber,
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          branchId: createdOrder.branchId,
          amount: Number(createdOrder.totalAmount),
          status: 'SUCCESS',
          method: paymentMethod,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (realtimeErr) {
      console.error('[Realtime] Failed to publish order created event:', realtimeErr);
    }

    return {
      success: true,
      orderNumber: createdOrder.orderNumber,
      orderId: createdOrder.id,
    };
  } catch (error) {
    console.error('Customer checkout error:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while placing your order. Please try again.',
    };
  }
}

export async function getCustomerOrdersAction() {
  const user = await getCurrentUser();
  if (!user) return [];

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ userId: user.id }, { email: user.email }],
    },
  });

  if (!customer) return [];

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ customerId: customer.id }, { createdBy: user.id }],
    },
    include: {
      branch: {
        select: {
          name: true,
          slug: true,
          phone: true,
          address: true,
        },
      },
      items: {
        include: {
          menuItem: {
            select: {
              imageUrl: true,
            },
          },
        },
      },
      payments: {
        select: {
          method: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    orderType: o.orderType,
    totalAmount: Number(o.totalAmount),
    subtotal: Number(o.subtotal),
    taxAmount: Number(o.taxAmount),
    deliveryCharge: Number(o.deliveryCharge),
    discountAmount: Number(o.discountAmount),
    createdAt: o.createdAt.toISOString(),
    branchName: o.branch.name,
    branchSlug: o.branch.slug,
    branchPhone: o.branch.phone,
    deliveryAddress: o.deliveryAddress,
    paymentMethod: o.payments[0]?.method || 'CASH',
    paymentStatus: o.payments[0]?.status || 'PENDING',
    items: o.items.map((i) => ({
      id: i.id,
      name: i.itemName,
      quantity: i.quantity,
      price: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      imageUrl: i.menuItem?.imageUrl || '/images/hero-pizza.jpg',
    })),
  }));
}

export async function getCustomerOrderDetails(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      branch: {
        select: {
          name: true,
          slug: true,
          phone: true,
          address: true,
          city: true,
        },
      },
      items: {
        include: {
          menuItem: {
            select: {
              imageUrl: true,
            },
          },
        },
      },
      payments: {
        select: {
          method: true,
          status: true,
          paymentNumber: true,
        },
      },
    },
  });

  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    orderType: order.orderType,
    subtotal: Number(order.subtotal),
    taxAmount: Number(order.taxAmount),
    deliveryCharge: Number(order.deliveryCharge),
    discountAmount: Number(order.discountAmount),
    totalAmount: Number(order.totalAmount),
    createdAt: order.createdAt.toISOString(),
    confirmedAt: order.confirmedAt?.toISOString() || null,
    preparingAt: order.preparingAt?.toISOString() || null,
    readyAt: order.readyAt?.toISOString() || null,
    completedAt: order.completedAt?.toISOString() || null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryNotes: order.deliveryNotes,
    branch: {
      name: order.branch.name,
      slug: order.branch.slug,
      phone: order.branch.phone,
      address: order.branch.address,
      city: order.branch.city,
    },
    payment: {
      method: order.payments[0]?.method || 'CASH',
      status: order.payments[0]?.status || 'PENDING',
      paymentNumber: order.payments[0]?.paymentNumber || '',
    },
    items: order.items.map((i) => ({
      id: i.id,
      name: i.itemName,
      quantity: i.quantity,
      price: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      imageUrl: i.menuItem?.imageUrl || '/images/hero-pizza.jpg',
    })),
  };
}
