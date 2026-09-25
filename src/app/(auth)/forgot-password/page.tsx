import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Forgot Password | Oven Xpress',
  description: 'Request a password reset link for your Oven Xpress account',
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <span className="text-lg font-bold tracking-wider">OX</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Oven Xpress</h1>
          <p className="text-sm text-muted-foreground">
            Multi-Branch Restaurant Management
          </p>
        </div>

        <Card className="border-border/70 shadow-md">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-xl font-semibold">Reset Your Password</CardTitle>
            <CardDescription>
              Enter your account email to receive a secure, expiring password reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Loading form...</div>}>
              <ForgotPasswordForm />
            </Suspense>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
