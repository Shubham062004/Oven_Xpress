import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPurchases, getPurchaseStats } from '@/lib/purchases/actions';
import { getBranches } from '@/lib/branches/actions';
import { getSuppliers } from '@/lib/suppliers/actions';
import { prisma } from '@/lib/db/prisma';
import { PurchaseListClient } from '@/components/purchases/purchase-list-client';

export const metadata: Metadata = {
  title: 'Purchase Orders',
  description: 'Track procurement, supplier delivery status, and stock inflows across branches.',
};

export default async function PurchasesPage() {
  const user = await requirePermission(PERMISSIONS.PURCHASE_READ);

  const isManager = user.role === 'MANAGER';
  let userBranchId: string | null = null;

  if (isManager) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [purchasesRes, statsRes, branchesRes, suppliersRes] = await Promise.all([
    getPurchases(),
    getPurchaseStats(),
    getBranches({ status: 'ACTIVE' }),
    getSuppliers({ status: 'ACTIVE' }),
  ]);

  const purchases = purchasesRes.success && purchasesRes.data ? purchasesRes.data : [];
  const stats =
    statsRes.success && statsRes.data
      ? statsRes.data
      : {
          totalOrders: 0,
          draftOrders: 0,
          orderedOrders: 0,
          partiallyReceivedOrders: 0,
          receivedOrders: 0,
          cancelledOrders: 0,
          totalSpend: 0,
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  const suppliers =
    suppliersRes.success && suppliersRes.data
      ? suppliersRes.data.map((s) => ({ id: s.id, name: s.name }))
      : [];

  return (
    <PurchaseListClient
      initialPurchases={purchases}
      initialStats={stats}
      branches={branches}
      suppliers={suppliers}
      isManager={isManager}
      userBranchId={userBranchId}
    />
  );
}
