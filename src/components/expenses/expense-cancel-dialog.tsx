'use client';

import { useState } from 'react';
import { AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cancelExpense } from '@/lib/expenses/actions';
import { formatINR } from '@/lib/expenses/constants';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExpenseCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: {
    id: string;
    expenseNumber: string;
    amount: number;
    categoryName: string;
    branchName: string;
    description: string;
  } | null;
  onSuccess: () => void;
}

export function ExpenseCancelDialog({
  open,
  onOpenChange,
  expense,
  onSuccess,
}: ExpenseCancelDialogProps) {
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!expense) return null;

  const handleCancel = async () => {
    setError(null);

    if (!cancellationReason || cancellationReason.trim().length < 3) {
      setError('Please provide a specific cancellation reason (minimum 3 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await cancelExpense({
        expenseId: expense.id,
        cancellationReason: cancellationReason.trim(),
      });

      if (res.success) {
        toast.success(`Expense ${expense.expenseNumber} cancelled successfully.`);
        setCancellationReason('');
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res.error || 'Failed to cancel expense');
        toast.error(res.error || 'Failed to cancel expense');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Cancel Expense</DialogTitle>
              <DialogDescription>
                Void expense {expense.expenseNumber}. Record remains in history for audit purposes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 rounded-lg border bg-muted/40 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expense #:</span>
            <span className="font-mono font-bold text-foreground">{expense.expenseNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Branch:</span>
            <span className="font-medium text-foreground">{expense.branchName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Category:</span>
            <span className="font-medium text-foreground">{expense.categoryName}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-border/60">
            <span className="font-semibold text-foreground">Amount:</span>
            <span className="font-bold text-foreground">{formatINR(expense.amount)}</span>
          </div>
        </div>

        <div className="space-y-1.5 py-1">
          <Label htmlFor="cancellationReason" className="text-xs font-semibold text-muted-foreground">
            Mandatory Cancellation Reason *
          </Label>
          <Textarea
            id="cancellationReason"
            placeholder="e.g. Transaction was aborted by cashier, bill paid through different entity, duplicate entry..."
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            disabled={isSubmitting}
            className="min-h-20 text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Cancelled expenses cannot be reactivated and will be marked as cancelled in the ledger.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Go Back
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirm Cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
