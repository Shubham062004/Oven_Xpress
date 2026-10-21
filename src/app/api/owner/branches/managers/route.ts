import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getEligibleBranchManagers } from '@/lib/branches/actions';

export async function GET() {
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

  const result = await getEligibleBranchManagers();
  return NextResponse.json(result);
}
