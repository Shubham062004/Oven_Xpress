import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getBranches } from '@/lib/branches/actions';
import type { BranchStatus } from '@prisma/client';

export async function GET(request: Request) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires ADMIN or OWNER role privileges' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const status = (searchParams.get('status') as BranchStatus | 'ALL') || undefined;

  const result = await getBranches({ search, status });
  return NextResponse.json(result);
}
