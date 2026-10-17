'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { loginAction, type LoginFormState } from '@/lib/auth/actions';

const INITIAL_STATE: LoginFormState = {
  success: false,
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || searchParams.get('returnTo') || '/';
  const resetSuccess = searchParams.get('reset') === 'success';
  const isSessionExpired =
    searchParams.get('reason') === 'session-expired' || searchParams.get('reason') === 'expired';
  const isAccountInactive = searchParams.get('error') === 'account-inactive';
  const isGoogleNotConfigured = searchParams.get('error') === 'google-not-configured';
  const isGoogleAuthFailed = [
    'google-auth-failed',
    'google-token-failed',
    'invalid-state',
    'google-profile-failed',
    'google-missing-email',
  ].includes(searchParams.get('error') || '');

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
      {isSessionExpired && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <Clock className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Session Expired</AlertTitle>
          <AlertDescription className="text-xs">
            Your session expired after 10 minutes for security. Please log in again to continue.
          </AlertDescription>
        </Alert>
      )}

      {isGoogleNotConfigured && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Google Sign-In Not Configured</AlertTitle>
          <AlertDescription className="text-xs">
            Google OAuth is not configured yet. Please configure <code className="px-1 py-0.5 rounded bg-amber-500/20 font-mono text-[11px]">GOOGLE_CLIENT_ID</code> and <code className="px-1 py-0.5 rounded bg-amber-500/20 font-mono text-[11px]">GOOGLE_CLIENT_SECRET</code> in your environment variables.
          </AlertDescription>
        </Alert>
      )}

      {isGoogleAuthFailed && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Google Authentication Failed</AlertTitle>
          <AlertDescription className="text-xs">
            Unable to sign in with Google. Please try again or use your email and password.
          </AlertDescription>
        </Alert>
      )}

      {isAccountInactive && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Account Inactive</AlertTitle>
          <AlertDescription className="text-xs">
            Your account is currently inactive. Please contact your restaurant administrator.
          </AlertDescription>
        </Alert>
      )}

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

      {/* Google OAuth Section */}
      <div className="space-y-3">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/70" />
          </div>
          <span className="relative bg-card px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Or continue with
          </span>
        </div>

        <a
          href={`/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full h-10 font-medium text-sm flex items-center justify-center gap-2.5 border-border/80 hover:bg-muted/50 hover:border-border transition-all shadow-sm'
          )}
        >
          <GoogleIcon className="size-4" />
          <span>Continue with Google</span>
        </a>
      </div>

      {/* Development Quick-Fill Helper */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          <span>Quick-Fill Demo Credentials (Testing)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => fillCredentials('customer@ovenxpress.com', 'Customer123!')}
            className="text-[11px] border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold"
          >
            Customer
          </Button>
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}
