import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth/guards';
import { getAdminDashboardData } from '@/lib/reports/admin-dashboard-service';
import { AdminDashboardClient } from '@/components/dashboard/admin-dashboard-client';

export const metadata: Metadata = {
  title: 'System Admin Dashboard | Oven Xpress',
  description: 'System administration, user account management, branch networks, and security audit log streams.',
};

export default async function AdminDashboardPage() {
  await requireRole(['ADMIN', 'OWNER']);
  const data = await getAdminDashboardData();

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto">
      <AdminDashboardClient data={data} />
    </div>
  );
}
