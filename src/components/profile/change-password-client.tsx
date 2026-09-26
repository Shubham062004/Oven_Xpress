'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { changePasswordAction } from '@/lib/profile/profile-actions';

export function ChangePasswordClient({ userName }: { userName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const isDifferent = currentPassword !== '' && newPassword !== '' && currentPassword !== newPassword;
  const passwordsMatch = newPassword !== '' && newPassword === confirmPassword;

  const isFormValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    hasSpecial &&
    isDifferent &&
    passwordsMatch &&
    currentPassword.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast.error('Please ensure all password requirements are satisfied.');
      return;
    }

    startTransition(async () => {
      const result = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to update password.');
        return;
      }

      toast.success('Password changed successfully! Other active sessions have been revoked.');
      router.push('/profile?tab=security');
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/profile"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Profile</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-foreground">Change Password</span>
      </div>

      <Card className="border-border/80 shadow-xs">
        <form onSubmit={handleSubmit}>
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <KeyRound className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Change Your Password</CardTitle>
                <CardDescription>
                  Update the login password for {userName}.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-xs font-semibold">
                Current Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle current password visibility"
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-xs font-semibold">
                New Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter high-entropy new password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle new password visibility"
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold">
                Confirm New Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Password Policy Requirements Checklist */}
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2.5 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" /> Password Security Standards
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  {hasMinLength ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={hasMinLength ? 'text-foreground font-medium' : ''}>Minimum 8 characters</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasUppercase ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={hasUppercase ? 'text-foreground font-medium' : ''}>Uppercase letter (A-Z)</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasLowercase ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={hasLowercase ? 'text-foreground font-medium' : ''}>Lowercase letter (a-z)</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasNumber ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={hasNumber ? 'text-foreground font-medium' : ''}>At least one number (0-9)</span>
                </div>
                <div className="flex items-center gap-2">
                  {hasSpecial ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={hasSpecial ? 'text-foreground font-medium' : ''}>Special character (!@#$%^&*)</span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordsMatch ? <CheckCircle2 className="size-4 text-emerald-500" /> : <XCircle className="size-4 text-muted-foreground" />}
                  <span className={passwordsMatch ? 'text-foreground font-medium' : ''}>Passwords match exactly</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Security Protection:</strong> Changing your password will automatically terminate any other active sessions across your devices. Your current browser session will remain authenticated.
              </p>
            </div>
          </CardContent>
          <CardFooter className="border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push('/profile')}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isFormValid || isPending}
              className="gap-2"
            >
              <Lock className="size-4" />
              {isPending ? 'Updating Password...' : 'Save New Password'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
