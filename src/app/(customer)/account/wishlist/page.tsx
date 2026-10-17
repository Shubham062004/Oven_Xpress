import React from 'react';
import type { Metadata } from 'next';
import { WishlistClient } from '@/components/customer/wishlist-client';

export const metadata: Metadata = {
  title: 'My Wishlist | Oven Xpress',
  description: 'View and manage your saved pizzas, burgers, garlic breads, and treats at Oven Xpress.',
};

export default function WishlistPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <WishlistClient />
    </div>
  );
}
