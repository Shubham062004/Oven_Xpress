import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getExpenseCategories } from '@/lib/expenses/actions';
import { ExpenseCategoriesClient } from '@/components/expenses/expense-categories-client';

export const metadata: Metadata = {
  title: 'Expense Categories | Oven Xpress',
  description: 'Manage accounting classifications and review total expense allocation.',
};

export default async function ExpenseCategoriesPage() {
  const user = await requirePermission(PERMISSIONS.EXPENSE_CATEGORY_READ);
  const categoriesRes = await getExpenseCategories(true);

  const categories = categoriesRes.success && categoriesRes.data ? categoriesRes.data : [];

  return (
    <ExpenseCategoriesClient
      initialCategories={categories}
      userPermissions={user.permissions}
    />
  );
}
