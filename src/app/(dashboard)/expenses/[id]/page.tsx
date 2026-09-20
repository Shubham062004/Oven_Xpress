import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getExpenseById, getExpenseCategories } from '@/lib/expenses/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { ExpenseDetailClient } from '@/components/expenses/expense-detail-client';

interface ExpenseDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ExpenseDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const res = await getExpenseById(id);

  if (!res.success || !res.data) {
    return { title: 'Expense Not Found | Oven Xpress' };
  }

  return {
    title: `${res.data.expenseNumber} - Expense Details | Oven Xpress`,
    description: `Operational details, approval workflow, and audit trail for ${res.data.expenseNumber}.`,
  };
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const user = await requirePermission(PERMISSIONS.EXPENSE_READ);
  const { id } = await params;

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [expenseRes, branchesRes, categoriesRes] = await Promise.all([
    getExpenseById(id),
    getBranches({ status: 'ACTIVE' }),
    getExpenseCategories(false),
  ]);

  if (!expenseRes.success || !expenseRes.data) {
    notFound();
  }

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  const categories =
    categoriesRes.success && categoriesRes.data
      ? categoriesRes.data.map((c) => ({ id: c.id, name: c.name }))
      : [];

  return (
    <ExpenseDetailClient
      expense={expenseRes.data}
      userPermissions={user.permissions}
      branches={branches}
      categories={categories}
      userBranchId={userBranchId}
    />
  );
}
