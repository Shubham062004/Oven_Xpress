import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuthentication } from '@/lib/auth/guards';
import { hasAnyPermission } from '@/lib/permissions/check';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getAttendanceReportAction } from '@/lib/reports/actions';
import { AttendanceReportClient } from '@/components/reports/attendance-report-client';
import type { DateRangePreset } from '@/lib/reports/types';

export const metadata: Metadata = {
  title: 'Attendance & Punctuality Report | Oven Xpress',
  description: 'Operational shift attendance records, arrival punctuality, and checkout deviations.',
};

interface AttendanceReportPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AttendanceReportPage({ searchParams }: AttendanceReportPageProps) {
  const user = await requireAuthentication('/reports/attendance');

  if (
    !hasAnyPermission(user, [
      PERMISSIONS.REPORT_ATTENDANCE_READ,
      PERMISSIONS.ATTENDANCE_READ,
    ])
  ) {
    redirect('/unauthorized');
  }

  const resolved = await searchParams;
  const page = resolved.page ? parseInt(resolved.page, 10) : 1;
  const preset = (resolved.preset as DateRangePreset) || (!resolved.startDate && !resolved.endDate ? 'today' : 'custom');

  const res = await getAttendanceReportAction({
    branchId: resolved.branchId,
    preset,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    shiftId: resolved.shiftId,
    status: resolved.status,
    search: resolved.search,
    page,
    limit: 25,
  });

  if (!res.success) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-base font-semibold text-rose-600">Failed to load attendance report</p>
        <p className="text-sm mt-1">{res.error || 'Unknown error occurred.'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <AttendanceReportClient
        rows={res.data.rows}
        summary={res.data.summary}
        pagination={res.data.pagination}
        branches={res.data.branches}
        shifts={res.data.shifts}
        selectedBranchId={res.data.selectedBranchId}
        isBranchRestricted={res.data.isBranchRestricted}
        selectedPreset={preset}
        startDate={resolved.startDate}
        endDate={resolved.endDate}
        currentShift={resolved.shiftId || 'all'}
        currentStatus={resolved.status || 'all'}
        currentSearch={resolved.search || ''}
      />
    </div>
  );
}
