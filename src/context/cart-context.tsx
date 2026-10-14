'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string | null;
  category?: string;
  quantity: number;
  notes?: string;
}

export type OrderType = 'DELIVERY' | 'TAKEAWAY' | 'DINE_IN';

export interface BranchInfo {
  id: string;
  slug: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  discountType: 'percentage' | 'fixed';
}

interface CartContextType {
  items: CartItem[];
  branch: BranchInfo | null;
  orderType: OrderType;
  tableNumber: string;
  appliedCoupon: AppliedCoupon | null;
  itemCount: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discount: number;
  total: number;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, deltaOrQuantity: number, isDirectSet?: boolean) => void;
  clearCart: () => void;
  setBranch: (branch: BranchInfo) => void;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (table: string) => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'ox_customer_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [branch, setBranchState] = useState<BranchInfo | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('DELIVERY');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items)) setItems(parsed.items);
        if (parsed.branch) setBranchState(parsed.branch);
        if (parsed.orderType) setOrderType(parsed.orderType);
        if (parsed.tableNumber) setTableNumber(parsed.tableNumber);
        if (parsed.appliedCoupon) setAppliedCoupon(parsed.appliedCoupon);
      }
    } catch (e) {
      console.warn('Failed to parse stored cart state:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save cart to localStorage on state changes
  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        CART_STORAGE_KEY,
        JSON.stringify({
          items,
          branch,
          orderType,
          tableNumber,
          appliedCoupon,
        })
      );
    } catch (e) {
      console.warn('Failed to save cart to localStorage:', e);
    }
  }, [items, branch, orderType, tableNumber, appliedCoupon, isLoaded]);

  const addItem = (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      const addQty = newItem.quantity || 1;
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id ? { ...i, quantity: i.quantity + addQty } : i
        );
      }
      return [...prev, { ...newItem, quantity: addQty }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, value: number, isDirectSet: boolean = false) => {
    setItems((prev) => {
      return prev
        .map((i) => {
          if (i.id !== id) return i;
          const newQty = isDirectSet ? value : i.quantity + value;
          return { ...i, quantity: newQty };
        })
        .filter((i) => i.quantity > 0);
    });
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
  };

  const setBranch = (newBranch: BranchInfo) => {
    // If switching branch and items exist, prompt or keep
    setBranchState(newBranch);
  };

  const applyCoupon = (rawCode: string): { success: boolean; message: string } => {
    const code = rawCode.trim().toUpperCase();
    if (code === 'WELCOME50' || code === 'FIRST50') {
      setAppliedCoupon({
        code,
        discount: 50,
        discountType: 'fixed',
      });
      return { success: true, message: '₹50 discount applied!' };
    }
    if (code === 'OVEN20' || code === 'PIZZA20') {
      setAppliedCoupon({
        code,
        discount: 20,
        discountType: 'percentage',
      });
      return { success: true, message: '20% discount applied!' };
    }
    return { success: false, message: 'Invalid or expired coupon code' };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const itemCount = useMemo(() => items.reduce((acc, i) => acc + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((acc, i) => acc + i.price * i.quantity, 0), [items]);
  
  // 5% GST tax rate
  const tax = useMemo(() => Math.round(subtotal * 0.05 * 100) / 100, [subtotal]);

  // Delivery fee: Free for orders over ₹499 or takeaway/dine-in, otherwise ₹40
  const deliveryFee = useMemo(() => {
    if (orderType !== 'DELIVERY' || subtotal === 0) return 0;
    return subtotal >= 499 ? 0 : 40;
  }, [orderType, subtotal]);

  // Coupon discount calculation
  const discount = useMemo(() => {
    if (!appliedCoupon || subtotal === 0) return 0;
    if (appliedCoupon.discountType === 'percentage') {
      const pctDiscount = (subtotal * appliedCoupon.discount) / 100;
      return Math.min(pctDiscount, 150); // capped at ₹150 max discount
    }
    return Math.min(appliedCoupon.discount, subtotal);
  }, [appliedCoupon, subtotal]);

  const total = useMemo(() => {
    if (subtotal === 0) return 0;
    return Math.max(0, Math.round((subtotal + tax + deliveryFee - discount) * 100) / 100);
  }, [subtotal, tax, deliveryFee, discount]);

  return (
    <CartContext.Provider
      value={{
        items,
        branch,
        orderType,
        tableNumber,
        appliedCoupon,
        itemCount,
        subtotal,
        tax,
        deliveryFee,
        discount,
        total,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        setBranch,
        setOrderType,
        setTableNumber,
        applyCoupon,
        removeCoupon,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
