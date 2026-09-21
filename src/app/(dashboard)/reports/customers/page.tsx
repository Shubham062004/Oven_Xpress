import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getCustomersReportAction } from '@/lib/reports/actions';
import { CustomersReportClient } from '@/components/reports/customers-report-client';

export const metadata: Metadata = {
  title: 'Customer Activity Report | Oven Xpress',
  description: 'Aggregated customer engagement metrics, transaction counts, and feedback history.',
};

interface CustomersReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function CustomersReportPage({ searchParams }: CustomersReportPageProps) {
  const user = await requireAuthentication('/reports/customers');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_CUSTOMER_READ,
      PERMISSIONS.CUSTOMER_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;

  const res = await getCustomersReportAction({
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load customers report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <CustomersReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId="all"
        isBranchRestricted={false}
        selectedPreset="today"
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
