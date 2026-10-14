import React from 'react';
import { getPublicBranches } from '@/lib/customer/branch-service';
import { getCurrentUser } from '@/lib/auth/guards';
import { CartProvider } from '@/context/cart-context';
import { CustomerHeader } from '@/components/customer/customer-header';
import { FloatingCartBar } from '@/components/customer/floating-cart-bar';
import { MobileBottomNav } from '@/components/customer/mobile-bottom-nav';
import Link from 'next/link';
import { UtensilsCrossed, Heart, ShieldCheck, Clock, MapPin, Sparkles } from 'lucide-react';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branches = await getPublicBranches();
  const user = await getCurrentUser();

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
        {/* Sticky Storefront Header */}
        <CustomerHeader branches={branches} user={user} />

        {/* Main Content Area */}
        <main className="flex-1 pb-24 md:pb-12">{children}</main>

        {/* Floating Cart bar for Mobile */}
        <FloatingCartBar />

        {/* Mobile Sticky Bottom Navigation */}
        <MobileBottomNav />

        {/* Footer */}
        <footer className="border-t border-border/60 bg-muted/20 py-10 px-4 sm:px-6 lg:px-8 hidden md:block">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                  <UtensilsCrossed className="size-4" />
                </div>
                <span className="font-extrabold text-base">Oven Xpress</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Artisanal sourdough pizzas, wood-fired gourmet burgers, and fresh baked goods delivered fast and hot.
              </p>
              <p className="text-muted-foreground/80 flex items-center gap-1 text-[11px]">
                Made with <Heart className="size-3 text-rose-500 fill-rose-500" /> for food lovers.
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-sm tracking-wide text-foreground">Menu & Order</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/b/bandra-west/menu" className="hover:text-primary transition-colors">
                    Artisanal Pizzas
                  </Link>
                </li>
                <li>
                  <Link href="/b/bandra-west/menu" className="hover:text-primary transition-colors">
                    Garlic Breads & Sourdough
                  </Link>
                </li>
                <li>
                  <Link href="/b/bandra-west/menu" className="hover:text-primary transition-colors">
                    Gourmet Burgers
                  </Link>
                </li>
                <li>
                  <Link href="/cart" className="hover:text-primary transition-colors">
                    View Cart
                  </Link>
                </li>
              </ul>
            </div>

            {/* Branches */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-sm tracking-wide text-foreground">Our Kitchens</h4>
              <ul className="space-y-2 text-muted-foreground">
                {branches.slice(0, 4).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/b/${b.slug}/menu`}
                      className="hover:text-primary transition-colors flex items-center gap-1"
                    >
                      <MapPin className="size-3 text-muted-foreground/60" />
                      <span>{b.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account & Policies */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-sm tracking-wide text-foreground">Customer Care</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link href="/account" className="hover:text-primary transition-colors">
                    My Account
                  </Link>
                </li>
                <li>
                  <Link href="/account/orders" className="hover:text-primary transition-colors">
                    Past Orders
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-primary transition-colors">
                    Staff Portal
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto border-t border-border/40 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} Oven Xpress Inc. All rights reserved.</span>
            <div className="flex gap-4">
              <span>Privacy Policy</span>
              <span>•</span>
              <span>Terms of Service</span>
              <span>•</span>
              <span>Food Safety Assured</span>
            </div>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
