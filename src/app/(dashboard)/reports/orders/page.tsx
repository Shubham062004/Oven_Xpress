import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getOrdersReportAction } from '@/lib/reports/actions';
import { OrdersReportClient } from '@/components/reports/orders-report-client';

export const metadata: Metadata = {
  title: 'Orders Report | Oven Xpress',
  description: 'Detailed operational breakdown of customer orders, types, payment states, and totals.',
};

interface OrdersReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function OrdersReportPage({ searchParams }: OrdersReportPageProps) {
  const user = await requireAuthentication('/reports/orders');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_ORDERS_READ,
      PERMISSIONS.ORDER_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as any) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getOrdersReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    orderType: resolved.orderType,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load orders report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <OrdersReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentOrderType={resolved.orderType || 'all'}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
