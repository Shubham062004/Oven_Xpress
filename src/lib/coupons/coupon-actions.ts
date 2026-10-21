'use server';

import { prisma } from '@/lib/db/prisma';
import { requirePermission, getCurrentUser } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  validateCoupon,
  ensureDefaultCoupons,
  type ValidateCouponParams,
  type ValidateCouponResult,
} from './coupon-service';
import { revalidatePath } from 'next/cache';
import type {
  CouponDiscountType,
  CouponUserFilter,
  CouponWithStats,
  CreateCouponInput,
  CouponUsageDetail,
  CouponUsageSummaryItem,
} from './coupon-types';

export type {
  CouponDiscountType,
  CouponUserFilter,
  CouponWithStats,
  CreateCouponInput,
  CouponUsageDetail,
  CouponUsageSummaryItem,
};

/**
 * Public action for customer cart and checkout to validate coupons.
 */
export async function validateCustomerCouponAction(
  params: ValidateCouponParams
): Promise<ValidateCouponResult> {
  const currentUser = await getCurrentUser();
  const userId = params.userId || currentUser?.id || null;
  const customerEmail = params.customerEmail || currentUser?.email || null;

  return await validateCoupon({
    ...params,
    userId,
    customerEmail,
  });
}

/**
 * Owner action: Fetch all coupons with usage statistics.
 */
export async function getOwnerCouponsAction(): Promise<{
  success: boolean;
  data?: CouponWithStats[];
  error?: string;
}> {
  try {
    await requirePermission(PERMISSIONS.COUPON_READ);
    await ensureDefaultCoupons();

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usages: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const enrichedCoupons: CouponWithStats[] = coupons.map((c) => {
      const usages = c.usages.map((u) => ({
        id: u.id,
        customerName: u.customerName,
        customerPhone: u.customerPhone,
        customerEmail: u.customerEmail,
        orderNumber: u.orderNumber,
        discountAmount: Number(u.discountAmount),
        instruction: u.instruction,
        createdAt: u.createdAt.toISOString(),
      }));

      const totalDiscountGiven = usages.reduce((sum, u) => sum + u.discountAmount, 0);

      // Aggregate usages per user/phone
      const userMap = new Map<
        string,
        { identifier: string; count: number; totalSaved: number; lastUsed: string }
      >();

      for (const u of usages) {
        const key = u.customerPhone || u.customerEmail || u.customerName || 'Guest User';
        const existing = userMap.get(key);
        if (existing) {
          existing.count += 1;
          existing.totalSaved += u.discountAmount;
        } else {
          userMap.set(key, {
            identifier: key,
            count: 1,
            totalSaved: u.discountAmount,
            lastUsed: u.createdAt,
          });
        }
      }

      const userUsageSummary = Array.from(userMap.values()).sort((a, b) => b.count - a.count);

      return {
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        minOrderAmount: Number(c.minOrderAmount),
        maxDiscountAmount: c.maxDiscountAmount ? Number(c.maxDiscountAmount) : null,
        freeItemName: c.freeItemName,
        requiresInstruction: c.requiresInstruction,
        instructionPrompt: c.instructionPrompt,
        allBranches: c.allBranches,
        branchIds: Array.isArray(c.branchIds) ? (c.branchIds as string[]) : [],
        userFilter: c.userFilter,
        targetedUserIds: Array.isArray(c.targetedUserIds) ? (c.targetedUserIds as string[]) : [],
        maxUsesPerUser: c.maxUsesPerUser,
        totalMaxUses: c.totalMaxUses,
        isActive: c.isActive,
        startDate: c.startDate ? c.startDate.toISOString() : null,
        endDate: c.endDate ? c.endDate.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        totalUsages: usages.length,
        uniqueUsersCount: userMap.size,
        totalDiscountGiven,
        usages,
        userUsageSummary,
      };
    });

    return { success: true, data: enrichedCoupons };
  } catch (error) {
    console.error('[Coupons] Failed to get owner coupons:', error);
    return { success: false, error: 'Failed to retrieve coupons list' };
  }
}



/**
 * Owner action: Create a new coupon with all restrictions.
 */
export async function createCouponAction(input: CreateCouponInput): Promise<{
  success: boolean;
  error?: string;
  couponId?: string;
}> {
  try {
    await requirePermission(PERMISSIONS.COUPON_MANAGE);

    const cleanCode = input.code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: 'Coupon code is required' };
    }

    if (!input.title?.trim()) {
      return { success: false, error: 'Coupon title is required' };
    }

    // Check code uniqueness
    const existing = await prisma.coupon.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      return { success: false, error: `Coupon code "${cleanCode}" already exists` };
    }

    const created = await prisma.coupon.create({
      data: {
        code: cleanCode,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        discountType: input.discountType,
        discountValue: Number(input.discountValue || 0),
        minOrderAmount: Number(input.minOrderAmount || 0),
        maxDiscountAmount: input.maxDiscountAmount ? Number(input.maxDiscountAmount) : null,
        freeItemName: input.freeItemName?.trim() || null,
        requiresInstruction: Boolean(input.requiresInstruction),
        instructionPrompt: input.instructionPrompt?.trim() || null,
        allBranches: input.allBranches,
        branchIds: input.allBranches ? [] : input.branchIds || [],
        userFilter: input.userFilter,
        targetedUserIds: input.userFilter === 'SPECIFIC_USERS' ? input.targetedUserIds || [] : [],
        maxUsesPerUser: input.maxUsesPerUser ? Number(input.maxUsesPerUser) : null,
        totalMaxUses: input.totalMaxUses ? Number(input.totalMaxUses) : null,
        isActive: input.isActive ?? true,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
    });

    revalidatePath('/owner/coupons');
    revalidatePath('/coupons');
    revalidatePath('/cart');

    return { success: true, couponId: created.id };
  } catch (error) {
    console.error('[Coupons] Failed to create coupon:', error);
    return { success: false, error: 'Failed to create coupon' };
  }
}

/**
 * Owner action: Toggle coupon active/inactive status.
 */
export async function toggleCouponStatusAction(
  couponId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission(PERMISSIONS.COUPON_MANAGE);

    await prisma.coupon.update({
      where: { id: couponId },
      data: { isActive },
    });

    revalidatePath('/owner/coupons');
    revalidatePath('/coupons');
    revalidatePath('/cart');

    return { success: true };
  } catch (error) {
    console.error('[Coupons] Failed to toggle coupon status:', error);
    return { success: false, error: 'Failed to update coupon status' };
  }
}

/**
 * Owner action: Delete a coupon.
 */
export async function deleteCouponAction(
  couponId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission(PERMISSIONS.COUPON_MANAGE);

    await prisma.coupon.delete({
      where: { id: couponId },
    });

    revalidatePath('/owner/coupons');
    revalidatePath('/coupons');
    revalidatePath('/cart');

    return { success: true };
  } catch (error) {
    console.error('[Coupons] Failed to delete coupon:', error);
    return { success: false, error: 'Failed to delete coupon' };
  }
}

/**
 * Returns branches list for branch selection checkboxes.
 */
export async function getBranchesForCouponsAction() {
  try {
    return await prisma.branch.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, city: true },
      orderBy: { name: 'asc' },
    });
  } catch {
    return [];
  }
}

/**
 * Returns users list with join date and order counts for coupon targeting.
 */
export async function getTargetableUsersAction() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        customer: {
          select: {
            orders: {
              where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] } },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      joinedAt: u.createdAt.toISOString(),
      orderCount: u.customer?.orders?.length || 0,
    }));
  } catch {
    return [];
  }
}
