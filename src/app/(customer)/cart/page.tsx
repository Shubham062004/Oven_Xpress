'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Tag,
  Check,
  MapPin,
  Clock,
  Sparkles,
  UtensilsCrossed,
  Info,
} from 'lucide-react';
import { useCart } from '@/context/cart-context';

export default function CartPage() {
  const router = useRouter();
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
    tax,
    deliveryFee,
    discount,
    total,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApplyCoupon = (codeToApply?: string) => {
    const code = codeToApply || couponInput;
    if (!code.trim()) return;
    const result = applyCoupon(code);
    if (result.success) {
      setCouponMessage({ type: 'success', text: result.message });
      setCouponInput('');
    } else {
      setCouponMessage({ type: 'error', text: result.message });
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Clear Cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Items & Order Mode */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Branch and Mode */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-4">
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
            <div className="grid grid-cols-3 gap-2 bg-muted/50 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setOrderType('DELIVERY')}
                className={`py-2 rounded-lg transition-all ${
                  orderType === 'DELIVERY'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🛵 Delivery
              </button>
              <button
                type="button"
                onClick={() => setOrderType('TAKEAWAY')}
                className={`py-2 rounded-lg transition-all ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🥡 Takeaway
              </button>
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`py-2 rounded-lg transition-all ${
                  orderType === 'DINE_IN'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                🍽️ Dine-In
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
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border/80 rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 divide-y divide-border/40">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="size-14 rounded-xl object-cover shrink-0 border border-border/40"
                    />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      ₹{item.price.toFixed(2)} each
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Stepper */}
                  <div className="flex items-center gap-1.5 bg-muted/80 rounded-xl p-1 border border-border/60">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, -1)}
                      className="size-6 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-foreground">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.id, 1)}
                      className="size-6 rounded-lg hover:bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>

                  <span className="w-16 text-right font-extrabold text-sm text-foreground">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add more items prompt */}
          <div className="text-center pt-2">
            <Link
              href={branch ? `/b/${branch.slug}/menu` : '/'}
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>+ Add more items from menu</span>
            </Link>
          </div>
        </div>

        {/* Right Column: Coupon & Bill Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Free Delivery Bar */}
          {orderType === 'DELIVERY' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 text-xs text-amber-900 dark:text-amber-200">
              {amountForFreeDelivery > 0 ? (
                <div className="space-y-1.5">
                  <p className="font-semibold flex items-center justify-between">
                    <span>Add ₹{amountForFreeDelivery.toFixed(2)} more for FREE Delivery!</span>
                    <span>🛵</span>
                  </p>
                  <div className="w-full bg-amber-500/20 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (subtotal / freeDeliveryThreshold) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Check className="size-4" />
                  <span>Congratulations! You unlocked FREE Delivery!</span>
                </p>
              )}
            </div>
          )}

          {/* Promo Code Section */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-primary" />
              <span>Offers & Coupons</span>
            </h3>

            {appliedCoupon ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <div>
                  <span className="font-black text-xs tracking-wider uppercase">
                    {appliedCoupon.code}
                  </span>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    {appliedCoupon.discountType === 'percentage'
                      ? `${appliedCoupon.discount}% discount applied`
                      : `₹${appliedCoupon.discount} discount applied`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs font-bold text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter promo code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    className="flex-1 px-3 py-2 text-xs bg-muted/40 border border-border/80 rounded-xl uppercase tracking-wider font-semibold focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity"
                  >
                    Apply
                  </button>
                </div>

                {couponMessage && (
                  <p
                    className={`text-xs ${
                      couponMessage.type === 'success'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-destructive'
                    }`}
                  >
                    {couponMessage.text}
                  </p>
                )}

                {/* Quick select coupons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('WELCOME50')}
                    className="px-2.5 py-1 rounded-lg border border-border/70 hover:border-primary text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    WELCOME50 (Flat ₹50 OFF)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('PIZZA20')}
                    className="px-2.5 py-1 rounded-lg border border-border/70 hover:border-primary text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    PIZZA20 (20% OFF)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-card rounded-2xl border border-border/70 p-4 space-y-3.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Bill Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Item Subtotal</span>
                <span className="font-semibold text-foreground">₹{subtotal.toFixed(2)}</span>
              </div>

              {orderType === 'DELIVERY' && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Delivery Partner Fee</span>
                  <span className="font-semibold text-foreground">
                    {deliveryFee === 0 ? (
                      <span className="text-emerald-600 font-bold">FREE</span>
                    ) : (
                      `₹${deliveryFee.toFixed(2)}`
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground">
                <span>Government Taxes (GST 5%)</span>
                <span className="font-semibold text-foreground">₹{tax.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Coupon Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <div>
                <span className="block font-black text-base text-foreground">To Pay</span>
                <span className="text-[10px] text-muted-foreground">Inclusive of all taxes</span>
              </div>
              <span className="text-xl font-black text-foreground">
                ₹{total.toFixed(2)}
              </span>
            </div>

            {/* Checkout Button */}
            <Link
              href="/checkout"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-sm shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 transition-all"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
