'use server';

import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/guards';
import { revalidatePath } from 'next/cache';
import type { OrderType, PaymentMethod } from '@prisma/client';
import { publishOrderCreated, publishPaymentUpdated } from '@/lib/realtime/event-bus';
import { generateTrackingToken, authorizeOrderAccess } from '@/lib/customer/tracking-token';
import {
  createRazorpayOrder,
  createRazorpayQrCode,
  verifyRazorpayPaymentSignature,
  getRazorpayKeyId,
} from '@/lib/payments/razorpay';
import type { CheckoutPayload } from '@/lib/customer/order-actions';

export interface InitiateRazorpayResult {
  success: boolean;
  error?: string;
  orderId?: string;
  orderNumber?: string;
  trackingToken?: string;
  razorpayOrderId?: string;
  amount?: number; // in paise
  currency?: string;
  keyId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  isMock?: boolean;
  qrImageUrl?: string;
  qrId?: string;
}


export interface VerifyRazorpayPayload {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  trackingToken?: string;
}

export interface VerifyRazorpayResult {
  success: boolean;
  error?: string;
  orderNumber?: string;
  trackingUrl?: string;
}

/**
 * Validates the checkout payload, calculates the verified total from DB menu items,
 * initiates a Razorpay Order, and creates the pending Order + Payment record atomically.
 */
export async function initiateRazorpayOrderAction(
  payload: CheckoutPayload
): Promise<InitiateRazorpayResult> {
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

    // 2. Fetch menu items to verify prices securely
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
      const dbItem = dbMenuItems.find((m) => m.id === cartItem.menuItemId);
      if (!dbItem) continue;

      const branchOverride = dbItem.branchAvailability[0];
      if (branchOverride && !branchOverride.isAvailable) {
        return {
          success: false,
          error: `Item "${dbItem.name}" is sold out at this branch.`,
        };
      }

      const unitPrice = branchOverride?.price
        ? Number(branchOverride.price)
        : Number(dbItem.price);

      const totalPrice = Math.round(unitPrice * cartItem.quantity * 100) / 100;
      subtotal += totalPrice;

      validatedOrderItems.push({
        menuItemId: dbItem.id,
        itemName: dbItem.name,
        quantity: cartItem.quantity,
        unitPrice,
        totalPrice,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // 4. Financial Calculations: GST (5%), Delivery charge
    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
    const deliveryCharge = orderType === 'DELIVERY' ? (subtotal >= 499 ? 0 : 49) : 0;

    let discountAmount = 0;
    if (couponCode) {
      const code = couponCode.trim().toUpperCase();
      if (code === 'WELCOME50' && subtotal >= 200) {
        discountAmount = Math.min(50, subtotal);
      } else if (code === 'FREEDEL' && orderType === 'DELIVERY') {
        discountAmount = deliveryCharge;
      } else if (code === 'OVEN10') {
        discountAmount = Math.round(subtotal * 0.1 * 100) / 100;
      }
    }

    const totalAmount = Math.max(
      1, // Razorpay minimum charge is ₹1.00
      Math.round((subtotal + taxAmount + deliveryCharge - discountAmount) * 100) / 100
    );

    // 5. Check authenticated user
    const currentUser = await getCurrentUser();
    let customerId: string | null = null;

    if (currentUser) {
      let customer = await prisma.customer.findUnique({
        where: { userId: currentUser.id },
      });

      if (!customer) {
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
      const existingCustomer = await prisma.customer.findUnique({
        where: { phone: customerPhone },
      });

      if (existingCustomer && !existingCustomer.userId) {
        customerId = existingCustomer.id;
      } else if (!existingCustomer) {
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

    // 6. Generate order identifiers
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `OX-${datePrefix}-${randomSuffix}`;
    const paymentNumber = `PAY-${datePrefix}-${randomSuffix}`;
    const { token: trackingToken, tokenHash: trackingTokenHash } = generateTrackingToken();

    // 7. Create Razorpay Order
    const razorpayOrder = await createRazorpayOrder({
      amount: totalAmount,
      receipt: orderNumber,
      notes: {
        orderNumber,
        branchId,
        customerPhone,
        customerName,
      },
    });

    // 8. Persist Order and initial Payment record with PENDING status
    const createdOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          trackingTokenHash,
          branchId,
          orderType: orderType as OrderType,
          status: 'PENDING', // Will transition to CONFIRMED once payment is verified
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
              toStatus: 'PENDING',
              performedBy: 'CUSTOMER',
              userId: currentUser?.id || null,
              notes: 'Customer initiated Razorpay payment gateway checkout',
            },
          },
        },
      });

      await tx.payment.create({
        data: {
          paymentNumber,
          orderId: order.id,
          branchId,
          amount: totalAmount,
          method: (paymentMethod === 'ONLINE' ? 'ONLINE' : 'UPI') as PaymentMethod,
          status: 'PENDING',
          processedBy: currentUser ? currentUser.name : customerName,
          gatewayProvider: 'RAZORPAY',
          gatewayTransactionId: razorpayOrder.id,
          gatewayStatus: 'created',
          gatewayMetadata: {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            isMock: razorpayOrder.isMock,
          },
          notes: `Razorpay Order ${razorpayOrder.id} initiated`,
        },
      });

      return order;
    });

    // Optionally create official Razorpay QR code if UPI payment method selected
    let qrImageUrl: string | undefined;
    let qrId: string | undefined;

    if (paymentMethod === 'UPI') {
      try {
        const qrResult = await createRazorpayQrCode({
          amount: totalAmount,
          orderNumber: createdOrder.orderNumber,
          notes: {
            orderId: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
          },
        });
        if (qrResult) {
          qrImageUrl = qrResult.imageUrl;
          qrId = qrResult.id;
        }
      } catch (err) {
        console.warn('[Razorpay] Official QR code creation failed or not enabled on account:', err);
      }
    }

    return {
      success: true,
      orderId: createdOrder.id,
      orderNumber: createdOrder.orderNumber,
      trackingToken,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      customerName,
      customerPhone,
      customerEmail: currentUser?.email || '',
      isMock: razorpayOrder.isMock,
      qrImageUrl,
      qrId,
    };
  } catch (error) {

    console.error('Failed to initiate Razorpay order:', error);
    return {
      success: false,
      error: 'Unable to initialize online payment gateway. Please try again.',
    };
  }
}

/**
 * Validates the cryptographic Razorpay payment signature and completes the order.
 */
export async function verifyAndCompleteRazorpayPaymentAction(
  payload: VerifyRazorpayPayload
): Promise<VerifyRazorpayResult> {
  try {
    const {
      orderId,
      orderNumber,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      trackingToken,
    } = payload;

    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return { success: false, error: 'Incomplete payment verification payload.' };
    }

    console.log(`[Razorpay] Verifying payment for order ${orderNumber} (${orderId})`);

    // 1. Verify cryptographic signature
    const isValid = verifyRazorpayPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      // Record failure audit
      await prisma.payment.updateMany({
        where: { orderId, gatewayTransactionId: razorpayOrderId },
        data: {
          status: 'FAILED',
          gatewayStatus: 'signature_verification_failed',
          notes: `Signature verification failed for payment ${razorpayPaymentId}`,
        },
      });

      return {
        success: false,
        error: 'Payment verification failed. If your money was deducted, it will be refunded automatically.',
      };
    }

    // 2. Fetch order and pending payment
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { gatewayProvider: 'RAZORPAY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existingOrder) {
      return { success: false, error: 'Order not found.' };
    }

    const paymentRecord = existingOrder.payments[0];

    // 3. Atomically confirm order and mark payment SUCCESS
    await prisma.$transaction(async (tx) => {
      // Update Payment
      if (paymentRecord) {
        await tx.payment.update({
          where: { id: paymentRecord.id },
          data: {
            status: 'SUCCESS',
            referenceNumber: razorpayPaymentId,
            gatewayTransactionId: razorpayPaymentId,
            gatewayStatus: 'captured',
            gatewayMetadata: {
              razorpayOrderId,
              razorpayPaymentId,
              razorpaySignature,
              verifiedAt: new Date().toISOString(),
            },
            notes: 'Payment verified and captured via Razorpay Gateway',
          },
        });

        await tx.paymentAuditLog.create({
          data: {
            paymentId: paymentRecord.id,
            action: 'PAYMENT_CAPTURED',
            fromStatus: 'PENDING',
            toStatus: 'SUCCESS',
            amount: paymentRecord.amount,
            performedBy: 'RAZORPAY_GATEWAY',
            notes: `Razorpay payment ID: ${razorpayPaymentId}`,
          },
        });
      }

      // Update Order to CONFIRMED
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      await tx.orderAuditLog.create({
        data: {
          orderId,
          fromStatus: existingOrder.status,
          toStatus: 'CONFIRMED',
          performedBy: 'RAZORPAY_GATEWAY',
          notes: `Payment verified via Razorpay (${razorpayPaymentId})`,
        },
      });
    });

    // 4. Revalidate cache
    try {
      revalidatePath(`/track/${existingOrder.orderNumber}`);
      revalidatePath('/account/orders');
    } catch {
      // Ignore request context errors
    }

    // 5. Emit real-time events to Staff POS and Kitchen screens
    try {
      publishOrderCreated({
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        branchId: existingOrder.branchId,
        orderType: existingOrder.orderType,
        status: 'CONFIRMED',
        totalAmount: Number(existingOrder.totalAmount),
        customerName: existingOrder.customerName || 'Customer',
        tableNumber: null,
        itemCount: 1,
        createdAt: existingOrder.createdAt.toISOString(),
      });

      publishPaymentUpdated({
        paymentId: paymentRecord?.paymentNumber || razorpayPaymentId,
        orderId: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        branchId: existingOrder.branchId,
        amount: Number(existingOrder.totalAmount),
        status: 'SUCCESS',
        method: paymentRecord?.method || 'ONLINE',
        updatedAt: new Date().toISOString(),
      });
    } catch (realtimeErr) {
      console.error('[Realtime] Failed to emit payment success event:', realtimeErr);
    }

    const trackingUrl = trackingToken
      ? `/track/${existingOrder.orderNumber}?token=${trackingToken}`
      : `/track/${existingOrder.orderNumber}`;

    return {
      success: true,
      orderNumber: existingOrder.orderNumber,
      trackingUrl,
    };
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    return {
      success: false,
      error: 'An unexpected error occurred while verifying your payment.',
    };
  }
}

/**
 * Initiates Razorpay checkout for an existing order with a PENDING payment
 * (e.g., from the tracking page or customer profile).
 */
export async function initiatePendingOrderRazorpayAction({
  orderNumber,
  token,
}: {
  orderNumber: string;
  token?: string;
}): Promise<InitiateRazorpayResult> {
  try {
    const currentUser = await getCurrentUser();
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return { success: false, error: 'Order not found.' };
    }

    // Check authorization via user account or tracking token
    const auth = await authorizeOrderAccess(order, currentUser, token || null);
    if (!auth.authorized) {
      return { success: false, error: 'Unauthorized to make payment for this order.' };
    }

    if (order.status === 'CANCELLED') {
      return { success: false, error: 'This order has been cancelled and cannot be paid.' };
    }

    const latestPayment = order.payments[0];
    if (latestPayment && latestPayment.status === 'SUCCESS') {
      return { success: false, error: 'This order has already been paid in full.' };
    }

    const totalAmount = Number(order.totalAmount);
    const razorpayOrder = await createRazorpayOrder({
      amount: totalAmount,
      receipt: order.orderNumber,
      notes: {
        orderNumber: order.orderNumber,
        branchId: order.branchId,
        customerPhone: order.customerPhone || '',
      },
    });

    // Update or link payment record
    if (latestPayment) {
      await prisma.payment.update({
        where: { id: latestPayment.id },
        data: {
          gatewayProvider: 'RAZORPAY',
          gatewayTransactionId: razorpayOrder.id,
          gatewayStatus: 'created',
          gatewayMetadata: {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            isMock: razorpayOrder.isMock,
          },
        },
      });
    }

    let qrImageUrl: string | undefined;
    let qrId: string | undefined;

    try {
      const qrResult = await createRazorpayQrCode({
        amount: Number(order.totalAmount),
        orderNumber: order.orderNumber,
        notes: {
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
      });
      if (qrResult) {
        qrImageUrl = qrResult.imageUrl;
        qrId = qrResult.id;
      }
    } catch (err) {
      console.warn('[Razorpay] Official QR code creation failed for pending order:', err);
    }

    return {
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingToken: token,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: getRazorpayKeyId(),
      customerName: order.customerName || 'Customer',
      customerPhone: order.customerPhone || '',
      customerEmail: currentUser?.email || '',
      isMock: razorpayOrder.isMock,
      qrImageUrl,
      qrId,
    };
  } catch (error) {
    console.error('Failed to initiate pending order payment:', error);
    return {
      success: false,
      error: 'Unable to start payment session. Please try again.',
    };
  }
}
