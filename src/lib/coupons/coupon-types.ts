export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_ITEM';

export type CouponUserFilter =
  | 'ALL_USERS'
  | 'FIRST_ORDER_ONLY'
  | 'JOINED_LAST_10_DAYS'
  | 'JOINED_LAST_30_DAYS'
  | 'SPECIFIC_USERS';

export interface CouponUsageSummaryItem {
  identifier: string;
  count: number;
  totalSaved: number;
  lastUsed: string;
}

export interface CouponUsageDetail {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  orderNumber: string | null;
  discountAmount: number;
  instruction: string | null;
  createdAt: string;
}

export interface CouponWithStats {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  freeItemName: string | null;
  requiresInstruction: boolean;
  instructionPrompt: string | null;
  allBranches: boolean;
  branchIds: string[];
  userFilter: CouponUserFilter;
  targetedUserIds: string[];
  maxUsesPerUser: number | null;
  totalMaxUses: number | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  totalUsages: number;
  uniqueUsersCount: number;
  totalDiscountGiven: number;
  usages: CouponUsageDetail[];
  userUsageSummary: CouponUsageSummaryItem[];
}

export interface CreateCouponInput {
  code: string;
  title: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  freeItemName?: string;
  requiresInstruction?: boolean;
  instructionPrompt?: string;
  allBranches: boolean;
  branchIds?: string[];
  userFilter: CouponUserFilter;
  targetedUserIds?: string[];
  maxUsesPerUser?: number;
  totalMaxUses?: number;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
}
