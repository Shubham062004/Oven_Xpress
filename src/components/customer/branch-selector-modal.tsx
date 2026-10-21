'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Clock,
  Check,
  Search,
  X,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { useRouter, usePathname } from 'next/navigation';

export interface BranchSelectorProps {
  branches: Array<{
    id: string;
    name: string;
    slug: string;
    address: string;
    city: string;
    phone: string | null;
    openingTime: string | null;
    closingTime: string | null;
    isOpenNow: boolean;
  }>;
  isOpen: boolean;
  onClose: () => void;
}

export function BranchSelectorModal({
  branches,
  isOpen,
  onClose,
}: BranchSelectorProps) {
  const { branch, setBranch } = useCart();
  const [search, setSearch] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  if (!isOpen) return null;

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.address.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (selected: (typeof branches)[0]) => {
    setBranch({
      id: selected.id,
      slug: selected.slug,
      name: selected.name,
      address: selected.address,
      city: selected.city,
      phone: selected.phone || undefined,
    });
    onClose();

    // Only switch URL if the user is already browsing a branch-specific route (e.g. /b/[branchSlug]/menu)
    if (pathname.startsWith('/b/')) {
      const segments = pathname.split('/');
      if (segments.length >= 3 && segments[1] === 'b') {
        segments[2] = selected.slug;
        router.push(segments.join('/'));
        return;
      }
    }

    // Otherwise stay on the exact same page
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-background rounded-t-3xl sm:rounded-2xl border border-border/80 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative size-9 rounded-xl overflow-hidden bg-white/95 dark:bg-zinc-900 border border-border/60 shadow-sm flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Oven Xpress"
                fill
                sizes="36px"
                className="object-contain p-0.5"
              />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Select Branch</h2>
              <p className="text-xs text-muted-foreground">
                Choose an Oven Xpress branch near you
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by area, branch name, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Branch List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-border/20">
          {filteredBranches.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs sm:text-sm">
              No branches found matching &quot;{search}&quot;
            </div>
          ) : (
            filteredBranches.map((b) => {
              const isSelected = branch?.id === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => handleSelect(b)}
                  className={`pt-2.5 first:pt-0 group flex items-start justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/5 border border-primary/30 shadow-xs'
                      : 'hover:bg-muted/40 border border-transparent'
                  }`}
                >
                  <div className="space-y-1 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {b.name}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          b.isOpenNow
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {b.isOpenNow ? 'Open Now' : 'Closed'}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3 shrink-0 text-muted-foreground/70" />
                      <span>{b.address}, {b.city}</span>
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground/80 pt-0.5">
                      {b.openingTime && b.closingTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {b.openingTime} – {b.closingTime}
                        </span>
                      )}
                      {b.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" />
                          {b.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    {isSelected ? (
                      <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="size-3.5 stroke-3" />
                      </div>
                    ) : (
                      <div className="size-6 rounded-full text-muted-foreground/40 group-hover:text-primary flex items-center justify-center">
                        <ChevronRight className="size-4" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
