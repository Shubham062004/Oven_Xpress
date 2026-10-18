import React from 'react';
import { getPublicBranches } from '@/lib/customer/branch-service';
import { getCurrentUser } from '@/lib/auth/guards';
import { CartProvider } from '@/context/cart-context';
import { WishlistProvider } from '@/context/wishlist-context';
import { CustomerHeader } from '@/components/customer/customer-header';
import { FloatingCartBar } from '@/components/customer/floating-cart-bar';
import { MobileBottomNav } from '@/components/customer/mobile-bottom-nav';

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branches = await getPublicBranches();
  const user = await getCurrentUser();

  return (
    <CartProvider>
      <WishlistProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
          {/* Sticky Storefront Header */}
          <CustomerHeader branches={branches} user={user} />

          {/* Main Content Area */}
          <main className="flex-1 pb-24 md:pb-12">{children}</main>

          {/* Floating Cart bar for Mobile */}
          <FloatingCartBar />

          {/* Mobile Sticky Bottom Navigation */}
          <MobileBottomNav />
        </div>
      </WishlistProvider>
    </CartProvider>
  );
}
