'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Mail, ExternalLink } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  verifyEmailAction,
  requestEmailVerificationAction,
  type EmailVerificationFormState,
} from '@/lib/auth/actions';

interface VerifyEmailContentProps {
  token?: string;
}

export function VerifyEmailContent({ token }: VerifyEmailContentProps) {
  const [isVerifying, startVerifyTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // Resend state
  const [resendEmail, setResendEmail] = useState('');
  const [resendState, setResendState] = useState<EmailVerificationFormState | null>(null);

  // Auto-verify if token is present on mount
  useEffect(() => {
    if (token && verifyStatus === 'idle') {
      startVerifyTransition(async () => {
        const result = await verifyEmailAction(token);
        if (result.success && result.data?.email) {
          setVerifyStatus('success');
          setVerifiedEmail(result.data.email);
        } else {
          setVerifyStatus('error');
          setErrorMessage(result.error || 'Invalid or expired email verification link.');
        }
      });
    }
  }, [token, verifyStatus]);

  const handleResend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    startResendTransition(async () => {
      const formData = new FormData();
      formData.set('email', resendEmail);
      const res = await requestEmailVerificationAction(null, formData);
      setResendState(res);
    });
  };

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 py-6 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Validating email verification token...</p>
        <p className="text-xs text-muted-foreground">Please wait while we confirm your account identity.</p>
      </div>
    );
  }

  if (verifyStatus === 'success') {
    return (
      <div className="space-y-4">
        <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Email Verified Successfully</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Your email address <strong>{verifiedEmail}</strong> has been confirmed. You now have full operational access to Oven Xpress.
          </AlertDescription>
        </Alert>

        <Link
          href="/login"
          className={cn(buttonVariants(), "w-full h-10 font-medium text-sm flex items-center justify-center")}
        >
          Proceed to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {verifyStatus === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Verification Failed</AlertTitle>
          <AlertDescription className="text-xs mt-1">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {resendState?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Request Error</AlertTitle>
          <AlertDescription className="text-xs mt-1">{resendState.error}</AlertDescription>
        </Alert>
      )}

      {resendState?.success && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Verification Link Sent</AlertTitle>
          <AlertDescription className="text-xs space-y-2 mt-1">
            <p>If an unverified account exists for this address, a confirmation link has been sent.</p>
            {resendState.data?.devVerifyUrl && (
              <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/20 p-2 font-mono text-[11px]">
                <span className="font-semibold block text-emerald-800 dark:text-emerald-300">Development / Testing Link:</span>
                <Link
                  href={resendState.data.devVerifyUrl}
                  className="text-primary hover:underline break-all inline-flex items-center gap-1 mt-1"
                >
                  <span>Click here to verify email</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!resendState?.success && (
        <form onSubmit={handleResend} className="space-y-4">
          <p className="text-xs text-muted-foreground text-center">
            {token
              ? 'Your link may have expired (24-hour limit). Enter your registered email below to request a fresh verification link.'
              : 'Enter your registered email address to receive a confirmation link.'}
          </p>

          <div className="space-y-2">
            <Label htmlFor="resend-email" className="text-sm font-medium">
              Registered Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="resend-email"
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="name@restaurant.com"
                className="pl-9"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isResending || !resendEmail}
            className="w-full h-10 font-medium text-sm transition-all"
          >
            {isResending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                <span>Sending link...</span>
              </>
            ) : (
              <span>Send Verification Link</span>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
