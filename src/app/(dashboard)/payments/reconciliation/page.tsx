import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getBranches } from '@/lib/branches/actions';
import { getReconciliationHistory } from '@/lib/payments/actions';
import { prisma } from '@/lib/db/prisma';
import { PaymentReconciliationClient } from '@/components/payments/payment-reconciliation-client';

export const metadata: Metadata = {
  title: 'Daily Reconciliation | Oven Xpress',
  description: 'Physical cash drawer reconciliation against system tender totals.',
};

export default async function ReconciliationPage() {
  const user = await requirePermission(PERMISSIONS.PAYMENT_RECONCILE);

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [branchesRes, historyRes] = await Promise.all([
    getBranches({ status: 'ACTIVE' }),
    getReconciliationHistory(userBranchId || undefined, 30),
  ]);

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  const defaultBranchId = userBranchId || (branches.length > 0 ? branches[0].id : '');
  const history = historyRes.success && historyRes.data ? historyRes.data : [];

  return (
    <PaymentReconciliationClient
      branches={branches}
      defaultBranchId={defaultBranchId}
      initialHistory={history}
      userBranchId={userBranchId}
    />
  );
}
