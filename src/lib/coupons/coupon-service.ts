import { prisma } from '@/lib/db/prisma';
import type { CouponDiscountType, CouponUserFilter } from '@prisma/client';

export interface ValidateCouponParams {
  code: string;
  subtotal: number;
  branchId?: string;
  userId?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  instruction?: string;
}

export interface ValidateCouponResult {
  valid: boolean;
  message: string;
  code?: string;
  title?: string;
  discountType?: 'percentage' | 'fixed' | 'free_item';
  discountAmount?: number;
  percentage?: number;
  freeItemName?: string;
  requiresInstruction?: boolean;
  instructionPrompt?: string;
  instruction?: string;
}

/**
 * Ensures system default coupons (FIRST50 and BIRTHDAY) exist with exact business rules.
 */
export async function ensureDefaultCoupons() {
  try {
    // 1. FIRST50: First order only, min order Rs 150, Flat Rs 50 off
    await prisma.coupon.upsert({
      where: { code: 'FIRST50' },
      update: {
        title: 'First Order Discount',
        description: 'Get ₹50 off on your very first order of ₹150 or more!',
        discountType: 'FIXED_AMOUNT',
        discountValue: 50,
        minOrderAmount: 150,
        maxUsesPerUser: 1,
        userFilter: 'FIRST_ORDER_ONLY',
        allBranches: true,
        isActive: true,
      },
      create: {
        code: 'FIRST50',
        title: 'First Order Discount',
        description: 'Get ₹50 off on your very first order of ₹150 or more!',
        discountType: 'FIXED_AMOUNT',
        discountValue: 50,
        minOrderAmount: 150,
        maxUsesPerUser: 1,
        userFilter: 'FIRST_ORDER_ONLY',
        allBranches: true,
        isActive: true,
      },
    });

    // 2. BIRTHDAY: Multiple times allowed, min order Rs 1500, Free Cake with name instruction
    await prisma.coupon.upsert({
      where: { code: 'BIRTHDAY' },
      update: {
        title: 'Birthday Special - Free Celebration Cake',
        description: 'Enjoy a FREE Celebration Cake on orders above ₹1,500! Can be used multiple times.',
        discountType: 'FREE_ITEM',
        discountValue: 0,
        minOrderAmount: 1500,
        freeItemName: "Complimentary Chef's Birthday Cake (500g)",
        requiresInstruction: true,
        instructionPrompt: 'Name / Message to write on your Birthday Cake',
        userFilter: 'ALL_USERS',
        maxUsesPerUser: null, // multiple times allowed
        allBranches: true,
        isActive: true,
      },
      create: {
        code: 'BIRTHDAY',
        title: 'Birthday Special - Free Celebration Cake',
        description: 'Enjoy a FREE Celebration Cake on orders above ₹1,500! Can be used multiple times.',
        discountType: 'FREE_ITEM',
        discountValue: 0,
        minOrderAmount: 1500,
        freeItemName: "Complimentary Chef's Birthday Cake (500g)",
        requiresInstruction: true,
        instructionPrompt: 'Name / Message to write on your Birthday Cake',
        userFilter: 'ALL_USERS',
        maxUsesPerUser: null, // multiple times allowed
        allBranches: true,
        isActive: true,
      },
    });
  } catch (error) {
    console.warn('[Coupons] Default coupons seed check error:', error);
  }
}

/**
 * Validates a coupon code against subtotal, branch, and user conditions.
 */
export async function validateCoupon({
  code,
  subtotal,
  branchId,
  userId,
  customerPhone,
  customerEmail,
  instruction,
}: ValidateCouponParams): Promise<ValidateCouponResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: 'Please enter a coupon code' };
  }

  // Ensure default coupons exist in DB
  await ensureDefaultCoupons();

  const coupon = await prisma.coupon.findUnique({
    where: { code: cleanCode },
  });

  if (!coupon || !coupon.isActive) {
    return { valid: false, message: 'Invalid or inactive coupon code' };
  }

  // Check expiry date
  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) {
    return { valid: false, message: 'This coupon offer has not started yet' };
  }
  if (coupon.endDate && coupon.endDate < now) {
    return { valid: false, message: 'This coupon code has expired' };
  }

  // Check minimum order amount
  const minOrder = Number(coupon.minOrderAmount);
  if (subtotal < minOrder) {
    return {
      valid: false,
      message: `Minimum order amount of ₹${minOrder} required to use "${coupon.code}"`,
    };
  }

  // Check branch restriction
  if (!coupon.allBranches && coupon.branchIds && branchId) {
    const allowedBranches = Array.isArray(coupon.branchIds)
      ? (coupon.branchIds as string[])
      : [];
    if (allowedBranches.length > 0 && !allowedBranches.includes(branchId)) {
      return {
        valid: false,
        message: 'This coupon is not valid at the selected branch',
      };
    }
  }

  // Check total usage cap
  if (coupon.totalMaxUses && coupon.totalMaxUses > 0) {
    const totalUsed = await prisma.couponUsage.count({
      where: { couponId: coupon.id },
    });
    if (totalUsed >= coupon.totalMaxUses) {
      return { valid: false, message: 'This coupon has reached its maximum total usage limit' };
    }
  }

  // Check user filter & eligibility
  let userRecord: { id: string; createdAt: Date } | null = null;
  if (userId) {
    userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true },
    });
  }

  // Check Prior Orders (for FIRST_ORDER_ONLY / FIRST50)
  if (coupon.userFilter === 'FIRST_ORDER_ONLY' || coupon.code === 'FIRST50') {
    let priorOrdersCount = 0;

    if (userId) {
      priorOrdersCount = await prisma.order.count({
        where: {
          OR: [
            { customer: { userId } },
            { customerPhone: customerPhone || undefined },
          ],
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] },
        },
      });
    } else if (customerPhone) {
      priorOrdersCount = await prisma.order.count({
        where: {
          customerPhone,
          status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] },
        },
      });
    }

    if (priorOrdersCount > 0) {
      return {
        valid: false,
        message: 'Coupon "FIRST50" is valid only on your very first order',
      };
    }
  }

  // Check Join Date Filters
  if (coupon.userFilter === 'JOINED_LAST_10_DAYS') {
    if (!userRecord) {
      return {
        valid: false,
        message: 'Please sign in to your account to use this special new member coupon',
      };
    }
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    if (userRecord.createdAt < tenDaysAgo) {
      return {
        valid: false,
        message: 'This coupon is only available to members who joined in the last 10 days',
      };
    }
  }

  if (coupon.userFilter === 'JOINED_LAST_30_DAYS') {
    if (!userRecord) {
      return {
        valid: false,
        message: 'Please sign in to your account to use this special new member coupon',
      };
    }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (userRecord.createdAt < thirtyDaysAgo) {
      return {
        valid: false,
        message: 'This coupon is only available to members who joined in the last 30 days',
      };
    }
  }

  // Check Specific Users List
  if (coupon.userFilter === 'SPECIFIC_USERS') {
    const targetedUsers = Array.isArray(coupon.targetedUserIds)
      ? (coupon.targetedUserIds as string[])
      : [];
    if (!userId || !targetedUsers.includes(userId)) {
      return {
        valid: false,
        message: 'This exclusive coupon is not available for this account',
      };
    }
  }

  // Check max usages per user
  if (coupon.maxUsesPerUser && coupon.maxUsesPerUser > 0) {
    let userUsages = 0;
    if (userId) {
      userUsages = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          OR: [{ userId }, { customerPhone: customerPhone || undefined }],
        },
      });
    } else if (customerPhone) {
      userUsages = await prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          customerPhone,
        },
      });
    }

    if (userUsages >= coupon.maxUsesPerUser) {
      return {
        valid: false,
        message: `You have already used coupon "${coupon.code}" the maximum allowed number of times`,
      };
    }
  }

  // Calculate discount
  let discountAmount = 0;
  let clientDiscountType: 'percentage' | 'fixed' | 'free_item' = 'fixed';
  let percentageValue: number | undefined = undefined;

  if (coupon.discountType === 'FIXED_AMOUNT') {
    clientDiscountType = 'fixed';
    discountAmount = Math.min(Number(coupon.discountValue), subtotal);
  } else if (coupon.discountType === 'PERCENTAGE') {
    clientDiscountType = 'percentage';
    percentageValue = Number(coupon.discountValue);
    const rawDiscount = (subtotal * percentageValue) / 100;
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(rawDiscount, Number(coupon.maxDiscountAmount));
    } else {
      discountAmount = rawDiscount;
    }
    discountAmount = Math.round(discountAmount * 100) / 100;
  } else if (coupon.discountType === 'FREE_ITEM') {
    clientDiscountType = 'free_item';
    discountAmount = 0; // The item is given for free!
  }

  return {
    valid: true,
    message:
      coupon.discountType === 'FREE_ITEM'
        ? `"${coupon.code}" applied! Free ${coupon.freeItemName || 'Item'} added to your order!`
        : `Coupon "${coupon.code}" applied successfully! Saved ₹${discountAmount.toFixed(2)}`,
    code: coupon.code,
    title: coupon.title,
    discountType: clientDiscountType,
    discountAmount,
    percentage: percentageValue,
    freeItemName: coupon.freeItemName || undefined,
    requiresInstruction: coupon.requiresInstruction,
    instructionPrompt: coupon.instructionPrompt || undefined,
    instruction: instruction || undefined,
  };
}

/**
 * Records a coupon usage in the database when an order is finalized.
 */
export async function recordCouponUsage({
  couponCode,
  userId,
  customerId,
  customerPhone,
  customerEmail,
  customerName,
  orderId,
  orderNumber,
  discountAmount,
  instruction,
}: {
  couponCode: string;
  userId?: string | null;
  customerId?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  discountAmount?: number;
  instruction?: string | null;
}) {
  try {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.trim().toUpperCase() },
    });
    if (!coupon) return null;

    return await prisma.couponUsage.create({
      data: {
        couponId: coupon.id,
        couponCode: coupon.code,
        userId: userId || null,
        customerId: customerId || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        customerName: customerName || null,
        orderId: orderId || null,
        orderNumber: orderNumber || null,
        discountAmount: discountAmount || 0,
        instruction: instruction || null,
      },
    });
  } catch (err) {
    console.error('[Coupons] Failed to record coupon usage:', err);
    return null;
  }
}
