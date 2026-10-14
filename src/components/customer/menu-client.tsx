'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Phone,
  Flame,
  Check,
  Filter,
  Sparkles,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { ItemCard } from './item-card';
import type { BranchMenuData } from '@/lib/customer/menu-service';

interface MenuClientProps {
  data: BranchMenuData;
}

export function MenuClient({ data }: MenuClientProps) {
  const { branch: selectedBranch, setBranch } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vegOnly, setVegOnly] = useState<boolean>(false);

  // Sync active branch into cart context
  useEffect(() => {
    if (selectedBranch?.id !== data.branch.id) {
      setBranch({
        id: data.branch.id,
        slug: data.branch.slug,
        name: data.branch.name,
        address: data.branch.address,
        city: data.branch.city,
        phone: data.branch.phone || undefined,
      });
    }
  }, [data.branch, selectedBranch?.id, setBranch]);

  // Flatten items for filtering
  const allItems = data.categories.flatMap((cat) => cat.items);

  const filteredItems = allItems.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.categoryId === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const isItemVeg =
      !item.name.toLowerCase().includes('pepperoni') &&
      !item.name.toLowerCase().includes('chicken') &&
      !item.name.toLowerCase().includes('beef') &&
      !item.name.toLowerCase().includes('meat');

    const matchesVeg = !vegOnly || isItemVeg;

    return matchesCategory && matchesSearch && matchesVeg;
  });

  return (
    <div className="space-y-6">
      {/* Branch Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-stone-900 to-neutral-900 text-white p-5 sm:p-7 shadow-lg border border-border/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white">
                {data.branch.name}
              </h1>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  data.branch.isOpenNow
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {data.branch.isOpenNow ? 'OPEN NOW' : 'CLOSED'}
              </span>
            </div>

            <p className="text-xs text-neutral-300 flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary shrink-0" />
              <span>
                {data.branch.address}, {data.branch.city}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-400 pt-1">
              {data.branch.openingTime && data.branch.closingTime && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  <span>
                    {data.branch.openingTime} – {data.branch.closingTime}
                  </span>
                </span>
              )}
              {data.branch.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5" />
                  <span>{data.branch.phone}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Flame className="size-3.5" />
                <span>Wood-Fired Kitchen</span>
              </span>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 bg-white/10 px-4 py-2 rounded-2xl border border-white/10 text-xs">
            <Clock className="size-4 text-primary" />
            <div>
              <span className="block text-[10px] text-white/70">Estimated Delivery</span>
              <span className="font-bold text-white">25 - 35 mins</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Search & Category Filter Controls */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-md pt-2 pb-3 border-b border-border/60 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 space-y-3">
        {/* Search bar and Veg toggle */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search pizza, sourdough, burgers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-muted/50 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Veg Only Toggle */}
          <button
            type="button"
            onClick={() => setVegOnly((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
              vegOnly
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted/40 border-border/80 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="size-3 rounded-xs border-2 border-emerald-600 flex items-center justify-center">
              <div className="size-1.5 rounded-full bg-emerald-600" />
            </div>
            <span>Veg Only</span>
          </button>
        </div>

        {/* Categories Horizontal Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            All Items ({allItems.length})
          </button>

          {data.categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>
      </div>

      {/* Items Section */}
      <div>
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <p className="font-bold text-base text-foreground">No dishes found</p>
            <p className="text-xs text-muted-foreground">
              Try adjusting your search terms or dietary filters.
            </p>
          </div>
        ) : activeCategory === 'all' && !searchQuery && !vegOnly ? (
          // Grouped by Category when no filters active
          <div className="space-y-8">
            {data.categories.map((category) => (
              <div key={category.id} className="space-y-3.5">
                <div className="border-b border-border/50 pb-2">
                  <h2 className="text-lg font-black tracking-tight text-foreground">
                    {category.name}
                  </h2>
                  {category.description && (
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.items.map((item) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat filtered grid
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
