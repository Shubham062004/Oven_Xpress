'use client';

import { useState } from 'react';
import {
  RotateCcw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { createPaymentRefund } from '@/lib/payments/actions';
import type { PaymentRecord } from '@/lib/payments/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface PaymentRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentRecord | null;
  onSuccess: () => void;
}

export function PaymentRefundDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: PaymentRefundDialogProps) {
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const refundableAmount = payment ? payment.refundableAmount : 0;

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && payment) {
      setAmount(payment.refundableAmount.toFixed(2));
      setReason('');
      setReferenceNumber('');
      setNotes('');
      setError(null);
      setShowConfirm(false);
    }
    onOpenChange(newOpen);
  };

  if (!payment) return null;

  const parsedAmount = parseFloat(amount) || 0;
  const isOverRefunding = parsedAmount > refundableAmount + 0.001;
  const isInvalidAmount = parsedAmount <= 0;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalidAmount) {
      setError('Please enter a valid refund amount greater than ₹0');
      return;
    }
    if (isOverRefunding) {
      setError(`Refund amount cannot exceed refundable balance of ₹${refundableAmount.toFixed(2)}`);
      return;
    }
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Please provide a refund reason of at least 3 characters');
      return;
    }

    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmRefund = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await createPaymentRefund({
        paymentId: payment.id,
        amount: parsedAmount,
        reason: reason.trim(),
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success(`Refund of ₹${parsedAmount.toFixed(2)} processed successfully.`);
        onOpenChange(false);
        onSuccess();
      } else {
        setError(res.error || 'Failed to process refund');
        toast.error(res.error || 'Failed to process refund');
        setShowConfirm(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to process refund';
      setError(msg);
      toast.error(msg);
      setShowConfirm(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <RotateCcw className="h-5 w-5" />
            <DialogTitle>Issue Refund for Payment {payment.paymentNumber}</DialogTitle>
          </div>
          <DialogDescription>
            Reverse full or partial tender. This sensitive operation updates the payment ledger and is permanently audited.
          </DialogDescription>
        </DialogHeader>

        {/* Financial Context */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-xl border text-center text-xs">
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Original Amount
            </span>
            <span className="font-bold text-foreground text-sm">
              ₹{payment.amount.toFixed(2)}
            </span>
          </div>
          <div className="border-x border-border/60">
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Refunded So Far
            </span>
            <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
              ₹{payment.refundedAmount.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
              Max Refundable
            </span>
            <span className="font-bold text-primary text-sm">
              ₹{refundableAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {!showConfirm ? (
          <form onSubmit={handlePreSubmit} className="space-y-4 pt-1">
            {/* Refund Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="refundAmount" className="text-sm font-semibold">
                  Refund Amount (₹) <span className="text-destructive">*</span>
                </Label>
                {refundableAmount > 0 && parsedAmount !== refundableAmount && (
                  <button
                    type="button"
                    onClick={() => setAmount(refundableAmount.toFixed(2))}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Max (₹{refundableAmount.toFixed(2)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="refundAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={refundableAmount}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  disabled={isPending}
                  className="pl-7 font-bold"
                />
              </div>
            </div>

            {/* Mandatory Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="refundReason" className="text-sm font-semibold">
                Reason for Refund <span className="text-destructive">*</span>
              </Label>
              <Input
                id="refundReason"
                placeholder="e.g. Customer returned item, duplicate charge, wrong order..."
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError(null);
                }}
                disabled={isPending}
              />
            </div>

            {/* External Reference */}
            <div className="space-y-1.5">
              <Label htmlFor="refundReference" className="text-sm font-medium">
                Reversal / Gateway Reference # (Optional)
              </Label>
              <Input
                id="refundReference"
                placeholder="e.g. Bank ARN, gateway refund ID, reversal voucher"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="refundNotes" className="text-sm font-medium">
                Internal Notes (Optional)
              </Label>
              <Textarea
                id="refundNotes"
                placeholder="Operational notes regarding manager approval or customer feedback..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                className="min-h-[60px] resize-none"
              />
            </div>

            {error && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending || isInvalidAmount || isOverRefunding || !reason.trim()}
                className="font-semibold"
              >
                Review Refund
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Warning & Confirmation */
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl border bg-destructive/5 border-destructive/20 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                <AlertTriangle className="h-5 w-5" />
                <span>Confirm Financial Refund</span>
              </div>
              <p className="text-xs text-muted-foreground">
                You are about to issue a refund of{' '}
                <span className="font-bold text-destructive">₹{parsedAmount.toFixed(2)}</span>{' '}
                against payment <span className="font-medium text-foreground">{payment.paymentNumber}</span>.
                This reversal will immediately reduce net payments on this order.
              </p>
              <div className="space-y-1 text-xs border-t border-destructive/10 pt-2 text-foreground">
                <div>
                  <span className="text-muted-foreground">Reason:</span> {reason}
                </div>
                {referenceNumber.trim() && (
                  <div>
                    <span className="text-muted-foreground">Reference:</span> {referenceNumber.trim()}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmRefund}
                disabled={isPending}
                className="gap-1.5 font-semibold"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing Refund...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Refund ₹{parsedAmount.toFixed(2)}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
