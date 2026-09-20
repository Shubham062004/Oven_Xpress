'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { approveExpense, rejectExpense } from '@/lib/expenses/actions';
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

interface ExpenseApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'approve' | 'reject';
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

export function ExpenseApprovalDialog({
  open,
  onOpenChange,
  mode,
  expense,
  onSuccess,
}: ExpenseApprovalDialogProps) {
  const [notes, setNotes] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!expense) return null;

  const isApprove = mode === 'approve';

  const handleAction = async () => {
    setError(null);

    if (!isApprove && (!rejectionReason || rejectionReason.trim().length < 3)) {
      setError('Please provide a specific rejection reason (minimum 3 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isApprove) {
        const res = await approveExpense({
          expenseId: expense.id,
          notes: notes.trim() || undefined,
        });

        if (res.success) {
          toast.success(`Expense ${expense.expenseNumber} approved successfully!`);
          onOpenChange(false);
          onSuccess();
        } else {
          setError(res.error || 'Failed to approve expense');
          toast.error(res.error || 'Failed to approve expense');
        }
      } else {
        const res = await rejectExpense({
          expenseId: expense.id,
          rejectionReason: rejectionReason.trim(),
        });

        if (res.success) {
          toast.success(`Expense ${expense.expenseNumber} rejected and archived.`);
          onOpenChange(false);
          onSuccess();
        } else {
          setError(res.error || 'Failed to reject expense');
          toast.error(res.error || 'Failed to reject expense');
        }
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
            <div
              className={`p-2 rounded-lg ${
                isApprove
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {isApprove ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle>
                {isApprove ? 'Authorize & Approve Expense' : 'Reject Expense Submission'}
              </DialogTitle>
              <DialogDescription>
                {isApprove
                  ? `Confirm authorization for ${expense.expenseNumber}.`
                  : `Document rejection rationale for ${expense.expenseNumber}.`}
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

        {/* Expense Summary Card */}
        <div className="p-3.5 rounded-lg border bg-muted/40 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Expense Number:</span>
            <span className="font-mono font-bold text-foreground">{expense.expenseNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Branch:</span>
            <span className="font-medium text-foreground">{expense.branchName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Category:</span>
            <span className="font-medium text-foreground">{expense.categoryName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Description:</span>
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {expense.description}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border/60">
            <span className="font-semibold text-foreground">Total Amount:</span>
            <span className="text-sm font-bold text-primary">{formatINR(expense.amount)}</span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-3 py-1">
          {isApprove ? (
            <div className="space-y-1.5">
              <Label htmlFor="approvalNotes" className="text-xs font-semibold text-muted-foreground">
                Approval Remarks / Notes (Optional)
              </Label>
              <Textarea
                id="approvalNotes"
                placeholder="e.g. Budget authorized under monthly utilities cap, verified with manager..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                className="min-h-16 text-xs"
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Once approved, this financial record is immutable.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="rejectionReason" className="text-xs font-semibold text-destructive">
                Mandatory Rejection Reason *
              </Label>
              <Textarea
                id="rejectionReason"
                placeholder="e.g. Missing valid vendor tax invoice, expense belongs to different branch, duplicate submission..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={isSubmitting}
                className="min-h-20 text-xs border-destructive/40 focus-visible:ring-destructive"
              />
              <p className="text-[11px] text-muted-foreground">
                Rejection reason is permanently preserved in the operational audit trail.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isApprove ? 'default' : 'destructive'}
            onClick={handleAction}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {isApprove ? 'Authorize & Approve' : 'Reject Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
