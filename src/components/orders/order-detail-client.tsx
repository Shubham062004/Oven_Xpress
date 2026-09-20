'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Utensils,
  ShoppingBag,
  Truck,
  Building2,
  Clock,
  User,
  Phone,
  MapPin,
  FileText,
  Ban,
  CheckCircle2,
  ChefHat,
  Sparkles,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrderType, OrderStatus } from '@prisma/client';

import { updateOrderStatus } from '@/lib/orders/actions';
import type { OrderDetail } from '@/lib/orders/types';
import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderCancelDialog } from '@/components/orders/order-cancel-dialog';

interface OrderDetailClientProps {
  initialOrder: OrderDetail;
}

const LIFECYCLE_STEPS: { status: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { status: OrderStatus.PENDING, label: 'Pending', icon: Clock },
  { status: OrderStatus.CONFIRMED, label: 'Confirmed', icon: CheckCircle2 },
  { status: OrderStatus.PREPARING, label: 'Preparing', icon: ChefHat },
  { status: OrderStatus.READY, label: 'Ready', icon: Sparkles },
  { status: OrderStatus.COMPLETED, label: 'Completed', icon: CheckCircle2 },
];

export function OrderDetailClient({ initialOrder }: OrderDetailClientProps) {
  const router = useRouter();
  const user = useAuth();
  const [order, setOrder] = useState<OrderDetail>(initialOrder);
  const [isPending, startTransition] = useTransition();

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState<boolean>(false);

  const canUpdateStatus = hasPermission(user, PERMISSIONS.ORDER_STATUS);
  const canCancel = hasPermission(user, PERMISSIONS.ORDER_CANCEL);

  // Status transition progression mapping
  const getNextAction = (status: OrderStatus): { nextStatus: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }> } | null => {
    switch (status) {
      case OrderStatus.PENDING:
        return { nextStatus: OrderStatus.CONFIRMED, label: 'Confirm Order', icon: CheckCircle2 };
      case OrderStatus.CONFIRMED:
        return { nextStatus: OrderStatus.PREPARING, label: 'Start Preparing', icon: ChefHat };
      case OrderStatus.PREPARING:
        return { nextStatus: OrderStatus.READY, label: 'Mark Ready', icon: Sparkles };
      case OrderStatus.READY:
        return { nextStatus: OrderStatus.COMPLETED, label: 'Complete Order', icon: CheckCircle2 };
      default:
        return null;
    }
  };

  const nextAction = getNextAction(order.status);
  const isTerminalState =
    order.status === OrderStatus.COMPLETED ||
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.REFUNDED;

  const handleStatusTransition = (targetStatus: OrderStatus) => {
    startTransition(async () => {
      const res = await updateOrderStatus(order.id, targetStatus);
      if (res.success && res.data) {
        const newStatus = res.data.status;
        setOrder((prev) => ({ ...prev, status: newStatus }));
        toast.success(`Order status updated to ${newStatus}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update order status');
      }
    });
  };

  const handleCancelSuccess = () => {
    setOrder((prev) => ({
      ...prev,
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date().toISOString(),
      cancelledBy: user?.name || 'System User',
    }));
    toast.success('Order cancelled successfully');
    router.refresh();
  };

  // Helper badges
  const getOrderTypeBadge = (type: OrderType) => {
    switch (type) {
      case OrderType.DINE_IN:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Utensils className="h-3.5 w-3.5" />
            Dine-In
          </span>
        );
      case OrderType.TAKEAWAY:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <ShoppingBag className="h-3.5 w-3.5" />
            Takeaway
          </span>
        );
      case OrderType.DELIVERY:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Truck className="h-3.5 w-3.5" />
            Delivery
          </span>
        );
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">PENDING</Badge>;
      case OrderStatus.CONFIRMED:
        return <Badge variant="secondary" className="bg-blue-500/15 text-blue-700 dark:text-blue-400">CONFIRMED</Badge>;
      case OrderStatus.PREPARING:
        return <Badge variant="secondary" className="bg-purple-500/15 text-purple-700 dark:text-purple-400">PREPARING</Badge>;
      case OrderStatus.READY:
        return <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">READY</Badge>;
      case OrderStatus.COMPLETED:
        return <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">COMPLETED</Badge>;
      case OrderStatus.CANCELLED:
        return <Badge variant="destructive">CANCELLED</Badge>;
      case OrderStatus.REFUNDED:
        return <Badge variant="outline" className="text-muted-foreground">REFUNDED</Badge>;
    }
  };

  // Timeline step calculation
  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {order.orderNumber}
            </h1>
            {getOrderTypeBadge(order.orderType)}
            {getStatusBadge(order.status)}
            <Badge variant="outline" className="border-dashed text-xs text-muted-foreground">
              Payment: UNPAID (Placeholder)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created on {new Date(order.createdAt).toLocaleString()} by {order.createdBy}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {canUpdateStatus && nextAction && !isTerminalState && (
            <Button
              onClick={() => handleStatusTransition(nextAction.nextStatus)}
              disabled={isPending}
              className="gap-2 shadow-xs"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <nextAction.icon className="h-4 w-4" />
              )}
              {nextAction.label}
            </Button>
          )}

          {canCancel && !isTerminalState && (
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(true)}
              disabled={isPending}
              className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
            >
              <Ban className="h-4 w-4" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {/* Lifecycle Progression Timeline (Only for non-cancelled orders) */}
      {order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.REFUNDED ? (
        <Card className="border shadow-xs">
          <CardHeader className="py-3 px-6 border-b bg-muted/20">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Status Progression
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="relative flex items-center justify-between max-w-4xl mx-auto">
              {/* Connecting Background Line */}
              <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 h-1 bg-muted rounded z-0" />
              {/* Progress Active Line */}
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-primary rounded transition-all duration-500 z-0"
                style={{
                  width: `${(Math.max(0, currentStepIndex) / (LIFECYCLE_STEPS.length - 1)) * 100}%`,
                }}
              />

              {LIFECYCLE_STEPS.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const StepIcon = step.icon;

                return (
                  <div key={step.status} className="relative flex flex-col items-center z-10">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isCurrent
                          ? 'border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20'
                          : isCompleted
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/30 bg-background text-muted-foreground'
                      }`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium ${
                        isCurrent
                          ? 'font-bold text-foreground'
                          : isCompleted
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Cancellation Banner */
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="p-2.5 rounded-full bg-destructive/10 text-destructive shrink-0">
              <Ban className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-destructive">
                Order Cancelled
              </h3>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Reason:</span> {order.cancellationReason || 'No reason specified'}
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                Cancelled by {order.cancelledBy || 'System'} on{' '}
                {order.cancelledAt ? new Date(order.cancelledAt).toLocaleString() : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid: Details and Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order Items & Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Utensils className="h-4 w-4 text-primary" />
                  Ordered Items ({order.items.length})
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Snapshot Prices at time of order
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[45%]">Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="align-top">
                        <div className="font-semibold text-foreground text-sm">
                          {item.itemName}
                        </div>
                        {item.notes && (
                          <div className="text-xs text-muted-foreground italic mt-0.5 flex items-center gap-1">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            Note: {item.notes}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        ₹{item.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                        {item.discountAmount > 0 ? `-₹${item.discountAmount.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm">
                        ₹{item.totalPrice.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>

            {/* Financial Summary */}
            <CardFooter className="flex flex-col gap-2 p-5 bg-muted/20 border-t">
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>₹{order.subtotal.toFixed(2)}</span>
                </div>

                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Order Discount</span>
                    <span>-₹{order.discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>Tax (5% Standard Food Tax)</span>
                  <span>₹{order.taxAmount.toFixed(2)}</span>
                </div>

                {order.orderType === OrderType.DELIVERY && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Charge</span>
                    <span>₹{order.deliveryCharge.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold text-foreground pt-3 border-t">
                  <span>Grand Total</span>
                  <span className="text-primary text-xl">₹{order.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </CardFooter>
          </Card>

          {/* Operational Notes */}
          {order.notes && (
            <Card className="border">
              <CardHeader className="py-3 px-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Kitchen & Operational Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm text-foreground">
                {order.notes}
              </CardContent>
            </Card>
          )}

          {/* Architecture Readiness Box */}
          <Card className="border-dashed bg-muted/10">
            <CardContent className="p-4 flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <span className="font-semibold text-foreground">
                  Ready for Future System Integrations
                </span>
                <p>
                  This order maintains normalized menu foreign keys for automatic Recipe/BOM inventory deduction upon kitchen dispatch. Payment processing and driver assignment will connect in upcoming feature milestones.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Logistics, Branch & Customer Cards */}
        <div className="space-y-6">
          {/* Branch Information */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Branch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm space-y-2">
              <div className="font-bold text-foreground">
                {order.branch.name} ({order.branch.code})
              </div>
              <div className="text-xs text-muted-foreground flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{order.branch.address}, {order.branch.city}</span>
              </div>
              {order.branch.phone && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{order.branch.phone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dine-In Table OR Delivery Information */}
          {order.orderType === OrderType.DINE_IN && (
            <Card className="border shadow-xs border-amber-200 dark:border-amber-900/40 bg-amber-500/5">
              <CardHeader className="pb-3 border-b bg-amber-500/10">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Utensils className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Dining Table Allocation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {order.table ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-foreground">
                        {order.table.tableNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Capacity: {order.table.capacity} Persons
                      </div>
                    </div>
                    <Badge variant="outline" className="border-amber-500/40 font-semibold">
                      {order.table.status}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Table information not linked.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {order.orderType === OrderType.DELIVERY && (
            <Card className="border shadow-xs border-emerald-200 dark:border-emerald-900/40 bg-emerald-500/5">
              <CardHeader className="pb-3 border-b bg-emerald-500/10">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Delivery Destination
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2.5 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Address:</span>
                  <span className="font-semibold text-foreground">
                    {order.deliveryAddress || 'No address specified'}
                  </span>
                </div>
                {order.deliveryNotes && (
                  <div>
                    <span className="text-xs text-muted-foreground block">
                      Landmark / Instructions:
                    </span>
                    <span className="text-xs italic text-foreground">
                      {order.deliveryNotes}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Details */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Customer Details
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {order.customerId ? 'Registered' : 'Guest'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 text-sm space-y-2">
              <div>
                <span className="text-xs text-muted-foreground block">Name:</span>
                <span className="font-semibold text-foreground">
                  {order.customerName || order.customer?.name || 'Walk-in Guest'}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Phone:</span>
                <span className="font-medium text-foreground">
                  {order.customerPhone || order.customer?.phone || 'Not provided'}
                </span>
              </div>
              {order.customer?.email && (
                <div>
                  <span className="text-xs text-muted-foreground block">Email:</span>
                  <span className="text-xs text-foreground">{order.customer.email}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancellation Modal */}
      <OrderCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        orderId={order.id}
        orderNumber={order.orderNumber}
        onSuccess={handleCancelSuccess}
      />
    </div>
  );
}
