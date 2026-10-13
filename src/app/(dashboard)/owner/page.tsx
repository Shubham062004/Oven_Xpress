import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getExecutiveDashboardData } from '@/lib/reports/dashboard-service';
import { OwnerDashboardClient } from '@/components/dashboard/owner-dashboard-client';
import type { DashboardDatePreset } from '@/lib/reports/dashboard-types';

export const metadata: Metadata = {
  title: 'Owner Executive Dashboard | Oven Xpress',
  description:
    'Executive overview of multi-branch business performance, sales velocity, profit, and operations.',
};

interface OwnerDashboardPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function OwnerDashboardPage({ searchParams }: OwnerDashboardPageProps) {
  await requirePermission(PERMISSIONS.DASHBOARD_READ);

  const resolvedParams = await searchParams;
  const branchId = resolvedParams.branchId || 'all';
  const preset = (resolvedParams.preset as DashboardDatePreset) || 'today';
  const from = resolvedParams.from;
  const to = resolvedParams.to;

  const dashRes = await getExecutiveDashboardData({
    branchId: branchId === 'all' ? undefined : branchId,
    preset,
    from,
    to,
  });

  if (!dashRes.success) {
    return (
      <div className="w-full min-w-0 max-w-7xl mx-auto">
        <div className="p-6 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-center space-y-2">
          <h2 className="text-lg font-bold">Failed to load owner dashboard</h2>
          <p className="text-sm">{dashRes.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto">
      <OwnerDashboardClient initialData={dashRes.data} />
    </div>
  );
}
