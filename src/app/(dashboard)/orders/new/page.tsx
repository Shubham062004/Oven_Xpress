import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranches } from '@/lib/branches/actions';
import { getBranchMenuItems } from '@/lib/orders/actions';
import { getBranchTables } from '@/lib/tables/actions';
import { prisma } from '@/lib/db/prisma';
import { OrderFormClient } from '@/components/orders/order-form-client';

export const metadata: Metadata = {
  title: 'Create Order | Oven Xpress',
  description: 'Fast POS order creation for Dine-In, Takeaway, and Delivery.',
};

export default async function NewOrderPage() {
  const user = await requirePermission(PERMISSIONS.ORDER_CREATE);

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const branchesRes = await getBranches({ status: 'ACTIVE' });
  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  const initialBranchId = userBranchId || (branches.length > 0 ? branches[0].id : '');

  let initialTables: Awaited<ReturnType<typeof getBranchTables>>['data'] = [];
  let initialMenuItems: Awaited<ReturnType<typeof getBranchMenuItems>>['data'] = [];

  if (initialBranchId) {
    const [tablesRes, menuRes] = await Promise.all([
      getBranchTables(initialBranchId),
      getBranchMenuItems(initialBranchId),
    ]);
    if (tablesRes.success && tablesRes.data) initialTables = tablesRes.data;
    if (menuRes.success && menuRes.data) initialMenuItems = menuRes.data;
  }

  return (
    <OrderFormClient
      branches={branches}
      userBranchId={userBranchId}
      isManager={isRestrictedBranchUser}
      initialTables={initialTables || []}
      initialMenuItems={initialMenuItems || []}
    />
  );
}
