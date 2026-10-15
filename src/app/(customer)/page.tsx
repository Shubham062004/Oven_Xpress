import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Flame,
  Clock,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Phone,
  Sparkles,
  ShoppingBag,
  Timer,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';
import { getPublicBranches } from '@/lib/customer/branch-service';
import { getFeaturedMenuHighlights } from '@/lib/customer/menu-service';
import { ItemCard } from '@/components/customer/item-card';
import {
  HomepageHeroActions,
  OrderAheadCtaButton,
} from '@/components/customer/homepage-hero-actions';

export const metadata = {
  title: 'Oven Xpress — Good food. Less waiting.',
  description:
    'Artisanal sourdough pizzas, wood-fired breads, and gourmet burgers baked fresh in 450°C stone ovens. Order ahead for instant express counter pickup.',
};

export default async function CustomerHomePage() {
  const branches = await getPublicBranches();
  const featuredItems = await getFeaturedMenuHighlights();

  const defaultBranch = branches[0];
  const primaryMenuUrl = defaultBranch ? `/b/${defaultBranch.slug}/menu` : '#branches';

  const categories = [
    { name: 'Pizzas', icon: '🍕', desc: 'Neapolitan Stone-Oven', slug: 'pizzas' },
    { name: 'Breads', icon: '🥖', desc: '48h Fermented Sourdough', slug: 'breads' },
    { name: 'Burgers', icon: '🍔', desc: 'Gourmet Brioche Buns', slug: 'burgers' },
    { name: 'Sides', icon: '🍟', desc: 'Crispy Appetizers', slug: 'sides-appetizers' },
    { name: 'Beverages', icon: '☕', desc: 'Craft Brews & Shakes', slug: 'beverages' },
    { name: 'Desserts', icon: '🍰', desc: 'Artisan Oven Bakes', slug: 'desserts' },
  ];

  return (
    <div className="space-y-10 sm:space-y-16">
      {/* 2. Hero Section: “Good food. Less waiting.” */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-background to-background pt-4 pb-8 sm:py-14 px-4 sm:px-6 lg:px-8 border-b border-border/40">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wide">
              <Flame className="size-3.5 fill-primary text-primary" />
              <span>WOOD-FIRED AT 450°C • ARTISANAL SOURDOUGH</span>
            </div>

            <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
              Good food.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500">
                Less waiting.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Every crust is hand-stretched and baked in authentic stone hearth ovens. Order ahead
              to skip the counter queue and pick up your meal freshly boxed when you arrive.
            </p>

            {/* Client Interactive Actions: Order Ahead & Explore Menu */}
            <div className="flex justify-center lg:justify-start">
              <HomepageHeroActions defaultBranchSlug={defaultBranch?.slug} />
            </div>

            {/* Verified Trust Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50 max-w-md mx-auto lg:mx-0 text-center sm:text-left">
              <div>
                <span className="block text-lg sm:text-xl font-black text-foreground">48h</span>
                <span className="text-[11px] text-muted-foreground">Cold Ferment</span>
              </div>
              <div>
                <span className="block text-lg sm:text-xl font-black text-foreground">450°C</span>
                <span className="text-[11px] text-muted-foreground">Stone Hearth</span>
              </div>
              <div>
                <span className="block text-lg sm:text-xl font-black text-foreground">Zero Line</span>
                <span className="text-[11px] text-muted-foreground">Express Pickup</span>
              </div>
            </div>
          </div>

          {/* Right Visual Column: Signature Neapolitan Margherita */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-background ring-1 ring-border/50 group">
              <Image
                src="/images/hero-pizza.jpg"
                alt="Signature Neapolitan Margherita Pizza with fresh basil and whole milk mozzarella"
                fill
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="inline-block bg-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1 shadow-xs">
                  SIGNATURE BESTSELLER
                </span>
                <h2 className="font-extrabold text-base sm:text-lg">Signature Neapolitan Margherita</h2>
                <p className="text-xs text-white/80 line-clamp-1">
                  San Marzano tomatoes, fresh mozzarella, organic basil & cold-pressed olive oil
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Order-Ahead Section: Explain ordering ahead, tracking & queue skipping */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-card border border-border/80 p-6 sm:p-8 lg:p-10 shadow-sm relative overflow-hidden">
          <div className="max-w-3xl space-y-2 mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <Clock className="size-3" />
              <span>Express Pickup Experience</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Order Ahead. Skip the Wait.
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Place your order before your class ends, during your commute, or on your way. Collect
              piping-hot food straight from our dedicated express pickup counter without standing in
              line.
            </p>
          </div>

          {/* 4-Step Progressive Timeline Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border/60 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-black text-sm">
                  1
                </div>
                <h3 className="font-bold text-sm text-foreground">Select Branch & Order</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose your nearest kitchen branch and customize your dishes ahead of arrival.
                </p>
              </div>
              <span className="text-[11px] font-medium text-primary flex items-center gap-1 pt-1">
                <ShoppingBag className="size-3" />
                <span>Any device, anywhere</span>
              </span>
            </div>

            {/* Step 2 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border/60 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-black text-sm">
                  2
                </div>
                <h3 className="font-bold text-sm text-foreground">Stone-Oven Baking</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our chefs immediately fire your pizzas and bakes in 450°C stone hearth ovens.
                </p>
              </div>
              <span className="text-[11px] font-medium text-primary flex items-center gap-1 pt-1">
                <Flame className="size-3" />
                <span>Baked fresh to order</span>
              </span>
            </div>

            {/* Step 3 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-muted/40 border border-border/60 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-black text-sm">
                  3
                </div>
                <h3 className="font-bold text-sm text-foreground">Live Preparation Tracking</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Watch live order status on your phone as your meal moves from prep to the oven.
                </p>
              </div>
              <span className="text-[11px] font-medium text-primary flex items-center gap-1 pt-1">
                <Timer className="size-3" />
                <span>Real-time kitchen updates</span>
              </span>
            </div>

            {/* Step 4 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/25 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-sm">
                  4
                </div>
                <h3 className="font-bold text-sm text-foreground">Express Counter Pickup</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Walk in, show your order number at the designated pickup counter, and grab your hot food.
                </p>
              </div>
              <span className="text-[11px] font-bold text-primary flex items-center gap-1 pt-1">
                <PackageCheck className="size-3" />
                <span>Zero queue waiting</span>
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground text-center sm:text-left">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>Available at all operating Oven Xpress kitchens during open hours</span>
            </div>
            <OrderAheadCtaButton defaultBranchSlug={defaultBranch?.slug} />
          </div>
        </div>
      </section>

      {/* 4. Curated Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Curated Menu Categories
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Handmade every morning with passion and precision
            </p>
          </div>
          {defaultBranch && (
            <Link
              href={primaryMenuUrl}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>See Full Menu</span>
              <ChevronRight className="size-3.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={primaryMenuUrl}
              className="group p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 hover:border-primary/50 hover:shadow-md transition-all text-center flex flex-col items-center justify-center space-y-2 active:scale-95"
            >
              <div className="size-11 sm:size-12 rounded-2xl bg-muted/60 group-hover:bg-primary/10 group-hover:scale-110 flex items-center justify-center text-2xl transition-all duration-200">
                {cat.icon}
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. Popular Products (4 to 6 items with real data and correct images) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              <span>Chef&apos;s Highlights</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Popular Dishes
            </h2>
          </div>
          {defaultBranch && (
            <Link
              href={primaryMenuUrl}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="size-3.5" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {featuredItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* 6. Compact Brand-Quality Section (Verified claims only) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-neutral-900 text-white p-6 sm:p-10 border border-white/10 shadow-xl overflow-hidden relative">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="text-amber-400 font-extrabold text-xs uppercase tracking-widest">
              The Oven Express Standard
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              Real Food Quality. No Shortcuts.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm text-neutral-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">48h Cold Ferment</strong> — Naturally leavened sourdough for airy crust and flavor.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">450°C Stone Hearth</strong> — Authentic high-temperature baking in volcanic stone ovens.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">100% Whole Milk Mozzarella</strong> — Premium real cheese with zero palm oil.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Dedicated Express Pickup</strong> — Freshly boxed and staged for immediate pickup.
                </span>
              </div>
            </div>
          </div>

          {/* Right Brand Badge Seal */}
          <div className="hidden lg:flex absolute right-10 top-1/2 -translate-y-1/2 size-40 items-center justify-center pointer-events-none">
            <Image
              src="/logo.png"
              alt="Oven Express Official Brand Seal"
              width={160}
              height={160}
              className="object-contain filter drop-shadow-[0_10px_25px_rgba(249,115,22,0.35)] opacity-95"
            />
          </div>
        </div>
      </section>

      {/* 7. Nearby / Available Branches with accurate operating status */}
      <section id="branches" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <MapPin className="size-3.5" />
            <span>Kitchen Locations</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Our Kitchens & Operating Hours
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Select a branch to view live item availability, kitchen hours, and place an order
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div
              key={b.id}
              className="bg-card rounded-2xl border border-border/70 p-5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base text-foreground">{b.name}</h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      b.isOpenNow
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {b.isOpenNow ? 'OPEN NOW' : 'CLOSED'}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0 text-muted-foreground/70" />
                  <span>
                    {b.address}, {b.city}
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/80 pt-1">
                  {b.openingTime && b.closingTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {b.openingTime} – {b.closingTime}
                    </span>
                  )}
                  {b.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" />
                      {b.phone}
                    </span>
                  )}
                </div>
              </div>

              <Link
                href={`/b/${b.slug}/menu`}
                className="w-full py-2.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Browse Menu & Order</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
