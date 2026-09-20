'use client';

import { useState, useTransition } from 'react';
import { Loader2, PackageCheck, AlertCircle, ArrowDownLeft } from 'lucide-react';
import { toast } from 'sonner';

import { receivePurchaseOrderItems } from '@/lib/purchases/actions';
import type { PurchaseOrderDetail } from '@/lib/purchases/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PurchaseReceivingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: PurchaseOrderDetail;
  onSuccess: () => void;
}

interface InnerReceivingProps {
  purchase: PurchaseOrderDetail;
  onClose: () => void;
  onSuccess: () => void;
}

function PurchaseReceivingInner({ purchase, onClose, onSuccess }: InnerReceivingProps) {
  const [isPending, startTransition] = useTransition();

  const [receiveAmounts, setReceiveAmounts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of purchase.items) {
      initial[item.id] = '';
    }
    return initial;
  });

  const [receivedDate, setReceivedDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  const handleSetAllRemaining = () => {
    const updated: Record<string, string> = {};
    for (const item of purchase.items) {
      if (item.remainingQuantity > 0) {
        updated[item.id] = item.remainingQuantity.toString();
      } else {
        updated[item.id] = '0';
      }
    }
    setReceiveAmounts(updated);
    setError(null);
  };

  const handleAmountChange = (itemId: string, value: string) => {
    setReceiveAmounts((prev) => ({ ...prev, [itemId]: value }));
    if (error) setError(null);
  };

  // Compute items being received
  const activeReceivingItems = purchase.items
    .map((item) => {
      const val = parseFloat(receiveAmounts[item.id] || '0');
      return {
        item,
        quantity: isNaN(val) ? 0 : val,
      };
    })
    .filter((entry) => entry.quantity > 0);

  const validate = (): boolean => {
    if (activeReceivingItems.length === 0) {
      setError('Please enter a quantity to receive for at least one item.');
      return false;
    }

    for (const entry of activeReceivingItems) {
      if (entry.quantity <= 0) {
        setError(`Quantity for "${entry.item.ingredientName}" must be greater than 0.`);
        return false;
      }
      if (entry.quantity > entry.item.remainingQuantity + 0.0001) {
        setError(
          `Over-receiving rejected: You entered ${entry.quantity} ${entry.item.unit} for "${entry.item.ingredientName}", but only ${entry.item.remainingQuantity} ${entry.item.unit} is remaining.`
        );
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setConfirmStep(true);
  };

  const handleConfirmReceive = () => {
    if (!validate()) {
      setConfirmStep(false);
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          purchaseOrderId: purchase.id,
          receivedDate: receivedDate ? new Date(receivedDate).toISOString() : undefined,
          note: note.trim() || undefined,
          items: activeReceivingItems.map((entry) => ({
            purchaseOrderItemId: entry.item.id,
            receivedNow: entry.quantity,
          })),
        };

        const res = await receivePurchaseOrderItems(payload);

        if (!res.success) {
          setError(res.error || 'Failed to record stock receipt');
          toast.error(res.error || 'Failed to record stock receipt');
          setConfirmStep(false);
          return;
        }

        toast.success(
          `Stock received successfully! Recorded in inventory ledger under batch ${res.data?.receivingNumber}.`
        );
        onClose();
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(msg);
        toast.error(msg);
        setConfirmStep(false);
      }
    });
  };

  return (
    <>
      {error && (
        <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive flex items-center gap-2 mb-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!confirmStep ? (
        <form onSubmit={handleProceedToConfirm} className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border/60">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Supplier:</span> {purchase.supplier.name} •{' '}
              <span className="font-semibold text-foreground">Branch:</span> {purchase.branch.name}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSetAllRemaining}
              className="text-xs h-7 gap-1"
            >
              <ArrowDownLeft className="size-3" />
              Receive All Remaining
            </Button>
          </div>

          {/* Items Table */}
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold text-xs">Ingredient</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Ordered</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Received</TableHead>
                  <TableHead className="text-right font-semibold text-xs">Remaining</TableHead>
                  <TableHead className="w-36 text-right font-semibold text-xs">Receive Now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.items.map((item) => {
                  const isFullyReceived = item.remainingQuantity <= 0;
                  const enteredVal = parseFloat(receiveAmounts[item.id] || '0');
                  const hasOver = enteredVal > item.remainingQuantity + 0.0001;

                  return (
                    <TableRow key={item.id} className={isFullyReceived ? 'opacity-60 bg-muted/20' : ''}>
                      <TableCell className="font-medium text-xs">
                        {item.ingredientName}
                        <span className="text-[11px] text-muted-foreground block">
                          Unit: {item.unit}
                        </span>
                      </TableCell>

                      <TableCell className="text-right text-xs">
                        {item.orderedQuantity} {item.unit}
                      </TableCell>

                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.receivedQuantity} {item.unit}
                      </TableCell>

                      <TableCell className="text-right text-xs font-semibold">
                        {item.remainingQuantity > 0 ? (
                          <span className="text-foreground">
                            {item.remainingQuantity} {item.unit}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0">
                            Fulfilled
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max={item.remainingQuantity}
                            disabled={isFullyReceived || isPending}
                            placeholder={isFullyReceived ? '0' : '0.00'}
                            value={receiveAmounts[item.id] ?? ''}
                            onChange={(e) => handleAmountChange(item.id, e.target.value)}
                            className={`h-8 text-right text-xs ${
                              hasOver ? 'border-destructive focus-visible:ring-destructive' : ''
                            }`}
                          />
                          {hasOver && (
                            <span className="text-[10px] text-destructive block">
                              Exceeds {item.remainingQuantity} {item.unit}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Receiving Details Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rcv-date" className="text-xs">
                Receiving Date
              </Label>
              <Input
                id="rcv-date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rcv-notes" className="text-xs">
                Delivery / Delivery Note (Optional)
              </Label>
              <Input
                id="rcv-notes"
                placeholder="e.g. Delivery challan #9821, inspected cold chain"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || activeReceivingItems.length === 0}>
              Review & Confirm ({activeReceivingItems.length} {activeReceivingItems.length === 1 ? 'item' : 'items'})
            </Button>
          </DialogFooter>
        </form>
      ) : (
        /* Confirmation Step */
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              Confirm Stock Inflow into Inventory
            </p>
            <p>
              You are receiving stock into <strong>{purchase.branch.name}</strong> inventory. This will
              immediately create immutable <strong>StockTransaction (RECEIPT)</strong> ledger entries and
              increase active branch stock counts.
            </p>
          </div>

          <div className="rounded-md border border-border/60 p-3 space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Items to be received:
            </span>
            <ul className="divide-y divide-border/40 text-xs">
              {activeReceivingItems.map(({ item, quantity }) => (
                <li key={item.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-foreground">{item.ingredientName}</span>
                    <span className="text-muted-foreground text-[11px] block">
                      Ordered: {item.orderedQuantity} {item.unit} • Current Received: {item.receivedQuantity} {item.unit}
                    </span>
                  </div>
                  <Badge className="bg-primary/15 text-primary text-xs px-2.5 py-0.5">
                    + {quantity} {item.unit}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmStep(false)}
              disabled={isPending}
            >
              Back to Edit
            </Button>
            <Button
              onClick={handleConfirmReceive}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm & Receive Stock
            </Button>
          </DialogFooter>
        </div>
      )}
    </>
  );
}

export function PurchaseReceivingDialog({
  open,
  onOpenChange,
  purchase,
  onSuccess,
}: PurchaseReceivingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <PackageCheck className="size-5" />
            </div>
            <div>
              <DialogTitle>Receive Purchase Stock</DialogTitle>
              <DialogDescription>
                Record delivered goods into {purchase.branch.name} inventory ledger ({purchase.purchaseNumber}).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {open && (
          <PurchaseReceivingInner
            key={purchase.id}
            purchase={purchase}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
