import React from 'react';
import { requireAuthentication } from '@/lib/auth/guards';
import { getCustomerOrdersAction } from '@/lib/customer/order-actions';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  Package,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Orders | Oven Xpress',
  description: 'View and track all your Oven Xpress orders.',
};

export default async function CustomerOrdersPage() {
  await requireAuthentication('/account/orders');
  const orders = await getCustomerOrdersAction();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Order History
          </h1>
          <p className="text-xs text-muted-foreground">
            Track active deliveries and review your past orders
          </p>
        </div>

        <Link
          href="/account"
          className="text-xs font-semibold text-primary hover:underline"
        >
          &larr; Account Profile
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="size-16 mx-auto rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
            <Package className="size-8 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">No orders found</h2>
            <p className="text-xs text-muted-foreground">
              You haven&apos;t placed any orders with us yet.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
          >
            <span>Start Ordering</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const isCompleted = order.status === 'COMPLETED';
            const isCancelled = order.status === 'CANCELLED';

            return (
              <div
                key={order.id}
                className="bg-card rounded-2xl border border-border/70 p-5 shadow-xs hover:border-primary/40 transition-all space-y-4"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-foreground">
                        #{order.orderNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : isCancelled
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 animate-pulse'
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-[10px] font-semibold uppercase bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md">
                        {order.orderType}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {order.branchName} •{' '}
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <Link
                    href={`/track/${order.orderNumber}`}
                    className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs transition-colors"
                  >
                    <span>Track Order</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>

                {/* Items preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2.5 text-muted-foreground">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="size-8 rounded-lg object-cover shrink-0 border border-border/40"
                      />
                      <span className="font-semibold text-foreground truncate">
                        {item.quantity}x {item.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer with totals */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <div className="text-muted-foreground">
                    <span>Payment: </span>
                    <span className="font-semibold text-foreground uppercase">
                      {order.paymentMethod}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-muted-foreground mr-1.5">Total Paid:</span>
                    <span className="font-black text-sm text-foreground">
                      ₹{order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
