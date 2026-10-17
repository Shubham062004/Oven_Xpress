'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  Clock,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface UpiQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  amount: number; // in rupees
  trackingToken?: string;
  onPaymentConfirmed: () => void;
  onOpenRazorpayModal: () => void;
}

export function UpiQrModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  amount,
  trackingToken,
  onPaymentConfirmed,
  onOpenRazorpayModal,
}: UpiQrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [showUtrInput, setShowUtrInput] = useState<boolean>(false);

  const merchantVpa =
    process.env.NEXT_PUBLIC_MERCHANT_UPI_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.replace(/[^a-zA-Z0-9]/g, '') + '@razorpay' ||
    'ovenxpress@razorpay';

  // Standard NPCI UPI URI Scheme
  const upiUrl = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=Oven%20Xpress&am=${amount.toFixed(2)}&tr=${encodeURIComponent(orderNumber)}&tn=${encodeURIComponent(`Order ${orderNumber}`)}&cu=INR`;

  // Generate QR Code image when modal opens or amount changes
  useEffect(() => {
    if (!open) return;

    QRCode.toDataURL(upiUrl, {
      width: 280,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        setQrDataUrl(url);
        setTimeLeft(600);
      })
      .catch((err) => {
        console.error('Failed to generate UPI QR code:', err);
      });
  }, [open, upiUrl]);

  // Timer countdown
  useEffect(() => {
    if (!open || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [open, timeLeft]);

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(merchantVpa);
    setCopied(true);
    toast.success('UPI ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleConfirmUpiPayment = async () => {
    setIsVerifying(true);
    try {
      const response = await fetch('/api/webhooks/razorpay', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderNumber,
          utrNumber: utrNumber.trim() || undefined,
          trackingToken,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('UPI payment verified successfully!');
        onPaymentConfirmed();
      } else {
        toast.error(result.error || 'Payment verification failed. Please try again.');
        setIsVerifying(false);
      }
    } catch (err) {
      console.error('UPI confirmation error:', err);
      toast.error('Unable to verify payment. Please try again.');
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/80 shadow-2xl p-5 overflow-y-auto max-h-[92vh]">
        <DialogHeader className="space-y-1.5 text-center sm:text-center pb-1">
          <div className="flex items-center justify-center gap-2">
            <div className="size-8 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <QrCode className="size-4" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Scan & Pay via Any UPI App
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Use GPay, PhonePe, Paytm, BHIM, or any UPI app to scan and pay instantly.
          </DialogDescription>
        </DialogHeader>

        {/* UPI Apps supported banner */}
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-muted/50 border border-border/60 text-[11px] font-bold text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">GPay</span>
          <span>•</span>
          <span className="text-indigo-600 dark:text-indigo-400">PhonePe</span>
          <span>•</span>
          <span className="text-sky-600 dark:text-sky-400">Paytm</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400">BHIM</span>
          <span>•</span>
          <span className="text-foreground">CRED</span>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center py-2 space-y-2">
          <div className="relative p-3 rounded-2xl bg-white shadow-md border-2 border-primary/30 flex items-center justify-center">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`UPI QR Code for Order ${orderNumber}`}
                className="size-52 sm:size-56 object-contain rounded-lg"
              />
            ) : (
              <div className="size-52 sm:size-56 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span>Generating secure QR...</span>
              </div>
            )}
          </div>

          {/* Amount & Order */}
          <div className="text-center space-y-0.5">
            <div className="text-2xl font-black text-foreground">
              ₹{amount.toFixed(2)}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Order #{orderNumber}
            </div>
          </div>
        </div>

        {/* Copy UPI ID & Timer */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/70">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                UPI ID (VPA)
              </span>
              <span className="font-mono font-semibold text-foreground text-[11px]">
                {merchantVpa}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyUpi}
              className="h-7 px-2.5 text-[11px] gap-1 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <div className="flex items-center gap-1">
              <Clock className="size-3 text-amber-500" />
              <span>
                QR Code valid for:{' '}
                <strong className="text-foreground font-mono">{formatTime(timeLeft)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="size-3" />
              <span>Instant Auto-Verify</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            disabled={isVerifying}
            onClick={handleConfirmUpiPayment}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 h-10 cursor-pointer"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Verifying UPI Payment...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                <span>I Have Completed Payment</span>
              </>
            )}
          </Button>

          {/* Optional UTR / Reference Number toggle */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setShowUtrInput(!showUtrInput)}
              className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1"
            >
              <span>Add 12-digit UPI Reference / UTR Number (Optional)</span>
              {showUtrInput ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>

            {showUtrInput && (
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={16}
                  placeholder="e.g. 4289XXXXXXXX"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-muted/40 border border-border/80 rounded-lg font-mono focus:outline-none focus:border-primary"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleConfirmUpiPayment}
                  className="text-xs h-8"
                >
                  Submit
                </Button>
              </div>
            )}
          </div>

          {/* Fallback to Razorpay Card / NetBanking Modal */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenRazorpayModal();
              }}
              className="text-[11px] text-primary hover:underline font-semibold inline-flex items-center gap-1"
            >
              <span>Want to pay via Card, NetBanking, or Razorpay Modal instead?</span>
              <ExternalLink className="size-3" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
