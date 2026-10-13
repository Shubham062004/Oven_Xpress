import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getManagerDashboardData } from '@/lib/reports/manager-dashboard-service';

export async function GET() {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires MANAGER role privileges' },
      { status: 403 }
    );
  }

  const data = await getManagerDashboardData(user.id);
  return NextResponse.json({ success: true, data });
}
