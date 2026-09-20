import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getExpenses, getExpenseStats, getExpenseCategories } from '@/lib/expenses/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { ExpenseListClient } from '@/components/expenses/expense-list-client';
import { ExpenseStatus, PaymentMethod } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Expenses Management | Oven Xpress',
  description: 'Branch-level expense ledger, approval workflows, recurring expense templates, and expenditure tracking.',
};

interface ExpensesPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const user = await requirePermission(PERMISSIONS.EXPENSE_READ);
  const resolvedParams = await searchParams;

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const branchId = userBranchId || resolvedParams.branchId;
  const categoryId = resolvedParams.categoryId;
  const status = resolvedParams.status as ExpenseStatus | undefined;
  const paymentMethod = resolvedParams.paymentMethod as PaymentMethod | undefined;
  const startDate = resolvedParams.startDate;
  const endDate = resolvedParams.endDate;
  const search = resolvedParams.search;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [expensesRes, statsRes, branchesRes, categoriesRes] = await Promise.all([
    getExpenses({
      branchId: branchId === 'all' ? undefined : branchId,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      status,
      paymentMethod,
      startDate,
      endDate,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: 20,
    }),
    getExpenseStats(branchId === 'all' ? undefined : branchId),
    getBranches({ status: 'ACTIVE' }),
    getExpenseCategories(false),
  ]);

  const expenses = expensesRes.success && expensesRes.data ? expensesRes.data.expenses : [];
  const pagination =
    expensesRes.success && expensesRes.data
      ? expensesRes.data.pagination
      : { page: 1, pageSize: 20, total: 0, totalPages: 1 };

  const stats =
    statsRes.success && statsRes.data
      ? statsRes.data
      : {
          todayTotal: 0,
          todayCount: 0,
          monthTotal: 0,
          monthCount: 0,
          pendingTotal: 0,
          pendingCount: 0,
          approvedTotal: 0,
          approvedCount: 0,
          topCategories: [],
        };

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
    <ExpenseListClient
      initialExpenses={expenses}
      initialPagination={pagination}
      initialStats={stats}
      branches={branches}
      categories={categories}
      defaultBranchId={defaultBranchId}
      userBranchId={userBranchId}
      userPermissions={user.permissions}
    />
  );
}
