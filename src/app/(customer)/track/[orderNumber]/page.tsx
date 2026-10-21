import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageX, ArrowLeft, ShieldAlert, LogIn } from 'lucide-react';
import { getCustomerOrderDetails, checkOrderAccess } from '@/lib/customer/order-actions';
import { TrackOrderClient } from './track-order-client';
import { buttonVariants } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface TrackOrderPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: TrackOrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Track Order ${orderNumber}`,
    description: `Live tracking for order ${orderNumber} in Oven Xpress.`,
    referrer: 'no-referrer',
  };
}

export default async function TrackOrderPage({ params, searchParams }: TrackOrderPageProps) {
  const { orderNumber } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token = resolvedSearchParams?.token;

  const access = await checkOrderAccess(orderNumber, token);

  // If order does not exist
  if (!access.exists) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
          <PackageX className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Order Not Found</h1>
        <p className="text-sm text-muted-foreground">
          We could not find an order matching reference{' '}
          <span className="font-mono font-semibold">{orderNumber}</span>. Please verify your order number or check your order history.
        </p>
        <div className="pt-2">
          <Link href="/" className={buttonVariants({ className: 'gap-2' })}>
            <ArrowLeft className="size-4" />
            Return to Menu
          </Link>
        </div>
      </div>
    );
  }

  // If order exists but viewer is unauthorized (e.g. shared URL opened on another device/account)
  if (!access.authorized) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="size-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Private Order &mdash; Access Denied</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Order <span className="font-mono font-bold text-foreground">#{orderNumber}</span> is private and linked to another customer account.
          For privacy and security, order details can only be viewed by the customer who placed this order.
        </p>
        <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href={`/login?callbackUrl=/track/${orderNumber}${token ? `?token=${token}` : ''}`}
            className={buttonVariants({ className: 'gap-2' })}
          >
            <LogIn className="size-4" />
            Log In to Your Account
          </Link>
          <Link
            href="/account/orders"
            className={buttonVariants({ variant: 'outline', className: 'gap-2' })}
          >
            My Order History
          </Link>
        </div>
      </div>
    );
  }

  const order = await getCustomerOrderDetails(orderNumber, token);

  if (!order) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
          <PackageX className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Order Not Found</h1>
        <p className="text-sm text-muted-foreground">
          We could not find an order matching reference{' '}
          <span className="font-mono font-semibold">{orderNumber}</span>.
        </p>
        <div className="pt-2">
          <Link href="/" className={buttonVariants({ className: 'gap-2' })}>
            <ArrowLeft className="size-4" />
            Return to Menu
          </Link>
        </div>
      </div>
    );
  }

  return <TrackOrderClient initialOrder={order} token={token} />;
}
