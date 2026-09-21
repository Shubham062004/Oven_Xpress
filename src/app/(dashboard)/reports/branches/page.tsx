import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranchesReportAction } from '@/lib/reports/actions';
import { BranchesReportClient } from '@/components/reports/branches-report-client';

export const metadata: Metadata = {
  title: 'Branch Benchmark Report | Oven Xpress',
  description: 'Factual operational comparisons across branches covering orders, sales, expenses, and results.',
};

interface BranchesReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function BranchesReportPage({ searchParams }: BranchesReportPageProps) {
  const user = await requireAuthentication('/reports/branches');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_BRANCH_READ,
      PERMISSIONS.REPORT_SALES_READ,
      PERMISSIONS.BRANCH_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as any) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getBranchesReportAction({
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load branch report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <BranchesReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId="all"
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
