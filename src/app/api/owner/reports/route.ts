import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getExecutiveDashboardData } from '@/lib/reports/dashboard-service';

export async function GET(request: Request) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires OWNER role privileges' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || undefined;
  const preset = (searchParams.get('preset') as 'today' | '7d' | '30d') || 'today';

  const data = await getExecutiveDashboardData({
    branchId: branchId === 'all' ? undefined : branchId,
    preset,
  });

  return NextResponse.json(data);
}
