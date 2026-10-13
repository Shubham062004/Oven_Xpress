import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getStaffDashboardData } from '@/lib/reports/staff-dashboard-service';

export async function GET() {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const data = await getStaffDashboardData(user.id);
  return NextResponse.json({ success: true, data });
}
