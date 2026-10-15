import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Flame,
  Clock,
  ChevronRight,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Phone,
} from 'lucide-react';
import { getPublicBranches } from '@/lib/customer/branch-service';
import { getFeaturedMenuHighlights } from '@/lib/customer/menu-service';
import { ItemCard } from '@/components/customer/item-card';

export const metadata = {
  title: 'Oven Xpress',
  description:
    'Order fresh, wood-fired artisanal pizzas, 48-hour fermented sourdough breads, and gourmet burgers from Oven Xpress. Fast 30-minute delivery to your doorstep.',
};

export default async function CustomerHomePage() {
  const branches = await getPublicBranches();
  const featuredItems = await getFeaturedMenuHighlights();

  const defaultBranch = branches[0];
  const primaryMenuUrl = defaultBranch ? `/b/${defaultBranch.slug}/menu` : '#';

  const categories = [
    { name: 'Pizzas', icon: '🍕', desc: 'Neapolitan Wood-Fired', slug: 'pizzas' },
    { name: 'Breads', icon: '🥖', desc: '48h Fermented Sourdough', slug: 'breads' },
    { name: 'Burgers', icon: '🍔', desc: 'Grilled Brioche Buns', slug: 'burgers' },
    { name: 'Sides', icon: '🍟', desc: 'Crispy Garlic Appetizers', slug: 'sides-appetizers' },
    { name: 'Beverages', icon: '🥤', desc: 'Cold Brews & Shakes', slug: 'beverages' },
    { name: 'Desserts', icon: '🍰', desc: 'Artisan Oven Bakes', slug: 'desserts' },
  ];

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Hero Banner Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-500/10 via-background to-background pt-4 pb-8 sm:py-12 px-4 sm:px-6 lg:px-8 border-b border-border/40">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold tracking-wide animate-in fade-in slide-in-from-top duration-300">
              <Flame className="size-3.5 fill-primary text-primary" />
              <span>WOOD-FIRED AT 450°C • 100% SOURDOUGH CRUST</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
              Artisanal Pizzas & Fresh Breads,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-500">
                Express to Your Door.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Every crust is naturally leavened for 48 hours and baked in our authentic stone ovens. Topped with imported San Marzano tomatoes, fresh mozzarella, and aromatic basil.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <Link
                href={primaryMenuUrl}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 group transition-all"
              >
                <span>Order Now & Explore Menu</span>
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#locations"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-semibold text-sm border border-border/80 flex items-center justify-center gap-2 transition-colors"
              >
                <MapPin className="size-4 text-primary" />
                <span>Find Kitchen Near You</span>
              </a>
            </div>

            {/* Quick trust metrics */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50 max-w-md mx-auto lg:mx-0 text-center sm:text-left">
              <div>
                <span className="block text-xl font-black text-foreground">30 min</span>
                <span className="text-[11px] text-muted-foreground">Express Delivery</span>
              </div>
              <div>
                <span className="block text-xl font-black text-foreground">48h</span>
                <span className="text-[11px] text-muted-foreground">Dough Ferment</span>
              </div>
              <div>
                <span className="block text-xl font-black text-foreground">4.8 ★</span>
                <span className="text-[11px] text-muted-foreground">Customer Rating</span>
              </div>
            </div>
          </div>

          {/* Right Visual Image */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 border-background ring-1 ring-border/50 group">
              <Image
                src="/images/hero-pizza.jpg"
                alt="Oven Express Margherita Pizza with fresh basil and mozzarella"
                fill
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <span className="inline-block bg-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  BESTSELLER
                </span>
                <h3 className="font-extrabold text-lg sm:text-xl">Signature Neapolitan Margherita</h3>
                <p className="text-xs text-white/80">San Marzano tomatoes, fresh mozzarella, organic basil</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Horizontal Scroller */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Explore Our Kitchen
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Handmade every morning with passion and precision
            </p>
          </div>
          {defaultBranch && (
            <Link
              href={`/b/${defaultBranch.slug}/menu`}
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
              href={defaultBranch ? `/b/${defaultBranch.slug}/menu` : '#'}
              className="group p-4 rounded-2xl bg-card border border-border/70 hover:border-primary/50 hover:shadow-md transition-all text-center flex flex-col items-center justify-center space-y-2"
            >
              <div className="size-12 rounded-2xl bg-muted/60 group-hover:bg-primary/10 group-hover:scale-110 flex items-center justify-center text-2xl transition-all duration-200">
                {cat.icon}
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Items Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              <span>Chef&apos;s Highlights</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Popular & Bestselling Dishes
            </h2>
          </div>
          {defaultBranch && (
            <Link
              href={`/b/${defaultBranch.slug}/menu`}
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

      {/* Quality Promise Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-stone-900 via-neutral-900 to-stone-950 text-white p-6 sm:p-10 border border-white/10 shadow-xl overflow-hidden relative">
          <div className="relative z-10 max-w-2xl space-y-4">
            <span className="text-amber-400 font-extrabold text-xs uppercase tracking-widest">
              The Oven Express Standard
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              We Never Compromise On Real Food Quality
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs sm:text-sm text-neutral-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Naturally fermented sourdough with zero chemical yeast</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Wood-fired stone oven baked at blistering 450°C</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>100% whole milk mozzarella with zero palm oil</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Triple-insulated thermal bags guarantee hot delivery</span>
              </div>
            </div>
          </div>

          {/* Right Brand Badge Seal */}
          <div className="hidden lg:flex absolute right-10 top-1/2 -translate-y-1/2 size-44 items-center justify-center pointer-events-none">
            <Image
              src="/logo.png"
              alt="Oven Express Official Seal"
              width={176}
              height={176}
              className="object-contain filter drop-shadow-[0_10px_25px_rgba(249,115,22,0.35)] opacity-95 hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>
      </section>

      {/* Locations Section */}
      <section id="locations" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <MapPin className="size-3.5" />
            <span>Kitchen Network</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Our Branches Near You
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Select a kitchen branch to explore its live availability, pricing, and fast delivery
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
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${b.isOpenNow
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

                <div className="flex items-center gap-4 text-xs text-muted-foreground/80 pt-1">
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
