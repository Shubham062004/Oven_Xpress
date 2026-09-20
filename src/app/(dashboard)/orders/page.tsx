import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getOrders, getOrderStats } from '@/lib/orders/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { OrderListClient } from '@/components/orders/order-list-client';

export const metadata: Metadata = {
  title: 'Order Management | Oven Xpress',
  description: 'Manage Dine-In, Takeaway, and Delivery orders across restaurant branches.',
};

export default async function OrdersPage() {
  const user = await requirePermission(PERMISSIONS.ORDER_READ);

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [ordersRes, statsRes, branchesRes] = await Promise.all([
    getOrders({
      branchId: userBranchId || undefined,
      page: 1,
      limit: 20,
    }),
    getOrderStats(userBranchId || undefined),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const orders = ordersRes.success && ordersRes.data ? ordersRes.data.orders : [];
  const pagination =
    ordersRes.success && ordersRes.data
      ? ordersRes.data.pagination
      : { page: 1, limit: 20, total: 0, totalPages: 1 };

  const stats =
    statsRes.success && statsRes.data
      ? statsRes.data
      : {
          todayOrders: 0,
          activeOrders: 0,
          preparingOrders: 0,
          completedToday: 0,
          todayRevenue: 0,
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  return (
    <OrderListClient
      initialOrders={orders}
      initialStats={stats}
      initialPagination={pagination}
      branches={branches}
      userBranchId={userBranchId}
    />
  );
}
