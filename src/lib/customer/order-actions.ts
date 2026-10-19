'use server';

import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';
import type { OrderType, PaymentMethod } from '@prisma/client';
import { publishOrderCreated, publishPaymentUpdated } from '@/lib/realtime/event-bus';
import { generateTrackingToken, authorizeOrderAccess } from '@/lib/customer/tracking-token';
import { validateCoupon, recordCouponUsage } from '@/lib/coupons/coupon-service';

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
  couponInstruction?: string;
  paymentMethod: 'CASH' | 'UPI' | 'ONLINE' | 'CARD';
}

export interface CheckoutResult {
  success: boolean;
  error?: string;
  orderNumber?: string;
  orderId?: string;
  trackingToken?: string;
  trackingUrl?: string;
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
      couponInstruction,
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

    // 4. Authenticated User Check (Needed for both coupon checks and customer account linking)
    const currentUser = await getCurrentUser();

    // 5. Calculate Tax, Delivery Charge, Discount
    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const deliveryCharge = orderType === 'DELIVERY' ? (subtotal >= 499 ? 0 : 40) : 0;

    let discountAmount = 0;
    let validatedCouponData: { code: string; freeItemName?: string; instruction?: string } | null = null;

    if (couponCode) {
      const couponValidation = await validateCoupon({
        code: couponCode,
        subtotal,
        branchId,
        userId: currentUser?.id,
        customerPhone,
        customerEmail: currentUser?.email,
        instruction: couponInstruction,
      });

      if (!couponValidation.valid) {
        return { success: false, error: couponValidation.message };
      }

      discountAmount = couponValidation.discountAmount || 0;
      validatedCouponData = {
        code: couponValidation.code || couponCode.trim().toUpperCase(),
        freeItemName: couponValidation.freeItemName,
        instruction: couponInstruction || (couponValidation.freeItemName ? `Free Gift: ${couponValidation.freeItemName}` : undefined),
      };
    }

    const totalAmount = Math.max(
      0,
      Math.round((subtotal + taxAmount + deliveryCharge - discountAmount) * 100) / 100
    );

    let customerId: string | null = null;

    if (currentUser) {
      // Find customer strictly tied to authenticated user to avoid unsafe automatic account linking
      let customer = await prisma.customer.findUnique({
        where: { userId: currentUser.id },
      });

      if (!customer) {
        // Check if an unlinked guest customer record with this phone exists
        const existingByPhone = await prisma.customer.findUnique({
          where: { phone: customerPhone },
        });

        if (existingByPhone && !existingByPhone.userId) {
          customer = await prisma.customer.update({
            where: { id: existingByPhone.id },
            data: {
              userId: currentUser.id,
              name: customerName,
              email: currentUser.email,
            },
          });
        } else if (!existingByPhone) {
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
        }
      }
      customerId = customer?.id || null;
    } else {
      // Guest customer: look up existing customer by phone if any
      const existingCustomer = await prisma.customer.findUnique({
        where: { phone: customerPhone },
      });

      if (existingCustomer) {
        // Only associate if it is a pure guest record (not linked to an account)
        if (!existingCustomer.userId) {
          customerId = existingCustomer.id;
        } else {
          // Do not link guest order to a registered customer's account to prevent account contamination.
          customerId = null;
        }
      } else {
        const newCustomer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            address: deliveryAddress || null,
            status: 'ACTIVE',
          },
        });
        customerId = newCustomer.id;
      }
    }

    // 6. Generate unique orderNumber, paymentNumber, and cryptographically secure tracking token
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `OX-${datePrefix}-${randomSuffix}`;
    const paymentNumber = `PAY-${datePrefix}-${randomSuffix}`;
    const { token: trackingToken, tokenHash: trackingTokenHash } = generateTrackingToken();

    // 7. Atomic transaction to create order, order items, audit log, and payment
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          trackingTokenHash,
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
          couponCode: validatedCouponData?.code || null,
          couponInstruction: validatedCouponData?.instruction || null,
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

    // Record coupon usage in database
    if (validatedCouponData) {
      await recordCouponUsage({
        couponCode: validatedCouponData.code,
        userId: currentUser?.id,
        customerId,
        customerPhone,
        customerEmail: currentUser?.email,
        customerName,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        discountAmount,
        instruction: validatedCouponData.instruction,
      });
    }

    try {
      revalidatePath(`/track/${orderNumber}`);
      revalidatePath('/account/orders');
    } catch {
      // Graceful fallback when invoked outside a Next.js request context (e.g. CLI, tests)
    }

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
      trackingToken,
      trackingUrl: `/track/${createdOrder.orderNumber}?token=${trackingToken}`,
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
  if (!user || !user.id) return [];

  // Strictly query customer record belonging to this authenticated user account
  const customer = await prisma.customer.findUnique({
    where: { userId: user.id },
  });

  // Query only orders that were created by this user ID,
  // or assigned to this user's verified customer record.
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { createdBy: user.id },
        ...(customer ? [{ customerId: customer.id }] : []),
      ],
    },
    include: {
      branch: {
        select: {
          id: true,
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
              id: true,
              imageUrl: true,
              description: true,
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
    branchId: o.branch.id,
    branchName: o.branch.name,
    branchSlug: o.branch.slug,
    branchPhone: o.branch.phone,
    branchAddress: o.branch.address,
    deliveryAddress: o.deliveryAddress,
    paymentMethod: o.payments[0]?.method || 'CASH',
    paymentStatus: o.payments[0]?.status || 'PENDING',
    items: o.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.itemName,
      quantity: i.quantity,
      price: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      imageUrl: i.menuItem?.imageUrl || '/images/hero-pizza.jpg',
      description: i.menuItem?.description || undefined,
    })),
  }));
}

/**
 * Checks whether an order exists and whether the current viewer is authorized to access it.
 */
export async function checkOrderAccess(orderNumber: string, token?: string): Promise<{
  exists: boolean;
  authorized: boolean;
  reason?: string;
}> {
  if (!orderNumber || typeof orderNumber !== 'string') {
    return { exists: false, authorized: false, reason: 'INVALID_ORDER_NUMBER' };
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      branchId: true,
      customerId: true,
      createdBy: true,
      trackingTokenHash: true,
    },
  });

  if (!order) {
    return { exists: false, authorized: false, reason: 'NOT_FOUND' };
  }

  const currentUser = await getCurrentUser();
  const auth = await authorizeOrderAccess(order, currentUser, token);

  return {
    exists: true,
    authorized: auth.authorized,
    reason: auth.reason,
  };
}


export async function getCustomerOrderDetails(orderNumber: string, token?: string) {
  if (!orderNumber || typeof orderNumber !== 'string') {
    return null;
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      branch: {
        select: {
          id: true,
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
              id: true,
              imageUrl: true,
              description: true,
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

  // Strict server-side authorization:
  // Requires Executive role, branch staff assignment, owning authenticated customer,
  // or a cryptographically valid guest tracking token matching the stored token hash.
  const currentUser = await getCurrentUser();
  const auth = await authorizeOrderAccess(order, currentUser, token);
  if (!auth.authorized) {
    // Fail closed: Return null (consistent 404 response without leaking existence or sensitive PII)
    return null;
  }

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
    couponCode: order.couponCode,
    couponInstruction: order.couponInstruction,
    branch: {
      id: order.branch.id,
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
      menuItemId: i.menuItemId,
      name: i.itemName,
      quantity: i.quantity,
      price: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      imageUrl: i.menuItem?.imageUrl || '/images/hero-pizza.jpg',
      description: i.menuItem?.description || undefined,
    })),
  };
}
