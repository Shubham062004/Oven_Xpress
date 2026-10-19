import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  verifyRazorpayWebhookSignature,
  fetchRazorpayOrderPayments,
} from '@/lib/payments/razorpay';
import { publishPaymentUpdated } from '@/lib/realtime/event-bus';
import { recordCouponUsage } from '@/lib/coupons/coupon-service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing x-razorpay-signature header' }, { status: 400 });
    }

    const isValid = verifyRazorpayWebhookSignature({ rawBody, signature });
    if (!isValid) {
      console.warn('[Razorpay Webhook] Invalid signature received.');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event as string;
    const payload = event.payload;

    console.log(`[Razorpay Webhook] Processing event: ${eventType}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id || payload.order?.entity?.id;
      const razorpayPaymentId = paymentEntity?.id;

      if (razorpayOrderId) {
        // Find matching payment record
        const paymentRecord = await prisma.payment.findFirst({
          where: {
            OR: [
              { gatewayTransactionId: razorpayOrderId },
              { gatewayTransactionId: razorpayPaymentId },
            ],
          },
          include: { order: true },
        });

        if (paymentRecord && paymentRecord.status !== 'SUCCESS') {
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: paymentRecord.id },
              data: {
                status: 'SUCCESS',
                gatewayTransactionId: razorpayPaymentId || paymentRecord.gatewayTransactionId,
                gatewayStatus: 'captured',
                referenceNumber: razorpayPaymentId || paymentRecord.referenceNumber,
                gatewayMetadata: {
                  webhookEvent: eventType,
                  razorpayPaymentId,
                  razorpayOrderId,
                  capturedAt: new Date().toISOString(),
                },
                notes: `Captured via Razorpay webhook (${eventType})`,
              },
            });

            await tx.order.update({
              where: { id: paymentRecord.orderId },
              data: {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
              },
            });

            await tx.paymentAuditLog.create({
              data: {
                paymentId: paymentRecord.id,
                action: 'WEBHOOK_PAYMENT_CAPTURED',
                fromStatus: paymentRecord.status,
                toStatus: 'SUCCESS',
                amount: paymentRecord.amount,
                performedBy: 'RAZORPAY_WEBHOOK',
                notes: `Webhook confirmed payment ID ${razorpayPaymentId}`,
              },
            });
          });

          // Record coupon usage if applied
          if (paymentRecord.order.couponCode) {
            await recordCouponUsage({
              couponCode: paymentRecord.order.couponCode,
              userId: paymentRecord.order.customerId ? undefined : null,
              customerId: paymentRecord.order.customerId,
              customerPhone: paymentRecord.order.customerPhone,
              customerName: paymentRecord.order.customerName,
              orderId: paymentRecord.order.id,
              orderNumber: paymentRecord.order.orderNumber,
              discountAmount: Number(paymentRecord.order.discountAmount),
              instruction: paymentRecord.order.couponInstruction,
            });
          }

          // Broadcast realtime notification
          try {
            publishPaymentUpdated({
              paymentId: paymentRecord.paymentNumber,
              orderId: paymentRecord.orderId,
              orderNumber: paymentRecord.order.orderNumber,
              branchId: paymentRecord.branchId,
              amount: Number(paymentRecord.amount),
              status: 'SUCCESS',
              method: paymentRecord.method,
              updatedAt: new Date().toISOString(),
            });
          } catch (err) {
            console.error('[Razorpay Webhook] Failed to broadcast realtime payment event:', err);
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const razorpayPaymentId = paymentEntity?.id;
      const errorDesc = paymentEntity?.error_description || 'Payment failed';

      if (razorpayOrderId) {
        const paymentRecord = await prisma.payment.findFirst({
          where: { gatewayTransactionId: razorpayOrderId },
        });

        if (paymentRecord && paymentRecord.status === 'PENDING') {
          await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
              status: 'FAILED',
              gatewayStatus: 'failed',
              notes: `Razorpay payment failed: ${errorDesc}`,
            },
          });

          await prisma.paymentAuditLog.create({
            data: {
              paymentId: paymentRecord.id,
              action: 'WEBHOOK_PAYMENT_FAILED',
              fromStatus: 'PENDING',
              toStatus: 'FAILED',
              amount: paymentRecord.amount,
              performedBy: 'RAZORPAY_WEBHOOK',
              notes: `Reason: ${errorDesc} (Payment ID: ${razorpayPaymentId || 'N/A'})`,
            },
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok', received: true });
  } catch (err) {
    console.error('[Razorpay Webhook Error]:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

/**
 * Direct customer confirmation endpoint for on-screen UPI QR payments.
 */
/**
 * Server-verified reconciliation endpoint for UPI payments.
 * Strictly verifies status against Razorpay API. Never accepts unverified customer claims.
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, orderNumber, trackingToken } = body;

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'Order identifier required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: orderId ? { id: orderId } : { orderNumber },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const latestPayment = order.payments[0];

    if (!latestPayment) {
      return NextResponse.json({ error: 'No payment record found for order' }, { status: 404 });
    }

    if (latestPayment.status === 'SUCCESS') {
      return NextResponse.json({
        success: true,
        orderNumber: order.orderNumber,
        trackingUrl: trackingToken
          ? `/track/${order.orderNumber}?token=${trackingToken}`
          : `/track/${order.orderNumber}`,
      });
    }

    // Verify against Razorpay API
    if (latestPayment.gatewayTransactionId) {
      const paymentsResponse = await fetchRazorpayOrderPayments(latestPayment.gatewayTransactionId);
      const items = (paymentsResponse as { items?: Array<{ status: string; id: string; method?: string }> })?.items || [];
      const capturedPayment = items.find((p) => p.status === 'captured');

      if (capturedPayment) {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: {
              status: 'SUCCESS',
              referenceNumber: capturedPayment.id,
              gatewayStatus: 'captured',
              gatewayMetadata: {
                ...((latestPayment.gatewayMetadata as Record<string, unknown>) || {}),
                capturedPaymentId: capturedPayment.id,
                method: capturedPayment.method,
              },
            },
          });

          await tx.paymentAuditLog.create({
            data: {
              paymentId: latestPayment.id,
              action: 'PAYMENT_CAPTURED_RECONCILED',
              fromStatus: latestPayment.status,
              toStatus: 'SUCCESS',
              amount: latestPayment.amount,
              performedBy: 'RAZORPAY_STATUS_VERIFY',
              notes: `Verified via Razorpay API payment ${capturedPayment.id}`,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
          });

          await tx.orderAuditLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: 'CONFIRMED',
              performedBy: 'RAZORPAY_STATUS_VERIFY',
              notes: 'Order confirmed after server-verified Razorpay payment',
            },
          });
        });

        if (order.couponCode) {
          await recordCouponUsage({
            couponCode: order.couponCode,
            customerId: order.customerId,
            customerPhone: order.customerPhone,
            customerName: order.customerName,
            orderId: order.id,
            orderNumber: order.orderNumber,
            discountAmount: Number(order.discountAmount),
            instruction: order.couponInstruction,
          });
        }

        try {
          publishPaymentUpdated({
            paymentId: latestPayment.paymentNumber,
            orderId: order.id,
            orderNumber: order.orderNumber,
            branchId: order.branchId,
            amount: Number(order.totalAmount),
            status: 'SUCCESS',
            method: 'UPI',
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error('[Razorpay Verify] Realtime error:', e);
        }

        return NextResponse.json({
          success: true,
          orderNumber: order.orderNumber,
          trackingUrl: trackingToken
            ? `/track/${order.orderNumber}?token=${trackingToken}`
            : `/track/${order.orderNumber}`,
        });
      }
    }

    return NextResponse.json({
      success: false,
      status: 'PENDING',
      message: 'Payment verification is pending. Please complete the transaction in your UPI app.',
    });
  } catch (err) {
    console.error('[UPI Verification Error]:', err);
    return NextResponse.json({ error: 'Failed to verify UPI payment' }, { status: 500 });
  }
}

/**
 * Polling status endpoint to verify if an order's payment has succeeded.
 * Can auto-reconcile against Razorpay API if a webhook or callback was missed.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const orderNumber = searchParams.get('orderNumber');
    const orderId = searchParams.get('orderId');

    if (!orderNumber && !orderId) {
      return NextResponse.json({ error: 'Order identifier required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: orderId ? { id: orderId } : { orderNumber: orderNumber! },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const latestPayment = order.payments[0];

    // If payment is already confirmed
    if (latestPayment && latestPayment.status === 'SUCCESS') {
      return NextResponse.json({
        status: 'SUCCESS',
        orderStatus: order.status,
        paymentId: latestPayment.id,
        method: latestPayment.method,
      });
    }

    // If payment is still PENDING and has a Razorpay Order ID, check Razorpay directly
    if (latestPayment && latestPayment.status === 'PENDING' && latestPayment.gatewayTransactionId) {
      const paymentsResponse = await fetchRazorpayOrderPayments(latestPayment.gatewayTransactionId);
      const items = (paymentsResponse as { items?: Array<{ status: string; id: string; method?: string }> })?.items || [];
      const capturedPayment = items.find((p) => p.status === 'captured');

      if (capturedPayment) {
        // Auto-reconcile payment
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: latestPayment.id },
            data: {
              status: 'SUCCESS',
              referenceNumber: capturedPayment.id,
              gatewayStatus: 'captured',
              gatewayMetadata: {
                ...((latestPayment.gatewayMetadata as Record<string, unknown>) || {}),
                capturedPaymentId: capturedPayment.id,
                method: capturedPayment.method,
              },
            },
          });

          await tx.paymentAuditLog.create({
            data: {
              paymentId: latestPayment.id,
              action: 'PAYMENT_CAPTURED_RECONCILED',
              fromStatus: latestPayment.status,
              toStatus: 'SUCCESS',
              amount: latestPayment.amount,
              performedBy: 'RAZORPAY_STATUS_POLL',
              notes: `Auto-reconciled via Razorpay API payment ${capturedPayment.id}`,
            },
          });

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
          });

          await tx.orderAuditLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: 'CONFIRMED',
              performedBy: 'RAZORPAY_STATUS_POLL',
              notes: 'Order auto-confirmed via Razorpay payment reconciliation',
            },
          });
        });

        // Broadcast real-time update
        try {
          publishPaymentUpdated({
            paymentId: latestPayment.paymentNumber,
            orderId: order.id,
            orderNumber: order.orderNumber,
            branchId: order.branchId,
            amount: Number(order.totalAmount),
            status: 'SUCCESS',
            method: latestPayment.method,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.error('[Razorpay Poll] Event bus error:', e);
        }

        return NextResponse.json({
          status: 'SUCCESS',
          orderStatus: 'CONFIRMED',
          paymentId: latestPayment.id,
          method: latestPayment.method,
        });
      }
    }

    return NextResponse.json({
      status: latestPayment?.status || 'PENDING',
      orderStatus: order.status,
      paymentId: latestPayment?.id,
    });
  } catch (err) {
    console.error('[Payment Status Poll Error]:', err);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}


