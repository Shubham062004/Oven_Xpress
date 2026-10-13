import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getAttendanceRecords } from '@/lib/attendance/actions';
import type { AttendanceStatus } from '@prisma/client';

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
  const date = searchParams.get('date') || undefined;
  const employeeId = searchParams.get('employeeId') || undefined;
  const status = (searchParams.get('status') as AttendanceStatus | 'ALL') || undefined;

  const result = await getAttendanceRecords({
    branchId,
    date,
    employeeId,
    status,
  });

  return NextResponse.json(result);
}
