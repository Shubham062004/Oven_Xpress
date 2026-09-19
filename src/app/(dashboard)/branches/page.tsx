import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranches, getBranchStats } from '@/lib/branches/actions';
import { BranchListClient } from '@/components/branches/branch-list-client';

export const metadata: Metadata = {
  title: 'Branches',
  description: 'Manage restaurant locations and branch information.',
};

export default async function BranchesPage() {
  // Server-side guard: requires branch.read permission
  await requirePermission(PERMISSIONS.BRANCH_READ);

  // Fetch initial data server-side
  const [branchesResult, statsResult] = await Promise.all([
    getBranches(),
    getBranchStats(),
  ]);

  const branches = branchesResult.success ? (branchesResult.data ?? []) : [];
  const stats = statsResult.success
    ? (statsResult.data ?? { total: 0, active: 0, inactive: 0 })
    : { total: 0, active: 0, inactive: 0 };

  return <BranchListClient initialBranches={branches} initialStats={stats} />;
}
