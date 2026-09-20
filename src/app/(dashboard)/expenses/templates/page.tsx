import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getExpenseTemplates, getExpenseCategories } from '@/lib/expenses/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { ExpenseTemplatesClient } from '@/components/expenses/expense-templates-client';

export const metadata: Metadata = {
  title: 'Recurring Expense Templates | Oven Xpress',
  description: 'Manage automated and manual recurring operational expense schedules.',
};

export default async function ExpenseTemplatesPage() {
  const user = await requirePermission(PERMISSIONS.EXPENSE_TEMPLATE_READ);

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [templatesRes, branchesRes, categoriesRes] = await Promise.all([
    getExpenseTemplates(userBranchId || undefined),
    getBranches({ status: 'ACTIVE' }),
    getExpenseCategories(false),
  ]);

  const templates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];
  const categories =
    categoriesRes.success && categoriesRes.data
      ? categoriesRes.data.map((c) => ({ id: c.id, name: c.name }))
      : [];

  const defaultBranchId = userBranchId || branches[0]?.id || '';

  return (
    <ExpenseTemplatesClient
      initialTemplates={templates}
      branches={branches}
      categories={categories}
      userPermissions={user.permissions}
      defaultBranchId={defaultBranchId}
      userBranchId={userBranchId}
    />
  );
}
