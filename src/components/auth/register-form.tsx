'use client';

import { useActionState, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { registerAction, type RegisterFormState } from '@/lib/auth/actions';
import { HONEYPOT_FIELD_NAME } from '@/lib/security/abuse-protection';

const INITIAL_STATE: RegisterFormState = {
  success: false,
};

export function RegisterForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || searchParams.get('returnTo') || '/';

  const [state, formAction, isPending] = useActionState(registerAction, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');

  // Password strength heuristics
  const hasMinLength = passwordValue.length >= 8;
  const hasUpperCase = /[A-Z]/.test(passwordValue);
  const hasLowerCase = /[a-z]/.test(passwordValue);
  const hasNumber = /[0-9]/.test(passwordValue);
  const hasSpecial = /[^A-Za-z0-9]/.test(passwordValue);
  const strengthCount = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;

  return (
    <div className="space-y-5">
      {state?.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Registration Failed</AlertTitle>
          <AlertDescription className="text-xs">{state.error}</AlertDescription>
        </Alert>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {/* Honeypot field for bot trap */}
        <div aria-hidden="true" style={{ display: 'none', position: 'absolute', left: '-9999px' }}>
          <label htmlFor={HONEYPOT_FIELD_NAME}>Leave this field blank</label>
          <input
            id={HONEYPOT_FIELD_NAME}
            type="text"
            name={HONEYPOT_FIELD_NAME}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g. Rahul Sharma"
              required
              disabled={isPending}
              className="pl-9 h-11 text-sm"
              autoComplete="name"
            />
          </div>
          {state?.fieldErrors?.name && (
            <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
          )}
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs font-semibold">
            Phone Number
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="10-digit mobile number"
              required
              disabled={isPending}
              className="pl-9 h-11 text-sm"
              autoComplete="tel"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Used for order delivery & OTP updates</p>
          {state?.fieldErrors?.phone && (
            <p className="text-xs text-destructive">{state.fieldErrors.phone[0]}</p>
          )}
        </div>

        {/* Email Address */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={isPending}
              className="pl-9 h-11 text-sm"
              autoComplete="email"
            />
          </div>
          {state?.fieldErrors?.email && (
            <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 chars, 1 uppercase, 1 symbol"
              required
              disabled={isPending}
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              className="pl-9 pr-10 h-11 text-sm"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {/* Password strength meter */}
          {passwordValue.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex gap-1 h-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-full flex-1 rounded-full transition-colors ${
                      strengthCount >= level
                        ? strengthCount >= 4
                          ? 'bg-emerald-500'
                          : strengthCount >= 3
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                        : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Must contain 8+ characters, uppercase, lowercase, number & symbol
              </p>
            </div>
          )}
          {state?.fieldErrors?.password && (
            <p className="text-xs text-destructive">{state.fieldErrors.password[0]}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              required
              disabled={isPending}
              className="pl-9 pr-10 h-11 text-sm"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {state?.fieldErrors?.confirmPassword && (
            <p className="text-xs text-destructive">{state.fieldErrors.confirmPassword[0]}</p>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold tracking-wide shadow-md"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Customer Account'
          )}
        </Button>
      </form>

      {/* Switch to login */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link
          href={`/login${callbackUrl && callbackUrl !== '/' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
          className="font-semibold text-primary hover:underline"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
