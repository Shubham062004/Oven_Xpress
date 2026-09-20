import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { hasPermission } from '@/lib/permissions/check';
import { prisma } from '@/lib/db/prisma';
import { getDashboardData, getReportBranches } from '@/lib/reports/actions';
import { DashboardClient } from '@/components/reports/dashboard-client';

export const metadata: Metadata = {
  title: 'Dashboard | Oven Xpress',
  description:
    'Executive overview, real-time sales metrics, operational KPIs, and daily performance.',
};

interface DashboardPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requirePermission(PERMISSIONS.DASHBOARD_READ);
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

  const canViewBranches = hasPermission(user, PERMISSIONS.REPORT_BRANCH_READ);

  const [dashRes, branchesRes] = await Promise.all([
    getDashboardData({ branchId: effectiveBranchId }),
    getReportBranches(),
  ]);

  const defaultData = {
    todaySales: 0,
    todayOrders: 0,
    todayExpenses: 0,
    operatingResult: 0,
    paymentBreakdown: [],
    orderTypeBreakdown: [],
    branchOverview: [],
    topSellingItems: [],
    lowStockCount: 0,
    pendingExpenseApprovals: 0,
    pendingSalaryReviews: 0,
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <DashboardClient
        initialData={dashRes.success ? dashRes.data : defaultData}
        branches={branchesRes.success ? branchesRes.data : []}
        userName={user.name}
        userRole={user.role}
        isBranchRestricted={isRestrictedBranchUser}
        selectedBranchId={branchId}
        canViewBranches={canViewBranches}
      />
    </div>
  );
}
