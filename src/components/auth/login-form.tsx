'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loginAction, type LoginFormState } from '@/lib/auth/actions';

const INITIAL_STATE: LoginFormState = {
  success: false,
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const resetSuccess = searchParams.get('reset') === 'success';

  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');

  const fillCredentials = (email: string, pass: string) => {
    setEmailValue(email);
    setPasswordValue(pass);
  };

  return (
    <div className="space-y-6">
      {resetSuccess && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle>Password Reset Successfully</AlertTitle>
          <AlertDescription className="text-xs">
            Your password has been updated and all active sessions were terminated. Please sign in with your new password.
          </AlertDescription>
        </Alert>
      )}

      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Authentication Failed</AlertTitle>
          <AlertDescription className="text-xs">{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.unverified && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <p className="font-semibold">Email Verification Required</p>
          <p>Your email address must be confirmed before you can access the operational dashboard.</p>
          <Link
            href="/verify-email"
            className="inline-block font-medium text-primary underline hover:text-primary/80"
          >
            Go to email verification page &rarr;
          </Link>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address
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

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="••••••••"
              className="pl-9 pr-10"
              aria-describedby={state?.fieldErrors?.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {state?.fieldErrors?.password && (
            <p id="password-error" className="text-xs text-destructive mt-1">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-10 font-medium text-sm transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span>Verifying credentials...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </Button>
      </form>

      {/* Development Quick-Fill Helper */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          <span>Quick-Fill Demo Credentials (Testing)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => fillCredentials('owner@ovenxpress.com', 'Owner123!')}
            className="text-[11px]"
          >
            Owner
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => fillCredentials('admin@ovenxpress.com', 'Admin123!')}
            className="text-[11px]"
          >
            Admin
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => fillCredentials('manager@ovenxpress.com', 'Manager123!')}
            className="text-[11px]"
          >
            Manager
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => fillCredentials('staff@ovenxpress.com', 'Staff123!')}
            className="text-[11px]"
          >
            Staff
          </Button>
        </div>
        <div className="pt-1 text-[11px] text-muted-foreground flex justify-between items-center">
          <span>Test Inactive Account:</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => fillCredentials('inactive@ovenxpress.com', 'Inactive123!')}
            className="text-[11px] text-destructive hover:bg-destructive/10"
          >
            Fill Inactive User
          </Button>
        </div>
      </div>
    </div>
  );
}
