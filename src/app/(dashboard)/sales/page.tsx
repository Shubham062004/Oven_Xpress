import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { hasPermission } from '@/lib/permissions/check';
import { prisma } from '@/lib/db/prisma';
import {
  getSalesOverview,
  getDailySalesMetrics,
  getOrderTypeSales,
  getPaymentMethodBreakdown,
  getHourlySalesBreakdown,
  getRevenueOverTime,
  getBranchSalesComparison,
  getReportBranches,
} from '@/lib/reports/actions';
import { getDateRangeFromPreset } from '@/lib/reports/constants';
import { SalesOverviewClient } from '@/components/reports/sales-overview-client';

export const metadata: Metadata = {
  title: 'Sales & Revenue Reports | Oven Xpress',
  description:
    'Operational sales metrics, order distributions, payment reconciliation, and revenue trends.',
};

interface SalesPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const user = await requirePermission(PERMISSIONS.REPORT_SALES_READ);
  const resolvedParams = await searchParams;

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const branchId = userBranchId || resolvedParams.branchId || 'all';
  const effectiveBranchId = branchId === 'all' ? undefined : branchId;

  const dateRange =
    resolvedParams.startDate && resolvedParams.endDate
      ? { startDate: resolvedParams.startDate, endDate: resolvedParams.endDate }
      : getDateRangeFromPreset('today');

  const canViewBranchComparison = hasPermission(user, PERMISSIONS.REPORT_BRANCH_READ);

  const [
    overviewRes,
    dailyRes,
    orderTypeRes,
    paymentRes,
    hourlyRes,
    trendRes,
    branchCompRes,
    branchesRes,
  ] = await Promise.all([
    getSalesOverview({ branchId: effectiveBranchId, dateRange }),
    getDailySalesMetrics({ branchId: effectiveBranchId, dateRange }),
    getOrderTypeSales({ branchId: effectiveBranchId, dateRange }),
    getPaymentMethodBreakdown({ branchId: effectiveBranchId, dateRange }),
    getHourlySalesBreakdown({ branchId: effectiveBranchId, dateRange }),
    getRevenueOverTime({ branchId: effectiveBranchId, dateRange }),
    canViewBranchComparison
      ? getBranchSalesComparison({ dateRange })
      : Promise.resolve({ success: true, data: [] }),
    getReportBranches(),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <SalesOverviewClient
        initialOverview={
          overviewRes.success
            ? overviewRes.data
            : {
                totalOrders: 0,
                completedOrders: 0,
                cancelledOrders: 0,
                grossSales: 0,
                discounts: 0,
                taxCollected: 0,
                deliveryCharges: 0,
                refunds: 0,
                netRevenue: 0,
                successfulPayments: 0,
                failedPayments: 0,
                approvedExpenses: 0,
                approvedSalary: 0,
                operatingResult: 0,
                averageOrderValue: 0,
              }
        }
        initialDailySales={dailyRes.success ? dailyRes.data : []}
        initialOrderTypes={orderTypeRes.success ? orderTypeRes.data : []}
        initialPaymentMethods={
          paymentRes.success
            ? paymentRes.data
            : { methods: [], failedPayments: { count: 0, amount: 0 }, refundedAmount: 0 }
        }
        initialHourly={hourlyRes.success ? hourlyRes.data : []}
        initialRevenueTrend={trendRes.success ? trendRes.data : []}
        initialBranchComparison={branchCompRes.success ? branchCompRes.data : []}
        branches={branchesRes.success ? branchesRes.data : []}
        canViewBranchComparison={canViewBranchComparison}
        isBranchRestricted={isRestrictedBranchUser}
        selectedBranchId={branchId}
        initialDateRange={dateRange}
      />
    </div>
  );
}
