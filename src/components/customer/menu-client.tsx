'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Phone,
  Flame,
  Check,
  ChevronDown,
  X,
  UtensilsCrossed,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { ItemCard } from './item-card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { isItemVeg, type BranchMenuData } from '@/lib/customer/menu-service';

interface MenuClientProps {
  data: BranchMenuData;
}

export type DietaryFilter = 'ALL' | 'VEG' | 'NON_VEG';

export function MenuClient({ data }: MenuClientProps) {
  const { branch: selectedBranch, setBranch } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>('ALL');

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

  const vegCount = allItems.filter((i) => isItemVeg(i)).length;
  const nonVegCount = allItems.filter((i) => !isItemVeg(i)).length;

  const filteredItems = allItems.filter((item) => {
    const matchesCategory =
      activeCategory === 'all' || item.categoryId === activeCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (item.description &&
        item.description.toLowerCase().includes(searchQuery.toLowerCase().trim()));

    const isVeg = isItemVeg(item);
    const matchesDietary =
      dietaryFilter === 'ALL' ||
      (dietaryFilter === 'VEG' && isVeg) ||
      (dietaryFilter === 'NON_VEG' && !isVeg);

    return matchesCategory && matchesSearch && matchesDietary;
  });

  // Calculate dynamic counts per category matching the active dietary filter
  const getCategoryCount = (categoryId: string) => {
    const items =
      categoryId === 'all'
        ? allItems
        : data.categories.find((c) => c.id === categoryId)?.items || [];

    return items.filter((item) => {
      const isVeg = isItemVeg(item);
      return (
        dietaryFilter === 'ALL' ||
        (dietaryFilter === 'VEG' && isVeg) ||
        (dietaryFilter === 'NON_VEG' && !isVeg)
      );
    }).length;
  };

  // Grouped by Category with dietary filtering applied per section
  const categoriesWithFilteredItems = data.categories
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        const isVeg = isItemVeg(item);
        return (
          dietaryFilter === 'ALL' ||
          (dietaryFilter === 'VEG' && isVeg) ||
          (dietaryFilter === 'NON_VEG' && !isVeg)
        );
      }),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <div className="space-y-6">
      {/* Branch Header Banner */}
      <div className="rounded-3xl bg-linear-to-r from-stone-900 to-neutral-900 text-white p-5 sm:p-7 shadow-lg border border-border/20">
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
        {/* Search bar and Dietary Dropdown */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search pizza, burgers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-8 py-2.5 text-xs sm:text-sm bg-muted/50 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Dietary Dropdown (All / Veg / Non-Veg) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs ${
                    dietaryFilter === 'VEG'
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                      : dietaryFilter === 'NON_VEG'
                      ? 'bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-400'
                      : 'bg-muted/40 border-border/80 text-foreground hover:bg-muted/70'
                  }`}
                  aria-label="Dietary preference filter"
                />
              }
            >
              {dietaryFilter === 'VEG' ? (
                <>
                  <div className="size-3.5 rounded-xs border-2 border-emerald-600 flex items-center justify-center shrink-0">
                    <div className="size-1.5 rounded-full bg-emerald-600" />
                  </div>
                  <span>Veg</span>
                </>
              ) : dietaryFilter === 'NON_VEG' ? (
                <>
                  <div className="size-3.5 rounded-xs border-2 border-rose-600 flex items-center justify-center shrink-0">
                    <div className="size-1.5 rounded-full bg-rose-600" />
                  </div>
                  <span>Non-Veg</span>
                </>
              ) : (
                <>
                  <div className="flex items-center -space-x-1 shrink-0">
                    <div className="size-2 rounded-full bg-emerald-600 border border-background" />
                    <div className="size-2 rounded-full bg-rose-600 border border-background" />
                  </div>
                  <span>All</span>
                </>
              )}
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0 ml-0.5" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52 p-1.5 space-y-1">
              {/* All Items Option */}
              <DropdownMenuItem
                onClick={() => setDietaryFilter('ALL')}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  dietaryFilter === 'ALL'
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center -space-x-1 shrink-0">
                    <div className="size-2.5 rounded-full bg-emerald-600 border border-background" />
                    <div className="size-2.5 rounded-full bg-rose-600 border border-background" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold leading-tight">All Dishes</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      Veg & Non-Veg ({allItems.length})
                    </div>
                  </div>
                </div>
                {dietaryFilter === 'ALL' && <Check className="size-3.5 text-primary shrink-0" />}
              </DropdownMenuItem>

              {/* Veg Only Option */}
              <DropdownMenuItem
                onClick={() => setDietaryFilter('VEG')}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  dietaryFilter === 'VEG'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-3.5 rounded-xs border-2 border-emerald-600 flex items-center justify-center shrink-0">
                    <div className="size-1.5 rounded-full bg-emerald-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold leading-tight text-emerald-700 dark:text-emerald-400">
                      Pure Veg
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      Vegetarian dishes ({vegCount})
                    </div>
                  </div>
                </div>
                {dietaryFilter === 'VEG' && <Check className="size-3.5 text-emerald-600 shrink-0" />}
              </DropdownMenuItem>

              {/* Non-Veg Option */}
              <DropdownMenuItem
                onClick={() => setDietaryFilter('NON_VEG')}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  dietaryFilter === 'NON_VEG'
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-3.5 rounded-xs border-2 border-rose-600 flex items-center justify-center shrink-0">
                    <div className="size-1.5 rounded-full bg-rose-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold leading-tight text-rose-700 dark:text-rose-400">
                      Non-Veg
                    </div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      Chicken, meat & seafood ({nonVegCount})
                    </div>
                  </div>
                </div>
                {dietaryFilter === 'NON_VEG' && <Check className="size-3.5 text-rose-600 shrink-0" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
            All Items ({getCategoryCount('all')})
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
              {cat.name} ({getCategoryCount(cat.id)})
            </button>
          ))}
        </div>
      </div>

      {/* Items Section */}
      <div>
        {filteredItems.length === 0 ? (
          <div className="py-14 text-center space-y-3 bg-card/50 rounded-2xl border border-dashed border-border/80">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <UtensilsCrossed className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-base text-foreground">No dishes found</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No items match your {dietaryFilter !== 'ALL' ? (dietaryFilter === 'VEG' ? 'vegetarian' : 'non-vegetarian') : ''} search criteria.
              </p>
            </div>
            {(dietaryFilter !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setDietaryFilter('ALL');
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : activeCategory === 'all' && !searchQuery ? (
          // Grouped by Category when viewing all categories without search query
          <div className="space-y-8">
            {categoriesWithFilteredItems.map((category) => (
              <div key={category.id} className="space-y-3.5">
                <div className="border-b border-border/50 pb-2 flex items-baseline justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-foreground">
                      {category.name}
                    </h2>
                    {category.description && (
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
                  </span>
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
