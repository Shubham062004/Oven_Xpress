import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { RegisterForm } from '@/components/auth/register-form';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Create Account',
  description: 'Sign up for Oven Xpress to order artisanal pizzas, freshly baked breads, and gourmet treats.',
};

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8">
      {/* Top right theme switcher & back   */}
      <div className="absolute top-4 inset-x-4 flex justify-between items-center max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          &larr; Back
        </Link>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6 pt-6">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/" className="group flex items-center gap-2">
            <div className="relative flex size-14 items-center justify-center rounded-2xl overflow-hidden bg-white/95 dark:bg-zinc-900 border border-border/60 shadow-lg shadow-orange-500/10 group-hover:scale-105 transition-transform p-1">
              <Image
                src="/logo.png"
                alt="Oven Xpress"
                fill
                sizes="56px"
                className="object-contain p-1"
                priority
              />
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Join Oven Xpress
          </h1>
          <p className="text-xs text-muted-foreground max-w-xs">
            Create an account to track your orders, save delivery addresses, and unlock member specials.
          </p>
        </div>

        {/* Register Card */}
        <Card className="border-border/70 shadow-xl bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-lg font-semibold">Customer Registration</CardTitle>
            <CardDescription className="text-xs">
              Quick 1-minute sign-up to start ordering
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  Loading registration form...
                </div>
              }
            >
              <RegisterForm />
            </Suspense>
          </CardContent>
        </Card>

        {/* Safe notice */}
        <p className="text-center text-[11px] text-muted-foreground">
          By registering, you agree to Oven Xpress Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
