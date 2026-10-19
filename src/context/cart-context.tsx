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
  slug?: string | null;
  name: string;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

import { validateCustomerCouponAction } from '@/lib/coupons/coupon-actions';

export interface AppliedCoupon {
  code: string;
  title?: string;
  discount: number;
  discountType: 'percentage' | 'fixed' | 'free_item';
  freeItemName?: string;
  requiresInstruction?: boolean;
  instructionPrompt?: string;
  instruction?: string;
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
  applyCoupon: (
    code: string,
    instruction?: string
  ) => Promise<{
    success: boolean;
    message: string;
    requiresInstruction?: boolean;
    prompt?: string;
  }>;
  setCouponInstruction: (instruction: string) => void;
  removeCoupon: () => void;
  reorderItems: (
    items: {
      id: string;
      name: string;
      price: number;
      imageUrl?: string | null;
      quantity: number;
      description?: string;
    }[],
    branch?: BranchInfo | null,
    orderType?: OrderType
  ) => void;
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

  const applyCoupon = async (
    rawCode: string,
    instruction?: string
  ): Promise<{
    success: boolean;
    message: string;
    requiresInstruction?: boolean;
    prompt?: string;
  }> => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { success: false, message: 'Please enter a coupon code' };
    }

    try {
      const res = await validateCustomerCouponAction({
        code,
        subtotal,
        branchId: branch?.id,
        instruction,
      });

      if (!res.valid) {
        return { success: false, message: res.message };
      }

      setAppliedCoupon({
        code: res.code || code,
        title: res.title,
        discount: res.discountAmount || 0,
        discountType: res.discountType || 'fixed',
        freeItemName: res.freeItemName,
        requiresInstruction: res.requiresInstruction,
        instructionPrompt: res.instructionPrompt,
        instruction: instruction || undefined,
      });

      return {
        success: true,
        message: res.message,
        requiresInstruction: res.requiresInstruction,
        prompt: res.instructionPrompt,
      };
    } catch {
      return { success: false, message: 'Failed to validate coupon' };
    }
  };

  const setCouponInstruction = (instruction: string) => {
    setAppliedCoupon((prev) => (prev ? { ...prev, instruction } : null));
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const reorderItems = (
    newItems: {
      id: string;
      name: string;
      price: number;
      imageUrl?: string | null;
      quantity: number;
      description?: string;
    }[],
    newBranch?: BranchInfo | null,
    newOrderType?: OrderType
  ) => {
    if (newBranch) {
      setBranchState(newBranch);
    }
    if (newOrderType) {
      setOrderType(newOrderType);
    }
    setItems((prev) => {
      const updated = [...prev];
      for (const item of newItems) {
        const existingIdx = updated.findIndex((i) => i.id === item.id);
        const addQty = Math.max(1, item.quantity || 1);
        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + addQty,
          };
        } else {
          updated.push({
            id: item.id,
            name: item.name,
            price: item.price,
            imageUrl: item.imageUrl,
            description: item.description,
            quantity: addQty,
          });
        }
      }
      return updated;
    });
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
    if (appliedCoupon.discountType === 'free_item') {
      return 0; // Free item gift (cake)
    }
    if (appliedCoupon.discountType === 'percentage') {
      const pctDiscount = (subtotal * appliedCoupon.discount) / 100;
      return Math.min(pctDiscount, 250);
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
        setCouponInstruction,
        removeCoupon,
        reorderItems,
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
