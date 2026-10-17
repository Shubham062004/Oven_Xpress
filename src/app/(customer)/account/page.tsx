import React from 'react';
import Image from 'next/image';
import { requireAuthentication } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import Link from 'next/link';
import {
  Mail,
  Phone,
  MapPin,
  Receipt,
  LogOut,
  ChevronRight,
  Home,
  Briefcase,
  ShoppingBag,
  Bug,
  Edit3,
  Heart,
} from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import type { Metadata } from 'next';

interface SavedAddress {
  id?: string;
  label?: string;
  street: string;
  city: string;
  pincode?: string;
}

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
          orders: {
            take: 3,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              totalAmount: true,
              createdAt: true,
              branch: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const rawAddresses = (dbUser?.addresses as unknown) || [];
  const savedAddresses: SavedAddress[] = Array.isArray(rawAddresses) ? (rawAddresses as SavedAddress[]) : [];
  const recentOrders = dbUser?.customer?.orders || [];

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
        <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
          <Link
            href="/account/profile"
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity"
          >
            <Edit3 className="size-3.5" />
            <span>Profile & Settings</span>
          </Link>

          <Link
            href="/account/wishlist"
            className="px-3.5 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Heart className="size-3.5 text-amber-500 fill-amber-500/20" />
            <span>Wishlist</span>
          </Link>

          {/* Logout Form */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Saved Addresses */}
        <div className="bg-card rounded-2xl border border-border/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              <span>Saved Delivery Addresses</span>
            </h2>
          </div>

          {savedAddresses.length === 0 && !dbUser?.customer?.address ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No saved addresses yet. Addresses will be saved automatically when you place orders.
            </p>
          ) : (
            <div className="space-y-2.5">
              {savedAddresses.map((addr: SavedAddress, idx: number) => (
                <div
                  key={addr.id || idx}
                  className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1"
                >
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    {addr.label === 'Work' ? (
                      <Briefcase className="size-3.5 text-primary" />
                    ) : (
                      <Home className="size-3.5 text-primary" />
                    )}
                    <span>{addr.label || `Address ${idx + 1}`}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {addr.street}, {addr.city} {addr.pincode}
                  </p>
                </div>
              ))}

              {dbUser?.customer?.address && savedAddresses.length === 0 && (
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Home className="size-3.5 text-primary" />
                    <span>Default Delivery Address</span>
                  </div>
                  <p className="text-muted-foreground">{dbUser.customer.address}</p>
                </div>
              )}
            </div>
          )}
        </div>

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
                <Link
                  key={order.id}
                  href={`/track/${order.orderNumber}`}
                  className="group block p-3.5 rounded-xl border border-border/60 hover:border-primary/40 bg-muted/20 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                        #{order.orderNumber}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {order.branch.name} • {new Date(order.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-foreground block">
                        ₹{Number(order.totalAmount).toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">
                        {order.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Support & Bug Reporting */}
      <div className="bg-card rounded-2xl border border-border/70 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
      </div>
    </div>
  );
}
