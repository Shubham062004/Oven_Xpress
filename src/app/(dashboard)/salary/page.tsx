import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getSalaryRecords, getSalaryDashboardStats } from '@/lib/salary/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { SalaryListClient } from '@/components/salary/salary-list-client';
import { SalaryRecordStatus } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Salary & Compensation Ledger | Oven Xpress',
  description: 'Employee compensation history, salary period records, bonuses, and increments.',
};

interface SalaryPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function SalaryPage({ searchParams }: SalaryPageProps) {
  const user = await requirePermission(PERMISSIONS.SALARY_READ);
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

  const branchId = userBranchId || resolvedParams.branchId;
  const status = resolvedParams.status as SalaryRecordStatus | undefined;
  const search = resolvedParams.search;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [recordsRes, statsRes, branchesRes] = await Promise.all([
    getSalaryRecords({
      branchId: branchId === 'all' ? undefined : branchId,
      status,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: 15,
    }),
    getSalaryDashboardStats(branchId === 'all' ? undefined : branchId),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const records = recordsRes.success && recordsRes.data ? recordsRes.data.records : [];
  const pagination =
    recordsRes.success && recordsRes.data
      ? recordsRes.data.pagination
      : {
          page: 1,
          pageSize: 15,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        };

  const stats =
    statsRes.success && statsRes.data
      ? statsRes.data
      : {
          activeEmployeesWithSalary: 0,
          pendingSalaryReviews: 0,
          approvedSalaryRecords: 0,
          totalApprovedBonuses: 0,
          recentIncrementsCount: 0,
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, city: b.city }))
      : [];

  return (
    <SalaryListClient
      initialRecords={records}
      initialPagination={pagination}
      stats={stats}
      branches={branches}
      currentBranchId={branchId || ''}
      currentStatus={status}
      currentSearch={search || ''}
    />
  );
}
