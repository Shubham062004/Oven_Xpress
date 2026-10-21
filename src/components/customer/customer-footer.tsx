import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, MapPin } from 'lucide-react';
import type { PublicBranch } from '@/lib/customer/branch-service';

export function CustomerFooter({ branches = [] }: { branches?: PublicBranch[] }) {
  return (
    <footer className="border-t border-border/60 bg-muted/20 pt-8 sm:pt-10 pb-28 md:pb-10 px-4 sm:px-6 lg:px-8 block mt-12">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-xs">
        {/* Brand */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="relative size-8 rounded-lg overflow-hidden bg-white/95 dark:bg-zinc-900 border border-border/60 shadow-sm flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Oven Xpress"
                fill
                sizes="32px"
                className="object-contain p-0.5"
              />
            </div>
            <span className="font-extrabold text-base tracking-tight">Oven Xpress</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Artisanal sourdough pizzas, wood-fired gourmet burgers, and fresh baked goods delivered fast and hot.
          </p>
          <p className="text-muted-foreground/80 flex items-center gap-1 text-[11px]">
            Made with <Heart className="size-3 text-rose-500 fill-rose-500" /> for food lovers.
          </p>
        </div>

        {/* Quick Links */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-sm tracking-wide text-foreground">Menu & Order</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link href="/b/bandra-west/menu" className="hover:text-primary transition-colors">
                Artisanal Pizzas
              </Link>
            </li>
            <li>
              <Link href="/b/bandra-west/menu" className="hover:text-primary transition-colors">
                Garlic Breads & Sourdough
              </Link>
            </li>
            <li>
              <Link href="/b/bandra-west/menu" className="hover:text-primary transition-colors">
                Gourmet Burgers
              </Link>
            </li>
            <li>
              <Link href="/cart" className="hover:text-primary transition-colors">
                View Cart
              </Link>
            </li>
          </ul>
        </div>

        {/* Branches */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-sm tracking-wide text-foreground">Our Kitchens</h4>
          <ul className="space-y-2 text-muted-foreground">
            {branches.slice(0, 4).map((b) => (
              <li key={b.id}>
                <Link
                  href={`/b/${b.slug}/menu`}
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  <MapPin className="size-3 text-muted-foreground/60" />
                  <span>{b.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Account & Policies */}
        <div className="space-y-2.5">
          <h4 className="font-bold text-sm tracking-wide text-foreground">Customer Care</h4>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link href="/account" className="hover:text-primary transition-colors">
                My Account
              </Link>
            </li>
            <li>
              <Link href="/account/orders" className="hover:text-primary transition-colors">
                Past Orders
              </Link>
            </li>
            <li>
              <Link
                href="/report-bug"
                className="hover:text-primary transition-colors flex items-center gap-1.5 text-primary/90 font-medium"
              >
                <span>Report a Bug</span>
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-primary transition-colors">
                Staff Portal
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto border-t border-border/40 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>&copy; {new Date().getFullYear()} Oven Xpress Inc. All rights reserved.</span>
        <div className="flex gap-4">
          <span>Privacy Policy</span>
          <span>•</span>
          <span>Terms of Service</span>
          <span>•</span>
          <span>Food Safety Assured</span>
        </div>
      </div>
    </footer>
  );
}
