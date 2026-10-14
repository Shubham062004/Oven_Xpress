'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UtensilsCrossed, ShoppingBag, Receipt, User } from 'lucide-react';
import { useCart } from '@/context/cart-context';

export function MobileBottomNav() {
  const pathname = usePathname();
  const { itemCount, branch } = useCart();

  const menuUrl = branch ? `/b/${branch.slug}/menu` : '/b/downtown-central/menu';

  const navItems = [
    {
      label: 'Home',
      icon: Home,
      href: '/',
      isActive: pathname === '/',
    },
    {
      label: 'Menu',
      icon: UtensilsCrossed,
      href: menuUrl,
      isActive: pathname.includes('/menu') || pathname.startsWith('/b/'),
    },
    {
      label: 'Cart',
      icon: ShoppingBag,
      href: '/cart',
      isActive: pathname === '/cart',
      badge: itemCount > 0 ? itemCount : null,
    },
    {
      label: 'Orders',
      icon: Receipt,
      href: '/account/orders',
      isActive: pathname.startsWith('/orders') || pathname === '/account/orders',
    },
    {
      label: 'Account',
      icon: User,
      href: '/account',
      isActive: pathname === '/account' && !pathname.includes('/orders'),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-background/95 backdrop-blur-md border-t border-border/60 pb-safe shadow-lg">
      <div className="grid grid-cols-5 h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center relative py-1 transition-colors ${
                item.isActive
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`size-5 ${item.isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
