import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getAdminDashboardData } from '@/lib/reports/admin-dashboard-service';

export async function GET() {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires ADMIN role privileges' },
      { status: 403 }
    );
  }

  const data = await getAdminDashboardData();
  return NextResponse.json({ success: true, data });
}
