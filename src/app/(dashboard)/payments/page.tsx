import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getPayments, getPaymentStats } from '@/lib/payments/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { PaymentListClient } from '@/components/payments/payment-list-client';

export const metadata: Metadata = {
  title: 'Payment Management | Oven Xpress',
  description: 'Audit-grade payment ledger, tender transactions, refunds, and daily cash reconciliation.',
};

export default async function PaymentsPage() {
  const user = await requirePermission(PERMISSIONS.PAYMENT_READ);

  const isRestrictedBranchUser = user.role === 'MANAGER' || user.role === 'STAFF';
  let userBranchId: string | null = null;

  if (isRestrictedBranchUser) {
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { branchId: true },
    });
    userBranchId = employee?.branchId ?? null;
  }

  const [paymentsRes, statsRes, branchesRes] = await Promise.all([
    getPayments({
      branchId: userBranchId || undefined,
      page: 1,
      limit: 20,
    }),
    getPaymentStats(userBranchId || undefined),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const payments = paymentsRes.success && paymentsRes.data ? paymentsRes.data.payments : [];
  const pagination =
    paymentsRes.success && paymentsRes.data
      ? paymentsRes.data.pagination
      : { page: 1, limit: 20, total: 0, totalPages: 1 };

  const stats =
    statsRes.success && statsRes.data
      ? statsRes.data
      : {
          totalSuccessfulPayments: { count: 0, amount: 0 },
          cash: { count: 0, amount: 0 },
          upi: { count: 0, amount: 0 },
          card: { count: 0, amount: 0 },
          online: { count: 0, amount: 0 },
          other: { count: 0, amount: 0 },
          failed: { count: 0, amount: 0 },
          refunded: { count: 0, amount: 0 },
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, code: b.code }))
      : [];

  return (
    <PaymentListClient
      initialPayments={payments}
      initialStats={stats}
      initialPagination={pagination}
      branches={branches}
      userBranchId={userBranchId}
    />
  );
}
