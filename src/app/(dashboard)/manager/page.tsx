import type { Metadata } from 'next';
import { requireAuthentication } from '@/lib/auth/guards';
import { getManagerDashboardData } from '@/lib/reports/manager-dashboard-service';
import { ManagerDashboardClient } from '@/components/dashboard/manager-dashboard-client';

export const metadata: Metadata = {
  title: 'Branch Manager Dashboard | Oven Xpress',
  description: 'Branch operational metrics, team shift status, inventory thresholds, and real-time sales ledger.',
};

export default async function ManagerDashboardPage() {
  const user = await requireAuthentication('/manager');
  const data = await getManagerDashboardData(user.id);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <ManagerDashboardClient data={data} />
    </div>
  );
}
