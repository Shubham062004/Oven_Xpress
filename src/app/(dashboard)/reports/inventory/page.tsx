import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getInventoryReportAction } from '@/lib/reports/actions';
import { InventoryReportClient } from '@/components/reports/inventory-report-client';
import type { DateRangePreset } from '@/lib/reports/types';

export const metadata: Metadata = {
  title: 'Inventory & Stock Movements Report | Oven Xpress',
  description: 'Current ingredient stock levels, minimum thresholds, and detailed stock transaction movements.',
};

interface InventoryReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function InventoryReportPage({ searchParams }: InventoryReportPageProps) {
  const user = await requireAuthentication('/reports/inventory');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_INVENTORY_READ,
      PERMISSIONS.INVENTORY_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as DateRangePreset) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');
  const view = (resolved.view === 'movements' ? 'movements' : 'stock') as 'stock' | 'movements';

  const res = await getInventoryReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    categoryId: resolved.categoryId,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load inventory report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <InventoryReportClient
        currentStockRows={res.data.currentStockRows}
        movementRows={res.data.movementRows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        movementsPagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        activeTab={view}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
