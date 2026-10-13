import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getBranches, createBranch } from '@/lib/branches/actions';
import type { BranchStatus } from '@prisma/client';

export async function GET(request: Request) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires OWNER or ADMIN role privileges' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const status = (searchParams.get('status') as BranchStatus | 'ALL') || undefined;

  const result = await getBranches({ search, status });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only OWNER can create new branches' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await createBranch(body);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request payload' },
      { status: 400 }
    );
  }
}
