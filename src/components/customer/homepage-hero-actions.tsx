'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/cart-context';

interface HomepageHeroActionsProps {
  defaultBranchSlug?: string;
}

export function HomepageHeroActions({ defaultBranchSlug }: HomepageHeroActionsProps) {
  const router = useRouter();
  const { branch, setOrderType } = useCart();

  const targetSlug = branch?.slug || defaultBranchSlug;

  const handleOrderAhead = () => {
    setOrderType('TAKEAWAY');
    if (targetSlug) {
      router.push(`/b/${targetSlug}/menu`);
    } else {
      const el = document.getElementById('branches');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleExploreMenu = () => {
    if (targetSlug) {
      router.push(`/b/${targetSlug}/menu`);
    } else {
      const el = document.getElementById('branches');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
      <button
        type="button"
        onClick={handleOrderAhead}
        className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 group transition-all active:scale-[0.98] cursor-pointer"
      >
        <Clock className="size-4 shrink-0" />
        <span>Order Ahead</span>
        <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform shrink-0" />
      </button>

      <button
        type="button"
        onClick={handleExploreMenu}
        className="px-6 py-3.5 rounded-xl bg-card hover:bg-muted text-foreground font-semibold text-sm border border-border/80 flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer"
      >
        <ShoppingBag className="size-4 text-primary shrink-0" />
        <span>Explore Menu</span>
      </button>
    </div>
  );
}

export function OrderAheadCtaButton({ defaultBranchSlug }: HomepageHeroActionsProps) {
  const router = useRouter();
  const { branch, setOrderType } = useCart();

  const targetSlug = branch?.slug || defaultBranchSlug;

  const handleOrderAhead = () => {
    setOrderType('TAKEAWAY');
    if (targetSlug) {
      router.push(`/b/${targetSlug}/menu`);
    } else {
      const el = document.getElementById('branches');
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleOrderAhead}
      className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
    >
      <Clock className="size-4 shrink-0" />
      <span>Order Ahead for Pickup</span>
      <ArrowRight className="size-4 shrink-0" />
    </button>
  );
}
