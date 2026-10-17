'use client';

import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useWishlist } from '@/context/wishlist-context';
import { cn } from 'cn';

interface WishlistButtonProps {
  menuItemId: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onToggle?: (inWishlist: boolean) => void;
}

export function WishlistButton({
  menuItemId,
  className,
  size = 'md',
  onToggle,
}: WishlistButtonProps) {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFavorited = isInWishlist(menuItemId);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const nextState = await toggleWishlist(menuItemId);
      onToggle?.(nextState);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sizeClasses = {
    sm: 'size-7 p-1',
    md: 'size-8.5 sm:size-9 p-1.5',
    lg: 'size-10 p-2',
  }[size];

  const iconSizes = {
    sm: 'size-3.5',
    md: 'size-4.5',
    lg: 'size-5',
  }[size];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSubmitting}
      aria-label={isFavorited ? 'Remove from wishlist' : 'Add to wishlist'}
      className={cn(
        'group/heart relative rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none active:scale-90',
        'bg-background/90 hover:bg-background backdrop-blur-md border border-border/70 hover:border-border shadow-xs hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        sizeClasses,
        className
      )}
    >
      <Heart
        className={cn(
          'transition-all duration-200 shrink-0',
          iconSizes,
          isFavorited
            ? 'fill-amber-500 text-amber-500 scale-105 drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]'
            : 'text-muted-foreground/80 hover:text-amber-500 hover:scale-110'
        )}
      />
    </button>
  );
}
