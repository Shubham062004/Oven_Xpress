import type { Metadata } from 'next';
import { requireAuthentication } from '@/lib/auth/guards';
import { getStaffDashboardData } from '@/lib/reports/staff-dashboard-service';
import { StaffDashboardClient } from '@/components/dashboard/staff-dashboard-client';

export const metadata: Metadata = {
  title: 'Staff Terminal Dashboard | Oven Xpress',
  description: 'Branch staff operations: shift clock status, fast POS order entry, and kitchen queues.',
};

export default async function StaffDashboardPage() {
  const user = await requireAuthentication('/staff');
  const data = await getStaffDashboardData(user.id);

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto">
      <StaffDashboardClient data={data} />
    </div>
  );
}
