import type { Metadata } from 'next';
import Link from 'next/link';
import { PackageX, ArrowLeft } from 'lucide-react';
import { getCustomerOrderDetails } from '@/lib/customer/order-actions';
import { TrackOrderClient } from './track-order-client';
import { buttonVariants } from '@/components/ui/button';

interface TrackOrderPageProps {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: TrackOrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `Track Order ${orderNumber}`,
    description: `Live tracking for order ${orderNumber} in Oven Express.`,
    referrer: 'no-referrer',
  };
}

export default async function TrackOrderPage({ params, searchParams }: TrackOrderPageProps) {
  const { orderNumber } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const token = resolvedSearchParams?.token;
  const order = await getCustomerOrderDetails(orderNumber, token);

  if (!order) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
          <PackageX className="size-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Order Not Found</h1>
        <p className="text-sm text-muted-foreground">
          We could not find an order matching reference <span className="font-mono font-semibold">{orderNumber}</span>. Please verify your order number or check your order history.
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
