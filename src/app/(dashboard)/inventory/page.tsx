import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getInventoryDashboardData } from '@/lib/inventory/actions';
import { InventoryDashboardClient } from '@/components/inventory/inventory-dashboard-client';

export const metadata: Metadata = {
  title: 'Inventory & Stock Management',
  description: 'Track branch-specific raw materials, stock receipts, wastage, branch transfers, and physical reconciliations.',
};

export default async function InventoryPage() {
  await requirePermission(PERMISSIONS.INVENTORY_READ);

  const res = await getInventoryDashboardData();

  const data = res.success && res.data
    ? res.data
    : {
        stats: {
          totalTrackedItems: 0,
          lowStockItems: 0,
          outOfStockItems: 0,
          todayReceiptsCount: 0,
          todayWastageCount: 0,
          activeBranchesCount: 0,
        },
        items: [],
        recentTransactions: [],
        branches: [],
        ingredients: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 1,
        },
      };

  return <InventoryDashboardClient initialData={data} />;
}
