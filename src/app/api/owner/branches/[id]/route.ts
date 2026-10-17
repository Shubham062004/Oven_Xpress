import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getBranchById, updateBranch, deleteBranch } from '@/lib/branches/actions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const result = await getBranchById(id);
  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}

export async function PUT(request: Request, { params }: RouteParams) {
  return handleUpdate(request, params);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  return handleUpdate(request, params);
}

async function handleUpdate(request: Request, paramsPromise: Promise<{ id: string }>) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only OWNER can modify branches and manager assignments' },
      { status: 403 }
    );
  }

  try {
    const { id } = await paramsPromise;
    const body = await request.json();
    const result = await updateBranch(id, body);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request payload' },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Only OWNER can delete or deactivate branches' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const result = await deleteBranch(id);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
