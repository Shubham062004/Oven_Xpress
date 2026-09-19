import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import {
  getEmployees,
  getEmployeeStats,
  getActiveBranchesForSelect,
  getEmployeeDesignations,
} from '@/lib/employees/actions';
import { EmployeeListClient } from '@/components/employees/employee-list-client';

export const metadata: Metadata = {
  title: 'Employees',
  description: 'Manage staff across restaurant branches.',
};

export default async function EmployeesPage() {
  // Server-side guard: requires employee.read permission
  await requirePermission(PERMISSIONS.EMPLOYEE_READ);

  // Fetch initial data server-side in parallel
  const [employeesRes, statsRes, branchesRes, designationsRes] = await Promise.all([
    getEmployees(),
    getEmployeeStats(),
    getActiveBranchesForSelect(),
    getEmployeeDesignations(),
  ]);

  const employees = employeesRes.success ? (employeesRes.data ?? []) : [];
  const stats = statsRes.success
    ? (statsRes.data ?? { total: 0, active: 0, inactive: 0, branchCounts: {} })
    : { total: 0, active: 0, inactive: 0, branchCounts: {} };
  const branches = branchesRes.success ? (branchesRes.data ?? []) : [];
  const designations = designationsRes.success ? (designationsRes.data ?? []) : [];

  return (
    <EmployeeListClient
      initialEmployees={employees}
      initialStats={stats}
      branches={branches}
      designations={designations}
    />
  );
}
