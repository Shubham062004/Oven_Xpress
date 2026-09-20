import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getIncrements } from '@/lib/salary/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { SalaryIncrementsClient } from '@/components/salary/salary-increments-client';

export const metadata: Metadata = {
  title: 'Salary Increments & Revisions | Oven Xpress',
  description: 'Employee compensation revisions, increment tracking, and percentage differentials.',
};

interface IncrementsPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function IncrementsPage({ searchParams }: IncrementsPageProps) {
  const user = await requirePermission(PERMISSIONS.INCREMENT_READ);
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
  const search = resolvedParams.search;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [incrementsRes, branchesRes] = await Promise.all([
    getIncrements({
      branchId: branchId === 'all' ? undefined : branchId,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: 20,
    }),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const increments = incrementsRes.success && incrementsRes.data ? incrementsRes.data.increments : [];
  const pagination =
    incrementsRes.success && incrementsRes.data
      ? incrementsRes.data.pagination
      : {
          page: 1,
          pageSize: 20,
          totalItems: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, city: b.city }))
      : [];

  return (
    <SalaryIncrementsClient
      initialIncrements={increments}
      initialPagination={pagination}
      branches={branches}
      currentBranchId={branchId || ''}
      currentSearch={search || ''}
    />
  );
}
