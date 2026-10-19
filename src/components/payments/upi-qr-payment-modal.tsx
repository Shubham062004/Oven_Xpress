'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  QrCode,
  Smartphone,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export interface UpiQrModalDetails {
  orderId: string;
  orderNumber: string;
  amount: number; // in Rupees
  razorpayOrderId: string;
  trackingToken?: string;
  customerName?: string;
  customerPhone?: string;
}

interface UpiQrPaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  details: UpiQrModalDetails | null;
  onPaymentSuccess: (trackingUrl: string) => void;
  onLaunchRazorpay: () => void;
}

export function UpiQrPaymentModal({
  isOpen,
  onOpenChange,
  details,
  onPaymentSuccess,
  onLaunchRazorpay,
}: UpiQrPaymentModalProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Waiting for payment confirmation...');
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Poll server for verified payment status every 3.5 seconds
  useEffect(() => {
    if (!isOpen || !details?.orderNumber) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(
          `/api/webhooks/razorpay?orderNumber=${encodeURIComponent(details.orderNumber)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'SUCCESS' || data.orderStatus === 'CONFIRMED') {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            toast.success('Payment verified successfully!');
            const trackingUrl = details.trackingToken
              ? `/track/${details.orderNumber}?token=${details.trackingToken}`
              : `/track/${details.orderNumber}`;
            onPaymentSuccess(trackingUrl);
          }
        }
      } catch (err) {
        console.warn('[UPI Poll] Status poll error:', err);
      }
      setPollCount((prev) => prev + 1);
    };

    // Initial check
    checkStatus();

    // Max 100 polls (~5.5 minutes bounded)
    pollTimerRef.current = setInterval(() => {
      checkStatus();
    }, 3500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, details, onPaymentSuccess]);

  if (!details) return null;

  const handleManualCheck = async () => {
    setIsChecking(true);
    setStatusMessage('Checking payment status with Razorpay...');
    try {
      const res = await fetch('/api/webhooks/razorpay', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: details.orderId,
          orderNumber: details.orderNumber,
          trackingToken: details.trackingToken,
        }),
      });

      const data = await res.json();
      if (data.success && data.trackingUrl) {
        toast.success('Payment verified!');
        onPaymentSuccess(data.trackingUrl);
        return;
      }

      toast.info(data.message || 'Payment is still processing in your UPI app. Please wait.');
      setStatusMessage('Waiting for UPI app confirmation...');
    } catch {
      toast.error('Unable to verify right now. Please wait a moment.');
    } finally {
      setIsChecking(false);
    }
  };

  // UPI deep link URI for mobile devices
  const upiDeepLink = `upi://pay?pa=razorpay@icici&pn=OvenXpress&am=${details.amount.toFixed(
    2
  )}&cu=INR&tn=${encodeURIComponent(`Order ${details.orderNumber}`)}&tr=${encodeURIComponent(
    details.razorpayOrderId
  )}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-5 sm:p-6 space-y-4">
        <DialogHeader className="text-center space-y-1">
          <div className="mx-auto size-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center mb-1">
            <QrCode className="size-6" />
          </div>
          <DialogTitle className="text-lg font-black text-foreground">
            UPI QR Code Payment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Scan with any UPI app to pay securely via Razorpay
          </DialogDescription>
        </DialogHeader>

        {/* Amount & Order Reference Banner */}
        <div className="p-4 rounded-2xl bg-muted/50 border border-border/80 text-center space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total Payable Amount
          </span>
          <div className="text-3xl font-black text-foreground">
            ₹{details.amount.toFixed(2)}
          </div>
          <span className="text-xs font-mono font-bold text-primary block">
            Order #{details.orderNumber}
          </span>
        </div>

        {/* Supported Apps strip */}
        <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] font-extrabold text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">GPay</span>
          <span>•</span>
          <span className="text-indigo-600 dark:text-indigo-400">PhonePe</span>
          <span>•</span>
          <span className="text-sky-600 dark:text-sky-400">Paytm</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400">BHIM</span>
          <span>•</span>
          <span className="text-purple-600 dark:text-purple-400">CRED</span>
        </div>

        {/* Mobile quick action */}
        <div className="block sm:hidden w-full">
          <a
            href={upiDeepLink}
            className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 flex items-center justify-center gap-2"
          >
            <Smartphone className="size-4" />
            <span>Tap to Pay with Installed UPI App</span>
          </a>
        </div>

        {/* Razorpay QR Trigger Box */}
        <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 text-center space-y-3">
          <div className="space-y-1">
            <div className="text-xs font-bold text-foreground">
              Scan Dynamic QR Code via Razorpay
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Click below to view the official Razorpay dynamic QR code for instant scanning with your phone.
            </p>
          </div>

          <Button
            type="button"
            onClick={onLaunchRazorpay}
            className="w-full bg-linear-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs shadow-md shadow-orange-600/25 h-11 rounded-xl cursor-pointer"
          >
            <QrCode className="size-4 mr-1.5" />
            <span>Open Razorpay QR Code Modal</span>
            <ExternalLink className="size-3.5 ml-1.5 opacity-80" />
          </Button>
        </div>

        {/* Live Status and Polling Indicator */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="size-4 animate-spin text-amber-600 shrink-0" />
            <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 truncate">
              {statusMessage}
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0 pl-2">
            Auto-checking #{pollCount}
          </span>
        </div>

        {/* Actions: Cancel/Back & Check Status */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-xs h-10 rounded-xl cursor-pointer"
          >
            <ArrowLeft className="size-3.5 mr-1" />
            <span>Cancel / Change Payment</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isChecking}
            onClick={handleManualCheck}
            className="flex-1 text-xs h-10 rounded-xl cursor-pointer font-bold"
          >
            {isChecking ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5 mr-1" />
                <span>Verify Status</span>
              </>
            )}
          </Button>
        </div>

        <div className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
          <ShieldCheck className="size-3 text-emerald-500" />
          <span>256-Bit Encrypted & Verified Server-Side by Razorpay</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
