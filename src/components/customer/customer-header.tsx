'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  MapPin,
  ChevronDown,
  User,
  Search,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { BranchSelectorModal } from './branch-selector-modal';
import type { PublicBranch } from '@/lib/customer/branch-service';

interface CustomerHeaderProps {
  branches: PublicBranch[];
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
}

export function CustomerHeader({ branches, user }: CustomerHeaderProps) {
  const { branch, itemCount, orderType, setOrderType } = useCart();
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  // If no branch selected yet, default to first active branch
  const activeBranch = branch || (branches[0] ? {
    id: branches[0].id,
    slug: branches[0].slug,
    name: branches[0].name,
    address: branches[0].address,
    city: branches[0].city,
    phone: branches[0].phone || undefined,
  } : null);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Left: Brand & Branch Picker */}
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <Link href="/" className="group flex items-center gap-2.5 shrink-0">
                <div className="relative size-9 sm:size-10 rounded-xl overflow-hidden shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform bg-white/90 dark:bg-zinc-900 border border-border/40 flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="Oven Express"
                    fill
                    sizes="40px"
                    className="object-contain p-0.5"
                    priority
                  />
                </div>
                <div className="hidden xs:block">
                  <span className="font-extrabold text-base sm:text-lg tracking-tight text-foreground flex items-center gap-1">
                    Oven<span className="text-primary font-black">Express</span>
                  </span>
                  <span className="block text-[10px] text-muted-foreground uppercase tracking-widest -mt-1 font-semibold">
                    Artisanal Kitchen
                  </span>
                </div>
              </Link>

              {/* Branch Selector Pill */}
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-xs font-medium border border-border/60 transition-colors max-w-[170px] sm:max-w-xs truncate"
              >
                <MapPin className="size-3.5 text-primary shrink-0" />
                <span className="truncate text-foreground">
                  {activeBranch ? activeBranch.name : 'Select Branch'}
                </span>
                <ChevronDown className="size-3 text-muted-foreground shrink-0" />
              </button>
            </div>

            {/* Center: Order Type Toggle (Desktop & Tablet) */}
            <div className="hidden md:flex items-center bg-muted/60 p-1 rounded-full border border-border/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setOrderType('DELIVERY')}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  orderType === 'DELIVERY'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Delivery
              </button>
              <button
                type="button"
                onClick={() => setOrderType('TAKEAWAY')}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Takeaway
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Menu link */}
              {activeBranch && (
                <Link
                  href={`/b/${activeBranch.slug}/menu`}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-muted/80 text-foreground transition-colors"
                >
                  <Search className="size-3.5 text-muted-foreground" />
                  <span>Browse Menu</span>
                </Link>
              )}

              <ThemeToggle />

              {/* Cart Button */}
              <Link
                href="/cart"
                className="relative flex items-center justify-center size-9 sm:size-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                aria-label="View Shopping Cart"
              >
                <ShoppingBag className="size-4 sm:size-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center shadow-xs animate-in zoom-in-75">
                    {itemCount}
                  </span>
                )}
              </Link>

              {/* User Account / Login */}
              {user ? (
                <Link
                  href="/account"
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-border/80 hover:bg-muted/60 transition-colors"
                >
                  <div className="size-6 sm:size-7 rounded-full bg-gradient-to-br from-primary to-orange-500 text-white flex items-center justify-center text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:inline text-xs font-semibold max-w-[90px] truncate">
                    {user.name}
                  </span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 shadow-xs transition-opacity"
                >
                  <User className="size-3.5" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Branch selector drawer/modal */}
      <BranchSelectorModal
        branches={branches}
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
      />
    </>
  );
}
