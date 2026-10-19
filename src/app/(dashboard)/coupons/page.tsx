import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  getOwnerCouponsAction,
  getBranchesForCouponsAction,
  getTargetableUsersAction,
} from '@/lib/coupons/coupon-actions';
import { OwnerCouponsClient } from '@/components/dashboard/owner-coupons-client';

export const metadata: Metadata = {
  title: 'Coupons & Offers Management | Oven Xpress Owner',
  description:
    'Manage promotional coupons, audience cohorts, branch restrictions, and inspect usage analytics.',
};

export default async function CouponsDashboardPage() {
  await requirePermission(PERMISSIONS.COUPON_READ);

  const [couponsRes, branches, targetableUsers] = await Promise.all([
    getOwnerCouponsAction(),
    getBranchesForCouponsAction(),
    getTargetableUsersAction(),
  ]);

  const initialCoupons = couponsRes.success && couponsRes.data ? couponsRes.data : [];

  return (
    <OwnerCouponsClient
      initialCoupons={initialCoupons}
      branches={branches}
      targetableUsers={targetableUsers}
    />
  );
}
