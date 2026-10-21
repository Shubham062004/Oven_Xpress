import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LoginForm } from '@/components/auth/login-form';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to your Oven Xpress customer account or operational dashboard',
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8">
      {/* Top navigation */}
      <div className="absolute top-4 inset-x-4 flex justify-between items-center max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          &larr; Back to Store
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Oven Xpress</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to order food or track deliveries
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/70 shadow-xl bg-card/95 backdrop-blur">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-xl font-semibold">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your email and password to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                  Loading login form...
                </div>
              }
            >
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        {/* Customer Registration Callout */}
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Hungry customer?{' '}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Create a free customer account &rarr;
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
