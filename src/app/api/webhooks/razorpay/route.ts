import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyRazorpayWebhookSignature } from '@/lib/payments/razorpay';
import { publishPaymentUpdated } from '@/lib/realtime/event-bus';

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
