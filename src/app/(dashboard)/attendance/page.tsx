import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  getAttendanceRecords,
  getAttendanceSummary,
  getShifts,
  getAuthorizedBranches,
  getAuthorizedEmployees,
} from '@/lib/attendance/actions';
import { AttendanceListClient } from '@/components/attendance/attendance-list-client';

export const metadata: Metadata = {
  title: 'Attendance',
  description: 'Monitor employee attendance across restaurant branches.',
};

export default async function AttendancePage() {
  // Server-side guard: requires attendance.read permission
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);

  const todayDate = new Date().toISOString().split('T')[0];

  // Fetch initial data server-side in parallel
  const [
    attendanceRes,
    summaryRes,
    shiftsRes,
    branchesRes,
    employeesRes,
  ] = await Promise.all([
    getAttendanceRecords({ date: todayDate }),
    getAttendanceSummary(todayDate),
    getShifts(),
    getAuthorizedBranches(),
    getAuthorizedEmployees(),
  ]);

  const initialAttendance = attendanceRes.success ? (attendanceRes.data ?? []) : [];
  const initialSummary = summaryRes.success
    ? (summaryRes.data ?? {
        date: todayDate,
        totalEmployees: 0,
        present: 0,
        absent: 0,
        halfDay: 0,
        leave: 0,
        late: 0,
        earlyDeparture: 0,
      })
    : {
        date: todayDate,
        totalEmployees: 0,
        present: 0,
        absent: 0,
        halfDay: 0,
        leave: 0,
        late: 0,
        earlyDeparture: 0,
      };
  const initialShifts = shiftsRes.success ? (shiftsRes.data ?? []) : [];
  const branches = branchesRes.success ? (branchesRes.data ?? []) : [];
  const employees = employeesRes.success ? (employeesRes.data ?? []) : [];

  return (
    <AttendanceListClient
      initialAttendance={initialAttendance}
      initialSummary={initialSummary}
      initialShifts={initialShifts}
      branches={branches}
      employees={employees}
      todayDate={todayDate}
    />
  );
}
