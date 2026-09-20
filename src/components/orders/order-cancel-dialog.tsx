'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cancelOrder } from '@/lib/orders/actions';
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

interface OrderCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  onSuccess: () => void;
}

export function OrderCancelDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  onSuccess,
}: OrderCancelDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a reason of at least 3 characters');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await cancelOrder({
        orderId,
        reason: reason.trim(),
      });

      if (res.success) {
        toast.success(`Order "${orderNumber}" has been cancelled.`);
        onOpenChange(false);
        setReason('');
        onSuccess();
      } else {
        setError(res.error || 'Failed to cancel order');
        toast.error(res.error || 'Failed to cancel order');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle>Cancel Restaurant Order</DialogTitle>
          </div>
          <DialogDescription className="pt-2 text-sm">
            Are you sure you want to cancel order{' '}
            <span className="font-semibold text-foreground">{orderNumber}</span>? This will stop
            further fulfillment and free any occupied dining table. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cancellationReason" className="text-sm font-medium">
              Cancellation Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cancellationReason"
              placeholder="e.g. Customer requested cancellation, out of key ingredient..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              className="w-full"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Keep Order
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
