'use client';

import { useState } from 'react';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

import { recordPayment } from '@/lib/payments/actions';
import { PAYMENT_METHODS } from '@/lib/payments/constants';
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

interface PaymentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  totalPaid: number;
  remainingAmount: number;
  onSuccess: () => void;
}

export function PaymentCreateDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  orderTotal,
  totalPaid,
  remainingAmount,
  onSuccess,
}: PaymentCreateDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [amount, setAmount] = useState<string>(remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isPending, setIsPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  // When dialog opens, reset amount to remaining balance if appropriate
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : '0.00');
      setError(null);
      setShowConfirm(false);
    }
    onOpenChange(newOpen);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const isOverpaying = parsedAmount > remainingAmount + 0.001;
  const isInvalidAmount = parsedAmount <= 0;

  const currentMethodMeta = PAYMENT_METHODS[method];

  const handleQuickFillRemaining = () => {
    setAmount(remainingAmount.toFixed(2));
    setError(null);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalidAmount) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }
    if (isOverpaying) {
      setError(`Payment cannot exceed remaining payable amount of ₹${remainingAmount.toFixed(2)}`);
      return;
    }

    setError(null);
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await recordPayment({
        orderId,
        amount: parsedAmount,
        method,
        status: PaymentStatus.SUCCESS,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        toast.success(`Payment ${res.data.paymentNumber} of ₹${parsedAmount.toFixed(2)} recorded successfully!`);
        onOpenChange(false);
        setReferenceNumber('');
        setNotes('');
        setShowConfirm(false);
        onSuccess();
      } else {
        setError(res.error || 'Failed to record payment');
        toast.error(res.error || 'Failed to record payment');
        setShowConfirm(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
      toast.error(msg);
      setShowConfirm(false);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <CreditCard className="h-5 w-5" />
            <DialogTitle>Record Payment for Order {orderNumber}</DialogTitle>
          </div>
          <DialogDescription>
            Record customer tender or digital transaction. Amounts are validated against the order ledger.
          </DialogDescription>
        </DialogHeader>

        {/* Financial Summary Ledger */}
        <div className="grid grid-cols-3 gap-2 p-3.5 bg-muted/40 rounded-xl border text-center">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Order Total
            </span>
            <span className="text-base font-bold text-foreground">
              ₹{orderTotal.toFixed(2)}
            </span>
          </div>
          <div className="space-y-0.5 border-x border-border/60">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Already Paid
            </span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              ₹{totalPaid.toFixed(2)}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Remaining
            </span>
            <span className="text-base font-bold text-primary">
              ₹{remainingAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {!showConfirm ? (
          <form onSubmit={handlePreSubmit} className="space-y-5 pt-1">
            {/* Payment Method Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Payment Method</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => {
                  const meta = PAYMENT_METHODS[m];
                  const Icon = meta.icon;
                  const isSelected = method === m;

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMethod(m);
                        setError(null);
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/20 shadow-xs'
                          : 'border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-xs">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentMethodMeta.description}
              </p>
            </div>

            {/* Payment Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="paymentAmount" className="text-sm font-semibold">
                  Payment Amount (₹) <span className="text-destructive">*</span>
                </Label>
                {remainingAmount > 0 && parsedAmount !== remainingAmount && (
                  <button
                    type="button"
                    onClick={handleQuickFillRemaining}
                    className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                  >
                    Pay Full Remaining (₹{remainingAmount.toFixed(2)})
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingAmount}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  disabled={isPending}
                  className="pl-7 font-bold text-base"
                />
              </div>

              {isOverpaying && (
                <p className="text-xs font-medium text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Overpayment rejected: Amount exceeds remaining payable balance of ₹{remainingAmount.toFixed(2)}.
                </p>
              )}
            </div>

            {/* Reference Number (External methods) */}
            <div className="space-y-1.5">
              <Label htmlFor="referenceNumber" className="text-sm font-medium">
                {currentMethodMeta.referenceLabel}
              </Label>
              <Input
                id="referenceNumber"
                placeholder={currentMethodMeta.referencePlaceholder}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="paymentNotes" className="text-sm font-medium">
                Notes (Optional)
              </Label>
              <Textarea
                id="paymentNotes"
                placeholder="e.g. Paid at table 4, customer change given, customer split bill..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isPending}
                className="min-h-[65px] resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
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
                disabled={isPending || isInvalidAmount || isOverpaying}
                className="font-semibold gap-1.5 shadow-xs"
              >
                Continue to Review
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Confirmation Step */
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-3">
              <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                <ShieldCheck className="h-5 w-5" />
                <span>Confirm Payment Submission</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Please verify the financial details before posting to the branch ledger. This creates an audit-traceable payment record.
              </p>
              <div className="space-y-1 text-sm border-t border-primary/10 pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order:</span>
                  <span className="font-semibold text-foreground">{orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <span className="font-semibold text-foreground">{currentMethodMeta.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Amount:</span>
                  <span className="font-bold text-primary text-base">₹{parsedAmount.toFixed(2)}</span>
                </div>
                {referenceNumber.trim() && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference #:</span>
                    <span className="font-medium text-foreground">{referenceNumber.trim()}</span>
                  </div>
                )}
                {notes.trim() && (
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-muted-foreground">Note:</span>
                    <span className="italic text-foreground">{notes.trim()}</span>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
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
                Back to Edit
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isPending}
                className="font-semibold gap-1.5 shadow-xs"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recording Payment...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Record ₹{parsedAmount.toFixed(2)}
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
