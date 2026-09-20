'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Truck,
  Building2,
  Calendar,
  Clock,
  User,
  PackageCheck,
  Ban,
  Phone,
  Mail,
  MapPin,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PurchaseOrderStatus } from '@prisma/client';

import { useAuth } from '@/providers/auth-provider';
import { hasPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { markPurchaseOrderAsOrdered } from '@/lib/purchases/actions';
import type { PurchaseOrderDetail } from '@/lib/purchases/types';

import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
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

import { PurchaseReceivingDialog } from '@/components/purchases/purchase-receiving-dialog';
import { PurchaseCancelDialog } from '@/components/purchases/purchase-cancel-dialog';

interface PurchaseDetailClientProps {
  purchase: PurchaseOrderDetail;
}

export function PurchaseDetailClient({ purchase }: PurchaseDetailClientProps) {
  const router = useRouter();
  const user = useAuth();

  const [receivingDialogOpen, setReceivingDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isMarkingOrdered, setIsMarkingOrdered] = useState(false);

  const canReceive = hasPermission(user, PERMISSIONS.PURCHASE_RECEIVE);
  const canCancel = hasPermission(user, PERMISSIONS.PURCHASE_CANCEL);
  const canUpdate = hasPermission(user, PERMISSIONS.PURCHASE_UPDATE);

  const isReceivable =
    purchase.status === PurchaseOrderStatus.ORDERED ||
    purchase.status === PurchaseOrderStatus.PARTIALLY_RECEIVED;

  const isCancellable =
    purchase.status === PurchaseOrderStatus.DRAFT ||
    (purchase.status === PurchaseOrderStatus.ORDERED && purchase.totalReceivedQuantity === 0);

  const handleMarkOrdered = async () => {
    setIsMarkingOrdered(true);
    try {
      const res = await markPurchaseOrderAsOrdered(purchase.id);
      if (res.success) {
        toast.success(`Purchase order marked as ORDERED. Ready for receiving.`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update purchase order');
      }
    } catch {
      toast.error('Failed to update purchase order');
    } finally {
      setIsMarkingOrdered(false);
    }
  };

  const getStatusBadge = (st: PurchaseOrderStatus) => {
    switch (st) {
      case PurchaseOrderStatus.RECEIVED:
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-sm py-0.5">
            Fully Received
          </Badge>
        );
      case PurchaseOrderStatus.PARTIALLY_RECEIVED:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-sm py-0.5">
            Partially Received
          </Badge>
        );
      case PurchaseOrderStatus.ORDERED:
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-sm py-0.5">
            Ordered (Awaiting Delivery)
          </Badge>
        );
      case PurchaseOrderStatus.DRAFT:
        return (
          <Badge variant="secondary" className="text-sm py-0.5">
            Draft
          </Badge>
        );
      case PurchaseOrderStatus.CANCELLED:
        return (
          <Badge variant="destructive" className="text-sm py-0.5">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="space-y-2">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Purchase Orders
        </Link>

        <PageHeader
          title={purchase.purchaseNumber}
          description={`Purchase Order created on ${new Date(purchase.orderDate).toLocaleDateString(
            'en-IN',
            { day: 'numeric', month: 'long', year: 'numeric' }
          )} by ${purchase.createdBy}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {purchase.status === PurchaseOrderStatus.DRAFT && canUpdate && (
              <Button
                onClick={handleMarkOrdered}
                disabled={isMarkingOrdered}
                className="gap-2 shadow-sm"
              >
                {isMarkingOrdered ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Mark as Ordered
              </Button>
            )}

            {canReceive && isReceivable && (
              <Button
                onClick={() => setReceivingDialogOpen(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <PackageCheck className="size-4" />
                Receive Stock
              </Button>
            )}

            {canCancel && isCancellable && (
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(true)}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <Ban className="size-4" />
                Cancel Order
              </Button>
            )}
          </div>
        </PageHeader>
      </div>

      {/* KPI & Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Order Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getStatusBadge(purchase.status)}
            <p className="text-xs text-muted-foreground mt-2">
              {purchase.status === PurchaseOrderStatus.RECEIVED
                ? 'All ordered stock verified in inventory'
                : purchase.status === PurchaseOrderStatus.PARTIALLY_RECEIVED
                  ? 'Delivery in progress'
                  : purchase.status === PurchaseOrderStatus.ORDERED
                    ? 'Awaiting delivery from vendor'
                    : purchase.status === PurchaseOrderStatus.DRAFT
                      ? 'Draft order'
                      : 'Order voided'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Purchase Subtotal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{purchase.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sum of all item line totals</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fulfillment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {purchase.fulfillmentPercentage}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {purchase.totalReceivedQuantity} / {purchase.totalOrderedQuantity} units received
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Delivery Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-foreground">
              {purchase.expectedDate
                ? new Date(purchase.expectedDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Standard Delivery'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ordered:{' '}
              {new Date(purchase.orderDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Supplier & Branch Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supplier Info */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                Vendor / Supplier
              </span>
              <Link
                href={`/suppliers/${purchase.supplier.id}`}
                className="text-xs text-primary hover:underline font-normal"
              >
                View Supplier Profile →
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="text-base font-semibold text-foreground">{purchase.supplier.name}</div>
            {purchase.supplier.contactPerson && (
              <p className="text-muted-foreground">Contact: {purchase.supplier.contactPerson}</p>
            )}
            <div className="flex flex-wrap gap-4 text-muted-foreground pt-1">
              {purchase.supplier.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="size-3" />
                  {purchase.supplier.phone}
                </div>
              )}
              {purchase.supplier.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="size-3" />
                  {purchase.supplier.email}
                </div>
              )}
              {purchase.supplier.city && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3" />
                  {[purchase.supplier.address, purchase.supplier.city].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Branch Info */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Receiving Restaurant Branch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="text-base font-semibold text-foreground">
              {purchase.branch.name} ({purchase.branch.code})
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground pt-1">
              <MapPin className="size-3 shrink-0" />
              <span>
                {[purchase.branch.address, purchase.branch.city].filter(Boolean).join(', ')}
              </span>
            </div>
            {purchase.notes && (
              <div className="pt-2 border-t border-border/60 text-muted-foreground">
                <span className="font-semibold text-foreground">Order Notes: </span>
                {purchase.notes}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Breakdown Table */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Order Items Breakdown</CardTitle>
            <CardDescription>
              Ingredient quantities, delivery fulfillment status, and line totals
            </CardDescription>
          </div>
          {canReceive && isReceivable && (
            <Button
              size="sm"
              onClick={() => setReceivingDialogOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <PackageCheck className="size-3.5" />
              Receive Items
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Ingredient</TableHead>
                  <TableHead className="text-center font-semibold">Unit</TableHead>
                  <TableHead className="text-right font-semibold">Ordered</TableHead>
                  <TableHead className="text-right font-semibold">Received</TableHead>
                  <TableHead className="text-right font-semibold">Remaining</TableHead>
                  <TableHead className="text-right font-semibold">Unit Price (₹)</TableHead>
                  <TableHead className="text-right font-semibold">Line Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.items.map((item) => {
                  const isComplete = item.remainingQuantity <= 0;

                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">
                        <Link
                          href={`/inventory?search=${encodeURIComponent(item.ingredientName)}`}
                          className="hover:underline hover:text-primary transition-colors"
                        >
                          {item.ingredientName}
                        </Link>
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs">
                        <Badge variant="outline">{item.unit}</Badge>
                      </TableCell>

                      <TableCell className="text-right text-sm font-medium">
                        {item.orderedQuantity} {item.unit}
                      </TableCell>

                      <TableCell className="text-right text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                        {item.receivedQuantity} {item.unit}
                      </TableCell>

                      <TableCell className="text-right text-sm font-semibold">
                        {isComplete ? (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">
                            Completed
                          </Badge>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            {item.remainingQuantity} {item.unit}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right text-sm">
                        ₹{item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="text-right text-sm font-semibold">
                        ₹{item.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/20 border-t border-border/60 gap-4">
          <div className="text-xs text-muted-foreground">
            Stock ledger transactions will reference PO ID <strong>{purchase.purchaseNumber}</strong>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-muted-foreground">Subtotal:</span>
            <span className="text-2xl font-bold text-foreground">
              ₹{purchase.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* Receiving History Audit Section */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Stock Receiving History & Inventory Ledger Audit
          </CardTitle>
          <CardDescription>
            Chronological audit trail of goods arrival batches and ledger postings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchase.receivingLogs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No stock receipts recorded yet for this purchase order. When vendor delivery arrives,
              click &quot;Receive Stock&quot; to record received quantities into the branch stock ledger.
            </div>
          ) : (
            <div className="space-y-4">
              {purchase.receivingLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border/60 p-4 space-y-3 bg-muted/10 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs font-semibold">
                        {log.receivingNumber}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(log.receivedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <User className="size-3" />
                      Received by: <span className="font-medium text-foreground">{log.receivedBy}</span>
                    </div>
                  </div>

                  {log.notes && (
                    <p className="text-xs text-muted-foreground italic bg-muted/40 p-2 rounded">
                      Note: {log.notes}
                    </p>
                  )}

                  <div className="text-xs">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 text-[11px]">
                      Items Inflowed into Inventory:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {log.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded bg-background border border-border/60"
                        >
                          <span className="font-medium text-foreground">{item.ingredientName}</span>
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                            + {item.quantity} {item.unit}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PurchaseReceivingDialog
        open={receivingDialogOpen}
        onOpenChange={setReceivingDialogOpen}
        purchase={purchase}
        onSuccess={() => router.refresh()}
      />

      <PurchaseCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        purchaseOrderId={purchase.id}
        purchaseNumber={purchase.purchaseNumber}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
