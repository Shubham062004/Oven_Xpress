'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Tag,
  Check,
  MapPin,
  Sparkles,
  UtensilsCrossed,
  Bike,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { isItemVeg } from '@/lib/customer/menu-utils';

export default function CartPage() {
  const {
    items,
    branch,
    orderType,
    setOrderType,
    tableNumber,
    setTableNumber,
    appliedCoupon,
    itemCount,
    subtotal,
    discount,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    setCouponInstruction,
    removeCoupon,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = codeToApply || couponInput;
    if (!code.trim()) return;
    setIsApplyingCoupon(true);
    setCouponMessage(null);
    try {
      const result = await applyCoupon(code);
      if (result.success) {
        setCouponMessage({ type: 'success', text: result.message });
        setCouponInput('');
      } else {
        setCouponMessage({ type: 'error', text: result.message });
      }
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const freeDeliveryThreshold = 499;
  const amountForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-5">
        <div className="size-20 mx-auto rounded-3xl bg-muted/60 flex items-center justify-center text-muted-foreground">
          <ShoppingBag className="size-10 stroke-[1.5]" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-black text-foreground">Your Cart is Empty</h1>
          <p className="text-xs text-muted-foreground">
            Looks like you haven&apos;t added any delicious pizzas or oven bakes yet.
          </p>
        </div>
        <Link
          href={branch ? `/b/${branch.slug}/menu` : '/'}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          <span>Explore Menu</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-12 space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Shopping Cart
          </h1>
          <p className="text-xs text-muted-foreground">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} in your order
          </p>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-muted/60"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items & Order Mode */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Branch and Mode */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-border/50 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="size-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground truncate">
                  Ordering from: {branch?.name || 'Selected Kitchen'}
                </span>
              </div>
              <Link
                href="/"
                className="text-primary font-bold hover:underline shrink-0 pl-2"
              >
                Change
              </Link>
            </div>

            {/* Order Type Toggle */}
            <div className="grid grid-cols-3 gap-2 bg-muted/60 p-1.5 rounded-2xl text-xs font-bold border border-border/70">
              <button
                type="button"
                onClick={() => setOrderType('DELIVERY')}
                className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === 'DELIVERY'
                    ? 'bg-background text-primary shadow-sm font-black border border-primary/25 ring-1 ring-primary/15'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bike className={`size-4 shrink-0 ${orderType === 'DELIVERY' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>Delivery</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('TAKEAWAY')}
                className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-background text-primary shadow-sm font-black border border-primary/25 ring-1 ring-primary/15'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PackageCheck className={`size-4 shrink-0 ${orderType === 'TAKEAWAY' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>Takeaway</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  orderType === 'DINE_IN'
                    ? 'bg-background text-primary shadow-sm font-black border border-primary/25 ring-1 ring-primary/15'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <UtensilsCrossed className={`size-4 shrink-0 ${orderType === 'DINE_IN' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>Dine-In</span>
              </button>
            </div>

            {orderType === 'DINE_IN' && (
              <div className="pt-2">
                <label htmlFor="tableNum" className="block text-xs font-semibold text-muted-foreground mb-1">
                  Table Number (Optional)
                </label>
                <input
                  id="tableNum"
                  type="text"
                  placeholder="e.g. Table 4"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/80 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="space-y-3">
            {items.map((item) => {
              const isVeg = isItemVeg({ name: item.name, description: item.description });

              return (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-card border border-border/70 hover:border-border transition-all shadow-xs space-y-3"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail with Veg/Non-Veg indicator */}
                    <div className="relative size-16 sm:size-18 rounded-xl overflow-hidden bg-muted shrink-0 border border-border/60">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center text-muted-foreground text-[10px]">
                          No image
                        </div>
                      )}

                      {/* Veg / Non-Veg badge on image corner */}
                      <div className="absolute top-1.5 left-1.5 bg-background/90 backdrop-blur-xs p-0.5 rounded-sm shadow-xs">
                        <div
                          className={`size-2.5 rounded-xs border-2 flex items-center justify-center ${
                            isVeg ? 'border-emerald-600' : 'border-rose-600'
                          }`}
                        >
                          <div
                            className={`size-1 rounded-full ${
                              isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Title & Info */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm sm:text-base text-foreground leading-snug line-clamp-2">
                            {item.name}
                          </h3>
                          {item.category && (
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mt-0.5">
                              {item.category}
                            </span>
                          )}
                        </div>

                        {/* Delete item button */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors shrink-0 -mr-1 -mt-0.5 cursor-pointer"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/40">
                        {/* Unit price */}
                        <span className="text-xs text-muted-foreground font-medium">
                          ₹{item.price.toFixed(2)} each
                        </span>

                        {/* Stepper + Item Total Price */}
                        <div className="flex items-center gap-3">
                          {/* Stepper */}
                          <div className="flex items-center bg-muted/80 rounded-xl p-0.5 border border-border/60">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, -1)}
                              className="size-6 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="w-6 text-center text-xs font-bold text-foreground">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, 1)}
                              className="size-6 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              aria-label="Increase quantity"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>

                          {/* Line Total */}
                          <span className="font-black text-sm text-foreground min-w-16 text-right">
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add more items prompt */}
          <Link
            href={branch ? `/b/${branch.slug}/menu` : '/'}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl border border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 text-xs font-bold text-primary transition-all group cursor-pointer shadow-xs"
          >
            <Plus className="size-4 group-hover:scale-110 transition-transform" />
            <span>Add more items from menu</span>
          </Link>
        </div>

        {/* Right Column: Coupon & Bill Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Free Delivery Bar — Tuscan Honeycomb Accent */}
          {orderType === 'DELIVERY' && (
            <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border border-amber-500/25 rounded-2xl p-4 text-xs shadow-xs space-y-2.5">
              {amountForFreeDelivery > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Bike className="size-4 text-amber-500 shrink-0" />
                      <span>
                        Add <strong className="text-amber-600 dark:text-amber-400">₹{amountForFreeDelivery.toFixed(2)}</strong> more for FREE Delivery!
                      </span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                      ₹{freeDeliveryThreshold} Goal
                    </span>
                  </div>
                  <div className="w-full bg-amber-500/15 h-2 rounded-full overflow-hidden p-0.5">
                    <div
                      className="bg-linear-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-500 ease-out shadow-xs shadow-amber-500/30"
                      style={{ width: `${Math.min(100, (subtotal / freeDeliveryThreshold) * 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <div className="size-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Check className="size-3.5" />
                  </div>
                  <span>Congratulations! You unlocked FREE Delivery on this order!</span>
                </div>
              )}
            </div>
          )}

          {/* Promo Code Section */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3 shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-primary" />
              <span>Offers & Coupons</span>
            </h3>

            {appliedCoupon ? (
              <div className="space-y-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-black text-xs tracking-wider uppercase block">
                        {appliedCoupon.code}
                      </span>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {appliedCoupon.freeItemName
                          ? `Free Gift: ${appliedCoupon.freeItemName}`
                          : appliedCoupon.discountType === 'percentage'
                          ? `${appliedCoupon.discount}% discount applied`
                          : `₹${appliedCoupon.discount} discount applied`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-xs font-bold text-destructive hover:underline cursor-pointer px-2 py-1"
                  >
                    Remove
                  </button>
                </div>

                {/* Birthday Cake Name Instruction Input */}
                {(appliedCoupon.requiresInstruction || appliedCoupon.code === 'BIRTHDAY') && (
                  <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                    <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
                      🎂 {appliedCoupon.instructionPrompt || 'Name / Message to write on Birthday Cake'}:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Happy Birthday Rahul!"
                      value={appliedCoupon.instruction || ''}
                      onChange={(e) => setCouponInstruction(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-emerald-500/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="w-full pl-8 pr-3 py-2.5 text-xs bg-muted/40 border border-border/80 rounded-xl uppercase tracking-wider font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isApplyingCoupon}
                    onClick={() => handleApplyCoupon()}
                    className="px-4 py-2.5 rounded-xl bg-linear-to-r from-[#E15227] to-[#EE7832] hover:from-[#EB5C30] hover:to-[#F58642] text-white font-bold text-xs shadow-md shadow-[#E15227]/25 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isApplyingCoupon ? 'Checking...' : 'Apply'}
                  </button>
                </div>

                {couponMessage && (
                  <p
                    className={`text-xs font-semibold ${
                      couponMessage.type === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive'
                    }`}
                  >
                    {couponMessage.text}
                  </p>
                )}

                {/* Quick select coupons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('FIRST50')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/8 hover:bg-amber-500/15 text-xs font-bold text-amber-600 dark:text-amber-400 transition-all cursor-pointer"
                  >
                    <span className="font-extrabold uppercase tracking-wider">FIRST50</span>
                    <span className="text-[10px] opacity-80">(₹50 OFF • 1st Order &gt; ₹150)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('BIRTHDAY')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-pink-500/40 hover:border-pink-500 bg-pink-500/8 hover:bg-pink-500/15 text-xs font-bold text-pink-600 dark:text-pink-400 transition-all cursor-pointer"
                  >
                    <span className="font-extrabold uppercase tracking-wider">🎂 BIRTHDAY</span>
                    <span className="text-[10px] opacity-80">(FREE Cake &gt; ₹1500)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 sm:p-5 space-y-4 shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Bill Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Item Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                <span className="font-semibold text-foreground">₹{subtotal.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-dashed border-border/60">
                <span>Delivery Partner Fee</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Calculated at checkout
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Government Taxes (GST 5%)</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Calculated at checkout
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="block font-black text-base text-foreground">Item Total</span>
                <span className="text-[10px] text-muted-foreground">Delivery & GST added at checkout</span>
              </div>
              <span className="text-2xl font-black text-foreground">
                ₹{Math.max(0, subtotal - discount).toFixed(2)}
              </span>
            </div>

            {/* Checkout Button */}
            <Link
              href="/checkout"
              className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#E15227] via-[#EA632B] to-[#F17E34] hover:from-[#EB5C30] hover:to-[#F58642] text-white font-black text-sm shadow-xl shadow-[#E15227]/30 hover:shadow-2xl hover:shadow-[#E15227]/40 flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="size-4" />
            </Link>

            <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1 pt-1">
              <ShieldCheck className="size-3 text-emerald-500" />
              <span>Safe & Secure Checkout Guaranteed</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
