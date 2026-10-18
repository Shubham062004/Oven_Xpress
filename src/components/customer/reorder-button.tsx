'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCart, type BranchInfo, type OrderType } from '@/context/cart-context';

export interface ReorderItemData {
  id: string; // menuItemId
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  description?: string;
}

export interface ReorderButtonProps {
  orderNumber?: string;
  items: ReorderItemData[];
  branch?: BranchInfo | null;
  orderType?: OrderType;
  variant?: 'primary' | 'outline' | 'compact' | 'ghost';
  className?: string;
  label?: string;
}

export function ReorderButton({
  items,
  branch,
  orderType,
  variant = 'primary',
  className = '',
  label = 'Reorder',
}: ReorderButtonProps) {
  const router = useRouter();
  const { reorderItems } = useCart();
  const [isLoading, setIsLoading] = useState(false);

  const handleReorder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!items || items.length === 0) {
      toast.error('No items found in this order to reorder.');
      return;
    }

    setIsLoading(true);
    try {
      reorderItems(
        items.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          imageUrl: i.imageUrl,
          quantity: i.quantity || 1,
          description: i.description,
        })),
        branch,
        orderType
      );

      const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
      toast.success(`Added ${totalQty} item${totalQty > 1 ? 's' : ''} to your cart!`);
      router.push('/cart');
    } catch (err) {
      console.error('Reorder error:', err);
      toast.error('Failed to add items to cart.');
      setIsLoading(false);
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleReorder}
        disabled={isLoading}
        title="Reorder this past order"
        aria-label="Reorder past order"
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-[11px] transition-all cursor-pointer disabled:opacity-60 shrink-0 ${className}`}
      >
        {isLoading ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <RotateCcw className="size-3" />
        )}
        <span>{isLoading ? 'Adding...' : label}</span>
      </button>
    );
  }

  if (variant === 'outline') {
    return (
      <button
        type="button"
        onClick={handleReorder}
        disabled={isLoading}
        title="Reorder this past order"
        aria-label="Reorder past order"
        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-border/80 hover:border-primary/50 bg-card hover:bg-muted text-foreground hover:text-primary font-bold text-xs transition-all cursor-pointer disabled:opacity-60 ${className}`}
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RotateCcw className="size-3.5" />
        )}
        <span>{isLoading ? 'Adding to Cart...' : label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleReorder}
      disabled={isLoading}
      title="Reorder this past order"
      aria-label="Reorder past order"
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:opacity-95 text-primary-foreground font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-60 ${className}`}
    >
      {isLoading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RotateCcw className="size-3.5" />
      )}
      <span>{isLoading ? 'Adding to Cart...' : label}</span>
    </button>
  );
}
