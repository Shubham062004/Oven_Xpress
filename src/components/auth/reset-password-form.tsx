'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, Loader2, Lock, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { resetPasswordAction, type PasswordResetFormState } from '@/lib/auth/actions';

const INITIAL_STATE: PasswordResetFormState = {
  success: false,
};

interface ResetPasswordFormProps {
  initialToken?: string;
}

export function ResetPasswordForm({ initialToken = '' }: ResetPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, INITIAL_STATE);
  const [tokenValue, setTokenValue] = useState(initialToken);
  const [passwordValue, setPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Real-time password requirement checklist
  const hasMinLength = passwordValue.length >= 8;
  const hasUppercase = /[A-Z]/.test(passwordValue);
  const hasLowercase = /[a-z]/.test(passwordValue);
  const hasNumber = /[0-9]/.test(passwordValue);
  const hasSpecial = /[^A-Za-z0-9]/.test(passwordValue);
  const passwordsMatch = passwordValue.length > 0 && passwordValue === confirmPasswordValue;

  return (
    <div className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Reset Failed</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-4">
        {/* Hidden or visible token input */}
        <input type="hidden" name="token" value={tokenValue} />

        {!initialToken && (
          <div className="space-y-2">
            <Label htmlFor="token" className="text-sm font-medium">
              Reset Token
            </Label>
            <Input
              id="token"
              name="token"
              type="text"
              required
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Paste the reset token from your link"
              className="font-mono text-xs"
            />
          </div>
        )}

        {/* New Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium">
            New Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="••••••••••••"
              className="pl-9 pr-10"
              aria-describedby={state?.fieldErrors?.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {state?.fieldErrors?.password && (
            <p id="password-error" className="text-xs text-destructive mt-1">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm New Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPasswordValue}
              onChange={(e) => setConfirmPasswordValue(e.target.value)}
              placeholder="••••••••••••"
              className="pl-9"
              aria-describedby={state?.fieldErrors?.confirmPassword ? 'confirm-error' : undefined}
            />
          </div>
          {state?.fieldErrors?.confirmPassword && (
            <p id="confirm-error" className="text-xs text-destructive mt-1">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          )}
        </div>

        {/* Password Strength Checklist */}
        <div className="rounded-md border border-border/60 bg-muted/20 p-2.5 text-[11px] space-y-1.5">
          <span className="font-semibold text-muted-foreground block mb-1">Password Requirements:</span>
          <div className="grid grid-cols-2 gap-1">
            <div className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
              {hasMinLength ? <Check className="size-3" /> : <X className="size-3" />}
              <span>8+ characters</span>
            </div>
            <div className={`flex items-center gap-1 ${hasUppercase ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
              {hasUppercase ? <Check className="size-3" /> : <X className="size-3" />}
              <span>Uppercase letter</span>
            </div>
            <div className={`flex items-center gap-1 ${hasLowercase ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
              {hasLowercase ? <Check className="size-3" /> : <X className="size-3" />}
              <span>Lowercase letter</span>
            </div>
            <div className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
              {hasNumber ? <Check className="size-3" /> : <X className="size-3" />}
              <span>Number (0-9)</span>
            </div>
            <div className={`flex items-center gap-1 ${hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
              {hasSpecial ? <Check className="size-3" /> : <X className="size-3" />}
              <span>Special symbol</span>
            </div>
            <div className={`flex items-center gap-1 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}`}>
              {passwordsMatch ? <Check className="size-3" /> : <X className="size-3" />}
              <span>Passwords match</span>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={isPending || !tokenValue}
          className="w-full h-10 font-medium text-sm transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span>Updating password & invalidating sessions...</span>
            </>
          ) : (
            <span>Update Password</span>
          )}
        </Button>
      </form>
    </div>
  );
}
