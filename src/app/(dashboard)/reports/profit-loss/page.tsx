import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { prisma } from '@/lib/db/prisma';
import {
  getProfitLossData,
  getPurchaseReport,
  getSalaryBreakdown,
  getReportBranches,
} from '@/lib/reports/actions';
import { getDateRangeFromPreset } from '@/lib/reports/constants';
import { ProfitLossClient } from '@/components/reports/profit-loss-client';

export const metadata: Metadata = {
  title: 'Profit & Loss Statement | Oven Xpress',
  description:
    'Operational financial performance tracking revenue deductions, approved expenses, and payroll.',
};

interface ProfitLossPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ProfitLossPage({ searchParams }: ProfitLossPageProps) {
  const user = await requirePermission(PERMISSIONS.REPORT_FINANCE_READ);
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
      : getDateRangeFromPreset('month');

  const [plRes, purchasesRes, salariesRes, branchesRes] = await Promise.all([
    getProfitLossData({ branchId: effectiveBranchId, dateRange }),
    getPurchaseReport({ branchId: effectiveBranchId, dateRange }),
    getSalaryBreakdown({ branchId: effectiveBranchId, dateRange }),
    getReportBranches(),
  ]);

  const defaultPL = {
    grossSales: 0,
    discounts: 0,
    refunds: 0,
    taxCollected: 0,
    deliveryCharges: 0,
    netRevenue: 0,
    approvedExpenses: 0,
    expenseCategories: [],
    approvedSalary: 0,
    totalCosts: 0,
    operatingResult: 0,
    dateRange,
    branchName: null,
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <ProfitLossClient
        initialPL={plRes.success ? plRes.data : defaultPL}
        initialPurchases={purchasesRes.success ? purchasesRes.data : []}
        initialSalaries={salariesRes.success ? salariesRes.data : []}
        branches={branchesRes.success ? branchesRes.data : []}
        isBranchRestricted={isRestrictedBranchUser}
        selectedBranchId={branchId}
        initialDateRange={dateRange}
      />
    </div>
  );
}
