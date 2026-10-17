'use client';

import React from 'react';
import Image from 'next/image';
import { Plus, Minus, Clock } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { WishlistButton } from './wishlist-button';
import type { PublicMenuItem } from '@/lib/customer/menu-service';

interface ItemCardProps {
  item: PublicMenuItem;
}

export function ItemCard({ item }: ItemCardProps) {
  const { items, addItem, updateQuantity } = useCart();

  const cartItem = items.find((i) => i.id === item.id);
  const inCartQty = cartItem?.quantity || 0;

  const handleAdd = () => {
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

  const isVeg = !item.name.toLowerCase().includes('pepperoni') &&
    !item.name.toLowerCase().includes('chicken') &&
    !item.name.toLowerCase().includes('beef') &&
    !item.name.toLowerCase().includes('meat');

  return (
    <div className="group relative bg-card rounded-2xl border border-border/70 hover:border-border overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Image container */}
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

        {/* Veg / Non-Veg Badge */}
        <div className="absolute top-2.5 left-2.5 bg-background/90 backdrop-blur-xs p-1 rounded-md shadow-xs z-10">
          <div
            className={`size-3 rounded-xs border-2 flex items-center justify-center ${
              isVeg ? 'border-emerald-600' : 'border-rose-600'
            }`}
          >
            <div
              className={`size-1.5 rounded-full ${
                isVeg ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            />
          </div>
        </div>

        {/* Wishlist Heart Button */}
        <WishlistButton
          menuItemId={item.id}
          size="sm"
          className="absolute top-2.5 right-2.5 z-10"
        />

        {/* Prep time badge */}
        {item.prepTimeMinutes > 0 && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
            <Clock className="size-2.5" />
            <span>{item.prepTimeMinutes}m</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-sm sm:text-base leading-snug text-foreground group-hover:text-primary transition-colors">
              {item.name}
            </h3>
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Price & Cart Actions */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-foreground">
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
                  className="size-7 rounded-lg hover:bg-black/10 active:bg-black/20 flex items-center justify-center transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-5 text-center text-xs font-bold">{inCartQty}</span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.id, 1)}
                  className="size-7 rounded-lg hover:bg-black/10 active:bg-black/20 flex items-center justify-center transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAdd}
                className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs border border-primary/20 shadow-2xs hover:shadow-xs transition-all active:scale-95"
              >
                + ADD
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
