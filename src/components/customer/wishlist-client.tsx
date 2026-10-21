'use client';

import React, { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Heart,
  ShoppingBag,
  Trash2,
  Clock,
  ArrowRight,
  Plus,
  Minus,
  Sparkles,
  MapPin,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import { useWishlist } from '@/context/wishlist-context';
import { useCart } from '@/context/cart-context';
import {
  getGuestWishlistItemsAction,
  getWishlistItemsAction,
} from '@/lib/customer/wishlist-actions';
import type { WishlistItemData } from '@/lib/customer/wishlist-service';
import { buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';

export function WishlistClient() {
  const { wishlistIds, toggleWishlist, isAuthenticated, isLoading: isWishlistLoading } = useWishlist();
  const { branch, items: cartItems, addItem, updateQuantity } = useCart();

  const [items, setItems] = useState<WishlistItemData[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load full details for wishlisted items, respecting active branch
  useEffect(() => {
    let isCurrent = true;

    async function fetchItems() {
      setIsLoadingItems(true);
      try {
        if (isAuthenticated) {
          const res = await getWishlistItemsAction(branch?.slug);
          if (res.success && isCurrent) {
            setItems(res.items);
          }
        } else {
          const ids = Array.from(wishlistIds);
          if (ids.length === 0) {
            if (isCurrent) setItems([]);
          } else {
            const res = await getGuestWishlistItemsAction(ids, branch?.slug);
            if (res.success && isCurrent) {
              setItems(res.items);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load wishlist item details:', err);
      } finally {
        if (isCurrent) setIsLoadingItems(false);
      }
    }

    if (!isWishlistLoading) {
      fetchItems();
    }

    return () => {
      isCurrent = false;
    };
  }, [wishlistIds, isAuthenticated, isWishlistLoading, branch?.slug]);

  const handleRemove = (id: string) => {
    startTransition(async () => {
      await toggleWishlist(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    });
  };

  const handleAddToCart = (item: WishlistItemData) => {
    if (!item.isAvailable) return;
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      description: item.description || undefined,
      imageUrl: item.imageUrl,
      category: item.categoryName,
      quantity: 1,
    });
  };

  const isVeg = (itemName: string) => {
    const lower = itemName.toLowerCase();
    return (
      !lower.includes('pepperoni') &&
      !lower.includes('chicken') &&
      !lower.includes('beef') &&
      !lower.includes('meat')
    );
  };

  const menuUrl = branch ? `/b/${branch.slug}/menu` : '/';

  if (isWishlistLoading || isLoadingItems) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/60 animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-card rounded-2xl border border-border/70 p-4 space-y-4 animate-pulse"
            >
              <div className="aspect-16/10 rounded-xl bg-muted/60 w-full" />
              <div className="h-4 bg-muted/60 rounded w-3/4" />
              <div className="h-3 bg-muted/40 rounded w-1/2" />
              <div className="h-8 bg-muted/50 rounded-xl w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Heart className="size-3.5 fill-primary text-primary" />
            <span>Saved Favorites</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-0.5">
            My Wishlist
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} {items.length === 1 ? 'item' : 'items'} saved in your personal collection
          </p>
        </div>

        <div className="flex items-center gap-2">
          {branch && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 bg-card text-xs text-muted-foreground">
              <MapPin className="size-3.5 text-primary" />
              <span className="font-medium">{branch.name}</span>
            </div>
          )}
          <Link
            href={menuUrl}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'text-xs font-semibold flex items-center gap-1.5')}
          >
            <span>Browse Menu</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* Guest Mode Callout */}
      {!isAuthenticated && items.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                You&apos;re viewing your temporary guest wishlist
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Sign in to sync your saved items across your devices and save them permanently.
              </p>
            </div>
          </div>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent('/account/wishlist')}`}
            className={cn(buttonVariants({ size: 'sm' }), 'shrink-0 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs')}
          >
            <LogIn className="size-3.5 mr-1.5" />
            <span>Sign In to Sync</span>
          </Link>
        </div>
      )}

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/70 p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4 shadow-xs">
          <div className="size-16 sm:size-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
            <Heart className="size-8 sm:size-10 stroke-[1.5]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Your Wishlist is Empty
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore our artisanal wood-fired pizzas, sourdough garlic breads, and gourmet burgers. Tap the heart icon on any product to save it here for later.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={menuUrl}
              className={cn(buttonVariants({ size: 'default' }), 'font-bold text-xs shadow-md inline-flex items-center gap-2')}
            >
              <ShoppingBag className="size-4" />
              <span>Explore Oven Xpress Menu</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Items Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {items.map((item) => {
            const cartItem = cartItems.find((ci) => ci.id === item.id);
            const inCartQty = cartItem?.quantity || 0;
            const veg = isVeg(item.name);

            return (
              <div
                key={item.id}
                className="group relative bg-card rounded-2xl border border-border/70 hover:border-border overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                {/* Image & Badges */}
                <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center bg-muted/60 text-muted-foreground text-xs">
                      No image available
                    </div>
                  )}

                  {/* Veg Badge */}
                  <div className="absolute top-2.5 left-2.5 bg-background/90 backdrop-blur-xs p-1 rounded-md shadow-xs z-10">
                    <div
                      className={`size-3 rounded-xs border-2 flex items-center justify-center ${
                        veg ? 'border-emerald-600' : 'border-rose-600'
                      }`}
                    >
                      <div
                        className={`size-1.5 rounded-full ${
                          veg ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    disabled={isPending}
                    aria-label="Remove from wishlist"
                    className="absolute top-2.5 right-2.5 z-10 size-8 rounded-full bg-background/90 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border border-border/70 flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-90"
                  >
                    <Trash2 className="size-4" />
                  </button>

                  {/* Unavailable Overlay */}
                  {!item.isAvailable && (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex items-center justify-center z-10">
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-[11px] font-bold shadow-md">
                        <AlertCircle className="size-3.5" />
                        <span>Currently Unavailable</span>
                      </span>
                    </div>
                  )}

                  {/* Prep time badge */}
                  {item.prepTimeMinutes > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                      <Clock className="size-2.5" />
                      <span>{item.prepTimeMinutes}m</span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {item.categoryName}
                    </span>
                    <h3 className="font-bold text-base leading-snug text-foreground group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Cart Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black text-foreground">
                        ₹{item.price.toFixed(2)}
                      </span>
                      {item.originalPrice && item.originalPrice > item.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{item.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div>
                      {!item.isAvailable ? (
                        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg">
                          Sold Out
                        </span>
                      ) : inCartQty > 0 ? (
                        <div className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl p-1 shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="size-7 rounded-lg hover:bg-black/10 active:bg-black/20 flex items-center justify-center transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold">{inCartQty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="size-7 rounded-lg hover:bg-black/10 active:bg-black/20 flex items-center justify-center transition-colors cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs border border-primary/20 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          + ADD TO CART
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
