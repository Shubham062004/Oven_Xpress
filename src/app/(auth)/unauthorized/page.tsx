import Link from 'next/link';
import { ArrowLeft, LogOut, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { logoutAction } from '@/lib/auth/actions';

export const metadata = {
  title: 'Access Denied',
  description: 'You do not have permission to access this resource.',
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 sm:p-8">
      <Card className="w-full max-w-md border-border/80 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">403 - Access Denied</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            You do not have the required permissions to view or perform operations on this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          If you believe you should have access to this section, please contact your restaurant owner or system administrator to adjust your role permissions.
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Link href="/" className="w-full sm:w-1/2">
            <Button variant="default" className="w-full gap-2">
              <ArrowLeft className="size-4" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
          <form action={logoutAction} className="w-full sm:w-1/2">
            <Button variant="outline" type="submit" className="w-full gap-2">
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
