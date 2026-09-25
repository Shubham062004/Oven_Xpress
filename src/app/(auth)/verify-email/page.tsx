import { Suspense } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { VerifyEmailContent } from '@/components/auth/verify-email-content';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Verify Email Address | Oven Xpress',
  description: 'Confirm your email address to access your Oven Xpress account',
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolved = await searchParams;
  const token = resolved.token || '';

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
            <CardTitle className="text-xl font-semibold">Email Verification</CardTitle>
            <CardDescription>
              Confirm your operational restaurant identity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-muted-foreground">Verifying token...</div>}>
              <VerifyEmailContent token={token} />
            </Suspense>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <ArrowLeft className="size-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
