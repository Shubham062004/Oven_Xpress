import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getOrders } from '@/lib/orders/actions';
import type { OrderType, OrderStatus } from '@prisma/client';

export async function GET(request: Request) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Requires MANAGER or OWNER role privileges' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || undefined;
  const orderType = (searchParams.get('orderType') as OrderType) || undefined;
  const status = (searchParams.get('status') as OrderStatus) || undefined;
  const search = searchParams.get('search') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;

  const result = await getOrders({
    branchId,
    orderType,
    status,
    search,
    page,
    limit,
  });

  return NextResponse.json(result);
}
