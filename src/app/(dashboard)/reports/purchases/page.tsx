import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPurchasesReportAction } from '@/lib/reports/actions';
import { PurchasesReportClient } from '@/components/reports/purchases-report-client';
import type { DateRangePreset } from '@/lib/reports/types';

export const metadata: Metadata = {
  title: 'Purchase Report | Oven Xpress',
  description: 'Supplier procurement orders, fulfillment tracking, and received goods value.',
};

interface PurchasesReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function PurchasesReportPage({ searchParams }: PurchasesReportPageProps) {
  const user = await requireAuthentication('/reports/purchases');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_PURCHASE_READ,
      PERMISSIONS.PURCHASE_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as DateRangePreset) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getPurchasesReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    supplierId: resolved.supplierId,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load purchases report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <PurchasesReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        suppliers={res.data.suppliers}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentSupplier={resolved.supplierId || 'all'}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
