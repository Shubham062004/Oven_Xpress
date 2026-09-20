import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import { getKitchenOrders } from '@/lib/kitchen/actions';
import { KitchenBoardClient } from '@/components/kitchen/kitchen-board-client';

export const metadata: Metadata = {
  title: 'Kitchen Display System (KDS) | Oven Xpress',
  description: 'Operational real-time kitchen display queue and order preparation workflow.',
};

export default async function KitchenPage() {
  // Server-side RBAC guard: User must have kitchen.read permission
  const user = await requirePermission(PERMISSIONS.KITCHEN_READ);

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  // Fetch branches accessible to the user
  const branches = await prisma.branch.findMany({
    where: {
      status: 'ACTIVE',
      ...(userBranchId ? { id: userBranchId } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: 'asc' },
  });

  // Fetch initial board state
  const initialDataRes = await getKitchenOrders(userBranchId || (branches.length > 0 ? branches[0].id : undefined));
  
  const initialData = initialDataRes.success && initialDataRes.data
    ? initialDataRes.data
    : {
        newOrders: [],
        preparingOrders: [],
        readyOrders: [],
        stats: {
          newOrdersCount: 0,
          preparingOrdersCount: 0,
          readyOrdersCount: 0,
          totalActiveCount: 0,
        },
        lastSyncedAt: new Date().toISOString(),
      };

  return (
    <main className="min-h-screen">
      <KitchenBoardClient
        initialData={initialData}
        branches={branches}
        userBranchId={userBranchId}
      />
    </main>
  );
}
