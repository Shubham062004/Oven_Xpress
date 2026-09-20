'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cancelPurchaseOrder } from '@/lib/purchases/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PurchaseCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  purchaseNumber: string;
  onSuccess: () => void;
}

export function PurchaseCancelDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  purchaseNumber,
  onSuccess,
}: PurchaseCancelDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      const res = await cancelPurchaseOrder({
        purchaseOrderId,
        reason: reason.trim() || undefined,
      });

      if (res.success) {
        toast.success(`Purchase Order "${purchaseNumber}" cancelled.`);
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res.error || 'Failed to cancel purchase order');
        toast.error(res.error || 'Failed to cancel purchase order');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <DialogTitle>Cancel Purchase Order {purchaseNumber}?</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to cancel this order? This action cannot be reversed. Only
            unreceived orders can be cancelled without an explicit inventory return.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Cancellation Reason (Optional)</Label>
            <Input
              id="cancel-reason"
              placeholder="e.g. Supplier out of stock, duplicate order"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Go Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Confirm Cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
