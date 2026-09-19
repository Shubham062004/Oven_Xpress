import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getEmployeeById, getActiveBranchesForSelect } from '@/lib/employees/actions';
import { EmployeeDetailClient } from '@/components/employees/employee-detail-client';

interface EmployeeDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: EmployeeDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getEmployeeById(id);

  if (!result.success || !result.data) {
    return { title: 'Employee Not Found' };
  }

  return {
    title: `${result.data.firstName} ${result.data.lastName} (${result.data.employeeCode})`,
    description: `Staff profile for ${result.data.firstName} ${result.data.lastName} - ${result.data.designation} at ${result.data.branch.name}`,
  };
}

export default async function EmployeeDetailPage({
  params,
}: EmployeeDetailPageProps) {
  // Server-side guard
  await requirePermission(PERMISSIONS.EMPLOYEE_READ);

  const { id } = await params;
  const [employeeResult, branchesResult] = await Promise.all([
    getEmployeeById(id),
    getActiveBranchesForSelect(),
  ]);

  if (!employeeResult.success || !employeeResult.data) {
    notFound();
  }

  const branches = branchesResult.success ? (branchesResult.data ?? []) : [];

  return <EmployeeDetailClient employee={employeeResult.data} branches={branches} />;
}
