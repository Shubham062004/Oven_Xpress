import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata = {
  title: 'Page Not Found',
  description: 'The requested page could not be found.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4 sm:p-8">
      <Card className="w-full max-w-md border-border/80 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SearchX className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">404 - Page Not Found</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            The page you are looking for does not exist or may have been moved.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Please check the URL for typos or return to the dashboard to continue managing your restaurant operations.
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row justify-center">
          <Link href="/" className="w-full">
            <Button variant="default" className="w-full gap-2">
              <Home className="size-4" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
