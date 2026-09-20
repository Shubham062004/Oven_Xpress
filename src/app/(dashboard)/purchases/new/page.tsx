import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranches } from '@/lib/branches/actions';
import { getSuppliers } from '@/lib/suppliers/actions';
import { getIngredients } from '@/lib/menu/ingredient-actions';
import { prisma } from '@/lib/db/prisma';
import { PurchaseFormClient } from '@/components/purchases/purchase-form-client';

export const metadata: Metadata = {
  title: 'New Purchase Order',
  description: 'Create a new purchase order for ingredients and restaurant supplies.',
};

export default async function NewPurchasePage() {
  const user = await requirePermission(PERMISSIONS.PURCHASE_CREATE);

  const isManager = user.role === 'MANAGER';
  let userBranchId: string | null = null;

  if (isManager) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [branchesRes, suppliersRes, ingredientsRes] = await Promise.all([
    getBranches({ status: 'ACTIVE' }),
    getSuppliers({ status: 'ACTIVE' }),
    getIngredients({ status: 'ACTIVE' }),
  ]);

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  const suppliers =
    suppliersRes.success && suppliersRes.data
      ? suppliersRes.data.map((s) => ({ id: s.id, name: s.name }))
      : [];

  const ingredients =
    ingredientsRes.success && ingredientsRes.data
      ? ingredientsRes.data.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))
      : [];

  return (
    <PurchaseFormClient
      branches={branches}
      suppliers={suppliers}
      ingredients={ingredients}
      userBranchId={userBranchId}
      isManager={isManager}
    />
  );
}
