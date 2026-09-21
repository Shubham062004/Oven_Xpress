import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getWastageReportAction } from '@/lib/reports/actions';
import { WastageReportClient } from '@/components/reports/wastage-report-client';

export const metadata: Metadata = {
  title: 'Wastage & Damage Report | Oven Xpress',
  description: 'Operational scrap, spoilage, and ingredient damage ledger from inventory movements.',
};

interface WastageReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function WastageReportPage({ searchParams }: WastageReportPageProps) {
  const user = await requireAuthentication('/reports/wastage');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_WASTAGE_READ,
      PERMISSIONS.REPORT_INVENTORY_READ,
      PERMISSIONS.INVENTORY_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as any) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getWastageReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    reason: resolved.reason,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load wastage report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <WastageReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentReason={resolved.reason || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
