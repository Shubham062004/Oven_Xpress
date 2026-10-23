'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/cart-context';

export function FloatingCartBar() {
  const { itemCount, subtotal, branch } = useCart();
  const pathname = usePathname();

  // Don't show floating bar on cart, checkout, tracking, or account/profile pages
  if (
    pathname === '/cart' ||
    pathname === '/checkout' ||
    pathname.startsWith('/track/') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/report-bug') ||
    itemCount === 0
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-16 md:bottom-6 inset-x-0 z-40 px-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <Link
          href="/cart"
          className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-linear-to-r from-[#E15227] via-[#EA632B] to-[#F17E34] text-white shadow-xl shadow-[#E15227]/35 hover:shadow-2xl hover:shadow-[#E15227]/45 border border-white/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/20 backdrop-blur-xs border border-white/25 flex items-center justify-center font-bold text-sm shadow-xs">
              <ShoppingBag className="size-4" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide uppercase opacity-90">
                {itemCount} {itemCount === 1 ? 'item' : 'items'} in cart
              </div>
              <div className="text-sm font-extrabold flex items-center gap-1.5">
                <span>₹{subtotal.toFixed(2)}</span>
                {branch && (
                  <span className="text-[11px] font-normal opacity-80 border-l border-white/30 pl-1.5">
                    {branch.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm pl-4 pr-1">
            <span>View Cart</span>
            <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>
    </div>
  );
}
