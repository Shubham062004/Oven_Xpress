'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2,
  ChefHat,
  Package,
  Building2,
  Phone,
  MapPin,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Receipt,
  CreditCard,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRealtime } from '@/lib/realtime/use-realtime';
import { getCustomerOrderDetails } from '@/lib/customer/order-actions';
import {
  initiatePendingOrderRazorpayAction,
  verifyAndCompleteRazorpayPaymentAction,
} from '@/lib/customer/razorpay-actions';
import {
  loadRazorpayScript,
  type RazorpayPaymentSuccessPayload,
} from '@/lib/payments/razorpay-client';
import { RazorpayMockModal } from '@/components/payments/razorpay-mock-modal';
import type {
  OrderStatusChangedPayload,
  KitchenStatusChangedPayload,
  PaymentUpdatedPayload,
} from '@/lib/realtime/types';
import { toast } from 'sonner';

type TrackOrderData = NonNullable<Awaited<ReturnType<typeof getCustomerOrderDetails>>>;

interface TrackOrderClientProps {
  initialOrder: TrackOrderData;
  token?: string;
}

const STEPS = [
  { key: 'CONFIRMED', label: 'Order Confirmed', description: 'Received and sent to oven', icon: Receipt },
  { key: 'PREPARING', label: 'In the Oven', description: 'Chef is baking your food fresh', icon: ChefHat },
  { key: 'READY', label: 'Order Ready', description: 'Packed & ready for pickup/delivery', icon: Package },
  { key: 'COMPLETED', label: 'Delivered / Completed', description: 'Enjoy your meal!', icon: CheckCircle2 },
];

function getStepIndex(status: string): number {
  switch (status) {
    case 'CONFIRMED':
      return 0;
    case 'PREPARING':
      return 1;
    case 'READY':
      return 2;
    case 'COMPLETED':
      return 3;
    case 'CANCELLED':
      return -1;
    default:
      return 0;
  }
}

export function TrackOrderClient({ initialOrder, token }: TrackOrderClientProps) {
  const [order, setOrder] = useState<TrackOrderData>(initialOrder);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Razorpay payment state for unpaid / pending orders
  const [isPaying, setIsPaying] = useState(false);
  const [mockModalOpen, setMockModalOpen] = useState(false);
  const [mockOrderDetails, setMockOrderDetails] = useState<{
    orderId: string;
    orderNumber: string;
    amount: number;
    razorpayOrderId: string;
  } | null>(null);

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';

  const handlePayPendingWithRazorpay = async () => {
    setIsPaying(true);
    try {
      const initResult = await initiatePendingOrderRazorpayAction({
        orderNumber: order.orderNumber,
        token,
      });

      if (!initResult.success || !initResult.razorpayOrderId || !initResult.orderId) {
        toast.error(initResult.error || 'Failed to start payment gateway.');
        setIsPaying(false);
        return;
      }

      if (initResult.isMock) {
        setIsPaying(false);
        setMockOrderDetails({
          orderId: initResult.orderId,
          orderNumber: initResult.orderNumber || order.orderNumber,
          amount: (initResult.amount || 0) / 100,
          razorpayOrderId: initResult.razorpayOrderId,
        });
        setMockModalOpen(true);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        toast.error('Failed to load Razorpay SDK. Please check your internet connection.');
        setIsPaying(false);
        return;
      }

      const options = {
        key: initResult.keyId || '',
        amount: initResult.amount || 0,
        currency: initResult.currency || 'INR',
        name: 'Oven Xpress',
        description: `Order #${initResult.orderNumber}`,
        image: '/images/hero-pizza.jpg',
        order_id: initResult.razorpayOrderId,
        handler: async (response: RazorpayPaymentSuccessPayload) => {
          setIsPaying(true);
          try {
            const verifyResult = await verifyAndCompleteRazorpayPaymentAction({
              orderId: initResult.orderId!,
              orderNumber: initResult.orderNumber!,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              trackingToken: token,
            });

            if (verifyResult.success) {
              toast.success('Payment completed successfully!');
              setOrder((prev) => ({
                ...prev,
                payment: {
                  ...prev.payment,
                  status: 'SUCCESS' as PaymentStatus,
                },
              }));
            } else {
              toast.error(verifyResult.error || 'Payment verification failed.');
            }
          } catch (err) {
            console.error(err);
            toast.error('Error verifying payment.');
          } finally {
            setIsPaying(false);
          }
        },
        prefill: {
          name: initResult.customerName || '',
          contact: initResult.customerPhone || '',
          email: initResult.customerEmail || '',
        },
        theme: {
          color: '#ea580c',
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false);
            toast.info('Payment window closed.');
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error('Unable to open payment gateway.');
      setIsPaying(false);
    }
  };

  const handleSimulateTrackSuccess = async () => {
    if (!mockOrderDetails) return;
    setMockModalOpen(false);
    setIsPaying(true);

    try {
      const verifyResult = await verifyAndCompleteRazorpayPaymentAction({
        orderId: mockOrderDetails.orderId,
        orderNumber: mockOrderDetails.orderNumber,
        razorpayOrderId: mockOrderDetails.razorpayOrderId,
        razorpayPaymentId: `pay_mock_${Date.now()}`,
        razorpaySignature: 'mock_signature_success',
        trackingToken: token,
      });

      if (verifyResult.success) {
        toast.success('Test payment simulated & order confirmed!');
        setOrder((prev) => ({
          ...prev,
          payment: {
            ...prev.payment,
            status: 'SUCCESS' as PaymentStatus,
          },
        }));
      } else {
        toast.error(verifyResult.error || 'Mock verification failed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to simulate test payment.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleSimulateTrackFailure = () => {
    setMockModalOpen(false);
    setIsPaying(false);
    toast.error('Test payment failed.');
  };

  // Manual & Polling resync function
  const refreshStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const fresh = await getCustomerOrderDetails(order.orderNumber, token);
      if (fresh) {
        setOrder(fresh);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to refresh order status:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [order.orderNumber, token]);

  // Hook into Real-time SSE stream
  const { isConnected } = useRealtime({
    orderNumber: order.orderNumber,
    token,
    eventTypes: ['order:status_changed', 'kitchen:status_changed', 'payment:updated'],
    onEvent: (msg) => {
      if (msg.type === 'order:status_changed') {
        const payload = msg.payload as OrderStatusChangedPayload;
        setOrder((prev) => ({ ...prev, status: payload.toStatus as OrderStatus }));
        setLastUpdated(new Date());
        toast.info(`Order status updated: ${payload.toStatus}`);
      } else if (msg.type === 'kitchen:status_changed') {
        const payload = msg.payload as KitchenStatusChangedPayload;
        setOrder((prev) => ({ ...prev, status: payload.status as OrderStatus }));
        setLastUpdated(new Date());
        toast.info(`Kitchen update: ${payload.status}`);
      } else if (msg.type === 'payment:updated') {
        const payload = msg.payload as PaymentUpdatedPayload;
        setOrder((prev) => ({
          ...prev,
          payment: { ...prev.payment, status: payload.status as PaymentStatus },
        }));
        setLastUpdated(new Date());
      }
    },
  });

  // Background polling fallback every 25s (resyncs if disconnected or tab was in background)
  useEffect(() => {
    const timer = setInterval(() => {
      refreshStatus();
    }, 25000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Top Navigation & Live Connection Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Storefront
        </Link>

        <div className="flex items-center gap-3">
          {/* Real-time connection badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
                <Wifi className="size-3.5" />
                <span>Live Tracking</span>
              </>
            ) : (
              <>
                <WifiOff className="size-3.5" />
                <span>Reconnecting...</span>
              </>
            )}
          </div>

          {/* Manual refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStatus}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Status Hero Card */}
      <Card className="overflow-hidden border shadow-lg bg-card/60 backdrop-blur-sm">
        <div className="bg-linear-to-r from-orange-500/15 via-amber-500/10 to-transparent p-6 sm:p-8 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order Tracking
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
                {order.orderNumber}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-1">
              <Badge
                variant={isCancelled ? 'destructive' : 'default'}
                className="text-sm font-bold px-3 py-1 uppercase"
              >
                {order.status}
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">
                {order.orderType} Order
              </span>
            </div>
          </div>
        </div>

        {/* Milestone Steps Timeline */}
        <CardContent className="p-6 sm:p-8">
          {isCancelled ? (
            <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive space-y-2 text-center">
              <AlertCircle className="size-8 mx-auto" />
              <h2 className="text-lg font-bold">This order was cancelled</h2>
              <p className="text-sm text-destructive/80">
                If you have questions or believe this was an error, please contact the branch or customer support.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Progress Bar Track */}
              <div className="hidden sm:block absolute top-1/2 left-8 right-8 -translate-y-1/2 h-1 bg-muted z-0" />
              <div
                className="hidden sm:block absolute top-1/2 left-8 -translate-y-1/2 h-1 bg-primary transition-all duration-700 ease-in-out z-0"
                style={{
                  width: `${Math.min(100, (currentStep / (STEPS.length - 1)) * 100)}%`,
                }}
              />

              {/* Step items */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-2">
                {STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = currentStep > idx;
                  const isActive = currentStep === idx;

                  return (
                    <div
                      key={step.key}
                      className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2 relative z-10"
                    >
                      <div
                        className={`size-12 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500 ${
                          isDone
                            ? 'bg-primary border-primary text-primary-foreground'
                            : isActive
                            ? 'bg-background border-primary text-primary ring-4 ring-primary/20 scale-110 shadow-lg'
                            : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div
                          className={`text-sm font-semibold ${
                            isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="text-xs text-muted-foreground leading-snug">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Order Items */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                Items in Order ({order.items.reduce((s, i) => s + i.quantity, 0)})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 rounded-lg overflow-hidden bg-muted border shrink-0">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Qty: {item.quantity} × ₹{item.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-sm text-foreground">
                    ₹{item.totalPrice.toFixed(2)}
                  </div>
                </div>
              ))}

              {/* Price Calculation Summary */}
              <div className="p-4 bg-muted/20 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal.toFixed(2)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-₹{order.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (5% GST)</span>
                  <span>₹{order.taxAmount.toFixed(2)}</span>
                </div>
                {order.deliveryCharge > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Charge</span>
                    <span>₹{order.deliveryCharge.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-foreground pt-2 border-t">
                  <span>Total Amount</span>
                  <span>₹{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Branch & Delivery Info */}
        <div className="space-y-6">
          {/* Branch Details */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Preparing Branch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="font-bold text-foreground">{order.branch.name}</div>
              <div className="flex items-start gap-2 text-muted-foreground text-xs">
                <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>
                  {order.branch.address}, {order.branch.city}
                </span>
              </div>
              {order.branch.phone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <a
                    href={`tel:${order.branch.phone}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {order.branch.phone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment & Delivery Status */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                Payment & Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Method:</span>
                <span className="font-semibold text-foreground uppercase">{order.payment.method}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Payment Status:</span>
                <Badge
                  variant={order.payment.status === 'SUCCESS' ? 'default' : 'secondary'}
                  className="font-bold text-xs"
                >
                  {order.payment.status}
                </Badge>
              </div>
              {order.deliveryAddress && (
                <div className="pt-2 border-t">
                  <div className="text-xs font-semibold text-muted-foreground">Delivery Address</div>
                  <div className="text-xs text-foreground mt-1">{order.deliveryAddress}</div>
                </div>
              )}
              {order.deliveryNotes && (
                <div className="pt-2 border-t">
                  <div className="text-xs font-semibold text-muted-foreground">Notes</div>
                  <div className="text-xs text-muted-foreground mt-1">{order.deliveryNotes}</div>
                </div>
              )}

              {/* Pay Online with Razorpay button if payment is PENDING */}
              {order.payment.status === 'PENDING' && !isCancelled && (
                <div className="pt-3 border-t">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPaying}
                    onClick={handlePayPendingWithRazorpay}
                    className="w-full bg-linear-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isPaying ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Opening Razorpay...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="size-3.5" />
                        <span>Pay ₹{order.totalAmount.toFixed(2)} with Razorpay</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bug / Issue Link */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <HelpCircle className="size-4 text-primary" />
              Need help with this order?
            </div>
            <p className="text-xs text-muted-foreground">
              Experience an issue with payment, delivery, or display? Let our engineering team know directly.
            </p>
            <Link
              href="/report-bug"
              className="inline-flex text-xs font-semibold text-primary hover:underline"
            >
              Report a Problem &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Razorpay Mock Sandbox Modal for testing */}
      {mockOrderDetails && (
        <RazorpayMockModal
          open={mockModalOpen}
          onOpenChange={setMockModalOpen}
          orderNumber={mockOrderDetails.orderNumber}
          amount={mockOrderDetails.amount}
          onSimulateSuccess={handleSimulateTrackSuccess}
          onSimulateFailure={handleSimulateTrackFailure}
        />
      )}
    </div>
  );
}
