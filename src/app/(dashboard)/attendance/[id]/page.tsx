import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  getAttendanceById,
  getAuthorizedBranches,
  getAuthorizedEmployees,
  getShifts,
} from '@/lib/attendance/actions';
import { AttendanceDetailClient } from '@/components/attendance/attendance-detail-client';

interface AttendanceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: AttendanceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getAttendanceById(id);

  if (!result.success || !result.data) {
    return { title: 'Attendance Record Not Found' };
  }

  const record = result.data;
  return {
    title: `Attendance: ${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeCode})`,
    description: `Attendance record for ${record.employee.firstName} ${record.employee.lastName} at ${record.branch.name}`,
  };
}

export default async function AttendanceDetailPage({
  params,
}: AttendanceDetailPageProps) {
  // Server-side guard
  await requirePermission(PERMISSIONS.ATTENDANCE_READ);

  const { id } = await params;

  const [recordResult, branchesResult, employeesResult, shiftsResult] =
    await Promise.all([
      getAttendanceById(id),
      getAuthorizedBranches(),
      getAuthorizedEmployees(),
      getShifts(),
    ]);

  if (!recordResult.success || !recordResult.data) {
    notFound();
  }

  const branches = branchesResult.success ? (branchesResult.data ?? []) : [];
  const employees = employeesResult.success ? (employeesResult.data ?? []) : [];
  const shifts = shiftsResult.success ? (shiftsResult.data ?? []) : [];

  return (
    <AttendanceDetailClient
      record={recordResult.data}
      branches={branches}
      employees={employees}
      shifts={shifts}
    />
  );
}
