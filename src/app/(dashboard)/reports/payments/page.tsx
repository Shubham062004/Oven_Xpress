import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPaymentsReportAction } from '@/lib/reports/actions';
import { PaymentsReportClient } from '@/components/reports/payments-report-client';
import type { DateRangePreset } from '@/lib/reports/types';

export const metadata: Metadata = {
  title: 'Payments Report | Oven Xpress',
  description: 'Reconciled payment ledger, tender breakdown, settlements, and refund deductions.',
};

interface PaymentsReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function PaymentsReportPage({ searchParams }: PaymentsReportPageProps) {
  const user = await requireAuthentication('/reports/payments');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_PAYMENT_READ,
      PERMISSIONS.REPORT_FINANCE_READ,
      PERMISSIONS.PAYMENT_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as DateRangePreset) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getPaymentsReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    paymentMethod: resolved.paymentMethod,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load payments report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <PaymentsReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentMethod={resolved.paymentMethod || 'all'}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
