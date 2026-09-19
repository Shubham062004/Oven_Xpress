import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LoginForm } from '@/components/auth/login-form';

export const metadata = {
  title: 'Sign In',
  description: 'Sign in to Oven Xpress Restaurant Management System',
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 sm:px-6 lg:px-8">
      {/* Top right theme switcher */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <span className="text-lg font-bold tracking-wider">OX</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Oven Xpress</h1>
          <p className="text-sm text-muted-foreground">
            Multi-Branch Restaurant Management
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/70 shadow-md">
          <CardHeader className="space-y-1 pb-4 text-center">
            <CardTitle className="text-xl font-semibold">Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your operational dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading login form...</div>}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        {/* Security & Support note */}
        <p className="text-center text-xs text-muted-foreground">
          Protected by role-based authorization. For account creation, please contact your restaurant owner.
        </p>
      </div>
    </div>
  );
}
