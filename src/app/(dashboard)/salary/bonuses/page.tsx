import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBonuses } from '@/lib/salary/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { BonusListClient } from '@/components/salary/bonus-list-client';
import { BonusStatus } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Bonuses & Incentives Management | Oven Xpress',
  description: 'Employee bonuses, performance awards, and sales target incentives.',
};

interface BonusesPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function BonusesPage({ searchParams }: BonusesPageProps) {
  const user = await requirePermission(PERMISSIONS.BONUS_READ);
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
  const status = resolvedParams.status as BonusStatus | undefined;
  const search = resolvedParams.search;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [bonusesRes, branchesRes] = await Promise.all([
    getBonuses({
      branchId: branchId === 'all' ? undefined : branchId,
      status,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: 20,
    }),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const bonuses = bonusesRes.success && bonusesRes.data ? bonusesRes.data.bonuses : [];
  const pagination =
    bonusesRes.success && bonusesRes.data
      ? bonusesRes.data.pagination
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
    <BonusListClient
      initialBonuses={bonuses}
      initialPagination={pagination}
      branches={branches}
      currentBranchId={branchId || ''}
      currentStatus={status}
      currentSearch={search || ''}
    />
  );
}
