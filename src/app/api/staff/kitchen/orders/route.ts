import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getKitchenOrders } from '@/lib/kitchen/actions';

export async function GET(request: Request) {
  const { user } = await validateSession();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Any authenticated user with staff/manager/admin/owner role can view their kitchen queue
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId') || undefined;
  const orderType = searchParams.get('orderType') || undefined;

  const result = await getKitchenOrders(branchId, orderType);
  return NextResponse.json(result);
}
