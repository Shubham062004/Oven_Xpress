'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, Mail, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { requestPasswordResetAction, type PasswordResetFormState } from '@/lib/auth/actions';

const INITIAL_STATE: PasswordResetFormState = {
  success: false,
};

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, INITIAL_STATE);
  const [emailValue, setEmailValue] = useState('');

  return (
    <div className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Request Failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.success && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Reset Link Dispatched</AlertTitle>
          <AlertDescription className="space-y-2 text-xs">
            <p>
              If an account is associated with <strong>{emailValue || 'that address'}</strong>, a password reset link has been dispatched.
            </p>
            <p className="text-[11px] text-muted-foreground">
              For security, the reset link will expire in <strong>15 minutes</strong> and can only be used once.
            </p>
            {state.data?.devResetUrl && (
              <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/20 p-2 font-mono text-[11px]">
                <span className="font-semibold block text-emerald-800 dark:text-emerald-300">Development / Testing Link:</span>
                <Link
                  href={state.data.devResetUrl}
                  className="text-primary hover:underline break-all inline-flex items-center gap-1 mt-1"
                >
                  <span>Click here to complete password reset</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {!state?.success && (
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Registered Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="name@restaurant.com"
                className="pl-9"
                aria-describedby={state?.fieldErrors?.email ? 'email-error' : undefined}
              />
            </div>
            {state?.fieldErrors?.email && (
              <p id="email-error" className="text-xs text-destructive mt-1">
                {state.fieldErrors.email[0]}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-10 font-medium text-sm transition-all"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                <span>Processing request...</span>
              </>
            ) : (
              <span>Send Password Reset Link</span>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
