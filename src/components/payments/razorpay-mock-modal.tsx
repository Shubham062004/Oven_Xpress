'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';

interface RazorpayMockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  amount: number; // in rupees
  onSimulateSuccess: () => void;
  onSimulateFailure: () => void;
}

export function RazorpayMockModal({
  open,
  onOpenChange,
  orderNumber,
  amount,
  onSimulateSuccess,
  onSimulateFailure,
}: RazorpayMockModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/80 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-black text-sm">
                RZP
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Razorpay Payment Sandbox
                </DialogTitle>
                <span className="text-[11px] text-muted-foreground">
                  Test Simulation Environment
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
              MOCK MODE
            </span>
          </div>

          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            Real Razorpay keys are not yet configured in <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">.env</code>. You can simulate checkout verification right now, or provide <code className="px-1 py-0.5 bg-muted rounded font-mono text-[11px]">RAZORPAY_KEY_ID</code> to trigger the live popup.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-xs">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Order Reference:</span>
            <span className="font-mono font-semibold text-foreground">{orderNumber}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Payable Amount:</span>
            <span className="text-lg font-black text-foreground">₹{amount.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onSimulateFailure}
            className="w-full sm:w-auto text-xs flex items-center gap-1.5"
          >
            <XCircle className="size-3.5" />
            Simulate Payment Failure
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onSimulateSuccess}
            className="w-full sm:w-auto text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
          >
            <CheckCircle2 className="size-3.5" />
            Simulate Payment Success
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
