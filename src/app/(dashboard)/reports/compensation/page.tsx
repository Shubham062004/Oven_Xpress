import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getCompensationReportAction } from '@/lib/reports/actions';
import { CompensationReportClient } from '@/components/reports/compensation-report-client';
import type { DateRangePreset } from '@/lib/reports/types';

export const metadata: Metadata = {
  title: 'Salary & Compensation Report | Oven Xpress',
  description: 'Confidential operational payroll statements, performance bonuses, incentives, and net payouts.',
};

interface CompensationReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function CompensationReportPage({ searchParams }: CompensationReportPageProps) {
  const user = await requireAuthentication('/reports/compensation');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_COMPENSATION_READ,
      PERMISSIONS.REPORT_FINANCE_READ,
      PERMISSIONS.SALARY_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as DateRangePreset) || (!resolved.startDate && !resolved.endDate ? 'month' : 'custom');

  const res = await getCompensationReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load compensation report</p>
        <p className="text-sm mt-1">{res.error || 'Access denied or unknown error.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <CompensationReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
