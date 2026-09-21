import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getExpensesReportAction } from '@/lib/reports/actions';
import { ExpensesReportClient } from '@/components/reports/expenses-report-client';

export const metadata: Metadata = {
  title: 'Expense Report | Oven Xpress',
  description: 'Operating expense ledger, vendor disbursements, categories, and approval states.',
};

interface ExpensesReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ExpensesReportPage({ searchParams }: ExpensesReportPageProps) {
  const user = await requireAuthentication('/reports/expenses');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_EXPENSE_READ,
      PERMISSIONS.REPORT_FINANCE_READ,
      PERMISSIONS.EXPENSE_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as any) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getExpensesReportAction({
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

  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load expenses report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <ExpensesReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        categories={res.data.categories}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentCategory={resolved.categoryId || 'all'}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
