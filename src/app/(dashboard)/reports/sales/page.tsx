import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getSalesReportAction } from '@/lib/reports/actions';
import { SalesReportClient } from '@/components/reports/sales-report-client';

export const metadata: Metadata = {
  title: 'Sales Report | Oven Xpress',
  description: 'View sales, orders, discounts, refunds, and net revenue across branches.',
};

interface SalesReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const user = await requireAuthentication('/reports/sales');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_SALES_READ,
      PERMISSIONS.REPORT_FINANCE_READ,
      PERMISSIONS.ORDER_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as any) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getSalesReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load sales report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <SalesReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
      />
    </div>
  );
}
