import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PERMISSIONS } from '@/lib/permissions/definitions';
import { getCustomers } from '@/lib/customers/actions';
import { getBranches } from '@/lib/branches/actions';
import { prisma } from '@/lib/db/prisma';
import { CustomerListClient } from '@/components/customers/customer-list-client';
import type { CustomerStatus, PaginationMeta } from '@/lib/customers/types';

export const metadata: Metadata = {
  title: 'Customer Directory | Oven Xpress',
  description: 'Manage customers, order histories, total spend, and contact records across branches.',
};

interface CustomersPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await requirePermission(PERMISSIONS.CUSTOMER_READ);
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
  const status = resolvedParams.status as CustomerStatus | undefined;
  const search = resolvedParams.search;
  const page = resolvedParams.page ? parseInt(resolvedParams.page, 10) : 1;

  const [customersRes, branchesRes] = await Promise.all([
    getCustomers({
      branchId: branchId === 'all' ? undefined : branchId,
      status,
      search,
      page: isNaN(page) ? 1 : page,
      pageSize: 20,
    }),
    getBranches({ status: 'ACTIVE' }),
  ]);

  const customers =
    customersRes.success && customersRes.data ? customersRes.data.items : [];
  const pagination: PaginationMeta =
    customersRes.success && customersRes.data
      ? customersRes.data.pagination
      : {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        };

  const branches =
    branchesRes.success && branchesRes.data
      ? branchesRes.data.map((b) => ({ id: b.id, name: b.name, city: b.city }))
      : [];

  return (
    <CustomerListClient
      initialCustomers={customers}
      initialPagination={pagination}
      branches={branches}
      currentBranchId={branchId || ''}
      currentStatus={status}
      currentSearch={search || ''}
    />
  );
}
