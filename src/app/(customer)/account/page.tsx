import React from 'react';
import Image from 'next/image';
import { requireAuthentication } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import {
  Mail,
  Phone,
  Receipt,
  LogOut,
  ChevronRight,
  ShoppingBag,
  Bug,
  Edit3,
  Heart,
} from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import { SavedAddressesCard } from '@/components/customer/saved-addresses-card';
import { ReorderButton } from '@/components/customer/reorder-button';
import type { SavedCustomerAddress } from '@/lib/customer/customer-profile-actions';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'My Account | Oven Xpress',
  description: 'Manage your Oven Xpress customer profile, saved addresses, and orders.',
};

export default async function CustomerAccountPage() {
  const user = await requireAuthentication('/account');

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
      createdAt: true,
      addresses: true,
      customer: {
        select: {
          id: true,
          phone: true,
          address: true,
        },
      },
    },
  });

  const rawAddresses = (dbUser?.addresses as unknown) || [];
  const savedAddresses: SavedCustomerAddress[] = Array.isArray(rawAddresses)
    ? (rawAddresses as SavedCustomerAddress[])
    : [];

  // Strictly query ONLY the authenticated user's orders with full item details for reordering
  const recentOrders = await prisma.order.findMany({
    where: {
      OR: [
        { createdBy: user.id },
        ...(dbUser?.customer?.id ? [{ customerId: dbUser.customer.id }] : []),
      ],
    },
    take: 3,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      orderType: true,
      totalAmount: true,
      createdAt: true,
      branch: {
        select: {
          id: true,
          slug: true,
          name: true,
          phone: true,
          address: true,
        },
      },
      items: {
        select: {
          id: true,
          menuItemId: true,
          itemName: true,
          quantity: true,
          unitPrice: true,
          menuItem: {
            select: {
              id: true,
              name: true,
              price: true,
              imageUrl: true,
              description: true,
            },
          },
        },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Profile Header */}
      <div className="bg-card rounded-3xl border border-border/70 p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {dbUser?.avatarUrl ? (
            <div className="relative size-16 sm:size-20 rounded-3xl overflow-hidden border-2 border-border/70 shadow-lg shadow-orange-500/15 shrink-0">
              <Image
                src={dbUser.avatarUrl}
                alt={dbUser.name}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="size-16 sm:size-20 rounded-3xl bg-linear-to-br from-amber-500 to-orange-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-orange-500/25 shrink-0">
              {dbUser?.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              {dbUser?.name} 
            <Link
            href="/account/profile"
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity"
          >
            <Edit3 className="size-3.5" />
            {/* <span>Profile & Settings</span> */}
          </Link>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="size-3.5" />
              <span>{dbUser?.email}</span>
            </p>
            {(dbUser?.phone || dbUser?.customer?.phone) && (
              <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5">
                <Phone className="size-3.5" />
                <span>{dbUser.phone || dbUser.customer?.phone}</span>
              </p>
            )}
          </div>
        </div>

        {/* Account Header Actions */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 shrink-0">
          

          <Link
            href="/account/wishlist"
            className="px-3.5 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors"
          >
            <Heart className="size-3.5 text-amber-500 fill-amber-500/20" />
            <span>Wishlist</span>
          </Link>

          <Link
            href="/report-bug"
            className="px-3.5 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold text-foreground flex items-center justify-center gap-1.5 transition-colors"
          >
            <Bug className="size-3.5 text-orange-500" />
            <span>Report a Bug</span>
          </Link>

          {/* Logout Form */}
          <form action={logoutAction} className="inline-flex">
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Saved Addresses */}
        <SavedAddressesCard
          initialAddresses={savedAddresses}
          defaultCustomerAddress={dbUser?.customer?.address || null}
        />

        {/* Recent Orders Overview */}
        <div className="bg-card rounded-2xl border border-border/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Receipt className="size-4 text-primary" />
              <span>Recent Orders</span>
            </h2>

            <Link
              href="/account/orders"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-muted-foreground">You haven&apos;t placed any orders yet.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs"
              >
                <ShoppingBag className="size-3.5" />
                <span>Explore Menu</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="group p-3.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-muted/30 transition-all text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/track/${order.orderNumber}`}
                      className="space-y-0.5 hover:underline block flex-1 min-w-0"
                    >
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors block truncate">
                        #{order.orderNumber}
                      </span>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {order.branch.name} • {new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </p>
                    </Link>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span className="font-black text-foreground block">
                          ₹{Number(order.totalAmount).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">
                          {order.status}
                        </span>
                      </div>

                      <ReorderButton
                        orderNumber={order.orderNumber}
                        items={order.items.map((i) => ({
                          id: i.menuItemId || i.id,
                          name: i.itemName,
                          price: i.menuItem?.price ? Number(i.menuItem.price) : Number(i.unitPrice),
                          quantity: i.quantity,
                          imageUrl: i.menuItem?.imageUrl,
                          description: i.menuItem?.description || undefined,
                        }))}
                        branch={order.branch}
                        orderType={order.orderType}
                        variant="compact"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Support & Bug Reporting */}
      {/* <div className="bg-card rounded-2xl border border-border/70 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Bug className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Technical Issue or System Glitch?
            </h3>
            <p className="text-xs text-muted-foreground">
              Report checkout issues, visual bugs, or broken pages directly to our engineering team.
            </p>
          </div>
        </div>

        <Link
          href="/report-bug"
          className="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <span>Report a Bug</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </div> */}
    </div>
  );
}
